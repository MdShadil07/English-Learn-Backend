import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyServiceMetric {
  date: string; // YYYY-MM-DD
  serviceId: string;
  requests: number;
  errors: number;
  totalLatencyMs: number;
  lastUpdated: Date;
}

const DailyServiceMetricSchema = new Schema<IDailyServiceMetric>({
  date: { type: String, required: true },
  serviceId: { type: String, required: true },
  requests: { type: Number, default: 0 },
  errors: { type: Number, default: 0 },
  totalLatencyMs: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

// Compound index to ensure uniqueness per day per service
DailyServiceMetricSchema.index({ date: 1, serviceId: 1 }, { unique: true });

export const DailyServiceMetric = mongoose.model<IDailyServiceMetric>('DailyServiceMetric', DailyServiceMetricSchema);
