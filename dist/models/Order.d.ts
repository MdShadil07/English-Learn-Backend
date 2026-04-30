import mongoose, { Document, Model } from 'mongoose';
export interface IOrder extends Document {
    userId?: mongoose.Types.ObjectId | null;
    amount: number;
    currency: string;
    receipt?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    status: 'created' | 'paid' | 'failed' | 'refunded';
    meta?: Record<string, any>;
}
declare const Order: Model<IOrder>;
export default Order;
//# sourceMappingURL=Order.d.ts.map