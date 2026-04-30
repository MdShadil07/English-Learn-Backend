import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
// Cache TTL constants (in seconds)
export const CACHE_TTL = {
    USER_PROFILE: 300, // 5 minutes
    USER_SESSION: 3600, // 1 hour
    SUBSCRIPTION: 600, // 10 minutes
    OAUTH_STATE: 300, // 5 minutes
    LEADERBOARD: 60, // 1 minute
    STATIC_CONTENT: 3600, // 1 hour
    API_RESPONSE: 60, // 1 minute
    VERIFICATION_CODE: 300, // 5 minutes
};
class RedisCache {
    client = null;
    REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    DEFAULT_TTL = 3600; // 1 hour
    async connect() {
        try {
            if (this.client && this.isConnected()) {
                return;
            }
            this.client = new Redis(this.REDIS_URL, {
                // Connection options for scalability
                maxRetriesPerRequest: 0, // Don't retry failed requests
                enableReadyCheck: true,
                lazyConnect: true,
                connectTimeout: 5000,
                commandTimeout: 3000,
            });
            // Handle connection events
            this.client.on('connect', () => {
                console.log('✅ Redis connected');
            });
            this.client.on('error', (error) => {
                // Only log Redis errors if we're actually trying to use Redis
                if (this.client && this.client.status === 'ready') {
                    console.error('❌ Redis connection error:', error);
                }
            });
            this.client.on('close', () => {
                console.log('📴 Redis connection closed');
            });
            // Wait for connection FIRST
            await this.client.connect();
            console.log('✅ Redis connection established');
            // Then try to set config (separate from connection - config failure shouldn't mark Redis as unavailable)
            try {
                await this.client.config('SET', 'maxmemory-policy', 'noeviction');
                console.log('✅ Redis maxmemory-policy set to noeviction');
            }
            catch (error) {
                // Config command not supported on managed Redis (Render/Upstash/Redis Cloud) - ignore and continue
                console.log('⚠️ Redis maxmemory-policy not supported (managed Redis) - continuing with default policy');
            }
        }
        catch (error) {
            console.log('❌ Redis connection failed, running without cache');
            this.client = null;
            // Don't throw error, allow app to continue without Redis
        }
    }
    async disconnect() {
        try {
            if (this.client) {
                await this.client.disconnect();
                console.log('📴 Redis disconnected successfully');
            }
        }
        catch (error) {
            console.error('❌ Error disconnecting from Redis:', error);
        }
    }
    async get(key) {
        try {
            if (!this.client || !this.isConnected()) {
                return null;
            }
            return await this.client.get(key);
        }
        catch (error) {
            console.error('❌ Redis GET error:', error);
            return null;
        }
    }
    async setex(key, ttl, value) {
        try {
            if (!this.client || !this.isConnected()) {
                return;
            }
            await this.client.setex(key, ttl, value);
        }
        catch (error) {
            console.error('❌ Redis SETEX error:', error);
        }
    }
    async set(key, value, ttl) {
        try {
            if (!this.client || !this.isConnected()) {
                return;
            }
            if (ttl === null || typeof ttl === 'undefined') {
                await this.client.set(key, value);
            }
            else {
                await this.client.setex(key, ttl, value);
            }
        }
        catch (error) {
            console.error('❌ Redis SET error:', error);
        }
    }
    async keys(pattern) {
        try {
            if (!this.client || !this.isConnected()) {
                return [];
            }
            return await this.client.keys(pattern);
        }
        catch (error) {
            console.error('❌ Redis KEYS error:', error);
            return [];
        }
    }
    async del(...keys) {
        try {
            if (!this.client || !this.isConnected()) {
                return 0;
            }
            return await this.client.del(...keys);
        }
        catch (error) {
            console.error('❌ Redis DEL error:', error);
            return 0;
        }
    }
    async exists(key) {
        try {
            if (!this.client || !this.isConnected()) {
                return 0;
            }
            return await this.client.exists(key);
        }
        catch (error) {
            console.error('❌ Redis EXISTS error:', error);
            return 0;
        }
    }
    isConnected() {
        return this.client !== null && this.client.status === 'ready';
    }
    getClient() {
        if (this.client && this.isConnected()) {
            return this.client;
        }
        return null;
    }
    // Cache helper methods
    async getJSON(key) {
        try {
            const data = await this.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            console.error('❌ Redis GET JSON error:', error);
            return null;
        }
    }
    async setJSON(key, value, ttl) {
        try {
            const jsonString = JSON.stringify(value);
            await this.set(key, jsonString, ttl);
        }
        catch (error) {
            console.error('❌ Redis SET JSON error:', error);
        }
    }
    // Cache keys for different data types
    getUserCacheKey(userId) {
        return `user:${userId}`;
    }
    getUserProfileCacheKey(userId) {
        return `user:profile:${userId}`;
    }
    getUserSessionCacheKey(userId) {
        return `session:${userId}`;
    }
    getSubscriptionCacheKey(userId) {
        return `subscription:${userId}`;
    }
    getOAuthStateCacheKey(state) {
        return `oauth:state:${state}`;
    }
    getVerificationCodeCacheKey(email) {
        return `verification:${email}`;
    }
    getUsersListCacheKey(page, limit) {
        return `users:list:${page}:${limit}`;
    }
    getLeaderboardCacheKey(sortBy, limit) {
        return `leaderboard:${sortBy}:${limit}`;
    }
    // Invalidate all user-related cache
    async invalidateUserCache(userId) {
        const keys = [
            this.getUserCacheKey(userId),
            this.getUserProfileCacheKey(userId),
            this.getUserSessionCacheKey(userId),
            this.getSubscriptionCacheKey(userId),
        ];
        await this.del(...keys);
    }
    // Invalidate pattern-based cache
    async invalidatePattern(pattern) {
        try {
            const keys = await this.keys(pattern);
            if (keys.length > 0) {
                await this.del(...keys);
                console.log(`🗑️ Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
            }
        }
        catch (error) {
            console.error('❌ Error invalidating cache pattern:', error);
        }
    }
}
export const redisCache = new RedisCache();
export default redisCache;
//# sourceMappingURL=redis.js.map