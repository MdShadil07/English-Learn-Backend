import mongoose, { Schema, Document, Model } from 'mongoose';

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
  
  raw: any; // webhook payload

  createdAt: Date;
}

export interface IPaymentModel extends Model<IPayment> {
  findByPaymentId(paymentId: string): Promise<IPayment | null>;
}

const paymentSchema = new Schema<IPayment, IPaymentModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID is required'],
      index: true,
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
      index: true,
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
// Field-level `index: true` is declared above for these fields. Avoid duplicate single-field indexes.

// Static methods
paymentSchema.statics.findByPaymentId = function (paymentId: string) {
  return this.findOne({ paymentId });
};

const Payment: IPaymentModel = mongoose.model<IPayment, IPaymentModel>('Payment', paymentSchema);

export default Payment;
