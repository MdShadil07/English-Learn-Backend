import mongoose, { Document, Schema } from 'mongoose';

export type PronunciationAnalysisJobState =
  | 'QUEUED'
  | 'VALIDATING'
  | 'DOWNLOADING'
  | 'PREPROCESSING'
  | 'INFERENCE'
  | 'SCORING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'TIMED_OUT'
  | 'CANCELLED';

export interface IPronunciationJobHistoryEntry {
  state: PronunciationAnalysisJobState;
  at: Date;
  message?: string;
  workerId?: string;
}

export interface IPronunciationJob extends Document {
  _id: mongoose.Types.ObjectId;
  attemptId: string;
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  passageId: mongoose.Types.ObjectId;
  audioUrl: string;
  audioObjectKey?: string;
  audioMimeType?: string;
  transcript: string;
  attemptNumber: number;
  status: PronunciationAnalysisJobState;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  queueLatencyMs?: number;
  processingLatencyMs?: number;
  lastError?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
    at: Date;
  };
  history: IPronunciationJobHistoryEntry[];
  workerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pronunciationJobHistorySchema = new Schema<IPronunciationJobHistoryEntry>(
  {
    state: {
      type: String,
      enum: ['QUEUED', 'VALIDATING', 'DOWNLOADING', 'PREPROCESSING', 'INFERENCE', 'SCORING', 'COMPLETED', 'FAILED', 'RETRYING', 'TIMED_OUT', 'CANCELLED'],
      required: true,
    },
    at: { type: Date, required: true },
    message: { type: String, default: null },
    workerId: { type: String, default: null },
  },
  { _id: false }
);

const pronunciationJobSchema = new Schema<IPronunciationJob>(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'PracticeSession', required: true, index: true },
    passageId: { type: Schema.Types.ObjectId, ref: 'Passage', required: true, index: true },
    audioUrl: { type: String, required: true, trim: true },
    audioObjectKey: { type: String, default: null, trim: true },
    audioMimeType: { type: String, default: null, trim: true },
    transcript: { type: String, required: true },
    attemptNumber: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ['QUEUED', 'VALIDATING', 'DOWNLOADING', 'PREPROCESSING', 'INFERENCE', 'SCORING', 'COMPLETED', 'FAILED', 'RETRYING', 'TIMED_OUT', 'CANCELLED'],
      default: 'QUEUED',
      index: true,
    },
    retryCount: { type: Number, default: 0, min: 0 },
    maxRetries: { type: Number, default: 3, min: 0 },
    timeoutMs: { type: Number, default: 90000, min: 1000 },
    queueLatencyMs: { type: Number, default: null },
    processingLatencyMs: { type: Number, default: null },
    lastError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      details: { type: Schema.Types.Mixed, default: null },
      at: { type: Date, default: null },
    },
    history: { type: [pronunciationJobHistorySchema], default: [] },
    workerId: { type: String, default: null },
  },
  { timestamps: true }
);

pronunciationJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
pronunciationJobSchema.index({ sessionId: 1, createdAt: -1 });

export default mongoose.model<IPronunciationJob>('PronunciationJob', pronunciationJobSchema);
