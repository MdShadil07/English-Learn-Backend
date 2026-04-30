/**
 * 🚀 PROGRESS OPTIMIZATION SERVICE
 * Industry-level optimization for handling millions of concurrent users
 *
 * ✅ ARCHITECTURE NOTE - XP & LEVEL CALCULATIONS:
 * This service does NOT calculate XP or levels directly.
 * It delegates to Progress.addXP() which uses Gamification services:
 * - services/Gamification/xpCalculator.ts (getLevelFromXP, calculateXPForLevel)
 * - services/Gamification/levelingService.ts (level progression logic)
 *
 * This service is ONLY responsible for:
 * - Performance optimization (batching, caching, debouncing)
 * - Aggregating/reporting existing XP/level data
 * - Database write optimization
 *
 * Features:
 * - Write-Behind Caching: Batch DB writes every 5 seconds
 * - Redis Pub/Sub: Real-time notifications without polling
 * - Debouncing: Prevent excessive API calls
 * - Smart Cache Invalidation: Selective updates
 * - Background Jobs: Async processing for heavy operations
 * - Memory-Efficient: LRU cache for pending updates
 *
 * Performance Targets:
 * - Handle 10M+ concurrent users
 * - < 50ms API response time
 * - 95% reduction in DB writes
 * - Real-time updates with < 100ms latency
 */
import { IAccuracyData } from '../../models/Progress.js';
declare class ProgressOptimizationService {
    private pendingUpdates;
    private debounceManager;
    private flushInterval;
    private isInitialized;
    constructor();
    /**
     * Initialize the optimization service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the service gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Start the batch write interval
     */
    private startBatchWriteInterval;
    /**
     * Initialize Redis Pub/Sub for real-time notifications
     */
    private initializePubSub;
    /**
     * Get progress data with caching
     */
    getProgressData(userId: string, options?: {
        forceRefresh?: boolean;
    }): Promise<any>;
    /**
     * Get analytics data with caching
     */
    getAnalyticsData(userId: string, timeRange?: string): Promise<any>;
    /**
     * Invalidate cache for specific user
     */
    invalidateCache(userId: string, dataType?: 'progress' | 'analytics' | 'all'): Promise<void>;
    /**
     * Update accuracy data (debounced)
     */
    updateAccuracyData(userId: string, accuracyData: Partial<IAccuracyData>, options?: {
        immediate?: boolean;
        priority?: 'low' | 'medium' | 'high';
    }): Promise<void>;
    /**
     * Perform accuracy update - DIRECT SAVE (Enhanced weighted calculator already merged)
     * ✅ Values coming from accuracy controller are ALREADY WEIGHTED/MERGED
     * ⚠️ Do NOT apply cumulative averaging again (causes double weighting)
     */
    private performAccuracyUpdate;
    private normalizeSnapshot;
    private clampAccuracyValue;
    private mapToSummaryField;
    private buildOverallAccuracySummary;
    private computeRollingAverage;
    /**
     * Add XP (debounced)
     */
    addXP(userId: string, amount: number, source: string, category?: string, options?: {
        immediate?: boolean;
    }): Promise<void>;
    /**
     * Perform XP update with proper level calculation
     *
     * ✅ USES GAMIFICATION SERVICES (Single Source of Truth):
     * - Delegates to Progress.addXP() method
     * - Progress.addXP() uses getLevelFromXP() from xpCalculator.ts
     * - Progress.addXP() uses calculateXPForLevel() from xpCalculator.ts
     * - No hardcoded XP/level calculations in this service
     */
    private performXPUpdate;
    /**
     * Update level (immediate, high priority)
     */
    updateLevel(userId: string, newLevel: number, rewards?: any): Promise<void>;
    /**
     * Flush all pending updates to database
     */
    private flushPendingUpdates;
    /**
     * Publish update to Redis Pub/Sub
     */
    private publishUpdate;
    /**
     * Compute analytics from progress data
     */
    private computeAnalytics;
    private getTimeRangeStart;
    /**
     * Calculate XP breakdown from progress events
     * ✅ NO XP CALCULATION: Just aggregates existing XP amounts from events
     * XP values were already calculated by Gamification services
     */
    private calculateXPBreakdown;
    private calculateAccuracyTrends;
    private calculateSkillsProgress;
    private calculateCategoryPerformance;
    /**
     * Calculate level statistics from progress data
     * ✅ NO LEVEL CALCULATION: Just returns existing level data
     * Level values were already calculated by Gamification services
     */
    private calculateLevelStats;
    /**
     * Get service metrics
     */
    getMetrics(): any;
}
export declare const progressOptimizationService: ProgressOptimizationService;
export default progressOptimizationService;
//# sourceMappingURL=progressOptimizationService.d.ts.map