import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, UserProfile } from '../../models/index.js';
import { profileService } from '../../services/Profile/profileService.js';
import { webSocketService } from '../../services/WebSocket/socketService.js';
import subscriptionService from '../../services/Subscription/subscriptionService.js';
import { Types } from 'mongoose';

const USER_RESPONSE_FIELDS = 'email firstName lastName username role tier subscriptionStatus subscriptionPlan subscriptionStartDate subscriptionEndDate createdAt updatedAt';

const sanitizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);

    return sanitizedArray.length > 0 ? sanitizedArray : undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'object') {
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      const sanitizedVal = sanitizeValue(val);
      if (sanitizedVal !== undefined) {
        sanitizedObject[key] = sanitizedVal;
      }
    }

    return Object.keys(sanitizedObject).length > 0 ? sanitizedObject : undefined;
  }

  return value;
};

const toValidDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

const normalizeUserUpdateData = (data: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = sanitizeValue(data);

  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    return {};
  }

  const normalized: Record<string, unknown> = { ...sanitized };

  if (normalized.dateOfBirth) {
    const parsedDate = toValidDate(normalized.dateOfBirth);
    if (parsedDate) {
      normalized.dateOfBirth = parsedDate;
    } else {
      delete normalized.dateOfBirth;
    }
  }

  return normalized;
};

