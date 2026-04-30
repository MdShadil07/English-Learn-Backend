import { unifiedAccuracyCalculator } from '../../utils/calculators/unifiedAccuracyCalculators.js';
import { logger } from '../../utils/calculators/core/logger.js';
const BENCHMARK_SAMPLES = [
    {
        id: 'benchmark-a1',
        level: 'A1',
        text: 'I like to read books and play with my friends after school.',
        baselineOverall: 62,
    },
    {
        id: 'benchmark-a2',
        level: 'A2',
        text: 'She usually prepares healthy meals because she wants to stay energetic.',
        baselineOverall: 68,
    },
    {
        id: 'benchmark-b1',
        level: 'B1',
        text: 'The project succeeded because the team collaborated effectively and communicated their progress.',
        baselineOverall: 76,
    },
    {
        id: 'benchmark-b2',
        level: 'B2',
        text: 'We must evaluate alternative strategies to mitigate the identified operational risks this quarter.',
        baselineOverall: 83,
    },
    {
        id: 'benchmark-c1',
        level: 'C1',
        text: 'Innovative methodologies can catalyze sustainable growth when leadership embraces adaptive decision-making.',
        baselineOverall: 88,
    },
];
export class AccuracyRegressionService {
    driftThreshold = 3; // percentage points
    async runWeeklyBenchmark() {
        const results = [];
        for (const sample of BENCHMARK_SAMPLES) {
            const analysis = await unifiedAccuracyCalculator.analyzeMessage(sample.text, '', {
                tier: 'premium',
                proficiencyLevel: 'Advanced',
                enableNLP: true,
                enableWeightedCalculation: false,
            });
            const deviation = Number((analysis.overall - sample.baselineOverall).toFixed(2));
            const flagged = Math.abs(deviation) > this.driftThreshold;
            results.push({
                id: sample.id,
                level: sample.level,
                baseline: sample.baselineOverall,
                measured: Number(analysis.overall.toFixed(2)),
                deviation,
                flagged,
            });
            if (flagged) {
                logger.warn({ sampleId: sample.id, deviation }, 'Accuracy drift detected during regression benchmark');
            }
        }
        const flaggedSamples = results.filter((entry) => entry.flagged).map((entry) => entry.id);
        logger.info({
            results,
            flaggedSamples,
            driftThreshold: this.driftThreshold,
        }, 'Weekly accuracy regression benchmark complete');
    }
}
export const accuracyRegressionService = new AccuracyRegressionService();
//# sourceMappingURL=accuracyRegressionService.js.map