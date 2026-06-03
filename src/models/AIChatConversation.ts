import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAIChatConversation extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: string;
  userId: mongoose.Types.ObjectId;
  personalityId: string;
  title: string;
  status: 'active' | 'archived';
  messageCount: number;
  lastMessagePreview: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiChatConversationSchema = new Schema<IAIChatConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    personalityId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessagePreview: {
      type: String,
      default: '',
      maxlength: 240,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

aiChatConversationSchema.index({ userId: 1, conversationId: 1 }, { unique: true });
aiChatConversationSchema.index({ userId: 1, personalityId: 1, lastMessageAt: -1 });

const AIChatConversation: Model<IAIChatConversation> = mongoose.model<IAIChatConversation>(
  'AIChatConversation',
  aiChatConversationSchema
);

export default AIChatConversation;
