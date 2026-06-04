import fs from 'fs';
import path from 'path';
// @ts-ignore
import csv from 'csv-parse/lib/sync';

// Simple tuning tool: reads a labeled CSV with columns [attemptId,phenomenonLabel,confidence,labelerDecision]
// and adjusts the patternWeights.json by increasing weights for phenomena frequently confirmed,
// and decreasing for phenomena frequently rejected. This is a basic calibration step.

const WORKING_DIR = path.resolve(__dirname, '../../data/phenomena');
const WEIGHTS_PATH = path.resolve(__dirname, './patternWeights.json');

type LabelRow = {
  attemptId: string;
  phenomenon: string;
  labelerDecision: 'yes' | 'no' | 'maybe';
};

export function tuneWeightsFromCsv(csvPath: string) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const records = csv(content, { columns: true, skip_empty_lines: true });
  const counts: Record<string, { yes: number; no: number; maybe: number }> = {};

  records.forEach((r: any) => {
    const phenomenon = (r.phenomenon || r.phenomenonLabel || r.label || '').trim();
    const decision = (r.labelerDecision || r.decision || r.confirmation || '').trim().toLowerCase();
    if (!phenomenon) return;
    counts[phenomenon] = counts[phenomenon] || { yes: 0, no: 0, maybe: 0 };
    if (decision === 'yes') counts[phenomenon].yes += 1;
    else if (decision === 'no') counts[phenomenon].no += 1;
    else counts[phenomenon].maybe += 1;
  });

  const weights = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8')) as Record<string, number>;

  Object.keys(counts).forEach((p) => {
    const c = counts[p];
    const total = c.yes + c.no + c.maybe || 1;
    const score = (c.yes + 0.5 * c.maybe) / total; // 0..1
    const factor = 0.5 + score; // 0.5..1.5
    weights[p] = Math.max(0.2, Math.min(3, (weights[p] || 1) * factor));
  });

  fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(weights, null, 2));
  return weights;
}

export default tuneWeightsFromCsv;
