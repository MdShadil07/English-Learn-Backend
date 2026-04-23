import mongoose, { Schema, Document, Model } from 'mongoose';

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

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
// Note: expiresAt index is already defined in schema field with index: true

// Static method to find valid token
refreshTokenSchema.statics.findValidToken = function (token: string, userId: mongoose.Types.ObjectId) {
  return this.findOne({
    token,
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

// Static method to revoke all user tokens
refreshTokenSchema.statics.revokeAllUserTokens = function (userId: mongoose.Types.ObjectId) {
  return this.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true }
  );
};

// Instance method to check if token is expired
refreshTokenSchema.methods.isExpired = function (): boolean {
  return this.expiresAt < new Date();
};

const RefreshToken: IRefreshTokenModel = mongoose.model<IRefreshToken, IRefreshTokenModel>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
