import mongoose, { Schema, Document } from 'mongoose';

export interface IPracticeAttemptWordAnalysisItem {
  word: string;
  expectedPhonemes: string[];
  expectedStress?: number[];
  expectedSyllables?: number;
  actualPhonemes: string[];
  severity: number;
  score: number;
  startTime: number;
  endTime: number;
  issueType: string;
  animationCue?: Record<string, any>;
  componentScores?: {
    phonemeCorrectness: number;
    consonantCompletion: number;
    vowelQuality: number;
    stressCorrectness: number;
    durationTiming: number;
  };
}

export interface IPracticeAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  passageId: mongoose.Types.ObjectId;
  audioUrl: string;
  audioObjectKey?: string;
  audioMimeType?: string;
  uploadSessionId?: mongoose.Types.ObjectId;
  transcript: string;
  recognizedTranscript?: string;
  transcriptionProvider?: string;
  asrConfidence?: number;
  attemptNumber: number;
  analysisJobId?: string;
  attemptClassification?:
    | 'valid_reading'
    | 'partial_reading'
    | 'wrong_passage'
    | 'random_speech'
    | 'native_language'
    | 'low_audio_quality'
    | 'silence';
  status: 'pending' | 'uploaded' | 'preprocessing' | 'transcribing' | 'aligning' | 'analyzing' | 'completed' | 'failed' | 'retry_required';
  processingStage?: 'uploaded' | 'preprocessing' | 'transcribing' | 'aligning' | 'analyzing' | 'completed' | 'failed' | 'retry_required';
  scores: {
    pronunciation: number;
    fluency: number;
    stress: number;
    intonation: number;
    clarity: number;
    passageAccuracy?: number;
    wordAccuracy?: number;
    phonemeAccuracy?: number;
    intelligibility?: number;
    audioQuality?: number;
    [key: string]: number | undefined;
  };
  severity?: number;
  wordAnalysis: IPracticeAttemptWordAnalysisItem[];
  phonemeAnalysis: Record<string, any>[];
  phonemeTimeline?: Record<string, any>[];
  prosodyAnalysis: Record<string, any>;
  drillRecommendations?: Record<string, any>[];
  phonologicalProfile?: Record<string, any>;
  phenomena?: Record<string, any>[];
  coachAnalysis?: Record<string, any>;
  badges?: Record<string, any>[];
  processingMetrics?: Record<string, any>;
  intermediateArtifacts?: Record<string, any>;
  trustSignals?: {
    confidenceBand?: 'high' | 'medium' | 'low';
    uncertaintyReasons?: string[];
    noiseDetected?: boolean;
    cautionMessage?: string;
    validation?: Record<string, any>;
  };
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const wordAnalysisSchema = new Schema<IPracticeAttemptWordAnalysisItem>(
  {
    word: { type: String, required: true },
    expectedPhonemes: { type: [String], default: [] },
    expectedStress: { type: [Number], default: [] },
    expectedSyllables: { type: Number, default: 0 },
    actualPhonemes: { type: [String], default: [] },
    severity: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    startTime: { type: Number, default: 0 },
    endTime: { type: Number, default: 0 },
    issueType: { type: String, default: '' },
    animationCue: { type: Schema.Types.Mixed, default: null },
    componentScores: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const practiceAttemptSchema = new Schema<IPracticeAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSession',
      required: true,
      index: true,
    },
    passageId: {
      type: Schema.Types.ObjectId,
      ref: 'Passage',
      required: true,
      index: true,
    },
    audioUrl: {
      type: String,
      required: true,
      trim: true,
    },
    audioObjectKey: {
      type: String,
      default: null,
      trim: true,
    },
    audioMimeType: {
      type: String,
      default: 'audio/webm',
      trim: true,
    },
    uploadSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'PronunciationUploadSession',
      default: null,
      index: true,
    },
    transcript: {
      type: String,
      default: '',
      trim: true,
    },
    recognizedTranscript: {
      type: String,
      default: '',
      trim: true,
    },
    transcriptionProvider: {
      type: String,
      default: '',
      trim: true,
    },
    asrConfidence: {
      type: Number,
      default: null,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    analysisJobId: {
      type: String,
      default: null,
    },
    attemptClassification: {
      type: String,
      enum: ['valid_reading', 'partial_reading', 'wrong_passage', 'random_speech', 'native_language', 'low_audio_quality', 'silence'],
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'preprocessing', 'transcribing', 'aligning', 'analyzing', 'completed', 'failed', 'retry_required'],
      default: 'pending',
      index: true,
    },
    processingStage: {
      type: String,
      enum: ['uploaded', 'preprocessing', 'transcribing', 'aligning', 'analyzing', 'completed', 'failed', 'retry_required'],
      default: 'uploaded',
      index: true,
    },
    scores: {
      pronunciation: { type: Number, default: 0 },
      fluency: { type: Number, default: 0 },
      stress: { type: Number, default: 0 },
      intonation: { type: Number, default: 0 },
      clarity: { type: Number, default: 0 },
      passageAccuracy: { type: Number, default: 0 },
      wordAccuracy: { type: Number, default: 0 },
      phonemeAccuracy: { type: Number, default: 0 },
      intelligibility: { type: Number, default: 0 },
      audioQuality: { type: Number, default: 0 },
    },
    wordAnalysis: {
      type: [wordAnalysisSchema],
      default: [],
    },
    phonemeAnalysis: {
      type: Schema.Types.Mixed,
      default: [],
    },
    phonemeTimeline: {
      type: Schema.Types.Mixed,
      default: [],
    },
    prosodyAnalysis: {
      type: Schema.Types.Mixed,
      default: {},
    },
    drillRecommendations: {
      type: Schema.Types.Mixed,
      default: [],
    },
    coachAnalysis: {
      type: Schema.Types.Mixed,
      default: null,
    },
    badges: {
      type: Schema.Types.Mixed,
      default: [],
    },
    processingMetrics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    intermediateArtifacts: {
      type: Schema.Types.Mixed,
      default: {},
    },
    trustSignals: {
      type: Schema.Types.Mixed,
      default: {},
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

practiceAttemptSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });
practiceAttemptSchema.index({ passageId: 1, status: 1 });

export default mongoose.model<IPracticeAttempt>('PracticeAttempt', practiceAttemptSchema);
