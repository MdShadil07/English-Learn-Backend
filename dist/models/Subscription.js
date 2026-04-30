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
    startAt: {
        type: Date,
        required: [true, 'Start date is required'],
        default: Date.now,
    },
    endAt: {
        type: Date,
        default: null,
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
    return this.endAt;
});
subscriptionSchema.virtual('razorpaySubscriptionId').get(function () {
    return this.razorpay?.subscriptionId;
});
// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endAt: 1 });
subscriptionSchema.index({ 'razorpay.subscriptionId': 1 });
// Static methods
subscriptionSchema.statics.findActiveByUserId = function (userId) {
    return this.findOne({
        userId,
        status: 'active',
        $or: [
            { endAt: { $gt: new Date() } },
            { endAt: null }, // Lifetime subscriptions
        ],
    }).sort({ createdAt: -1 });
};
subscriptionSchema.statics.findExpiredSubscriptions = function () {
    return this.find({
        status: 'active',
        endAt: { $lt: new Date() },
    });
};
const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
//# sourceMappingURL=Subscription.js.map