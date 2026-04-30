import mongoose, { Schema } from 'mongoose';
const subscriptionPlanSchema = new Schema({
    code: {
        type: String,
        required: [true, 'Plan code is required'],
        unique: true,
        uppercase: true,
        trim: true,
    },
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true,
    },
    billingPeriod: {
        type: String,
        enum: ['monthly', 'yearly', 'lifetime'],
        required: [true, 'Billing period is required'],
    },
    durationDays: {
        type: Number,
        default: 30, // Default to monthly
    },
    tier: {
        type: String,
        enum: ['free', 'pro', 'premium'],
        required: [true, 'Tier is required'],
    },
    features: {
        maxProjects: { type: Number, default: 0 },
        aiMessages: { type: Number, default: 0 },
        prioritySupport: { type: Boolean, default: false },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
// Indexes
subscriptionPlanSchema.index({ code: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1 });
subscriptionPlanSchema.index({ tier: 1 });
// Static methods
subscriptionPlanSchema.statics.findByCode = function (code) {
    return this.findOne({ code, isActive: true });
};
subscriptionPlanSchema.statics.findActivePlans = function () {
    return this.find({ isActive: true }).sort({ price: 1 });
};
subscriptionPlanSchema.statics.findByTier = function (tier) {
    return this.find({ tier, isActive: true }).sort({ price: 1 });
};
const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;
//# sourceMappingURL=SubscriptionPlan.js.map