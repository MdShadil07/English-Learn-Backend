import mongoose, { Document, Schema } from 'mongoose';

export interface IUserPhonemeProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  phoneme: string;
  attempts: number;
  averageScore: number;
  improvementTrend: Array<{ recordedAt: Date; score: number }>;
  severityTrend: Array<{ recordedAt: Date; severity: number }>;
  commonSubstitutions: Array<{ phoneme: string; count: number }>;
  weakestWords: Array<{ word: string; score: number; updatedAt: Date }>;
  recommendedDrills: Array<{ type: string; word?: string; instruction: string; confidence?: number }>;
  lastAttemptId?: mongoose.Types.ObjectId | null;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const trendPointSchema = new Schema(
  {
    recordedAt: { type: Date, required: true },
    score: { type: Number, min: 0, max: 100 },
    severity: { type: Number, min: 0, max: 5 },
  },
  { _id: false }
);

const commonSubstitutionSchema = new Schema(
  {
    phoneme: { type: String, required: true, trim: true },
    count: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const weakestWordSchema = new Schema(
  {
    word: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    updatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const recommendedDrillSchema = new Schema(
  {
    type: { type: String, required: true, trim: true },
    word: { type: String, default: null, trim: true },
    instruction: { type: String, required: true, trim: true },
    confidence: { type: Number, default: null, min: 0, max: 1 },
  },
  { _id: false }
);

const userPhonemeProfileSchema = new Schema<IUserPhonemeProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phoneme: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    improvementTrend: {
      type: [trendPointSchema],
      default: [],
    },
    severityTrend: {
      type: [trendPointSchema],
      default: [],
    },
    commonSubstitutions: {
      type: [commonSubstitutionSchema],
      default: [],
    },
    weakestWords: {
      type: [weakestWordSchema],
      default: [],
    },
    recommendedDrills: {
      type: [recommendedDrillSchema],
      default: [],
    },
    lastAttemptId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeAttempt',
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

userPhonemeProfileSchema.index({ userId: 1, phoneme: 1 }, { unique: true });

export default mongoose.model<IUserPhonemeProfile>('UserPhonemeProfile', userPhonemeProfileSchema);
