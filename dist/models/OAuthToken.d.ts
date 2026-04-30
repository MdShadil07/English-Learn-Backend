import mongoose, { Document, Model } from 'mongoose';
export interface IOAuthToken extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    provider: 'google' | 'facebook' | 'apple';
    providerId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scopes: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface IOAuthTokenModel extends Model<IOAuthToken> {
    findByUserIdAndProvider(userId: mongoose.Types.ObjectId, provider: string): Promise<IOAuthToken | null>;
    findByProviderId(providerId: string): Promise<IOAuthToken | null>;
    deleteExpiredTokens(): Promise<void>;
}
declare const OAuthToken: IOAuthTokenModel;
export default OAuthToken;
//# sourceMappingURL=OAuthToken.d.ts.map