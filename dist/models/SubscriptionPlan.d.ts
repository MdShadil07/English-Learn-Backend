import mongoose, { Document, Model } from 'mongoose';
export interface ISubscriptionPlan extends Document {
    _id: mongoose.Types.ObjectId;
    code: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    billingPeriod: 'monthly' | 'yearly' | 'lifetime';
    durationDays: number | null;
    tier: 'free' | 'pro' | 'premium';
    features: {
        maxProjects: number;
        aiMessages: number;
        prioritySupport: boolean;
        [key: string]: any;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ISubscriptionPlanModel extends Model<ISubscriptionPlan> {
    findByCode(code: string): Promise<ISubscriptionPlan | null>;
    findActivePlans(): Promise<ISubscriptionPlan[]>;
    findByTier(tier: 'free' | 'pro' | 'premium'): Promise<ISubscriptionPlan[]>;
}
declare const SubscriptionPlan: ISubscriptionPlanModel;
export default SubscriptionPlan;
//# sourceMappingURL=SubscriptionPlan.d.ts.map