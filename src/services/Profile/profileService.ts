import { Types } from 'mongoose';
import { Profile, UserProfile, IUserProfile, UserField } from '../../models/index.js';
import { UserRole } from '../../models/UserProfile.js';
import { redisCache } from '../../config/redis.js';

interface ProfileUpdateData {
  displayName?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  isPremium?: boolean;
  location?: string;
  phone?: string;
  address?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  country?: string;
  proficiencyLevel?: string;
  personalInfo?: any;
  experienceLevel?: string;
  field?: UserField;
  goals?: string[];
  interests?: string[];
  professionalInfo?: any;
  education?: any[];
  certifications?: any[];
  socialLinks?: any;
  learningPreferences?: any;
  privacySettings?: any;
}

export class ProfileService {

  /**
   * Get user profile with caching
   */
  async getProfile(userId: string): Promise<IUserProfile | null> {
    try {
      // Try cache first
      const cacheKey = `profile:${userId}`;
      const cachedProfile = await redisCache.get(cacheKey);

      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }

      // Query database with optimized population
      const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) })
        .populate('userId', 'email isActive lastLoginAt')
        .lean<IUserProfile | null>();

      if (profile) {
        // Cache for 5 minutes
        await redisCache.setex(cacheKey, 300, JSON.stringify(profile));
        return profile;
      }

      return null;
    } catch (error) {
      console.error('ProfileService.getProfile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile with optimistic locking and batch operations
   */
  async updateProfile(userId: string, updateData: ProfileUpdateData, updatedBy: string): Promise<IUserProfile | null> {
    try {
      console.log('🔄 ProfileService.updateProfile called:', {
        userId,
        updateData: Object.keys(updateData),
        updatedBy
      });

      const session = await UserProfile.startSession();
      session.startTransaction();

      try {
        const userObjectId = new Types.ObjectId(userId);
        const updatedByObjectId = new Types.ObjectId(updatedBy);

        console.log('🔄 Converting to ObjectIds:', {
          userObjectId: userObjectId.toString(),
          updatedByObjectId: updatedByObjectId.toString()
        });

        const {
          education,
          certifications,
          ...profileFields
        } = updateData;

        const baseUpdate = {
          ...profileFields,
          lastUpdatedBy: updatedByObjectId,
          lastActivityAt: new Date()
        } as Record<string, any>;

        console.log('🔄 Base update data:', baseUpdate);

        // Use enhanced createOrUpdateProfile method for better duplicate prevention
        const profileUpdate = await UserProfile.findOneAndUpdate(
          { userId: userObjectId },
          { $set: baseUpdate },
          {
            new: true,
            runValidators: true,
            session,
            upsert: true,
            setDefaultsOnInsert: true
          }
        ).populate('userId', 'email isActive');

        console.log('🔄 MongoDB update result:', {
          profileFound: !!profileUpdate,
          profileData: profileUpdate ? {
            _id: profileUpdate._id,
            userId: profileUpdate.userId,
            avatar_url: profileUpdate.avatar_url
          } : null
        });

        // Handle education updates separately for better performance
        if (education && Array.isArray(education)) {
          await this.updateEducation(userId, education, session);
        }

        // Handle certifications updates separately
        if (certifications && Array.isArray(certifications)) {
          await this.updateCertifications(userId, certifications, session);
        }

        // Refresh profile snapshot if nested collections were updated
        const profile = (education || certifications)
          ? await UserProfile.findOne({ userId: userObjectId })
              .populate('userId', 'email isActive')
              .session(session)
          : profileUpdate;

        console.log('🔄 Final profile result:', {
          hasNestedUpdates: !!(education || certifications),
          profileFound: !!profile,
          profileId: profile?._id
        });

        await session.commitTransaction();

        // Invalidate cache
        await this.invalidateProfileCache(userId);

        // Cache updated profile
        if (profile) {
          const cacheKey = `profile:${userId}`;
          await redisCache.setex(cacheKey, 300, JSON.stringify(profile.toObject()));
        }

        console.log('✅ Profile update completed successfully');
        return profile;
      } catch (error: any) {
        await session.abortTransaction();

        console.error('❌ Profile update failed in transaction:', error);

        // Handle duplicate key errors specifically
        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern || {})[0];
          throw new Error(`Duplicate value for field: ${field}`);
        }

        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      console.error('ProfileService.updateProfile error:', error);

      // Re-throw with more context
      if (error.message.includes('Duplicate')) {
        throw error;
      }

      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Batch update multiple profiles (for admin operations)
   */
  async batchUpdateProfiles(updates: Array<{ userId: string; data: ProfileUpdateData }>, updatedBy: string): Promise<void> {
    try {
      const session = await UserProfile.startSession();
      session.startTransaction();

      try {
        const bulkOps = updates.map(({ userId, data }) => ({
          updateOne: {
            filter: { userId: new Types.ObjectId(userId) },
            update: {
              ...data,
              lastUpdatedBy: new Types.ObjectId(updatedBy),
              lastActivityAt: new Date()
            },
            upsert: true
          }
        }));

        await UserProfile.bulkWrite(bulkOps, { session, ordered: false });

        await session.commitTransaction();

        // Invalidate cache for all updated profiles
        for (const { userId } of updates) {
          await this.invalidateProfileCache(userId);
        }
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error('ProfileService.batchUpdateProfiles error:', error);
      throw error;
    }
  }

  /**
   * Update education records separately for better performance
   */
  private async updateEducation(userId: string, education: any[], session: any): Promise<void> {
    // Remove existing education
    await UserProfile.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $unset: { education: 1 } },
      { session }
    );

    // Add new education if provided
    if (education.length > 0) {
      await UserProfile.updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          $push: {
            education: {
              $each: education.map((edu: any) => ({
                ...edu,
                institution: edu.institution?.trim(),
                degree: edu.degree?.trim(),
                fieldOfStudy: edu.fieldOfStudy?.trim(),
                description: edu.description?.trim()
              }))
            }
          }
        },
        { session }
      );
    }
  }

  /**
   * Update certifications separately
   */
  private async updateCertifications(userId: string, certifications: any[], session: any): Promise<void> {
    // Remove existing certifications
    await UserProfile.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $unset: { certifications: 1 } },
      { session }
    );

    // Add new certifications if provided
    if (certifications.length > 0) {
      await UserProfile.updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          $push: {
            certifications: {
              $each: certifications.map((cert: any) => ({
                ...cert,
                name: cert.name?.trim(),
                issuer: cert.issuer?.trim(),
                description: cert.description?.trim(),
                credentialId: cert.credentialId?.trim(),
                credentialUrl: cert.credentialUrl?.trim()
              }))
            }
          }
        },
        { session }
      );
    }
  }

  /**
   * Search profiles with advanced filtering and caching
   */
  async searchProfiles(searchParams: {
    query?: string;
    field?: UserField;
    experienceLevel?: string;
    location?: string;
    skills?: string[];
    targetLanguage?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ profiles: IUserProfile[]; total: number; hasMore: boolean }> {
    try {
      const {
        query,
        field,
        experienceLevel,
        location,
        skills,
        targetLanguage,
        limit = 20,
        skip = 0
      } = searchParams;

      // Create cache key
      const cacheKey = `search:${JSON.stringify(searchParams)}`;
      const cachedResult = await redisCache.get(cacheKey);

      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Build query
      const dbQuery: any = {};

      if (query) {
        dbQuery.$text = { $search: query };
      }

      if (field) dbQuery.field = field;
      if (experienceLevel) dbQuery.experienceLevel = experienceLevel;
      if (location) dbQuery.location = new RegExp(location, 'i');
      if (targetLanguage) dbQuery.targetLanguage = new RegExp(targetLanguage, 'i');

      if (skills && skills.length > 0) {
        dbQuery['professionalInfo.skills'] = { $in: skills };
      }

      // Execute query with optimized aggregation
      const [profilesResult, total] = await Promise.all([
        UserProfile.find(dbQuery, { score: query ? { $meta: 'textScore' } : undefined })
          .populate('userId', 'email isActive')
          .sort(query ? { score: { $meta: 'textScore' } } : { lastActivityAt: -1 })
          .skip(skip)
          .limit(limit),

        UserProfile.countDocuments(dbQuery)
      ]);

      // Convert Mongoose documents to plain objects
      const profiles = profilesResult.map(profile => profile.toObject()) as IUserProfile[];

      const result = {
        profiles,
        total,
        hasMore: skip + limit < total
      };

      // Cache for 2 minutes
      await redisCache.setex(cacheKey, 120, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('ProfileService.searchProfiles error:', error);
      throw error;
    }
  }

  /**
   * Get profile statistics for analytics
   */
  async getProfileStats(): Promise<any> {
    try {
      const cacheKey = 'profile:stats';
      const cachedStats = await redisCache.get(cacheKey);

      if (cachedStats) {
        return JSON.parse(cachedStats);
      }

      const stats = await UserProfile.aggregate([
        {
          $group: {
            _id: {
              field: '$field',
              experienceLevel: '$experienceLevel',
              targetLanguage: '$targetLanguage'
            },
            count: { $sum: 1 },
            premiumCount: { $sum: { $cond: ['$isPremium', 1, 0] } },
            avgDailyGoal: { $avg: '$learningPreferences.dailyLearningGoal' },
            avgWeeklyGoal: { $avg: '$learningPreferences.weeklyLearningGoal' }
          }
        },
        {
          $group: {
            _id: '$_id.field',
            experienceLevels: {
              $push: {
                experienceLevel: '$_id.experienceLevel',
                targetLanguage: '$_id.targetLanguage',
                count: '$count',
                premiumCount: '$premiumCount',
                avgDailyGoal: '$avgDailyGoal',
                avgWeeklyGoal: '$avgWeeklyGoal'
              }
            },
            totalUsers: { $sum: '$count' },
            totalPremium: { $sum: '$premiumCount' }
          }
        }
      ]);

      // Cache for 10 minutes
      await redisCache.setex(cacheKey, 600, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('ProfileService.getProfileStats error:', error);
      throw error;
    }
  }

  /**
   * Invalidate profile cache
   */
  private async invalidateProfileCache(userId: string): Promise<void> {
    try {
      const keys = await redisCache.keys(`profile:*${userId}*`);
      if (keys.length > 0) {
        await redisCache.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
      // Don't throw error for cache issues
    }
  }

  /**
   * Get profiles by role with pagination (cached)
   */
  async getProfilesByRole(role: UserRole, options: { limit?: number; skip?: number } = {}): Promise<IUserProfile[]> {
    try {
      // Validate that the role is a valid UserRole
      const validRoles: UserRole[] = ['student', 'teacher', 'professional', 'admin', 'content-creator'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
      }

      const cacheKey = `profiles:role:${role}:${options.limit || 20}:${options.skip || 0}`;
      const cachedProfiles = await redisCache.get(cacheKey);

      if (cachedProfiles) {
        return JSON.parse(cachedProfiles);
      }

      const profiles = await UserProfile.findByRole(role, options);

      // Convert lean results to plain objects
      const plainProfiles = profiles.map((profile: any) => profile.toObject()) as IUserProfile[];

      // Cache for 3 minutes
      await redisCache.setex(cacheKey, 180, JSON.stringify(plainProfiles));

      return plainProfiles;
    } catch (error) {
      console.error('ProfileService.getProfilesByRole error:', error);
      throw error;
    }
  }

  /**
   * Get profiles by field/expertise (cached)
   */
  async getProfilesByField(field: UserField, options: { limit?: number; skip?: number } = {}): Promise<IUserProfile[]> {
    try {
      const cacheKey = `profiles:field:${field}:${options.limit || 20}:${options.skip || 0}`;
      const cachedProfiles = await redisCache.get(cacheKey);

      if (cachedProfiles) {
        return JSON.parse(cachedProfiles);
      }

      const profiles = await UserProfile.findByField(field, options);

      // Convert lean results to plain objects
      const plainProfiles = profiles.map((profile: any) => profile.toObject()) as IUserProfile[];

      // Cache for 3 minutes
      await redisCache.setex(cacheKey, 180, JSON.stringify(plainProfiles));

      return plainProfiles;
    } catch (error) {
      console.error('ProfileService.getProfilesByField error:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();
