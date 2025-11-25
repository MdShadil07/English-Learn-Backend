import mongoose, { Schema, Document, Model } from 'mongoose';
import { redisCache } from '../config/redis.js';
export type UserRole = 'student' | 'teacher' | 'professional' | 'admin' | 'content-creator';
export type UserField =
  | 'student' | 'high-school-student' | 'college-student' | 'graduate-student'
  | 'professional' | 'teacher' | 'professor' | 'researcher' | 'software-engineer'
  | 'data-scientist' | 'writer' | 'entrepreneur' | 'freelancer' | 'admin'
  | 'computer-science' | 'business' | 'medicine' | 'engineering' | 'law'
  | 'education' | 'arts' | 'science' | 'mathematics' | 'literature'
  | 'psychology' | 'economics' | 'finance' | 'marketing' | 'design'
  | 'technology' | 'healthcare' | 'research' | 'consulting' | 'other';

// Gender type for personal information
export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | 'other';

// Language proficiency levels
export type LanguageProficiency = 'beginner' | 'intermediate' | 'advanced' | 'native';

// Experience levels
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// Learning style preferences
export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing' | 'mixed';

// English proficiency levels (more comprehensive than basic proficiency)
export type EnglishLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'proficient' | 'native';

// Basic proficiency levels (for general language proficiency)
export type ProficiencyLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'proficient';

// Education levels
export type EducationLevel = 'high-school' | 'associate-degree' | 'bachelors-degree' | 'masters-degree' | 'phd' | 'certificate' | 'diploma' | 'other';

// Personal Information Schema
const PersonalInfoSchema = new Schema({
  dateOfBirth: { type: Date },
  gender: {
    type: String,
    enum: ['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'],
    default: 'prefer-not-to-say'
  },
  phone: { type: String, trim: true },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },
  nationality: { type: String, trim: true },
  languages: [{
    language: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'native'],
      required: true
    }
  }]
}, { _id: false });

// Professional Information Schema
const ProfessionalInfoSchema = new Schema({
  company: { type: String, trim: true },
  position: { type: String, trim: true },
  experienceYears: { type: Number, min: 0, max: 50 },
  industry: { type: String, trim: true },
  skills: [{ type: String, trim: true }],
  interests: [{ type: String, trim: true }],
  careerGoals: { type: String, trim: true },
  resumeUrl: { type: String, trim: true }
}, { _id: false });

// Learning Preferences Schema
const LearningPreferencesSchema = new Schema({
  preferredLearningStyle: {
    type: String,
    enum: ['visual', 'auditory', 'kinesthetic', 'reading-writing', 'mixed'],
    default: 'mixed'
  },
  dailyLearningGoal: { type: Number, min: 5, max: 480, default: 30 }, // in minutes
  weeklyLearningGoal: { type: Number, min: 35, max: 3360, default: 210 }, // in minutes
  targetEnglishLevel: {
    type: String,
    enum: ['beginner', 'elementary', 'intermediate', 'advanced', 'proficient', 'native'],
    default: 'intermediate'
  },
  focusAreas: [{
    type: String,
    enum: ['speaking', 'listening', 'reading', 'writing', 'grammar', 'vocabulary', 'pronunciation', 'business-english', 'academic-english']
  }]
}, { _id: false });

// Education Schema
const EducationSchema = new Schema({
  institution: { type: String, required: true, trim: true },
  degree: { type: String, trim: true },
  fieldOfStudy: { type: String, trim: true },
  startYear: { type: Number, min: 1900, max: new Date().getFullYear() + 10 },
  endYear: {
    type: Schema.Types.Mixed,
    validate: {
      validator: function(this: any, value: number | null | undefined) {
        if (this.isCurrentlyEnrolled) {
          return value === null || value === undefined;
        }
        return typeof value === 'number' && value >= 1900 && value <= new Date().getFullYear() + 10;
      },
      message: function(this: any) {
        return this.isCurrentlyEnrolled
          ? 'End year should be null when currently enrolled'
          : 'End year must be a valid number between 1900 and ' + (new Date().getFullYear() + 10);
      }
    }
  },
  grade: { type: String, trim: true },
  description: { type: String, trim: true },
  isCurrentlyEnrolled: { type: Boolean, default: false },
  educationLevel: {
    type: String,
    enum: ['high-school', 'associate-degree', 'bachelors-degree', 'masters-degree', 'phd', 'certificate', 'diploma', 'other'],
    required: true
  }
}, { timestamps: true });

