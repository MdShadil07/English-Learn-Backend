/**
 * 🚀 FAST ACCURACY CACHE SERVICE
 *
 * Performance-optimized accuracy tracking:
 * - In-memory cache for instant updates
 * - Weighted accuracy calculation with previous data
 * - Auto-save every 30 seconds
 * - Save on logout/tab-switch
 * - Data loss prevention
 */
interface AccuracyMetrics {
    overall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    punctuation: number;
    capitalization: number;
    syntax: number;
    coherence: number;
    messageCount: number;
    lastUpdated: Date;
    isDirty: boolean;
}
declare class FastAccuracyCache {
    private cache;
    private saveInterval;
    private readonly SAVE_INTERVAL;
    private readonly CACHE_KEY_PREFIX;
    constructor();
    /**
     * Initialize user accuracy from database
     * Called once on user login/page load
     */
    initializeUser(userId: string): Promise<AccuracyMetrics>;
    /**
     * Update accuracy with new message (weighted merge)
     * Called immediately after AI response
     */
    updateAccuracy(userId: string, newAccuracy: {
        overall: number;
        grammar: number;
        vocabulary: number;
        spelling: number;
        fluency: number;
        punctuation: number;
        capitalization: number;
        syntax?: number;
        coherence?: number;
    }): Promise<AccuracyMetrics>;
    /**
     * Get current accuracy (from cache)
     */
    getAccuracy(userId: string): AccuracyMetrics | null;
    /**
     * Force save user's accuracy to database
     */
    forceSave(userId: string): Promise<boolean>;
    /**
     * Auto-save all dirty users every 30 seconds
     */
    private startAutoSave;
    /**
     * Save to Redis cache (backup)
     */
    private saveToRedis;
    /**
     * Load from Redis cache
     */
    private loadFromRedis;
    /**
     * Cleanup user from cache (e.g., on logout)
     */
    cleanup(userId: string): Promise<void>;
    /**
     * Stop auto-save (for graceful shutdown)
     */
    shutdown(): Promise<void>;
}
export declare const fastAccuracyCache: FastAccuracyCache;
export {};
//# sourceMappingURL=fastAccuracyCache.d.ts.map