const normalizeProfileUpdateData = (data: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = sanitizeValue(data);

  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    return {};
  }

  const normalized: Record<string, any> = { ...sanitized };

  // Normalize field value to match enum format (lowercase with hyphens)
  if (normalized.field && typeof normalized.field === 'string') {
    normalized.field = normalized.field
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Remove special characters except hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // If field becomes empty after normalization, remove it
    if (!normalized.field) {
      delete normalized.field;
    }
  }

  if (normalized.personalInfo) {
    if (normalized.personalInfo.dateOfBirth) {
      const parsedDate = toValidDate(normalized.personalInfo.dateOfBirth);
      if (parsedDate) {
        normalized.personalInfo.dateOfBirth = parsedDate;
      } else {
        delete normalized.personalInfo.dateOfBirth;
      }
    }

    if (Array.isArray(normalized.personalInfo.languages)) {
      normalized.personalInfo.languages = normalized.personalInfo.languages
        .map((lang: any) => sanitizeValue(lang))
        .filter((lang: any) => lang && typeof lang === 'object' && Object.keys(lang).length > 0);

      if (normalized.personalInfo.languages.length === 0) {
        delete normalized.personalInfo.languages;
      }
    }

    if (normalized.personalInfo && Object.keys(normalized.personalInfo).length === 0) {
      delete normalized.personalInfo;
    }
  }

  if (normalized.professionalInfo) {
    if (normalized.professionalInfo.experienceYears !== undefined) {
      const experienceYears = Number(normalized.professionalInfo.experienceYears);
      if (Number.isNaN(experienceYears)) {
        delete normalized.professionalInfo.experienceYears;
      } else {
        normalized.professionalInfo.experienceYears = experienceYears;
      }
    }

    if (normalized.professionalInfo && Object.keys(normalized.professionalInfo).length === 0) {
      delete normalized.professionalInfo;
    }
  }

  if (Array.isArray(normalized.education)) {
    normalized.education = normalized.education
      .map((educationItem: any) => {
        const entry = sanitizeValue(educationItem);
        if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
          return undefined;
        }

        const normalizedEntry: Record<string, any> = { ...entry };

        // Ensure endYear is null when currently enrolled
        if (normalizedEntry.isCurrentlyEnrolled === true) {
          normalizedEntry.endYear = null;
        }

        if (normalizedEntry.startYear !== undefined) {
          const startYear = Number(normalizedEntry.startYear);
          if (Number.isNaN(startYear)) {
            delete normalizedEntry.startYear;
          } else {
            normalizedEntry.startYear = startYear;
          }
        }

        if (normalizedEntry.endYear !== undefined && normalizedEntry.endYear !== null) {
          const endYear = Number(normalizedEntry.endYear);
          if (Number.isNaN(endYear)) {
            delete normalizedEntry.endYear;
          } else {
            normalizedEntry.endYear = endYear;
          }
        } else if (normalizedEntry.endYear === null) {
          // Keep null value for currently enrolled students
          // No transformation needed
        }

        return Object.keys(normalizedEntry).length > 0 ? normalizedEntry : undefined;
      })
      .filter((educationEntry: any) => educationEntry !== undefined);

    if (normalized.education.length === 0) {
      delete normalized.education;
    }
  }

  if (Array.isArray(normalized.certifications)) {
    normalized.certifications = normalized.certifications
      .map((certificationItem: any) => {
        const entry = sanitizeValue(certificationItem);
        if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
          return undefined;
        }

        const normalizedEntry: Record<string, any> = { ...entry };

        if (normalizedEntry.issueDate) {
          const issueDate = toValidDate(normalizedEntry.issueDate);
          if (issueDate) {
            normalizedEntry.issueDate = issueDate;
          } else {
            delete normalizedEntry.issueDate;
          }
        }

        if (normalizedEntry.expiryDate) {
          const expiryDate = toValidDate(normalizedEntry.expiryDate);
          if (expiryDate) {
            normalizedEntry.expiryDate = expiryDate;
          } else {
            delete normalizedEntry.expiryDate;
          }
        }

        return Object.keys(normalizedEntry).length > 0 ? normalizedEntry : undefined;
      })
      .filter((certificationEntry: any) => certificationEntry !== undefined);

    if (normalized.certifications.length === 0) {
      delete normalized.certifications;
    }
  }

  if (normalized.learningPreferences) {
    const preferences = normalized.learningPreferences;

    if (preferences.dailyLearningGoal !== undefined) {
      const dailyGoal = Number(preferences.dailyLearningGoal);
      if (Number.isNaN(dailyGoal)) {
        delete preferences.dailyLearningGoal;
      } else {
        preferences.dailyLearningGoal = dailyGoal;
      }
    }

    if (preferences.weeklyLearningGoal !== undefined) {
      const weeklyGoal = Number(preferences.weeklyLearningGoal);
      if (Number.isNaN(weeklyGoal)) {
        delete preferences.weeklyLearningGoal;
      } else {
        preferences.weeklyLearningGoal = weeklyGoal;
      }
    }

    if (preferences && Object.keys(preferences).length === 0) {
      delete normalized.learningPreferences;
    }
  }

  if (normalized.privacySettings && Object.keys(normalized.privacySettings).length === 0) {
    delete normalized.privacySettings;
  }

  if (normalized.privacySettings) {
    const privacy = normalized.privacySettings;

    if (privacy.dataManagement) {
      const dataManagement = privacy.dataManagement;

      if (dataManagement.dataRetentionPeriod !== undefined) {
        const retention = Number(dataManagement.dataRetentionPeriod);
        if (Number.isNaN(retention)) {
          delete dataManagement.dataRetentionPeriod;
        } else {
          dataManagement.dataRetentionPeriod = Math.min(Math.max(retention, 6), 60);
        }
      }

      if (dataManagement.sessionTimeout !== undefined) {
        const timeout = Number(dataManagement.sessionTimeout);
        if (Number.isNaN(timeout)) {
          delete dataManagement.sessionTimeout;
        }
      }

      if (Object.keys(dataManagement).length === 0) {
        delete privacy.dataManagement;
      }
    }

    if (privacy.security) {
      const security = privacy.security;
      if (security.sessionTimeout !== undefined) {
        const timeout = Number(security.sessionTimeout);
        if (Number.isNaN(timeout)) {
          delete security.sessionTimeout;
        } else {
          security.sessionTimeout = Math.min(Math.max(timeout, 15), 1440);
        }
      }

      if (Object.keys(security).length === 0) {
        delete privacy.security;
      }
    }

    if (Object.keys(privacy).length === 0) {
      delete normalized.privacySettings;
    }
  }

  if (normalized.socialLinks && Object.keys(normalized.socialLinks).length === 0) {
    delete normalized.socialLinks;
  }

  return normalized;
};

