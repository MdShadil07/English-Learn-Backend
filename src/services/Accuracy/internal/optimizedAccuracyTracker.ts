import { redisCache } from '../../../config/redis.js';

type AccuracyCardPayload = {
  totalXP?: number;
  currentLevel?: number;
  prestigeLevel?: number;
};

type NullableNumber = number | null | undefined;

type AccuracyScore = {
  overall: NullableNumber;
  grammar: NullableNumber;
  vocabulary: NullableNumber;
  spelling: NullableNumber;
  fluency: NullableNumber;
};

interface LatestAccuracyScores extends AccuracyScore {
  adjustedOverall?: NullableNumber;
  punctuation?: NullableNumber;
  capitalization?: NullableNumber;
  syntax?: NullableNumber;
  coherence?: NullableNumber;
  timestamp?: string;
}

interface LatestAccuracyInput extends AccuracyScore {
  adjustedOverall?: NullableNumber;
  punctuation?: NullableNumber;
  capitalization?: NullableNumber;
  syntax?: NullableNumber;
  coherence?: NullableNumber;
  timestamp?: Date | string;
}

export interface AccuracyTrackingPayload {
  userId: string;
  messageText?: string;
  timestamp?: Date | string;
  // Support both new names and legacy names
  overall?: NullableNumber;
  grammar?: NullableNumber;
  vocabulary?: NullableNumber;
  spelling?: NullableNumber;
  fluency?: NullableNumber;
  // Legacy names for backward compatibility
  overallScore?: NullableNumber;
  grammarScore?: NullableNumber;
  vocabularyScore?: NullableNumber;
  spellingScore?: NullableNumber;
  fluencyScore?: NullableNumber;
  latest?: LatestAccuracyInput;
  latestOverall?: NullableNumber;
  latestAdjustedOverall?: NullableNumber;
  latestGrammar?: NullableNumber;
  latestVocabulary?: NullableNumber;
  latestSpelling?: NullableNumber;
  latestFluency?: NullableNumber;
  latestPunctuation?: NullableNumber;
  latestCapitalization?: NullableNumber;
  latestSyntax?: NullableNumber;
  latestCoherence?: NullableNumber;
  xpSnapshot?: AccuracyCardPayload;
}

export interface CachedAccuracy extends AccuracyScore {
  userId: string;
  lastMessage?: string | null;
  timestamp: string;
  latest?: LatestAccuracyScores;
  xpSnapshot?: AccuracyCardPayload;
}

const CACHE_PREFIX = 'accuracy:realtime:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

const inMemoryCache = new Map<string, { data: CachedAccuracy; expiresAt: number }>();

function buildCacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

function normalizeTimestamp(timestamp?: Date | string): string {
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

function toNumber(value: NullableNumber): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  return undefined;
}

function hasLatestMetrics(latest?: LatestAccuracyInput): boolean {
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

async function persistToRedis(key: string, value: CachedAccuracy): Promise<void> {
  try {
    await redisCache.set(key, JSON.stringify(value), CACHE_TTL_SECONDS);
  } catch (error) {
    console.error('❌ Redis accuracy cache error:', error);
  }
}

function persistInMemory(key: string, value: CachedAccuracy): void {
  inMemoryCache.set(key, {
    data: value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
}

async function readFromRedis(key: string): Promise<CachedAccuracy | null> {
  try {
    const cached = await redisCache.get(key);
    return cached ? (JSON.parse(cached) as CachedAccuracy) : null;
  } catch (error) {
    console.error('❌ Redis accuracy read error:', error);
    return null;
  }
}

function readFromMemory(key: string): CachedAccuracy | null {
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
  async trackAccuracy(payload: AccuracyTrackingPayload): Promise<void> {
    if (!payload?.userId) {
      throw new Error('userId is required to track accuracy');
    }

    const cacheKey = buildCacheKey(payload.userId);

    let latestPayload: LatestAccuracyInput | undefined;

    if (payload.latest) {
      latestPayload = { ...payload.latest };
    } else {
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
    const normalizedLatest: LatestAccuracyScores | undefined = latestPayload && hasLatestMetrics(latestPayload)
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

    const cachedAccuracy: CachedAccuracy = {
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

  async getCachedAccuracy(userId: string): Promise<CachedAccuracy | null> {
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

  clearMemoryCache(): void {
    inMemoryCache.clear();
  },

  async invalidate(userId: string): Promise<void> {
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
    } catch (error) {
      console.error('❌ Redis accuracy invalidate error:', error);
    }
  },
};

export default optimizedAccuracyTracker;
