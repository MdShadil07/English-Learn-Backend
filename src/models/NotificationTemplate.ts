import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationTemplate extends Document {
  actionKey: string;
  title: string;
  message: string;
  type: 'system' | 'billing' | 'alert' | 'message';
}

const notificationTemplateSchema = new Schema<INotificationTemplate>({
  actionKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['system', 'billing', 'alert', 'message'],
    default: 'system'
  }
});

export const NotificationTemplate = mongoose.model<INotificationTemplate>('NotificationTemplate', notificationTemplateSchema);
