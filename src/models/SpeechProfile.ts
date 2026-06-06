import mongoose from 'mongoose';

const { Schema } = mongoose;

export interface ISpeechProfile extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  recurringPhenomena: Record<string, number>;
  weakPhonemes: string[];
  fillerCount: number;
  pacingHistory: { at: Date; wps: number }[];
  confidenceHistory: { at: Date; confidence: number }[];
  overallScore: number;
  scoreHistory: { at: Date; score: number }[];
  calculationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SpeechProfileSchema = new Schema<ISpeechProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  recurringPhenomena: { type: Schema.Types.Mixed, default: {} },
  weakPhonemes: { type: [String], default: [] },
  fillerCount: { type: Number, default: 0 },
  pacingHistory: { type: [{ at: Date, wps: Number }], default: [] },
  confidenceHistory: { type: [{ at: Date, confidence: Number }], default: [] },
  overallScore: { type: Number, default: 0 },
  scoreHistory: { type: [{ at: Date, score: Number }], default: [] },
  calculationCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model<ISpeechProfile>('SpeechProfile', SpeechProfileSchema);
