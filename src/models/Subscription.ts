import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  
  tier: 'free' | 'pro' | 'premium';
  planType: 'monthly' | 'yearly' | 'lifetime' | 'manual';

  status: 'active' | 'canceled' | 'expired' | 'pending';
  
  startAt: Date;
  expiresAt: Date | null; // null for lifetime plans
  canceledAt?: Date;
  reason?: string;

  autoRenew: boolean;
  paymentMethod?: string;
  transactionId?: string;
  billingRetries?: number;
      
  razorpay: {
    subscriptionId?: string;        // razorpay subscription_id
    orderId?: string;               // initial order id
    paymentId?: string;             // last payment id
    signature?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionModel extends Model<ISubscription> {
  findActiveByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription | null>;
  findExpiredSubscriptions(): Promise<ISubscription[]>;
}

const subscriptionSchema = new Schema<ISubscription, ISubscriptionModel>(
  {
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
      default: 'premium',
      
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
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      default: Date.now,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals
subscriptionSchema.virtual('endDate').get(function (this: ISubscription) {
  return this.expiresAt;
});

subscriptionSchema.virtual('razorpaySubscriptionId').get(function (this: ISubscription) {
  return this.razorpay?.subscriptionId;
});

// Optimized indexes for subscription management
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1, status: 1 });
subscriptionSchema.index({ planId: 1, status: 1 });
subscriptionSchema.index({ 'razorpay.subscriptionId': 1 }, { sparse: true });
subscriptionSchema.index({ startAt: -1, status: 1 });
subscriptionSchema.index({ 
  userId: 1, 
  status: 1, 
  expiresAt: 1 
});

// Static methods
subscriptionSchema.statics.findActiveByUserId = function (userId: mongoose.Types.ObjectId) {
  return this.findOne({
    userId,
    status: 'active',
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }, // Lifetime subscriptions
    ],
  }).sort({ createdAt: -1 });
};

subscriptionSchema.statics.findExpiredSubscriptions = function () {
  return this.find({
    status: 'active',
    expiresAt: { $lt: new Date() },
  });
};

const Subscription: ISubscriptionModel = mongoose.model<ISubscription, ISubscriptionModel>(
  'Subscription',
  subscriptionSchema
);

export default Subscription;
