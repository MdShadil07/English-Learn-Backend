export declare const CACHE_TTL: {
    readonly USER_PROFILE: 300;
    readonly USER_SESSION: 3600;
    readonly SUBSCRIPTION: 600;
    readonly OAUTH_STATE: 300;
    readonly LEADERBOARD: 60;
    readonly STATIC_CONTENT: 3600;
    readonly API_RESPONSE: 60;
    readonly VERIFICATION_CODE: 300;
};
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
declare class RedisCache implements CacheConfig {
    private client;
    private readonly REDIS_URL;
    private readonly DEFAULT_TTL;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get(key: string): Promise<string | null>;
    setex(key: string, ttl: number, value: string): Promise<void>;
    set(key: string, value: string, ttl?: number | null): Promise<void>;
    keys(pattern: string): Promise<string[]>;
    del(...keys: string[]): Promise<number>;
    exists(key: string): Promise<number>;
    isConnected(): boolean;
    getClient(): any | null;
    getJSON<T>(key: string): Promise<T | null>;
    setJSON(key: string, value: any, ttl?: number): Promise<void>;
    getUserCacheKey(userId: string): string;
    getUserProfileCacheKey(userId: string): string;
    getUserSessionCacheKey(userId: string): string;
    getSubscriptionCacheKey(userId: string): string;
    getOAuthStateCacheKey(state: string): string;
    getVerificationCodeCacheKey(email: string): string;
    getUsersListCacheKey(page: number, limit: number): string;
    getLeaderboardCacheKey(sortBy: string, limit: number): string;
    invalidateUserCache(userId: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
}
export declare const redisCache: RedisCache;
export default redisCache;
//# sourceMappingURL=redis.d.ts.map