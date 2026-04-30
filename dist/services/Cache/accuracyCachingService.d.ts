/**
 * 🚀 ACCURACY CACHING SERVICE
 * Redis-based caching for accuracy calculations with intelligent invalidation
 */
import { IAccuracyData } from '../../models/Progress.js';
export declare class AccuracyCachingService {
    /**
     * Get cached current accuracy
     */
    static getCurrentAccuracy(userId: string): Promise<Partial<IAccuracyData> | null>;
    /**
     * Cache current accuracy
     */
    static cacheCurrentAccuracy(userId: string, accuracy: Partial<IAccuracyData>): Promise<void>;
    /**
     * Get cached accuracy history
     */
    static getAccuracyHistory(userId: string): Promise<Array<{
        date: Date;
        overall: number;
        grammar: number;
        vocabulary: number;
    }> | null>;
    /**
     * Cache accuracy history
     */
    static cacheAccuracyHistory(userId: string, history: Array<{
        date: Date;
        overall: number;
        grammar: number;
        vocabulary: number;
    }>): Promise<void>;
    /**
     * Get cached historical context (for weighted calculation)
     */
    static getHistoricalContext(userId: string): Promise<any | null>;
    /**
     * Cache historical context
     */
    static cacheHistoricalContext(userId: string, context: any, ttl?: number): Promise<void>;
    /**
     * Get cached user statistics
     */
    static getUserStats(userId: string): Promise<any | null>;
    /**
     * Cache user statistics
     */
    static cacheUserStats(userId: string, stats: any): Promise<void>;
    /**
     * Invalidate all accuracy caches for a user
     */
    static invalidateUserCache(userId: string): Promise<void>;
    /**
     * Batch invalidate caches for multiple users
     */
    static batchInvalidate(userIds: string[]): Promise<void>;
    /**
     * Get cache statistics
     */
    static getCacheStats(): Promise<{
        totalKeys: number;
        accuracyKeys: number;
        historyKeys: number;
        contextKeys: number;
        statsKeys: number;
    }>;
    /**
     * Warm up cache for active users
     */
    static warmUpCache(userIds: string[]): Promise<void>;
}
export default AccuracyCachingService;
//# sourceMappingURL=accuracyCachingService.d.ts.map