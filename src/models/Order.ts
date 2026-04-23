import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrder extends Document {
  userId?: mongoose.Types.ObjectId | null;
  amount: number; // in smallest currency unit (e.g., paise)
  currency: string;
  receipt?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  meta?: Record<string, any>;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    receipt: { type: String, index: true },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created', index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
