import mongoose, { Schema, Document, Model } from 'mongoose';

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

const oauthTokenSchema = new Schema<IOAuthToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    provider: {
      type: String,
      enum: ['google', 'facebook', 'apple'],
      required: [true, 'Provider is required'],
    },
    providerId: {
      type: String,
      required: [true, 'Provider ID is required'],
      sparse: true,
      index: true,
    },
    accessToken: {
      type: String,
      required: [true, 'Access token is required'],
      select: false, // Don't include in queries by default
    },
    refreshToken: {
      type: String,
      required: [true, 'Refresh token is required'],
      select: false, // Don't include in queries by default
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    scopes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common query patterns
oauthTokenSchema.index({ userId: 1, provider: 1 });
oauthTokenSchema.index({ provider: 1, providerId: 1 }, { sparse: true });

// TTL index for automatic cleanup of expired tokens
oauthTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Static method to find token by user ID and provider
oauthTokenSchema.statics.findByUserIdAndProvider = function(
  userId: mongoose.Types.ObjectId,
  provider: string
) {
  return this.findOne({ userId, provider });
};

// Static method to find token by provider ID
oauthTokenSchema.statics.findByProviderId = function(providerId: string) {
  return this.findOne({ providerId });
};

// Static method to delete expired tokens
oauthTokenSchema.statics.deleteExpiredTokens = async function() {
  const result = await this.deleteMany({ expiresAt: { $lt: new Date() } });
  console.log(`🗑️ Deleted ${result.deletedCount} expired OAuth tokens`);
  return result;
};

const OAuthToken: IOAuthTokenModel = mongoose.model<IOAuthToken, IOAuthTokenModel>('OAuthToken', oauthTokenSchema);

export default OAuthToken;
