import mongoose, { Schema, Document } from 'mongoose';

export interface IPassage extends Document {
  _id: mongoose.Types.ObjectId;
  text: string;
  passageVersion: number;
  cefrLevel: string;
  exerciseType: string;
  curriculumTrack: string;
  lessonGroup: string;
  phonemeTargets: string[];
  mtiTargets: string[];
  phonemeDensity: number;
  difficulty: {
    phonetic: number;
    fluency: number;
    stress: number;
    lexical: number;
  };
  professionalContext: string;
  metadata: {
    wordCount: number;
    estimatedDuration: number;
    stressTargets: string[];
    pauseTargets: string[];
    readingHints: string[];
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const passageSchema = new Schema<IPassage>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    passageVersion: {
      type: Number,
      default: 1,
      min: 1,
      index: true,
    },
    cefrLevel: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    exerciseType: {
      type: String,
      required: true,
      default: 'reading',
      index: true,
    },
    curriculumTrack: {
      type: String,
      default: 'general-english',
      trim: true,
      index: true,
    },
    lessonGroup: {
      type: String,
      default: 'solo-practice',
      trim: true,
      index: true,
    },
    phonemeTargets: {
      type: [String],
      default: [],
      index: true,
    },
    mtiTargets: {
      type: [String],
      default: [],
    },
    phonemeDensity: {
      type: Number,
      default: 0,
      index: true,
    },
    difficulty: {
      phonetic: { type: Number, default: 0, index: true },
      fluency: { type: Number, default: 0 },
      stress: { type: Number, default: 0 },
      lexical: { type: Number, default: 0 },
    },
    professionalContext: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      wordCount: { type: Number, default: 0 },
      estimatedDuration: { type: Number, default: 0 },
      stressTargets: { type: [String], default: [] },
      pauseTargets: { type: [String], default: [] },
      readingHints: { type: [String], default: [] },
      seedId: { type: String },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

passageSchema.index({ cefrLevel: 1, exerciseType: 1, curriculumTrack: 1, lessonGroup: 1, passageVersion: 1, phonemeTargets: 1, 'difficulty.phonetic': 1 });

export default mongoose.model<IPassage>('Passage', passageSchema);
