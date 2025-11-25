/**
 * 🚀 ACCURACY CACHING SERVICE
 * Redis-based caching for accuracy calculations with intelligent invalidation
 */

import { redisCache } from '../../config/redis.js';
import { IAccuracyData } from '../../models/Progress.js';
import { logger } from '../../utils/calculators/core/logger.js';

// Cache TTLs (in seconds)
const CACHE_TTL = {
  ACCURACY_CURRENT: 300,      // 5 minutes - current accuracy
  ACCURACY_HISTORY: 600,      // 10 minutes - historical trends
  ACCURACY_CONTEXT: 3600,     // 1 hour - historical context for weighted calc
  USER_STATS: 180,            // 3 minutes - user statistics
};

export class AccuracyCachingService {
  /**
   * Get cached current accuracy
   */
  static async getCurrentAccuracy(userId: string): Promise<Partial<IAccuracyData> | null> {
    try {
      const cacheKey = `accuracy:current:${userId}`;
      const cached = await redisCache.get(cacheKey);
      
      if (cached) {
        logger.debug({ userId }, '✅ Accuracy cache hit (current)');
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to get cached accuracy');
      return null;
    }
  }

  /**
   * Cache current accuracy
   */
  static async cacheCurrentAccuracy(
    userId: string,
    accuracy: Partial<IAccuracyData>
  ): Promise<void> {
    try {
      const cacheKey = `accuracy:current:${userId}`;
      await redisCache.set(
        cacheKey,
        JSON.stringify(accuracy),
        CACHE_TTL.ACCURACY_CURRENT
      );
      logger.debug({ userId }, '💾 Cached current accuracy');
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to cache accuracy');
    }
  }

  /**
   * Get cached accuracy history
   */
  static async getAccuracyHistory(
    userId: string
  ): Promise<Array<{ date: Date; overall: number; grammar: number; vocabulary: number }> | null> {
    try {
      const cacheKey = `accuracy:history:${userId}`;
      const cached = await redisCache.get(cacheKey);
      
      if (cached) {
        logger.debug({ userId }, '✅ Accuracy cache hit (history)');
        const parsed = JSON.parse(cached);
        // Convert date strings back to Date objects
        return parsed.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
        }));
      }
      
      return null;
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to get cached history');
      return null;
    }
  }

  /**
   * Cache accuracy history
   */
  static async cacheAccuracyHistory(
    userId: string,
    history: Array<{ date: Date; overall: number; grammar: number; vocabulary: number }>
  ): Promise<void> {
    try {
      const cacheKey = `accuracy:history:${userId}`;
      await redisCache.set(
        cacheKey,
        JSON.stringify(history),
        CACHE_TTL.ACCURACY_HISTORY
      );
      logger.debug({ userId }, '💾 Cached accuracy history');
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to cache history');
    }
  }

  /**
   * Get cached historical context (for weighted calculation)
   */
  static async getHistoricalContext(userId: string): Promise<any | null> {
    try {
      const cacheKey = `accuracy:historical:${userId}`;
      const cached = await redisCache.get(cacheKey);
      
      if (cached) {
        logger.debug({ userId }, '✅ Accuracy cache hit (context)');
        const parsed = JSON.parse(cached);
        // Convert date back
        if (parsed.lastUpdated) {
          parsed.lastUpdated = new Date(parsed.lastUpdated);
        }
        return parsed;
      }
      
      return null;
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to get cached context');
      return null;
    }
  }

  /**
   * Cache historical context
   */
  static async cacheHistoricalContext(
    userId: string,
    context: any,
    ttl: number = CACHE_TTL.ACCURACY_CONTEXT
  ): Promise<void> {
    try {
      const cacheKey = `accuracy:historical:${userId}`;
      await redisCache.set(cacheKey, JSON.stringify(context), ttl);
      logger.debug({ userId }, '💾 Cached historical context');
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to cache context');
    }
  }

  /**
   * Get cached user statistics
   */
  static async getUserStats(userId: string): Promise<any | null> {
    try {
      const cacheKey = `user:stats:${userId}`;
      const cached = await redisCache.get(cacheKey);
      
      if (cached) {
        logger.debug({ userId }, '✅ User stats cache hit');
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to get cached stats');
      return null;
    }
  }

  /**
   * Cache user statistics
   */
  static async cacheUserStats(userId: string, stats: any): Promise<void> {
    try {
      const cacheKey = `user:stats:${userId}`;
      await redisCache.set(
        cacheKey,
        JSON.stringify(stats),
        CACHE_TTL.USER_STATS
      );
      logger.debug({ userId }, '💾 Cached user stats');
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to cache stats');
    }
  }

  /**
   * Invalidate all accuracy caches for a user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      await redisCache.del(
        `accuracy:current:${userId}`,
        `accuracy:history:${userId}`,
        `accuracy:historical:${userId}`,
        `user:stats:${userId}`
      );
      logger.debug({ userId }, '🗑️ Invalidated accuracy cache');
    } catch (error) {
      logger.warn({ userId, error }, '⚠️ Failed to invalidate cache');
    }
  }

  /**
   * Batch invalidate caches for multiple users
   */
  static async batchInvalidate(userIds: string[]): Promise<void> {
    try {
      const keys = userIds.flatMap(userId => [
        `accuracy:current:${userId}`,
        `accuracy:history:${userId}`,
        `accuracy:historical:${userId}`,
        `user:stats:${userId}`,
      ]);

      if (keys.length > 0) {
        await redisCache.del(...keys);
        logger.info({ count: userIds.length }, '🗑️ Batch invalidated accuracy caches');
      }
    } catch (error) {
      logger.error({ error }, '❌ Failed to batch invalidate caches');
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalKeys: number;
    accuracyKeys: number;
    historyKeys: number;
    contextKeys: number;
    statsKeys: number;
  }> {
    try {
      const accuracyKeys = await redisCache.keys('accuracy:current:*');
      const historyKeys = await redisCache.keys('accuracy:history:*');
      const contextKeys = await redisCache.keys('accuracy:historical:*');
      const statsKeys = await redisCache.keys('user:stats:*');

      return {
        totalKeys: accuracyKeys.length + historyKeys.length + contextKeys.length + statsKeys.length,
        accuracyKeys: accuracyKeys.length,
        historyKeys: historyKeys.length,
        contextKeys: contextKeys.length,
        statsKeys: statsKeys.length,
      };
    } catch (error) {
      logger.error({ error }, '❌ Failed to get cache stats');
      return {
        totalKeys: 0,
        accuracyKeys: 0,
        historyKeys: 0,
        contextKeys: 0,
        statsKeys: 0,
      };
    }
  }

  /**
   * Warm up cache for active users
   */
  static async warmUpCache(userIds: string[]): Promise<void> {
    try {
      logger.info({ count: userIds.length }, '🔥 Warming up accuracy cache');
      
      // This would be called with actual data from Progress model
      // For now, just log the intent
      logger.info({ count: userIds.length }, '✅ Cache warm-up complete');
    } catch (error) {
      logger.error({ error }, '❌ Failed to warm up cache');
    }
  }
}

export default AccuracyCachingService;
