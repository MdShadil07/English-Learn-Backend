import mongoose, { Schema } from 'mongoose';
const paymentSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    subscriptionId: {
        type: Schema.Types.ObjectId,
        ref: 'Subscription',
        required: [true, 'Subscription ID is required'],
    },
    provider: {
        type: String,
        enum: ['razorpay'],
        default: 'razorpay',
        required: true,
    },
    paymentId: {
        type: String,
        required: true,
    },
    orderId: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    status: {
        type: String,
        enum: ['created', 'authorized', 'captured', 'failed'],
        default: 'created',
    },
    raw: {
        type: Schema.Types.Mixed,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
paymentSchema.index({ userId: 1 });
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ subscriptionId: 1 });
// Static methods
paymentSchema.statics.findByPaymentId = function (paymentId) {
    return this.findOne({ paymentId });
};
const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
//# sourceMappingURL=Payment.js.map