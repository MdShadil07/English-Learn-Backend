import mongoose, { Document, Model } from 'mongoose';
export interface IPayment extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    subscriptionId: mongoose.Types.ObjectId;
    provider: 'razorpay';
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    status: 'created' | 'authorized' | 'captured' | 'failed';
    raw: any;
    createdAt: Date;
}
export interface IPaymentModel extends Model<IPayment> {
    findByPaymentId(paymentId: string): Promise<IPayment | null>;
}
declare const Payment: IPaymentModel;
export default Payment;
//# sourceMappingURL=Payment.d.ts.map