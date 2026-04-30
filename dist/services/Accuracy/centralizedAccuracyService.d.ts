/**
 * 🎯 CENTRALIZED ACCURACY SERVICE
 * Industry-level accuracy management with optimized performance
 *
 * Features:
 * - Single entry point for all accuracy calculations
 * - Intelligent caching and batching for millions of requests
 * - Historical context management
 * - Real-time accuracy tracking
 * - Performance monitoring and optimization
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
    syntax?: number;
    coherence?: number;
    calculationCount?: number;
}
export declare function calculateCumulativeAccuracy(currentAccuracy: CurrentAccuracyData | null | undefined, newAccuracy: Partial<IAccuracyData>): AccuracyCalculationResult;
export declare function logAccuracyUpdate(calculationCount: number, currentAccuracy: CurrentAccuracyData | null | undefined, newAccuracy: Partial<IAccuracyData>, cumulativeAccuracy: Partial<IAccuracyData>): void;
export declare function extractCurrentAccuracy(accuracyData: any): CurrentAccuracyData;
export declare function calculateAccuracy(currentAccuracy: Partial<IAccuracyData>, previousAccuracy?: Partial<IAccuracyData> | null, userId?: string): Promise<{
    currentAccuracy: Partial<IAccuracyData>;
    updatedOverallAccuracy: Partial<IAccuracyData>;
}>;
export interface AccuracyCalculationRequest {
    userId: string;
    userMessage: string;
    currentAccuracy: Partial<IAccuracyData>;
    previousAccuracy?: Partial<IAccuracyData> | null;
    userTier?: 'free' | 'pro' | 'premium';
    userLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    sessionId?: string;
    timestamp?: Date;
}
export interface AccuracyCalculationResponse {
    weightedAccuracy: Partial<IAccuracyData>;
    currentAccuracy: Partial<IAccuracyData>;
    historicalContext: any;
    performance: {
        totalProcessingTime: number;
        cacheHit: boolean;
        strategy: string;
        weightsUsed: {
            historical: number;
            current: number;
        };
    };
    insights: {
        trendDirection: 'improving' | 'declining' | 'stable';
        confidenceLevel: number;
        recommendations: string[];
        nextMilestone?: {
            type: string;
            target: number;
            current: number;
            progress: number;
        };
    };
}
export interface RealTimeAccuracyUpdate {
    userId: string;
    accuracy: Partial<IAccuracyData>;
    timestamp: Date;
    source: 'realtime' | 'batched' | 'historical';
    metadata?: any;
}
declare class CentralizedAccuracyService {
    private readonly CACHE_TTL;
    private readonly BATCH_SIZE;
    private readonly MAX_CONCURRENT_CALCULATIONS;
    private activeCalculations;
    private calculationQueue;
    /**
     * Main entry point for accuracy calculation
     * Optimized for high concurrency and performance
     */
    calculateAccuracy(request: AccuracyCalculationRequest): Promise<AccuracyCalculationResponse>;
    /**
     * Perform the actual accuracy calculation with all optimizations
     */
    private performAccuracyCalculation;
    /**
     * Generate user insights based on accuracy data
     */
    private generateUserInsights;
    /**
     * Generate personalized recommendations based on accuracy
     */
    private generateRecommendations;
    /**
     * Calculate next milestone for user
     */
    private calculateNextMilestone;
    /**
     * Update real-time accuracy tracking
     */
    private updateRealTimeTracking;
    /**
     * Generate cache key for request
     */
    private generateCacheKey;
    /**
     * Simple hash for accuracy data
     */
    private hashAccuracy;
    /**
     * Get cached result
     */
    private getCachedResult;
    /**
     * Cache result
     */
    private cacheResult;
    /**
     * Get real-time accuracy for user
     */
    getRealTimeAccuracy(userId: string): Promise<RealTimeAccuracyUpdate | null>;
    /**
     * Batch accuracy calculations for multiple users
     */
    batchCalculateAccuracy(requests: AccuracyCalculationRequest[]): Promise<AccuracyCalculationResponse[]>;
    /**
     * Get service statistics for monitoring
     */
    getStats(): {
        activeCalculations: number;
        queuedRequests: number;
        cacheEnabled: boolean;
        maxConcurrent: number;
    };
}
export declare const centralizedAccuracyService: CentralizedAccuracyService;
export default centralizedAccuracyService;
//# sourceMappingURL=centralizedAccuracyService.d.ts.map