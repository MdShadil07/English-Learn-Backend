import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  type: string; // e.g., "SUBSCRIPTION_EXPIRED", "PAYMENT_FAILED"
  userId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  metadata: any;
  createdAt: Date;
}

export interface IEventModel extends Model<IEvent> {
  // Add static methods if needed
}

const eventSchema = new Schema<IEvent, IEventModel>(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
eventSchema.index({ userId: 1, createdAt: -1 });
eventSchema.index({ type: 1 });

const Event: IEventModel = mongoose.model<IEvent, IEventModel>('Event', eventSchema);

export default Event;