// Certification Schema
const CertificationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  issuer: { type: String, required: true, trim: true },
  issueDate: { type: Date, required: true },
  expiryDate: { type: Date },
  credentialId: { type: String, trim: true },
  credentialUrl: { type: String, trim: true },
  description: { type: String, trim: true },
  skills: [{ type: String, trim: true }],
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

// Social Links Schema
const SocialLinksSchema = new Schema({
  linkedin: { type: String, trim: true },
  github: { type: String, trim: true },
  twitter: { type: String, trim: true },
  website: { type: String, trim: true },
  instagram: { type: String, trim: true },
  youtube: { type: String, trim: true },
  portfolio: { type: String, trim: true },
  other: { type: String, trim: true }
}, { _id: false });

// Privacy Settings Schema
const PrivacySettingsSchema = new Schema({
  profileVisibility: {
    type: String,
    enum: ['public', 'friends-only', 'private'],
    default: 'public'
  },
  showContactInfo: { type: Boolean, default: false },
  showEducation: { type: Boolean, default: true },
  showCertifications: { type: Boolean, default: true },
  showAchievements: { type: Boolean, default: true },

  // Advanced privacy settings
  activityTracking: {
    trackLearningProgress: { type: Boolean, default: true },
    trackTimeSpent: { type: Boolean, default: true },
    trackCourseCompletions: { type: Boolean, default: true },
    trackQuizResults: { type: Boolean, default: true },
    trackLoginHistory: { type: Boolean, default: false },
    trackDeviceInfo: { type: Boolean, default: false },
    trackLocationData: { type: Boolean, default: false }
  },

  communicationPreferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    marketingEmails: { type: Boolean, default: false },
    weeklyReports: { type: Boolean, default: true },
    achievementAlerts: { type: Boolean, default: true },
    reminderNotifications: { type: Boolean, default: true }
  },

  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    loginAlerts: { type: Boolean, default: true },
    suspiciousActivityAlerts: { type: Boolean, default: true },
    sessionTimeout: { type: Number, default: 60, min: 15, max: 1440 } // in minutes
  },

  dataManagement: {
    autoDeleteInactive: { type: Boolean, default: false },
    dataRetentionPeriod: { type: Number, default: 24, min: 6, max: 60 }, // in months
    downloadData: { type: Boolean, default: false },
    deleteAccount: { type: Boolean, default: false }
  },

  dataSharing: {
    shareWithPartners: { type: Boolean, default: false },
    shareAnonymousUsage: { type: Boolean, default: true },
    shareForResearch: { type: Boolean, default: false },
    allowPersonalization: { type: Boolean, default: true },
    thirdPartyIntegrations: { type: Boolean, default: false }
  },

  emergency: {
    emergencyContact: { type: String, trim: true },
    emergencyPhone: { type: String, trim: true },
    emergencyEmail: { type: String, trim: true },
    allowEmergencyAccess: { type: Boolean, default: false }
  }
}, { _id: false });

// Static methods interface
interface IUserProfileModel extends Model<IUserProfile> {
  findByRole(role: UserRole, options?: { limit?: number; skip?: number; sort?: any }): Promise<any[]>;
  findByField(field: UserField, options?: { limit?: number; skip?: number; sort?: any }): Promise<any[]>;
  searchProfiles(searchTerm: string, options?: { limit?: number; skip?: number; role?: UserRole }): Promise<any[]>;
  getProfileStats(): Promise<any[]>;
  createOrUpdateProfile(userId: mongoose.Types.ObjectId, profileData: Partial<IUserProfile>): Promise<IUserProfile | null>;
}

