import mongoose, { Schema, Document } from 'mongoose';

export interface IWordAnalysis extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  practiceAttemptId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  passageId: mongoose.Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

const wordAnalysisSchema = new Schema<IWordAnalysis>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    practiceAttemptId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeAttempt',
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
    word: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    expectedPhonemes: {
      type: [String],
      default: [],
    },
    expectedStress: {
      type: [Number],
      default: [],
    },
    expectedSyllables: {
      type: Number,
      default: 0,
    },
    actualPhonemes: {
      type: [String],
      default: [],
    },
    severity: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    startTime: {
      type: Number,
      default: 0,
    },
    endTime: {
      type: Number,
      default: 0,
    },
    issueType: {
      type: String,
      default: 'unknown',
      trim: true,
    },
    animationCue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    componentScores: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

wordAnalysisSchema.index({ practiceAttemptId: 1, userId: 1, passageId: 1, word: 1 });

export default mongoose.model<IWordAnalysis>('WordAnalysis', wordAnalysisSchema);