interface AuthRequest extends Request {
  user?: any;
  token?: string;
}

export class ProfileController {

  /**
   * Get user profile
   */
  async getProfile(req: AuthRequest, res: Response) {
    try {
      // If no user is authenticated, return a clear unauthenticated response
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access profile',
          authenticated: false,
        });
      }

      const userId = req.user._id;

      const user = await User.findById(userId).select(USER_RESPONSE_FIELDS);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      let profile = await profileService.getProfile(userId);

      if (!profile) {
        const createdProfile = await profileService.updateProfile(
          userId,
          {
            displayName: user.getFullName(),
            experienceLevel: 'beginner',
            targetLanguage: 'English',
          },
          userId
        );

        profile = createdProfile
          ? createdProfile.toObject ? createdProfile.toObject() : createdProfile
          : null;
      }

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found',
        });
      }

      return res.json({
        success: true,
        data: {
          user: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            fullName: user.getFullName(),
          },
          profile: {
            ...profile,
            // Add profile fields that were moved from User
            targetLanguage: profile.targetLanguage || 'English',
            nativeLanguage: profile.nativeLanguage,
            country: profile.country,
            proficiencyLevel: profile.proficiencyLevel || 'beginner',
            displayName: profile.displayName || user.getFullName(),
          },
        },
      });

    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get profile',
      });
    }
  }

  /**
   * Update user profile with enhanced duplicate prevention and data synchronization
   */
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const userId = req.user._id;
      const updateData = req.body;

      // Enhanced duplicate prevention for usernames
      if (updateData.username) {
        const desiredUsername = String(updateData.username).toLowerCase().trim();

        // Check for duplicates across both User and UserProfile collections
        const [existingUser, existingProfile] = await Promise.all([
          User.findOne({
            username: desiredUsername,
            _id: { $ne: userId }
          }).select('_id username'),
          UserProfile.findOne({
            userId: { $ne: userId }
          }).select('userId')
        ]);

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken',
            field: 'username',
          });
        }
      }

      // Enhanced duplicate prevention for email
      if (updateData.email) {
        const desiredEmail = String(updateData.email).toLowerCase().trim();

        const existingUser = await User.findOne({
          email: desiredEmail,
          _id: { $ne: userId }
        }).select('_id email');

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Email is already in use',
            field: 'email',
          });
        }
      }

      const userFields = [
        'firstName',
        'lastName',
        'username'
      ] as const;

      const userUpdateData: Record<string, unknown> = {};
      for (const field of userFields) {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          userUpdateData[field] = updateData[field];
        }
      }

      // Ensure username uniqueness and validation
      if (userUpdateData.username) {
        const desiredUsername = String(userUpdateData.username).toLowerCase();
        userUpdateData.username = desiredUsername;

        // Additional validation for username format
        if (!/^[a-zA-Z0-9_]+$/.test(desiredUsername)) {
          return res.status(400).json({
            success: false,
            message: 'Username can only contain letters, numbers, and underscores',
            field: 'username',
          });
        }
      }

      const sanitizedUserUpdateData = normalizeUserUpdateData(userUpdateData);

      // Update User collection with transaction safety
      let updatedUser = null;
      if (Object.keys(sanitizedUserUpdateData).length > 0) {
        updatedUser = await User.findByIdAndUpdate(
          userId,
          sanitizedUserUpdateData,
          { new: true, runValidators: true }
        ).select('_id');

        if (!updatedUser) {
          return res.status(404).json({
            success: false,
            message: 'User not found',
          });
        }
      }

      // Handle profile updates with enhanced duplicate prevention
      const profileFields = [
        'displayName',
        'username',
        'avatar_url',
        'bio',
        'isPremium',
        'location',
        'targetLanguage',
        'nativeLanguage',
        'country',
        'proficiencyLevel',
        'personalInfo',
        'experienceLevel',
        'field',
        'goals',
        'interests',
        'professionalInfo',
        'education',
        'certifications',
        'documents',
        'socialLinks',
        'learningPreferences',
        'privacySettings'
      ] as const;

      const profileUpdateData: Record<string, unknown> = {};
      for (const field of profileFields) {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          profileUpdateData[field] = updateData[field];
        }
      }

      // Enhanced validation for profile fields to prevent duplicates
      if (profileUpdateData.personalInfo && typeof profileUpdateData.personalInfo === 'object') {
        const personalInfo = profileUpdateData.personalInfo as any;

        // Validate phone number uniqueness if provided
        if (personalInfo.phone) {
          const existingPhoneProfile = await UserProfile.findOne({
            'personalInfo.phone': personalInfo.phone,
            userId: { $ne: userId }
          }).select('_id');

          if (existingPhoneProfile) {
            return res.status(409).json({
              success: false,
              message: 'Phone number is already in use',
              field: 'personalInfo.phone',
            });
          }
        }
      }

      const sanitizedProfileUpdateData = normalizeProfileUpdateData(profileUpdateData);

      // Debug logging to see what's being validated
      console.log('🔍 Backend: Profile update data before validation:', JSON.stringify(sanitizedProfileUpdateData, null, 2));

      // Use the enhanced profile service for better duplicate prevention
      if (Object.keys(sanitizedProfileUpdateData).length > 0) {
        await profileService.updateProfile(userId, sanitizedProfileUpdateData, userId);
      }

      // Fetch updated data for response
      const [updatedUserData, latestProfile] = await Promise.all([
        User.findById(userId).select(USER_RESPONSE_FIELDS),
        UserProfile.findOne({ userId: new Types.ObjectId(userId) })
      ]);

      if (!updatedUserData) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!latestProfile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found',
        });
      }

      // Send real-time notification to connected clients (only if we have data)
      if (updatedUserData && latestProfile) {
        await webSocketService.notifyProfileUpdate(
          userId,
          {
            user: {
              _id: updatedUserData._id,
              email: updatedUserData.email,
              firstName: updatedUserData.firstName,
              lastName: updatedUserData.lastName,
              username: updatedUserData.username,
              role: updatedUserData.role,
              createdAt: updatedUserData.createdAt,
              updatedAt: updatedUserData.updatedAt,
              fullName: updatedUserData.getFullName(),
            },
            profile: {
              ...latestProfile.toObject(),
              // Ensure moved fields are included
              targetLanguage: latestProfile.targetLanguage || 'English',
              nativeLanguage: latestProfile.nativeLanguage,
              country: latestProfile.country,
              proficiencyLevel: latestProfile.proficiencyLevel || 'beginner',
              displayName: latestProfile.displayName || updatedUserData.getFullName(),
            },
          }
        );
      }

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            _id: updatedUserData._id,
            email: updatedUserData.email,
            firstName: updatedUserData.firstName,
            lastName: updatedUserData.lastName,
            username: updatedUserData.username,
            role: updatedUserData.role,
            createdAt: updatedUserData.createdAt,
            updatedAt: updatedUserData.updatedAt,
            fullName: updatedUserData.getFullName(),
          },
          profile: {
            ...latestProfile.toObject(),
            // Ensure moved fields are included
            targetLanguage: latestProfile.targetLanguage || 'English',
            nativeLanguage: latestProfile.nativeLanguage,
            country: latestProfile.country,
            proficiencyLevel: latestProfile.proficiencyLevel || 'beginner',
            displayName: latestProfile.displayName || updatedUserData.getFullName(),
          },
        },
      });

    } catch (error: any) {
      console.error('Update profile error:', error);

      // Handle specific MongoDB duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        return res.status(409).json({
          success: false,
          message: `${field} already exists`,
          field,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update profile',
      });
    }
  }

  /**
   * Change user password
   */
  async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const userId = req.user._id;
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.password = hashedPassword;
      await user.save();

      return res.json({
        success: true,
        message: 'Password changed successfully',
      });

    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to change password',
      });
    }
  }
}

export const profileController = new ProfileController();