// Main User Profile Interface
export interface IUserProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Basic Information
  avatar_url?: string;
  bio: string;
  isPremium: boolean;
  displayName: string;
  username: string; // Add username field

  // Contact Information (now only in personalInfo)
  location: string;

  // Language and Learning Information
  targetLanguage: string;
  nativeLanguage?: string;
  country?: string;
  proficiencyLevel: ProficiencyLevel;

  // Personal Information
  personalInfo: {
    dateOfBirth?: Date;
    gender: Gender;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
    nationality: string;
    languages: Array<{
      language: string;
      proficiency: LanguageProficiency;
    }>;
  };

  // Experience Level and Field
  experienceLevel: ExperienceLevel;
  field?: string;

  // Learning Goals and Interests
  goals: string[];
  interests: string[];

  // Professional Information (for professionals, teachers, etc.)
  professionalInfo: {
    company: string;
    position: string;
    experienceYears?: number;
    industry: string;
    skills: string[];
    interests: string[];
    careerGoals: string;
    resumeUrl?: string;
  };

  // Educational Information
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startYear?: number;
    endYear?: number | null;
    grade?: string;
    description?: string;
    isCurrentlyEnrolled: boolean;
    educationLevel: EducationLevel;
    _id?: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  }>;

  // Certifications
  certifications: Array<{
    name: string;
    issuer: string;
    issueDate: Date;
    expiryDate?: Date;
    credentialId?: string;
    credentialUrl?: string;
    description?: string;
    skills: string[];
    isVerified: boolean;
    _id?: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  }>;

  // Documents (resumes, portfolios, certificates, etc.)
  documents?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
    uploadedAt: Date;
    _id?: mongoose.Types.ObjectId;
  }>;

  // Social Links
  socialLinks: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
    instagram?: string;
    youtube?: string;
    portfolio?: string;
    other?: string;
  };

  // Learning Preferences
  learningPreferences: {
    preferredLearningStyle: LearningStyle;
    dailyLearningGoal: number;
    weeklyLearningGoal: number;
    targetEnglishLevel: EnglishLevel;
    focusAreas: string[];
  };

  // Privacy Settings
  privacySettings: {
    profileVisibility: 'public' | 'friends-only' | 'private';
    showContactInfo: boolean;
    showEducation: boolean;
    showCertifications: boolean;
    showAchievements: boolean;
    activityTracking: {
      trackLearningProgress: boolean;
      trackTimeSpent: boolean;
      trackCourseCompletions: boolean;
      trackQuizResults: boolean;
      trackLoginHistory: boolean;
      trackDeviceInfo: boolean;
      trackLocationData: boolean;
    };
    communicationPreferences: {
      emailNotifications: boolean;
      pushNotifications: boolean;
      smsNotifications: boolean;
      marketingEmails: boolean;
      weeklyReports: boolean;
      achievementAlerts: boolean;
      reminderNotifications: boolean;
    };
    security: {
      twoFactorEnabled: boolean;
      loginAlerts: boolean;
      suspiciousActivityAlerts: boolean;
      sessionTimeout: number;
    };
    dataManagement: {
      autoDeleteInactive: boolean;
      dataRetentionPeriod: number;
      downloadData: boolean;
      deleteAccount: boolean;
    };
    dataSharing: {
      shareWithPartners: boolean;
      shareAnonymousUsage: boolean;
      shareForResearch: boolean;
      allowPersonalization: boolean;
      thirdPartyIntegrations: boolean;
    };
    emergency: {
      emergencyContact: string;
      emergencyPhone: string;
      emergencyEmail: string;
      allowEmergencyAccess: boolean;
    };
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastUpdatedBy: mongoose.Types.ObjectId;

  // Performance tracking
  lastActivityAt: Date;
  searchVector: string; // For full-text search optimization

  // Virtual for profile completeness calculation
  profileCompleteness: number;
}

// Static methods for optimized queries
interface IUserProfileStatics {
  findByRole(role: UserRole, options?: { limit?: number; skip?: number; sort?: any }): any;
  findByField(field: UserField, options?: { limit?: number; skip?: number; sort?: any }): any;
  searchProfiles(searchTerm: string, options?: { limit?: number; skip?: number; role?: UserRole }): any;
  getProfileStats(): any;
}

