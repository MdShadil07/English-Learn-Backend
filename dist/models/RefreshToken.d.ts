import mongoose, { Document, Model } from 'mongoose';
export interface IRefreshToken extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    isRevoked: boolean;
}
export interface IRefreshTokenModel extends Model<IRefreshToken> {
    findValidToken(token: string, userId: mongoose.Types.ObjectId): Promise<IRefreshToken | null>;
    revokeAllUserTokens(userId: mongoose.Types.ObjectId): Promise<any>;
}
declare const RefreshToken: IRefreshTokenModel;
export default RefreshToken;
//# sourceMappingURL=RefreshToken.d.ts.map