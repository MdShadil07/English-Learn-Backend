import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  full_name: string;
  field: 'student' | 'teacher' | 'professional';
  role: 'student' | 'teacher' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    full_name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    field: {
      type: String,
      enum: ['student', 'teacher', 'professional'],
      default: 'student',
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
    },
  },
  {
    timestamps: true,
  }
);

// Legacy indexes - keeping minimal for backward compatibility
profileSchema.index({ userId: 1 }, { unique: true });

const Profile: Model<IProfile> = mongoose.model<IProfile>('Profile', profileSchema);

export default Profile;
