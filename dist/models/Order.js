import mongoose, { Schema } from 'mongoose';
const orderSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    receipt: { type: String, index: true },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created', index: true },
    meta: { type: Schema.Types.Mixed },
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);
export default Order;
//# sourceMappingURL=Order.js.map