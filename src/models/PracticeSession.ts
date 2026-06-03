import mongoose, { Schema, Document } from 'mongoose';

export interface IPracticeSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  passageId: mongoose.Types.ObjectId;
  passageSnapshot: {
    text: string;
    passageVersion?: number;
    cefrLevel: string;
    exerciseType: string;
    curriculumTrack?: string;
    lessonGroup?: string;
    phonemeDensity?: number;
    phonemeTargets: string[];
    mtiTargets: string[];
    metadata: Record<string, any>;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  processingStage?: 'uploaded' | 'preprocessing' | 'transcribing' | 'aligning' | 'analyzing' | 'completed' | 'failed' | 'retry_required';
  recommendation: {
    grammarLevel?: number;
    vocabularyScore?: number;
    weakPhonemes?: string[];
    fluencyLevel?: string;
    exerciseType?: string;
    [key: string]: any;
  };
  attempts: mongoose.Types.ObjectId[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const practiceSessionSchema = new Schema<IPracticeSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    passageId: {
      type: Schema.Types.ObjectId,
      ref: 'Passage',
      required: true,
      index: true,
    },
    passageSnapshot: {
      text: { type: String, required: true, trim: true },
      passageVersion: { type: Number, default: 1 },
      cefrLevel: { type: String, required: true, trim: true },
      exerciseType: { type: String, required: true, trim: true },
      curriculumTrack: { type: String, default: 'general-english', trim: true },
      lessonGroup: { type: String, default: 'solo-practice', trim: true },
      phonemeDensity: { type: Number, default: 0 },
      phonemeTargets: { type: [String], default: [] },
      mtiTargets: { type: [String], default: [] },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    processingStage: {
      type: String,
      enum: ['uploaded', 'preprocessing', 'transcribing', 'aligning', 'analyzing', 'completed', 'failed', 'retry_required'],
      default: 'uploaded',
      index: true,
    },
    recommendation: {
      type: Schema.Types.Mixed,
      default: {},
    },
    attempts: [{ type: Schema.Types.ObjectId, ref: 'PracticeAttempt' }],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

practiceSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });
practiceSessionSchema.index({ passageId: 1 });

export default mongoose.model<IPracticeSession>('PracticeSession', practiceSessionSchema);
