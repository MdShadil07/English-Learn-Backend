import mongoose, { Document, Model } from 'mongoose';
export interface ISubscription extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    planId: mongoose.Types.ObjectId;
    tier: 'free' | 'pro' | 'premium';
    planType: 'monthly' | 'yearly' | 'lifetime' | 'manual';
    status: 'active' | 'canceled' | 'expired' | 'pending';
    startAt: Date;
    endAt: Date | null;
    canceledAt?: Date;
    reason?: string;
    autoRenew: boolean;
    paymentMethod?: string;
    transactionId?: string;
    billingRetries?: number;
    endDate?: Date | null;
    razorpaySubscriptionId?: string;
    razorpay: {
        subscriptionId?: string;
        orderId?: string;
        paymentId?: string;
        signature?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface ISubscriptionModel extends Model<ISubscription> {
    findActiveByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription | null>;
    findExpiredSubscriptions(): Promise<ISubscription[]>;
}
declare const Subscription: ISubscriptionModel;
export default Subscription;
//# sourceMappingURL=Subscription.d.ts.map