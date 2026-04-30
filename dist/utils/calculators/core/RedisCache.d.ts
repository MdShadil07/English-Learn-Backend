/**
 * Redis Cache Adapter
 * Implements ICache interface for NLP caching
 */
import { ICache } from './interface.js';
export declare class RedisCache implements ICache {
    private client;
    private defaultTTL;
    constructor(redisClient: any, defaultTTL?: number);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    invalidate(pattern: string): Promise<void>;
    /**
     * Clear all cache entries (use with caution)
     */
    clearAll(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<{
        keyCount: number;
        memoryUsed: string;
        hitRate?: number;
    }>;
}
//# sourceMappingURL=RedisCache.d.ts.map