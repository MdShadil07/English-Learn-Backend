import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

interface CacheConfig {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  setex: (key: string, ttl: number, value: string) => Promise<void>;
  del: (...keys: string[]) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  exists: (key: string) => Promise<number>;
  isConnected: () => boolean;
  getClient: () => any | null;
}

class RedisCache implements CacheConfig {
  private client: any | null = null;
  private readonly REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  private readonly DEFAULT_TTL = 3600; // 1 hour

  async connect(): Promise<void> {
    try {
      if (this.client && this.isConnected()) {
        return;
      }

      this.client = new (Redis as any)(this.REDIS_URL, {
        // Connection options for better resilience in flaky networks
        maxRetriesPerRequest: 5, // allow a few retries for transient failures
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
        // Simple reconnect strategy (ms)
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      });

      // Handle connection events
      this.client.on('connect', () => {
      });

      this.client.on('error', (error: any) => {
        // Only log Redis errors if we're actually trying to use Redis
        if (this.client && this.client.status === 'ready') {
          console.error('❌ Redis connection error:', error);
        }
      });

      this.client.on('close', () => {
        console.log('📴 Redis connection closed');
      });

      // Wait for connection
      await this.client.connect();

    } catch (error) {
      console.log('🔄 Redis not available, running without cache');
      this.client = null;
      // Don't throw error, allow app to continue without Redis
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect();
        console.log('📴 Redis disconnected successfully');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from Redis:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this.client || !this.isConnected()) {
        return null;
      }
      return await this.client.get(key);
    } catch (error) {
      console.error('❌ Redis GET error:', error);
      return null;
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    try {
      if (!this.client || !this.isConnected()) {
        return;
      }
      await this.client.setex(key, ttl, value);
    } catch (error) {
      console.error('❌ Redis SETEX error:', error);
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (!this.client || !this.isConnected()) {
        return;
      }
      const expiry = ttl ?? this.DEFAULT_TTL;
      await this.client.setex(key, expiry, value);
    } catch (error) {
      console.error('❌ Redis SETEX error:', error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.client || !this.isConnected()) {
        return [];
      }
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('❌ Redis KEYS error:', error);
      return [];
    }
  }

  async del(...keys: string[]): Promise<number> {
    try {
      if (!this.client || !this.isConnected()) {
        return 0;
      }
      return await this.client.del(...keys);
    } catch (error) {
      console.error('❌ Redis DEL error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      if (!this.client || !this.isConnected()) {
        return 0;
      }
      return await this.client.exists(key);
    } catch (error) {
      console.error('❌ Redis EXISTS error:', error);
      return 0;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  getClient(): any | null {
    if (this.client && this.isConnected()) {
      return this.client;
    }
    return null;
  }

  // Cache helper methods
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const data = await this.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Redis GET JSON error:', error);
      return null;
    }
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await this.set(key, jsonString, ttl);
    } catch (error) {
      console.error('❌ Redis SET JSON error:', error);
    }
  }

  // Cache keys for different data types
  getUserCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  getUsersListCacheKey(page: number, limit: number): string {
    return `users:list:${page}:${limit}`;
  }

  getLeaderboardCacheKey(sortBy: string, limit: number): string {
    return `leaderboard:${sortBy}:${limit}`;
  }
}

export const redisCache = new RedisCache();
export default redisCache;
