import { redisCache } from '../../../config/redis.js';
const CACHE_PREFIX = 'accuracy:realtime:';
const CACHE_TTL_SECONDS = 300; // 5 minutes
const inMemoryCache = new Map();
function buildCacheKey(userId) {
    return `${CACHE_PREFIX}${userId}`;
}
function normalizeTimestamp(timestamp) {
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }
    if (typeof timestamp === 'string') {
        const parsedDate = new Date(timestamp);
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
        }
    }
    return new Date().toISOString();
}
function toNumber(value) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    return undefined;
}
function hasLatestMetrics(latest) {
    if (!latest) {
        return false;
    }
    const candidates = [
        latest.overall,
        latest.adjustedOverall,
        latest.grammar,
        latest.vocabulary,
        latest.spelling,
        latest.fluency,
        latest.punctuation,
        latest.capitalization,
    ];
    return candidates.some((value) => typeof value === 'number' && !Number.isNaN(value));
}
async function persistToRedis(key, value) {
    try {
        await redisCache.set(key, JSON.stringify(value), CACHE_TTL_SECONDS);
    }
    catch (error) {
        console.error('❌ Redis accuracy cache error:', error);
    }
}
function persistInMemory(key, value) {
    inMemoryCache.set(key, {
        data: value,
        expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
}
async function readFromRedis(key) {
    try {
        const cached = await redisCache.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    catch (error) {
        console.error('❌ Redis accuracy read error:', error);
        return null;
    }
}
function readFromMemory(key) {
    const cached = inMemoryCache.get(key);
    if (!cached) {
        return null;
    }
    if (Date.now() > cached.expiresAt) {
        inMemoryCache.delete(key);
        return null;
    }
    return cached.data;
}
export const optimizedAccuracyTracker = {
    async trackAccuracy(payload) {
        if (!payload?.userId) {
            throw new Error('userId is required to track accuracy');
        }
        const cacheKey = buildCacheKey(payload.userId);
        let latestPayload;
        if (payload.latest) {
            latestPayload = { ...payload.latest };
        }
        else {
            const hasIndividualLatest = [
                payload.latestOverall,
                payload.latestAdjustedOverall,
                payload.latestGrammar,
                payload.latestVocabulary,
                payload.latestSpelling,
                payload.latestFluency,
                payload.latestPunctuation,
                payload.latestCapitalization,
            ].some((value) => typeof value === 'number' && !Number.isNaN(value));
            if (hasIndividualLatest) {
                latestPayload = {
                    overall: payload.latestOverall,
                    adjustedOverall: payload.latestAdjustedOverall,
                    grammar: payload.latestGrammar,
                    vocabulary: payload.latestVocabulary,
                    spelling: payload.latestSpelling,
                    fluency: payload.latestFluency,
                    punctuation: payload.latestPunctuation,
                    capitalization: payload.latestCapitalization,
                    timestamp: payload.timestamp,
                };
            }
        }
        // Support both new and legacy property names
        const normalizedLatest = latestPayload && hasLatestMetrics(latestPayload)
            ? {
                overall: toNumber(latestPayload.overall),
                adjustedOverall: toNumber(latestPayload.adjustedOverall),
                grammar: toNumber(latestPayload.grammar),
                vocabulary: toNumber(latestPayload.vocabulary),
                spelling: toNumber(latestPayload.spelling),
                fluency: toNumber(latestPayload.fluency),
                punctuation: toNumber(latestPayload.punctuation),
                capitalization: toNumber(latestPayload.capitalization),
                timestamp: normalizeTimestamp(latestPayload.timestamp),
            }
            : undefined;
        const cachedAccuracy = {
            userId: payload.userId,
            overall: toNumber(payload.overall ?? payload.overallScore),
            grammar: toNumber(payload.grammar ?? payload.grammarScore),
            vocabulary: toNumber(payload.vocabulary ?? payload.vocabularyScore),
            spelling: toNumber(payload.spelling ?? payload.spellingScore),
            fluency: toNumber(payload.fluency ?? payload.fluencyScore),
            lastMessage: payload.messageText ?? null,
            timestamp: normalizeTimestamp(payload.timestamp),
            latest: normalizedLatest,
            xpSnapshot: payload.xpSnapshot,
        };
        persistInMemory(cacheKey, cachedAccuracy);
        await persistToRedis(cacheKey, cachedAccuracy);
    },
    async getCachedAccuracy(userId) {
        if (!userId) {
            return null;
        }
        const cacheKey = buildCacheKey(userId);
        const redisResult = await readFromRedis(cacheKey);
        if (redisResult) {
            persistInMemory(cacheKey, redisResult);
            return redisResult;
        }
        return readFromMemory(cacheKey);
    },
    clearMemoryCache() {
        inMemoryCache.clear();
    },
    async invalidate(userId) {
        if (!userId) {
            return;
        }
        const cacheKey = buildCacheKey(userId);
        inMemoryCache.delete(cacheKey);
        if (!redisCache.isConnected()) {
            return;
        }
        try {
            await redisCache.del(cacheKey);
        }
        catch (error) {
            console.error('❌ Redis accuracy invalidate error:', error);
        }
    },
};
export default optimizedAccuracyTracker;
//# sourceMappingURL=optimizedAccuracyTracker.js.map