import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  
  tier: 'free' | 'pro' | 'premium';
  planType: 'monthly' | 'yearly' | 'lifetime' | 'manual';

  status: 'active' | 'canceled' | 'expired' | 'pending';
  
  startAt: Date;
  endAt: Date | null; // null for lifetime plans
  canceledAt?: Date;
  reason?: string;

  autoRenew: boolean;
  paymentMethod?: string;
  transactionId?: string;
  billingRetries?: number;
  lastFailedPaymentAt?: Date | null;
  
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
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    tier: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      required: [true, 'Tier is required'],
      index: true,
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
      index: true,
    },
    startAt: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
    },
    endAt: {
      type: Date,
      default: null,
      index: true,
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
    billingRetries: {
      type: Number,
      default: 0,
      index: true,
    },
    lastFailedPaymentAt: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    razorpay: {
      subscriptionId: { type: String, index: true },
      orderId: { type: String },
      paymentId: { type: String },
      signature: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Keep compound index for common queries, avoid duplicate single-field indexes (they are set inline above)
subscriptionSchema.index({ userId: 1, status: 1 });

// Static methods
subscriptionSchema.statics.findActiveByUserId = function (userId: mongoose.Types.ObjectId) {
  return this.findOne({
    userId,
    status: 'active',
    $or: [
      { endAt: { $gt: new Date() } },
      { endAt: null }, // Lifetime subscriptions
    ],
  }).sort({ createdAt: -1 });
};

subscriptionSchema.statics.findExpiredSubscriptions = function () {
  return this.find({
    status: 'active',
    endAt: { $lt: new Date() },
  });
};

const Subscription: ISubscriptionModel = mongoose.model<ISubscription, ISubscriptionModel>(
  'Subscription',
  subscriptionSchema
);

export default Subscription;
