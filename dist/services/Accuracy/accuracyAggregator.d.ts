/**
 * 🎯 CENTRALIZED ACCURACY CALCULATOR
 * Single source of truth for accuracy calculations across the application
 *
 * Features:
 * - Cumulative weighted averaging (prevents overwriting)
 * - Consistent calculation logic
 * - Proper handling of first vs subsequent calculations
 * - Synchronization of duplicate fields
 */
import { IAccuracyData } from '../../models/Progress.js';
export interface AccuracyCalculationResult {
    cumulativeAccuracy: Partial<IAccuracyData>;
    skillsUpdate: {
        accuracy?: number;
        overallAccuracy?: number;
        grammar?: number;
        vocabulary?: number;
        fluency?: number;
    };
    calculationCount: number;
    lastCalculated: Date;
}
export interface CurrentAccuracyData {
    overall?: number;
    grammar?: number;
    vocabulary?: number;
    spelling?: number;
    fluency?: number;
    punctuation?: number;
    capitalization?: number;
    calculationCount?: number;
}
/**
 * Calculate cumulative accuracy (SINGLE SOURCE OF TRUTH)
 *
 * This function ensures:
 * 1. Accuracy is NEVER overwritten (always cumulative)
 * 2. Consistent calculation across all services
 * 3. Proper synchronization between accuracyData and skills
 *
 * @param currentAccuracy - Current accuracy data from database
 * @param newAccuracy - New accuracy scores from latest message
 * @returns Calculation result with cumulative values and sync updates
 */
export declare function calculateCumulativeAccuracy(currentAccuracy: CurrentAccuracyData | null | undefined, newAccuracy: Partial<IAccuracyData>): AccuracyCalculationResult;
/**
 * Log cumulative accuracy update (for debugging)
 */
export declare function logAccuracyUpdate(calculationCount: number, currentAccuracy: CurrentAccuracyData | null | undefined, newAccuracy: Partial<IAccuracyData>, cumulativeAccuracy: Partial<IAccuracyData>): void;
/**
 * Helper to extract accuracy data from MongoDB document
 */
export declare function extractCurrentAccuracy(accuracyData: any): CurrentAccuracyData;
/**
 * Calculate current message accuracy and a weighted combined accuracy
 * using advanced weighted calculation with historical context.
 *
 * Features:
 * - Advanced weighted averaging with historical context
 * - Prevents accuracy flow disruption (no sudden jumps)
 * - Configurable weight strategies based on user progression
 * - Integration with Redis for optimized performance
 *
 * @param currentAccuracy - Current accuracy scores from latest message
 * @param previousAccuracy - Previous accuracy object (legacy support)
 * @param userId - User ID for historical context (optional but recommended)
 * @returns Object with current accuracy and updated weighted accuracy
 */
export declare function calculateAccuracy(currentAccuracy: Partial<IAccuracyData>, previousAccuracy?: Partial<IAccuracyData> | null, userId?: string): Promise<{
    currentAccuracy: Partial<IAccuracyData>;
    updatedOverallAccuracy: Partial<IAccuracyData>;
}>;
//# sourceMappingURL=accuracyAggregator.d.ts.map