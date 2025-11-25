/**
 * Redis Cache Adapter
 * Implements ICache interface for NLP caching
 */

import Redis from 'ioredis';
import { ICache } from './interface.js';
import { cacheLogger } from './logger.js';
import { CACHE_TTL } from './constants.js';

export class RedisCache implements ICache {
  private client: any;
  private defaultTTL: number;

  constructor(redisClient: any, defaultTTL: number = CACHE_TTL.NLP_RESPONSE) {
    this.client = redisClient;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (!value) {
        cacheLogger.debug({ key }, 'Cache miss');
        return null;
      }

      cacheLogger.debug({ key }, 'Cache hit');
      return JSON.parse(value) as T;
    } catch (error) {
      cacheLogger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.defaultTTL;
      const serialized = JSON.stringify(value);
      
      await this.client.setex(key, ttl, serialized);
      
      cacheLogger.debug({ key, ttl }, 'Cache set');
    } catch (error) {
      cacheLogger.error({ error, key }, 'Cache set error');
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
        cacheLogger.info({ pattern, count: keys.length }, 'Cache invalidated');
      }
    } catch (error) {
      cacheLogger.error({ error, pattern }, 'Cache invalidate error');
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await this.client.flushdb();
      cacheLogger.warn('All cache cleared');
    } catch (error) {
      cacheLogger.error({ error }, 'Cache clear error');
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keyCount: number;
    memoryUsed: string;
    hitRate?: number;
  }> {
    try {
      const info = await this.client.info('stats');
      const keyCount = await this.client.dbsize();
      
      const memoryInfo = await this.client.info('memory');
      const memoryMatch = memoryInfo.match(/used_memory_human:(.+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        keyCount,
        memoryUsed,
      };
    } catch (error) {
      cacheLogger.error({ error }, 'Cache stats error');
      return {
        keyCount: 0,
        memoryUsed: 'unknown',
      };
    }
  }
}
