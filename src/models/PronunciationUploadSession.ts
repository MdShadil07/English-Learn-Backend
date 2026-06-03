import mongoose, { Document, Schema } from 'mongoose';

export interface IPronunciationUploadSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  practiceSessionId: mongoose.Types.ObjectId;
  uploadToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  chunkSizeBytes: number;
  totalChunks: number;
  uploadedParts: number[];
  uploadedBytes: number;
  status: 'initiated' | 'uploading' | 'uploaded' | 'preprocessing' | 'transcribing' | 'aligning' | 'analyzing' | 'assembled' | 'queued' | 'completed' | 'cancelled' | 'failed' | 'retry_required';
  tempPrefix: string;
  finalObjectKey?: string | null;
  finalAudioUrl?: string | null;
  waveformPeaks?: number[];
  qualityMetrics?: Record<string, unknown>;
  deviceMetadata?: Record<string, unknown>;
  networkMetadata?: Record<string, unknown>;
  validation?: {
    silenceRatio?: number;
    clippedSamplesRatio?: number;
    averageLevel?: number;
    backgroundNoiseEstimate?: number;
    speechToNoiseRatio?: number;
    audioQualityScore?: number;
    warnings?: string[];
  };
  observability?: {
    uploadFailureCount?: number;
    lowQualityAudio?: boolean;
    asrRetryRequired?: boolean;
    queueLatencyMs?: number;
    averageAnalysisTimeMs?: number;
    analysisStartedAt?: Date;
    analysisCompletedAt?: Date;
  };
  errorMessage?: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pronunciationUploadSessionSchema = new Schema<IPronunciationUploadSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    practiceSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSession',
      required: true,
      index: true,
    },
    uploadToken: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    durationMs: {
      type: Number,
      default: null,
    },
    chunkSizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    totalChunks: {
      type: Number,
      required: true,
      min: 1,
    },
    uploadedParts: {
      type: [Number],
      default: [],
    },
    uploadedBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['initiated', 'uploading', 'uploaded', 'preprocessing', 'transcribing', 'aligning', 'analyzing', 'assembled', 'queued', 'completed', 'cancelled', 'failed', 'retry_required'],
      default: 'initiated',
      index: true,
    },
    tempPrefix: {
      type: String,
      required: true,
      trim: true,
    },
    finalObjectKey: {
      type: String,
      default: null,
      trim: true,
    },
    finalAudioUrl: {
      type: String,
      default: null,
      trim: true,
    },
    waveformPeaks: {
      type: [Number],
      default: [],
    },
    qualityMetrics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deviceMetadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    networkMetadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    validation: {
      silenceRatio: { type: Number, default: null },
      clippedSamplesRatio: { type: Number, default: null },
      averageLevel: { type: Number, default: null },
      backgroundNoiseEstimate: { type: Number, default: null },
      speechToNoiseRatio: { type: Number, default: null },
      audioQualityScore: { type: Number, default: null },
      warnings: { type: [String], default: [] },
    },
    observability: {
      type: Schema.Types.Mixed,
      default: {},
    },
    errorMessage: {
      type: String,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

pronunciationUploadSessionSchema.index({ userId: 1, practiceSessionId: 1, createdAt: -1 });
pronunciationUploadSessionSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model<IPronunciationUploadSession>('PronunciationUploadSession', pronunciationUploadSessionSchema);
