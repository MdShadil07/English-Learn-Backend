import mongoose, { Schema } from 'mongoose';
const refreshTokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    token: {
        type: String,
        required: [true, 'Token is required'],
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: [true, 'Expiration date is required'],
    },
    isRevoked: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
// Indexes for better performance
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 });
refreshTokenSchema.index({ isRevoked: 1 });
// Static method to find valid token
refreshTokenSchema.statics.findValidToken = function (token, userId) {
    return this.findOne({
        token,
        userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
    });
};
// Static method to revoke all user tokens
refreshTokenSchema.statics.revokeAllUserTokens = function (userId) {
    return this.updateMany({ userId, isRevoked: false }, { isRevoked: true });
};
// Instance method to check if token is expired
refreshTokenSchema.methods.isExpired = function () {
    return this.expiresAt < new Date();
};
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
//# sourceMappingURL=RefreshToken.js.map