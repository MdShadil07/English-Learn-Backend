import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  _id: mongoose.Types.ObjectId;
  code: string; // "FREE", "PRO", "PREMIUM"
  name: string;
  description: string;
  price: number; // in paisa/cents
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'lifetime';
  durationDays: number | null; // null for lifetime
  tier: 'free' | 'pro' | 'premium';
  features: {
    maxProjects: number;
    aiMessages: number;
    prioritySupport: boolean;
    [key: string]: any; // Allow extensibility
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

const subscriptionPlanSchema = new Schema<ISubscriptionPlan, ISubscriptionPlanModel>(
  {
    code: {
      type: String,
      required: [true, 'Plan code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
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
      index: true,
    },
    features: {
      maxProjects: { type: Number, default: 0 },
      aiMessages: { type: Number, default: 0 },
      prioritySupport: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
subscriptionPlanSchema.index({ code: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1 });
subscriptionPlanSchema.index({ tier: 1 });

// Static methods
subscriptionPlanSchema.statics.findByCode = function (code: string) {
  return this.findOne({ code, isActive: true });
};

subscriptionPlanSchema.statics.findActivePlans = function () {
  return this.find({ isActive: true }).sort({ price: 1 });
};

subscriptionPlanSchema.statics.findByTier = function (tier: 'free' | 'pro' | 'premium') {
  return this.find({ tier, isActive: true }).sort({ price: 1 });
};

const SubscriptionPlan: ISubscriptionPlanModel = mongoose.model<ISubscriptionPlan, ISubscriptionPlanModel>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

export default SubscriptionPlan;
