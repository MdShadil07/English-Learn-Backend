import mongoose, { Document, Model } from 'mongoose';
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
    googleAuth?: {
        googleId: string;
        accessToken?: string;
        refreshToken?: string;
        email: string;
        profilePicture?: string;
        isLinked: boolean;
        linkedAt?: Date;
        linkedBy?: 'manual' | 'sso_first_time' | 'email_verification';
    };
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    isEmailVerified: boolean;
    welcomeEmailSent: boolean;
    isVerified?: boolean;
    verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
    lastLoginAt?: Date;
    lastActiveAt?: Date;
    subscription: {
        planCode: string;
        status: 'active' | 'expired' | 'none';
        expiresAt?: Date | null;
        subscriptionId?: mongoose.Types.ObjectId | null;
        renewedAt?: Date | null;
    };
    createdAt: Date;
    updatedAt: Date;
    fullName: string;
    tier: {
        type: String;
        enum: ['free', 'pro', 'premium'];
        default: 'premium';
    };
    subscriptionStatus: 'active' | 'expired' | 'none';
    subscriptionEndDate?: Date | null;
    pronunciationProfile?: {
        accentLocale: string;
        weakPhonemes: Array<{
            phoneme: string;
            score: number;
            updatedAt: Date;
        }>;
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
declare const User: IUserModel;
export default User;
//# sourceMappingURL=User.d.ts.map