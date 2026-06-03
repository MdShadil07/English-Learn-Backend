import mongoose, { Schema } from 'mongoose';
const subscriptionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    planId: {
        type: Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        required: [true, 'Plan ID is required'],
    },
    tier: {
        type: String,
        enum: ['free', 'pro', 'premium'],
        required: [true, 'Tier is required'],
        default: 'premium',
    },
    planType: {
        type: String,
        enum: ['monthly', 'yearly', 'lifetime', 'manual'],
        required: [true, 'Plan type is required'],
    },
    status: {
        type: String,
        enum: ['active', 'canceled', 'expired', 'pending'],
        default: 'pending',
    },
    expiresAt: {
        type: Date,
        required: [true, 'Expiration date is required'],
        default: Date.now,
    },
    canceledAt: {
        type: Date,
    },
    reason: {
        type: String,
    },
    autoRenew: {
        type: Boolean,
        default: false,
    },
    paymentMethod: {
        type: String,
    },
    transactionId: {
        type: String,
    },
    billingRetries: {
        type: Number,
        default: 0,
    },
    razorpay: {
        subscriptionId: { type: String },
        orderId: { type: String },
        paymentId: { type: String },
        signature: { type: String },
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Virtuals
subscriptionSchema.virtual('endDate').get(function () {
    return this.expiresAt;
});
subscriptionSchema.virtual('razorpaySubscriptionId').get(function () {
    return this.razorpay?.subscriptionId;
});
// Optimized indexes for subscription management
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1, status: 1 });
subscriptionSchema.index({ planId: 1, status: 1 });
subscriptionSchema.index({ 'razorpay.subscriptionId': 1 }, { sparse: true });
subscriptionSchema.index({ startAt: -1, status: 1 });
subscriptionSchema.index({
    userId: 1,
    status: 1,
    expiresAt: 1
});
// Static methods
subscriptionSchema.statics.findActiveByUserId = function (userId) {
    return this.findOne({
        userId,
        status: 'active',
        $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null }, // Lifetime subscriptions
        ],
    }).sort({ createdAt: -1 });
};
subscriptionSchema.statics.findExpiredSubscriptions = function () {
    return this.find({
        status: 'active',
        expiresAt: { $lt: new Date() },
    });
};
const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
//# sourceMappingURL=Subscription.js.map