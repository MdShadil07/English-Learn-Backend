import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
const userSchema = new Schema({
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
        required: function () {
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
    // Email verification
    isEmailVerified: {
        type: Boolean,
        default: false,
        index: true,
    },
    welcomeEmailSent: {
        type: Boolean,
        default: false,
    },
    lastLoginAt: {
        type: Date,
        default: null,
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Performance optimized indexes
userSchema.index({ createdAt: -1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ 'subscription.expiresAt': 1 });
userSchema.index({ 'googleAuth.googleId': 1 });
// Compound indexes for common query patterns (Phase 1 scalability)
userSchema.index({
    'subscription.status': 1,
    'subscription.expiresAt': 1
});
userSchema.index({
    isEmailVerified: 1,
    createdAt: -1
});
userSchema.index({
    role: 1,
    createdAt: -1
});
userSchema.index({
    'googleAuth.isLinked': 1,
    'googleAuth.linkedAt': -1
});
// TTL index for cleanup of unverified accounts (30 days)
userSchema.index({ createdAt: 1 }, {
    expireAfterSeconds: 2592000, // 30 days
    partialFilterExpression: { isEmailVerified: false }
});
// Virtuals
userSchema.virtual('fullName').get(function () {
    return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});
userSchema.virtual('tier').get(function () {
    return (this.subscription?.planCode?.toLowerCase() || 'free');
});
userSchema.virtual('subscriptionStatus').get(function () {
    return this.subscription?.status || 'none';
});
userSchema.virtual('subscriptionEndDate').get(function () {
    return this.subscription?.expiresAt;
});
// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    const user = this;
    if (typeof user.isModified === 'function' && !user.isModified('password'))
        return next();
    try {
        // Hash password with cost of 12 for better security
        if (user.password) {
            user.password = await bcrypt.hash(user.password, 12);
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
    const user = this;
    return bcrypt.compare(candidatePassword, user.password);
};
// Instance method to get full name
userSchema.methods.getFullName = function () {
    const user = this;
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
};
// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};
// Static method to find user by username
userSchema.statics.findByUsername = function (username) {
    return this.findOne({ username: username.toLowerCase() });
};
// Static method to find active users
userSchema.statics.findActiveUsers = function () {
    return this.find({}).select('-password');
};
// Static method to find users by role
userSchema.statics.findByRole = function (role) {
    return this.find({ role }).select('-password');
};
// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const user = this;
    const userObject = user.toObject ? user.toObject() : { ...user };
    if (userObject && typeof userObject === 'object')
        delete userObject.password;
    return userObject;
};
const User = mongoose.model('User', userSchema);
export default User;
//# sourceMappingURL=User.js.map