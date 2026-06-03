import mongoose, { Schema, Document, Model } from 'mongoose';

export type SupportCategory = 'general' | 'billing' | 'technical' | 'account' | 'feature';
export type SupportUrgency = 'low' | 'normal' | 'high' | 'urgent';
export type SupportTicketStatus = 'new' | 'in_progress' | 'resolved' | 'closed';
export type SupportDeliveryStatus = 'queued' | 'sent' | 'failed';

export interface ISupportInquiry extends Document {
  _id: mongoose.Types.ObjectId;
  ticketNumber: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: SupportCategory;
  urgency: SupportUrgency;
  status: SupportTicketStatus;
  deliveryStatus: SupportDeliveryStatus;
  source?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  browserLanguage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupportInquiryModel extends Model<ISupportInquiry> {
  buildTicketNumber(): string;
}

const supportInquirySchema = new Schema<ISupportInquiry, ISupportInquiryModel>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: 5,
      maxlength: 160,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: 20,
      maxlength: 5000,
    },
    category: {
      type: String,
      enum: ['general', 'billing', 'technical', 'account', 'feature'],
      default: 'general',
      index: true,
    },
    urgency: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved', 'closed'],
      default: 'new',
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      index: true,
    },
    source: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    pageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    referrer: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    browserLanguage: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

supportInquirySchema.index({ createdAt: -1 });
supportInquirySchema.index({ email: 1, createdAt: -1 });
supportInquirySchema.index({ status: 1, urgency: 1, createdAt: -1 });

supportInquirySchema.statics.buildTicketNumber = function buildTicketNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CS-${datePart}-${randomPart}`;
};

const SupportInquiry: ISupportInquiryModel = mongoose.model<ISupportInquiry, ISupportInquiryModel>(
  'SupportInquiry',
  supportInquirySchema
);

export default SupportInquiry;