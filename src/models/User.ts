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
      index: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
      index: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
      index: true,
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
      index: true,
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
      required: [true, 'Role is required'],
      index: true,
    },
    // Denormalized subscription fields stored inside user for fast access
    subscription: {
      planCode: {
        type: String,
        default: 'FREE',
        index: true,
      },
      status: {
        type: String,
        enum: ['active', 'expired', 'none'],
        default: 'none',
        index: true,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Performance optimized indexes
userSchema.index({ createdAt: -1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ 'subscription.expiresAt': 1 });

// Virtuals
userSchema.virtual('fullName').get(function (this: IUser) {
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
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
  const user = this as unknown as IUser;
  return bcrypt.compare(candidatePassword, user.password);
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
  if (userObject && typeof userObject === 'object') delete userObject.password;
  return userObject;
};

const User: IUserModel = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;
