import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  username?: string;
  role: 'student' | 'teacher' | 'admin';
  accountStatus: 'active' | 'suspended' | 'banned' | 'deleted';
  statusReason?: string;
  
  // OAuth authentication fields
  googleAuth?: {
    googleId: string;
    accessToken?: string;
    refreshToken?: string;
    email: string;
    profilePicture?: string;
    // Account linking status
    isLinked: boolean;
    linkedAt?: Date;
    linkedBy?: 'manual' | 'sso_first_time' | 'email_verification';
  };
  
  // Password Reset fields
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  
  // Email verification
  isEmailVerified: boolean;
  welcomeEmailSent: boolean;
  isVerified?: boolean;
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  
  // Quick-access subscription snapshot
  subscription: {
    planCode: string;               // "FREE", "PRO", "PREMIUM"
    status: 'active' | 'expired' | 'none';
    expiresAt?: Date | null;        // subscription end time
    subscriptionId?: mongoose.Types.ObjectId | null; // reference to subscriptions collection
    renewedAt?: Date | null;
  };
  
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
  tier: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'premium',
    };
  subscriptionStatus: 'active' | 'expired' | 'none';
  subscriptionEndDate?: Date | null;
  pronunciationProfile?: {
    accentLocale: string;
    weakPhonemes: Array<{ phoneme: string; score: number; updatedAt: Date }>;
    speechProfile: {
      averagePronunciationScore: number;
      averageWordsPerMinute: number;
      averageAsrConfidence: number;
      lastProcessedAt?: Date | null;
    };
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
  toJSON(): any;
  toObject(): any;
}

export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findByUsername(username: string): Promise<IUser | null>;
  findActiveUsers(): Promise<IUser[]>;
  findByRole(role: string): Promise<IUser[]>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: function(this: IUser) {
        // Password is optional for OAuth users
        return !this.googleAuth?.googleId;
      },
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
      required: [true, 'Role is required'],
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'banned', 'deleted'],
      default: 'active',
    },
    statusReason: {
      type: String,
    },
    // OAuth authentication fields
    googleAuth: {
      googleId: {
        type: String,
        sparse: true,
      },
      accessToken: {
        type: String,
        select: false, // Don't include in queries by default
      },
      refreshToken: {
        type: String,
        select: false, // Don't include in queries by default
      },
      email: {
        type: String,
      },
      profilePicture: {
        type: String,
      },
      // Account linking status
      isLinked: {
        type: Boolean,
        default: false,
      },
      linkedAt: {
        type: Date,
        default: null,
      },
      linkedBy: {
        type: String, // 'manual' | 'sso_first_time' | 'email_verification'
        default: null,
      },
    },
    
    // Password Reset
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    // Email verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['none', 'pending', 'verified', 'rejected'],
      default: 'none',
    },
    welcomeEmailSent: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    // Subscription fields for fast access
    subscription: {
      planCode: {
        type: String,
        default: 'PREMIUM',
      },
      status: {
        type: String,
        enum: ['active', 'expired', 'none'],
        default: 'none',
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      subscriptionId: {
        type: Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null,
      },
      renewedAt: {
        type: Date,
        default: null,
      },
    },
    pronunciationProfile: {
      accentLocale: {
        type: String,
        default: 'en-IN',
      },
      weakPhonemes: {
        type: [
          {
            phoneme: { type: String, required: true },
            score: { type: Number, default: 0 },
            updatedAt: { type: Date, default: Date.now },
          },
        ],
        default: [],
      },
      speechProfile: {
        averagePronunciationScore: { type: Number, default: 0 },
        averageWordsPerMinute: { type: Number, default: 0 },
        averageAsrConfidence: { type: Number, default: 0 },
        lastProcessedAt: { type: Date, default: null },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Performance optimized indexes for enterprise scale
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });

// Compound indexes for common query patterns (optimized for millions of users)
userSchema.index({ 
  'subscription.status': 1, 
  'subscription.expiresAt': 1, 
  createdAt: -1
});
userSchema.index({ 
  isEmailVerified: 1, 
  createdAt: -1 
});
userSchema.index({ 
  'googleAuth.isLinked': 1, 
  'googleAuth.linkedAt': -1 
});
userSchema.index({ 
  lastLoginAt: -1, 
  'subscription.status': 1 
});

// TTL index for cleanup of unverified accounts (30 days)
userSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 2592000, // 30 days
    partialFilterExpression: { isEmailVerified: false }
  }
);

// Virtuals
userSchema.virtual('fullName').get(function (this: IUser) {
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

userSchema.virtual('tier').get(function (this: IUser) {
  return (this.subscription?.planCode?.toLowerCase() || 'free') as 'free' | 'pro' | 'premium';
});

userSchema.virtual('subscriptionStatus').get(function (this: IUser) {
  return this.subscription?.status || 'none';
});

userSchema.virtual('subscriptionEndDate').get(function (this: IUser) {
  return this.subscription?.expiresAt;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  const user = this as unknown as IUser;
  if (typeof (user as any).isModified === 'function' && !(user as any).isModified('password')) return next();

  try {
    // Hash password with cost of 12 for better security
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 12);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const user = this as any;

  try {
    if (typeof candidatePassword !== 'string' || candidatePassword.length === 0) {
      // Invalid candidate password supplied
      return false;
    }

    const stored = user.password;
    if (typeof stored !== 'string' || stored.length === 0) {
      // Stored password missing (likely not selected in the query)
      console.warn('comparePassword: stored password is missing for user', user._id ? user._id.toString() : '(unknown)');
      return false;
    }

    // bcrypt.compare can throw if arguments are invalid; wrap in try/catch
    const result = await bcrypt.compare(candidatePassword, stored);
    return !!result;
  } catch (err) {
    console.error('comparePassword error:', err);
    return false;
  }
};

// Instance method to get full name
userSchema.methods.getFullName = function (): string {
  const user = this as unknown as IUser;
  return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find user by username
userSchema.statics.findByUsername = function (username: string) {
  return this.findOne({ username: username.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActiveUsers = function () {
  return this.find({}).select('-password');
};

// Static method to find users by role
userSchema.statics.findByRole = function (role: string) {
  return this.find({ role }).select('-password');
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const user = this as unknown as IUser;
  const userObject = (user as any).toObject ? (user as any).toObject() : { ...user };
  if (userObject && typeof userObject === 'object') {
    delete userObject.password;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpires;
  }
  return userObject;
};

const User: IUserModel = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;
