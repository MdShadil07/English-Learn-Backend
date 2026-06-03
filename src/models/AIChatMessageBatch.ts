import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAIChatStoredMessage {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  personalityId?: string;
}

export interface IAIChatMessageBatch extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: string;
  userId: mongoose.Types.ObjectId;
  personalityId: string;
  sequenceStart: number;
  sequenceEnd: number;
  messages: IAIChatStoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const storedMessageSchema = new Schema<IAIChatStoredMessage>(
  {
    messageId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 12000,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    personalityId: {
      type: String,
      trim: true,
      maxlength: 80,
    },
  },
  { _id: false }
);

const aiChatMessageBatchSchema = new Schema<IAIChatMessageBatch>(
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
    sequenceStart: {
      type: Number,
      required: true,
      min: 0,
    },
    sequenceEnd: {
      type: Number,
      required: true,
      min: 0,
    },
    messages: {
      type: [storedMessageSchema],
      default: [],
      validate: {
        validator(messages: IAIChatStoredMessage[]) {
          return messages.length > 0 && messages.length <= 50;
        },
        message: 'A message batch must contain between 1 and 50 messages',
      },
    },
  },
  {
    timestamps: true,
  }
);

aiChatMessageBatchSchema.index({ userId: 1, conversationId: 1, sequenceStart: 1 });
aiChatMessageBatchSchema.index({ userId: 1, personalityId: 1, createdAt: -1 });

const AIChatMessageBatch: Model<IAIChatMessageBatch> = mongoose.model<IAIChatMessageBatch>(
  'AIChatMessageBatch',
  aiChatMessageBatchSchema
);

export default AIChatMessageBatch;
