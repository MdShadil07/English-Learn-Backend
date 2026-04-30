/**
 * Final Enhanced Weighted Accuracy Service
 * - Unified Redis wrapper with safe fetch/set
 * - Dynamic adaptive weights with trend decay
 * - Loggable fallback flags and diagnostics
 * - Robust NaN/Range guards and per-category adjustments
 * - Debounced DB writes to reduce write amplification
 * - Improved smoothing using logarithmic factor
 */
import { IAccuracyData } from '../../models/Progress.js';
export interface WeightedAccuracyResult {
    current: Partial<IAccuracyData>;
    previous: Partial<IAccuracyData>;
    weighted: Partial<IAccuracyData>;
    historicalContext: HistoricalContext | null;
    weights: {
        historical: number;
        current: number;
    };
    trend: {
        direction: 'improving' | 'declining' | 'stable';
        confidence: number;
    };
    messageCount: number;
    processingTime: number;
    diagnostics?: {
        fallback?: string | null;
    };
}
export interface HistoricalContext {
    userId: string;
    messageCount: number;
    overall: number;
    categories: Partial<IAccuracyData>;
    trend: {
        direction: 'improving' | 'declining' | 'stable';
        confidence: number;
        recentAverage: number;
    };
    lastUpdated: Date;
}
export declare class FinalWeightedAccuracyService {
    private redisClient;
    private persistModulo;
    constructor();
    calculateEnhancedWeightedAccuracy(userId: string, currentAccuracy: Partial<IAccuracyData>, errorCount?: number): Promise<WeightedAccuracyResult>;
    private safeRedisGetJson;
    private safeRedisSetJson;
    private getHistoricalContext;
    private fetchPreviousAccuracy;
    private getMessageCount;
    private calculateAdaptiveWeights;
    private applyWeightedCalculation;
    private applySmoothing;
    private calculateTrend;
    private updateHistoricalContext;
    /**
     * 🚀 PRIORITY 2: GRADUATED PENALTY SYSTEM
     * Apply penalty based on error count with graduated thresholds
     * - 15+ errors: -40% penalty
     * - 10-14 errors: -25% penalty
     * - 8-9 errors: -15% penalty
     * - 5-7 errors: -5% penalty
     * - <5 errors: No penalty
     */
    private applyGraduatedPenalty;
    /**
     * FIX #4: Calculate penalty factor based on severely low-performing metrics
     * Returns a multiplier (0.6 - 1.0) where lower means more penalty
     * NOTE: This is now supplemented by the graduated penalty system above
     */
    private calculatePenaltyFactor;
    private isValidObjectId;
    private getNumber;
    private clamp;
    private normalizeAccuracyInput;
    private getDefaultAccuracy;
}
export declare const enhancedWeightedAccuracyService: FinalWeightedAccuracyService;
export default enhancedWeightedAccuracyService;
//# sourceMappingURL=enhancedWeightedAccuracy.d.ts.map