const userProfileSchema = new Schema<IUserProfile, IUserProfileModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true
    },

    // Basic Information
    avatar_url: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Avatar URL must be a valid HTTP/HTTPS URL'
      }
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [2000, 'Bio cannot exceed 2000 characters'],
      index: 'text'
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [100, 'Display name cannot exceed 100 characters'],
      index: 'text'
    },
    username: {
      type: String,
      trim: true,
      maxlength: [30, 'Username cannot exceed 30 characters'],
      index: 'text'
    },

    // Contact Information (now only in personalInfo)
    location: {
      type: String,
      trim: true,
      maxlength: [100, 'Location cannot exceed 100 characters'],
      index: 'text'
    },

    // Language and Learning Information
    targetLanguage: {
      type: String,
      required: [true, 'Target language is required'],
      default: 'English',
      trim: true,
      index: true,
    },
    nativeLanguage: {
      type: String,
      trim: true,
      maxlength: [50, 'Native language cannot exceed 50 characters'],
      index: true,
    },
    country: {
      type: String,
      trim: true,
      maxlength: [100, 'Country name cannot exceed 100 characters'],
      index: true,
    },
    proficiencyLevel: {
      type: String,
      enum: ['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'],
      default: 'beginner',
      index: true
    },

    // Personal Information (embedded for contact details and personal data)
    personalInfo: {
      type: PersonalInfoSchema,
      default: () => ({
        gender: 'prefer-not-to-say',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          country: '',
          zipCode: '',
        },
        nationality: '',
        languages: []
      })
    },

    // Experience Level and Field
    experienceLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
      index: true,
      required: true
    },
    field: {
      type: String,
      enum: [
        'student', 'high-school-student', 'college-student', 'graduate-student',
        'professional', 'teacher', 'professor', 'researcher', 'software-engineer',
        'data-scientist', 'writer', 'entrepreneur', 'freelancer', 'admin',
        'computer-science', 'business', 'medicine', 'engineering', 'law',
        'education', 'arts', 'science', 'mathematics', 'literature',
        'psychology', 'economics', 'finance', 'marketing', 'design',
        'technology', 'healthcare', 'research', 'consulting', 'other'
      ],
      trim: true,
      maxlength: 100,
      default: undefined,
      index: true,
      required: false
    },

    // Learning Goals and Interests
    goals: [{
      type: String,
      trim: true,
      index: true
    }],
    interests: [{
      type: String,
      trim: true,
      index: true
    }],

    // Educational Information (referenced collection for better performance)
    education: [{
      institution: { type: String, required: true, trim: true, index: 'text' },
      degree: { type: String, trim: true },
      fieldOfStudy: { type: String, trim: true },
      startYear: { type: Number, min: 1900, max: new Date().getFullYear() + 10 },
      endYear: {
        type: Schema.Types.Mixed, // Allow both Number and null
        validate: {
          validator: function(this: any, value: number | null | undefined) {
            // If currently enrolled, endYear should be null/undefined
            if (this.isCurrentlyEnrolled) {
              return value === null || value === undefined;
            }
            // If not currently enrolled, endYear should be a valid number
            return typeof value === 'number' && value >= 1900 && value <= new Date().getFullYear() + 10;
          },
          message: function(this: any) {
            return this.isCurrentlyEnrolled
              ? 'End year should be null when currently enrolled'
              : 'End year must be a valid number between 1900 and ' + (new Date().getFullYear() + 10);
          }
        }
      },
      grade: { type: String, trim: true },
      description: { type: String, trim: true },
      isCurrentlyEnrolled: { type: Boolean, default: false },
      educationLevel: {
        type: String,
        enum: ['high-school', 'associate-degree', 'bachelors-degree', 'masters-degree', 'phd', 'certificate', 'diploma', 'other'],
        required: true
      }
    }],

    // Certifications (referenced collection)
    certifications: [{
      name: { type: String, required: true, trim: true, index: 'text' },
      issuer: { type: String, required: true, trim: true },
      issueDate: { type: Date, required: true, index: true },
      expiryDate: { type: Date },
      credentialId: { type: String, trim: true, index: 'text' },
      credentialUrl: { type: String, trim: true },
      description: { type: String, trim: true },
      skills: [{ type: String, trim: true }],
      isVerified: { type: Boolean, default: false, index: true }
    }],

    // Documents (resumes, portfolios, certificates, etc.)
    documents: [{
      name: { type: String, required: true, trim: true },
      url: { type: String, required: true, trim: true },
      type: {
        type: String,
        required: true,
        enum: ['certificate', 'resume', 'portfolio', 'general']
      },
      size: { type: Number, min: 0 },
      uploadedAt: { type: Date, default: Date.now }
    }],

    // Social Links (embedded for performance)
    socialLinks: {
      type: SocialLinksSchema,
      default: () => ({})
    },

    // Learning Preferences (embedded)
    learningPreferences: {
      type: LearningPreferencesSchema,
      default: () => ({
        preferredLearningStyle: 'mixed',
        dailyLearningGoal: 30,
        weeklyLearningGoal: 210,
        targetEnglishLevel: 'intermediate',
        focusAreas: []
      })
    },

    // Privacy Settings (embedded for quick access)
    privacySettings: {
      type: PrivacySettingsSchema,
      default: () => ({
        profileVisibility: 'public',
        showContactInfo: false,
        showEducation: true,
        showCertifications: true,
        showAchievements: true,
        activityTracking: {
          trackLearningProgress: true,
          trackTimeSpent: true,
          trackCourseCompletions: true,
          trackQuizResults: true,
          trackLoginHistory: false,
          trackDeviceInfo: false,
          trackLocationData: false
        },
        communicationPreferences: {
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          marketingEmails: false,
          weeklyReports: true,
          achievementAlerts: true,
          reminderNotifications: true
        },
        security: {
          twoFactorEnabled: false,
          loginAlerts: true,
          suspiciousActivityAlerts: true,
          sessionTimeout: 60
        },
        dataManagement: {
          autoDeleteInactive: false,
          dataRetentionPeriod: 24,
          downloadData: false,
          deleteAccount: false
        },
        dataSharing: {
          shareWithPartners: false,
          shareAnonymousUsage: true,
          shareForResearch: false,
          allowPersonalization: true,
          thirdPartyIntegrations: false
        },
        emergency: {
          emergencyContact: '',
          emergencyPhone: '',
          emergencyEmail: '',
          allowEmergencyAccess: false
        }
      })
    },

    // Metadata for performance and analytics
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Performance tracking
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    // Full-text search optimization
    searchVector: {
      type: String,
      index: 'text'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Performance optimized indexes for high-traffic scenarios
// Note: userId index with unique constraint is already defined in schema field
userProfileSchema.index({ displayName: 1 });
userProfileSchema.index({ 'privacySettings.profileVisibility': 1 });
userProfileSchema.index({ 'personalInfo.nationality': 1 });
userProfileSchema.index({ 'personalInfo.languages.language': 1 });
userProfileSchema.index({ 'professionalInfo.industry': 1 });
userProfileSchema.index({ 'professionalInfo.skills': 1 });
userProfileSchema.index({ 'learningPreferences.targetEnglishLevel': 1 });
userProfileSchema.index({ 'learningPreferences.focusAreas': 1 });
userProfileSchema.index({ lastActivityAt: -1 });
userProfileSchema.index({ createdAt: -1 });
userProfileSchema.index({ updatedAt: -1 });

// Compound indexes for complex queries - ADDING NEW ONES FOR SCALABILITY
userProfileSchema.index({ experienceLevel: 1, targetLanguage: 1 });
userProfileSchema.index({ 'privacySettings.profileVisibility': 1, lastActivityAt: -1 });
userProfileSchema.index({ 'learningPreferences.targetEnglishLevel': 1, 'learningPreferences.focusAreas': 1 });

// Additional indexes for enhanced performance at scale
userProfileSchema.index({ isPremium: 1, lastActivityAt: -1 }); // Premium user queries
userProfileSchema.index({ location: 1, targetLanguage: 1 }); // Location-based searches
userProfileSchema.index({ profileCompleteness: -1, lastActivityAt: -1 }); // Gamification features

// Text search index for user discovery
userProfileSchema.index({
  displayName: 'text',
  username: 'text',
  bio: 'text',
  targetLanguage: 'text',
  nativeLanguage: 'text',
  country: 'text',
  field: 'text',
  'professionalInfo.skills': 'text',
  'professionalInfo.industry': 'text',
  'education.institution': 'text',
  'education.fieldOfStudy': 'text',
  'certifications.name': 'text',
  searchVector: 'text'
}, {
  weights: {
    displayName: 10,
    username: 10,
    bio: 8,
    field: 7,
    targetLanguage: 6,
    nativeLanguage: 5,
    country: 4,
    'professionalInfo.skills': 6,
    'professionalInfo.industry': 4,
    'education.institution': 4,
    'education.fieldOfStudy': 3,
    'certifications.name': 5,
    searchVector: 2
  }
});

// Virtual for profile completeness calculation
userProfileSchema.virtual('profileCompleteness').get(function(this: IUserProfile) {
  const fields = [
    this.displayName,
    this.bio,
    this.targetLanguage,
    this.location,
    this.personalInfo.phone,
    this.personalInfo.nationality,
    this.experienceLevel,
    this.field, // field is now optional but still contributes to completeness
    this.goals.length > 0,
    this.interests.length > 0,
    this.learningPreferences.focusAreas.length > 0
  ];

  const completedFields = fields.filter(field => {
    if (typeof field === 'boolean') return field;
    return field && field.toString().trim().length > 0;
  }).length;

  return Math.round((completedFields / fields.length) * 100);
});

// Pre-save middleware to update search vector and metadata
userProfileSchema.pre('save', function(next) {
  // Update search vector for full-text search
  const searchableFields = [
    this.displayName,
    this.username,
    this.bio,
    this.targetLanguage,
    this.nativeLanguage,
    this.country,
    this.field, // field is now optional
    this.location,
    this.personalInfo.nationality,
    this.professionalInfo.company,
    this.professionalInfo.position,
    this.professionalInfo.industry,
    this.professionalInfo.skills.join(' '),
    this.interests.join(' '),
    this.goals.join(' '),
    this.learningPreferences.focusAreas.join(' '),
    this.education.map(e => `${e.institution} ${e.degree} ${e.fieldOfStudy}`).join(' '),
    this.certifications.map(c => `${c.name} ${c.issuer} ${c.skills.join(' ')}`).join(' ')
  ].filter(Boolean);

  this.searchVector = searchableFields.join(' ').toLowerCase();

  // Update last activity
  this.lastActivityAt = new Date();

  next();
});

// Post-save middleware for cache invalidation (keep only one instance)
userProfileSchema.post('save', function(doc: any) {
  // Invalidate cache for this user
  if (redisCache && redisCache.isConnected()) {
    redisCache.del(`profile:${doc.userId}`);
    // Note: Role-based search cache would need to be handled via User model population
  }
});

// Static methods for optimized queries
userProfileSchema.statics = {
  // Find profiles by role
  findByRole: function(role: UserRole, options: { limit?: number; skip?: number; sort?: any } = {}) {
    const query = this.find({ experienceLevel: role })
      .populate('userId', 'email role lastLoginAt')
      .select('-searchVector');
    if (options.limit) query.limit(options.limit);
    if (options.skip) query.skip(options.skip);
    if (options.sort) query.sort(options.sort);
    return query.lean().exec();
  },

  // Find profiles by field
  findByField: function(field: UserField, options: { limit?: number; skip?: number; sort?: any } = {}) {
    const query = this.find({ field })
      .populate('userId', 'email isActive lastLoginAt')
      .select('-searchVector');
    if (options.limit) query.limit(options.limit);
    if (options.skip) query.skip(options.skip);
    if (options.sort) query.sort(options.sort);
    return query.lean().exec();
  },

  // Search profiles with text search
  searchProfiles: function(searchTerm: string, options: { limit?: number; skip?: number; targetLanguage?: string } = {}) {
    const query: any = {
      $text: { $search: searchTerm }
    };

    if (options.targetLanguage) {
      query.targetLanguage = options.targetLanguage;
    }

    const dbQuery = this.find(query, { score: { $meta: 'textScore' } })
      .populate('userId', 'email role lastLoginAt')
      .select('-searchVector')
      .sort({ score: { $meta: 'textScore' } });

    if (options.limit) dbQuery.limit(options.limit);
    if (options.skip) dbQuery.skip(options.skip);

    return dbQuery.lean().exec();
  },

  // Get profile statistics
  getProfileStats: function() {
    return this.aggregate([
      {
        $group: {
          _id: {
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
          _id: '$_id.experienceLevel',
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
  },

  // Find profiles with duplicate prevention
  createOrUpdateProfile: async function(userId: mongoose.Types.ObjectId, profileData: Partial<IUserProfile>) {
    try {
      const result = await this.findOneAndUpdate(
        { userId },
        {
          ...profileData,
          lastActivityAt: new Date(),
          $setOnInsert: { createdAt: new Date() }
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      ).populate('userId', 'email role lastLoginAt');

      return result;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new Error('Profile already exists for this user');
      }
      throw error;
    }
  }
};

const UserProfile: IUserProfileModel = mongoose.model<IUserProfile, IUserProfileModel>('UserProfile', userProfileSchema);

export default UserProfile;
