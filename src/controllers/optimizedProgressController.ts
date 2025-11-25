/**
 * OPTIMIZED PROGRESS API
 * High-performance endpoints with Redis caching
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth/auth.js';
import { batchedProgressService } from '../services/Progress/batchedProgressService.js';
import { optimizedAccuracyTracker, fastAccuracyCache } from '../services/Accuracy/index.js';
import type { CachedAccuracy } from '../services/Accuracy/internal/optimizedAccuracyTracker.js';
import Progress from '../models/Progress.js';
import { redisCache } from '../config/redis.js';
import { calculateCumulativeXP } from '../services/Gamification/xpCalculator.js';

const REALTIME_CACHE_TTL_SECONDS = 60;
const DASHBOARD_CACHE_TTL_SECONDS = 120;

interface XPSnapshotOverrides {
  currentLevelXP?: number;
  xpToNextLevel?: number;
  progressPercentage?: number;
  cumulativeXPForCurrentLevel?: number;
  cumulativeXPForNextLevel?: number;
}

const buildXpSnapshot = (
  totalXP: number | undefined,
  currentLevel: number | undefined,
  prestigeLevel: number | undefined,
  overrides: XPSnapshotOverrides = {}
) => {
  const safeTotalXP = Math.max(0, totalXP ?? 0);
  const safeLevel = Math.max(1, currentLevel ?? 1);
  const safePrestige = Math.max(0, prestigeLevel ?? 0);

  const cumulativeCurrent =
    typeof overrides.cumulativeXPForCurrentLevel === 'number'
      ? overrides.cumulativeXPForCurrentLevel
      : calculateCumulativeXP(safeLevel, safePrestige);

  const cumulativeNext =
    typeof overrides.cumulativeXPForNextLevel === 'number'
      ? overrides.cumulativeXPForNextLevel
      : calculateCumulativeXP(safeLevel + 1, safePrestige);

  const levelSpan = Math.max(cumulativeNext - cumulativeCurrent, 1);

  const normalizedCurrentLevelXP = Math.max(
    0,
    Math.min(
      typeof overrides.currentLevelXP === 'number'
        ? overrides.currentLevelXP
        : safeTotalXP - cumulativeCurrent,
      levelSpan
    )
  );

  const normalizedXpToNext = Math.max(
    0,
    Math.min(
      typeof overrides.xpToNextLevel === 'number'
        ? overrides.xpToNextLevel
        : cumulativeNext - safeTotalXP,
      levelSpan
    )
  );

  const progressPercentage = Math.max(
    0,
    Math.min(
      100,
      typeof overrides.progressPercentage === 'number'
        ? overrides.progressPercentage
        : (normalizedCurrentLevelXP / levelSpan) * 100
    )
  );

  return {
    total: safeTotalXP,
    currentLevel: safeLevel,
    currentLevelXP: Math.round(normalizedCurrentLevelXP),
    xpToNextLevel: Math.round(normalizedXpToNext),
    xpRequiredForLevel: Math.round(levelSpan),
    progressPercentage: Math.round(progressPercentage),
    cumulativeXPForCurrentLevel: Math.round(cumulativeCurrent),
    cumulativeXPForNextLevel: Math.round(cumulativeNext),
  };
};

interface LatestAccuracyPayload {
  overall?: number;
  adjustedOverall?: number;
  grammar?: number;
  vocabulary?: number;
  spelling?: number;
  fluency?: number;
  punctuation?: number;
  capitalization?: number;
  timestamp?: string;
}

interface AccuracyCardPayload {
  totalXP?: number;
  currentLevel?: number;
  prestigeLevel?: number;
}

interface AccuracyResponsePayload {
  overall: number;
  adjustedOverall?: number;
  grammar?: number;
  vocabulary?: number;
  spelling?: number;
  fluency?: number;
  punctuation?: number;
  capitalization?: number;
  syntax?: number;
  coherence?: number;
  messageCount?: number;
  lastUpdated: string;
  source: 'fast-cache' | 'optimized-cache' | 'progress-cache' | 'database' | 'none';
  latest?: LatestAccuracyPayload;
  xpSnapshot?: AccuracyCardPayload;
}

function toIsoString(input?: Date | string | null): string {
  if (input instanceof Date) {
    return input.toISOString();
  }

  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

const toOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

function buildAccuracyResponse(
  fastCachedAccuracy: ReturnType<typeof fastAccuracyCache.getAccuracy>,
  optimizedCachedAccuracy: CachedAccuracy | null,
  fallbackAccuracy?: Record<string, unknown> | null,
  fallbackSource: 'progress-cache' | 'database' = 'progress-cache',
  fallbackTimestamp?: string
): AccuracyResponsePayload | null {
  if (fastCachedAccuracy) {
    return {
      overall: fastCachedAccuracy.overall ?? 0,
      adjustedOverall: fastCachedAccuracy.overall ?? 0,
      grammar: fastCachedAccuracy.grammar ?? 0,
      vocabulary: fastCachedAccuracy.vocabulary ?? 0,
      spelling: fastCachedAccuracy.spelling ?? 0,
      fluency: fastCachedAccuracy.fluency ?? 0,
      punctuation: fastCachedAccuracy.punctuation ?? 0,
      capitalization: fastCachedAccuracy.capitalization ?? 0,
      syntax: fastCachedAccuracy.syntax ?? 0,
      coherence: fastCachedAccuracy.coherence ?? 0,
      messageCount: fastCachedAccuracy.messageCount ?? 0,
      lastUpdated: toIsoString(fastCachedAccuracy.lastUpdated as Date | string | null),
      source: 'fast-cache',
      latest: optimizedCachedAccuracy?.latest
        ? {
            overall: toOptionalNumber(optimizedCachedAccuracy.latest.overall),
            adjustedOverall: toOptionalNumber(optimizedCachedAccuracy.latest.adjustedOverall),
            grammar: toOptionalNumber(optimizedCachedAccuracy.latest.grammar),
            vocabulary: toOptionalNumber(optimizedCachedAccuracy.latest.vocabulary),
            spelling: toOptionalNumber(optimizedCachedAccuracy.latest.spelling),
            fluency: toOptionalNumber(optimizedCachedAccuracy.latest.fluency),
            punctuation: toOptionalNumber(optimizedCachedAccuracy.latest.punctuation),
            capitalization: toOptionalNumber(optimizedCachedAccuracy.latest.capitalization),
            timestamp: optimizedCachedAccuracy.latest.timestamp,
          }
        : undefined,
      xpSnapshot: optimizedCachedAccuracy?.xpSnapshot,
    };
  }

  if (optimizedCachedAccuracy) {
    return {
      overall: optimizedCachedAccuracy.overall ?? 0,
      adjustedOverall: optimizedCachedAccuracy.overall ?? 0,
      grammar: optimizedCachedAccuracy.grammar ?? 0,
      vocabulary: optimizedCachedAccuracy.vocabulary ?? 0,
      spelling: optimizedCachedAccuracy.spelling ?? 0,
      fluency: optimizedCachedAccuracy.fluency ?? 0,
      punctuation: toOptionalNumber(optimizedCachedAccuracy.latest?.punctuation) ?? 0,
      capitalization: toOptionalNumber(optimizedCachedAccuracy.latest?.capitalization) ?? 0,
      syntax: toOptionalNumber(optimizedCachedAccuracy.latest?.syntax) ?? 0,
      coherence: toOptionalNumber(optimizedCachedAccuracy.latest?.coherence) ?? 0,
      messageCount: undefined,
      lastUpdated: optimizedCachedAccuracy.timestamp,
      source: 'optimized-cache',
      latest: optimizedCachedAccuracy.latest
        ? {
            overall: toOptionalNumber(optimizedCachedAccuracy.latest.overall),
            adjustedOverall: toOptionalNumber(optimizedCachedAccuracy.latest.adjustedOverall),
            grammar: toOptionalNumber(optimizedCachedAccuracy.latest.grammar),
            vocabulary: toOptionalNumber(optimizedCachedAccuracy.latest.vocabulary),
            spelling: toOptionalNumber(optimizedCachedAccuracy.latest.spelling),
            fluency: toOptionalNumber(optimizedCachedAccuracy.latest.fluency),
            punctuation: toOptionalNumber(optimizedCachedAccuracy.latest.punctuation),
            capitalization: toOptionalNumber(optimizedCachedAccuracy.latest.capitalization),
            timestamp: optimizedCachedAccuracy.latest.timestamp,
          }
        : undefined,
      xpSnapshot: optimizedCachedAccuracy.xpSnapshot,
    };
  }

  if (fallbackAccuracy) {
    const overall = toOptionalNumber(fallbackAccuracy.overall) ?? toOptionalNumber(fallbackAccuracy.average) ?? 0;
    const adjustedOverall = toOptionalNumber(fallbackAccuracy.adjustedOverall) ?? overall;
    const grammar = toOptionalNumber(fallbackAccuracy.grammar) ?? 0;
    const vocabulary = toOptionalNumber(fallbackAccuracy.vocabulary) ?? 0;
    const spelling = toOptionalNumber(fallbackAccuracy.spelling) ?? 0;
    const fluency = toOptionalNumber(fallbackAccuracy.fluency) ?? 0;
    const punctuation = toOptionalNumber(fallbackAccuracy.punctuation) ?? 0;
    const capitalization = toOptionalNumber(fallbackAccuracy.capitalization) ?? 0;
    const syntax = toOptionalNumber(fallbackAccuracy.syntax) ?? 0;
    const coherence = toOptionalNumber(fallbackAccuracy.coherence) ?? 0;
    const messageCount =
      toOptionalNumber(fallbackAccuracy.messageCount) ?? toOptionalNumber(fallbackAccuracy.calculationCount) ?? 0;

    const timestampCandidate =
      fallbackTimestamp ??
      (typeof fallbackAccuracy.lastUpdated === 'string' ? fallbackAccuracy.lastUpdated : undefined) ??
      (typeof fallbackAccuracy.timestamp === 'string' ? fallbackAccuracy.timestamp : undefined);

    return {
      overall,
      adjustedOverall,
      grammar,
      vocabulary,
      spelling,
      fluency,
      punctuation,
      capitalization,
      syntax,
      coherence,
      messageCount,
      lastUpdated: toIsoString(timestampCandidate ?? null),
      source: fallbackSource,
    };
  }

  return null;
}

const selectRealtimeFields = `
  totalXP
  currentLevel
  currentLevelXP
  xpToNextLevel
  prestigeLevel
  accuracyData.overall
  accuracyData.adjustedOverall
  accuracyData.grammar
  accuracyData.vocabulary
  accuracyData.spelling
  accuracyData.fluency
  accuracyData.punctuation
  accuracyData.capitalization
  accuracyData.calculationCount
  accuracyData.lastCalculated
  streak.current
  streak.longest
  streak.messages
  stats.conversationsPracticed
  stats.totalTimeSpent
  updatedAt
`;

export const getRealtimeProgress = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const [cachedProgress, optimizedCachedAccuracy] = await Promise.all([
      batchedProgressService.getCachedProgress(userId),
      optimizedAccuracyTracker.getCachedAccuracy(userId),
    ]);

    const fastCachedAccuracy = fastAccuracyCache.getAccuracy(userId);

    const accuracyFromCache = buildAccuracyResponse(
      fastCachedAccuracy,
      optimizedCachedAccuracy,
      cachedProgress?.accuracy ?? null,
      'progress-cache',
      typeof cachedProgress?.lastUpdate === 'string' ? cachedProgress.lastUpdate : undefined
    );

    const totalXPFromCache =
      typeof cachedProgress?.xp?.total === 'number'
        ? cachedProgress.xp.total
        : typeof cachedProgress?.totalXP === 'number'
        ? cachedProgress.totalXP
        : undefined;

    const currentLevelFromCache =
      typeof cachedProgress?.xp?.currentLevel === 'number'
        ? cachedProgress.xp.currentLevel
        : typeof cachedProgress?.currentLevel === 'number'
        ? cachedProgress.currentLevel
        : undefined;

    const prestigeFromCache =
      typeof cachedProgress?.xp?.prestigeLevel === 'number'
        ? cachedProgress.xp.prestigeLevel
        : typeof cachedProgress?.prestigeLevel === 'number'
        ? cachedProgress.prestigeLevel
        : undefined;

    const hasProgressCache =
      typeof totalXPFromCache === 'number' && typeof currentLevelFromCache === 'number' && accuracyFromCache;

    if (hasProgressCache && accuracyFromCache) {
      const xpSnapshot = buildXpSnapshot(totalXPFromCache, currentLevelFromCache, prestigeFromCache, {
        currentLevelXP:
          typeof cachedProgress?.xp?.currentLevelXP === 'number'
            ? cachedProgress.xp.currentLevelXP
            : typeof cachedProgress?.currentLevelXP === 'number'
            ? cachedProgress.currentLevelXP
            : undefined,
        xpToNextLevel:
          typeof cachedProgress?.xp?.xpToNextLevel === 'number'
            ? cachedProgress.xp.xpToNextLevel
            : typeof cachedProgress?.xpToNextLevel === 'number'
            ? cachedProgress.xpToNextLevel
            : undefined,
        progressPercentage:
          typeof cachedProgress?.xp?.progressPercentage === 'number'
            ? cachedProgress.xp.progressPercentage
            : typeof cachedProgress?.levelProgress === 'number'
            ? cachedProgress.levelProgress
            : undefined,
        cumulativeXPForCurrentLevel:
          typeof cachedProgress?.xp?.cumulativeXPForCurrentLevel === 'number'
            ? cachedProgress.xp.cumulativeXPForCurrentLevel
            : undefined,
        cumulativeXPForNextLevel:
          typeof cachedProgress?.xp?.cumulativeXPForNextLevel === 'number'
            ? cachedProgress.xp.cumulativeXPForNextLevel
            : undefined,
      });

      const responseData = {
        streak: {
          current:
            typeof cachedProgress?.streak?.current === 'number'
              ? cachedProgress.streak.current
              : typeof cachedProgress?.streak === 'number'
              ? cachedProgress.streak
              : 0,
        },
        accuracy: accuracyFromCache,
        xp: {
          ...xpSnapshot,
          prestigeLevel: prestigeFromCache ?? 0,
        },
        stats: {
          totalMessages:
            typeof cachedProgress?.stats?.totalMessages === 'number'
              ? cachedProgress.stats.totalMessages
              : typeof cachedProgress?.stats?.conversationsPracticed === 'number'
              ? cachedProgress.stats.conversationsPracticed
              : typeof cachedProgress?.streak?.messages === 'number'
              ? cachedProgress.streak.messages
              : 0,
          totalMinutes:
            typeof cachedProgress?.stats?.totalMinutes === 'number'
              ? cachedProgress.stats.totalMinutes
              : 0,
        },
        lastUpdate:
          typeof cachedProgress?.lastUpdate === 'string'
            ? cachedProgress.lastUpdate
            : new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        source: accuracyFromCache.source === 'fast-cache' ? 'fast-cache' : 'cache',
        data: responseData,
      });
      return;
    }

    console.log('[REALTIME] Cache miss, querying database for progress', { userId });

    let progress = await Progress.findOne({ userId }).select(selectRealtimeFields).lean();

    if (!progress) {
      const defaultProgress = new Progress({
        userId,
        totalXP: 0,
        currentLevel: 1,
        currentLevelXP: 0,
        xpToNextLevel: calculateCumulativeXP(2, 0),
        prestigeLevel: 0,
        overallAccuracy: 0,
        proficiencyLevel: 'beginner',
        streak: {
          current: 0,
          longest: 0,
          messages: 0,
          lastActiveDate: new Date(),
        },
        accuracyData: {
          overall: 0,
          adjustedOverall: 0,
          grammar: 0,
          vocabulary: 0,
          spelling: 0,
          fluency: 0,
          punctuation: 0,
          capitalization: 0,
          calculationCount: 0,
          lastCalculated: new Date(),
        },
        stats: {
          conversationsPracticed: 0,
          totalTimeSpent: 0,
        },
      });

      await defaultProgress.save();
      progress = await Progress.findOne({ userId }).select(selectRealtimeFields).lean();

      if (!progress) {
        res.status(500).json({ error: 'Failed to initialize progress' });
        return;
      }
    }

    const progressRecord = progress as Record<string, any>;

    const progressAccuracyFallback = progressRecord.accuracyData
      ? {
          overall: progressRecord.accuracyData.overall,
          adjustedOverall: progressRecord.accuracyData.adjustedOverall ?? progressRecord.accuracyData.overall,
          grammar: progressRecord.accuracyData.grammar,
          vocabulary: progressRecord.accuracyData.vocabulary,
          spelling: progressRecord.accuracyData.spelling,
          fluency: progressRecord.accuracyData.fluency,
          punctuation: progressRecord.accuracyData.punctuation,
          capitalization: progressRecord.accuracyData.capitalization,
          messageCount: progressRecord.accuracyData.calculationCount,
          lastUpdated: progressRecord.accuracyData.lastCalculated,
        }
      : null;

    const accuracyFromDatabase =
      buildAccuracyResponse(
        fastCachedAccuracy,
        optimizedCachedAccuracy,
        progressAccuracyFallback,
        'database'
      ) ?? {
        overall: progressRecord.accuracyData?.overall ?? 0,
        adjustedOverall:
          progressRecord.accuracyData?.adjustedOverall ?? progressRecord.accuracyData?.overall ?? 0,
        grammar: progressRecord.accuracyData?.grammar ?? 0,
        vocabulary: progressRecord.accuracyData?.vocabulary ?? 0,
        spelling: progressRecord.accuracyData?.spelling ?? 0,
        fluency: progressRecord.accuracyData?.fluency ?? 0,
        punctuation: progressRecord.accuracyData?.punctuation ?? 0,
        capitalization: progressRecord.accuracyData?.capitalization ?? 0,
        messageCount: progressRecord.accuracyData?.calculationCount ?? 0,
        lastUpdated: toIsoString(progressRecord.accuracyData?.lastCalculated as Date | string | null),
        source: 'database',
      };

    const xpSnapshot = buildXpSnapshot(progress.totalXP, progress.currentLevel, progress.prestigeLevel, {
      currentLevelXP: progress.currentLevelXP,
      xpToNextLevel: progress.xpToNextLevel,
    });

    const responseData = {
      streak: {
        current: typeof progressRecord.streak?.current === 'number' ? progressRecord.streak.current : 0,
      },
      accuracy: accuracyFromDatabase,
      xp: {
        ...xpSnapshot,
        prestigeLevel: progress.prestigeLevel ?? 0,
      },
      stats: {
        totalMessages:
          typeof progressRecord.stats?.conversationsPracticed === 'number'
            ? progressRecord.stats.conversationsPracticed
            : typeof progressRecord.streak?.messages === 'number'
            ? progressRecord.streak.messages
            : 0,
        totalMinutes:
          typeof progressRecord.stats?.totalTimeSpent === 'number' ? progressRecord.stats.totalTimeSpent : 0,
      },
      lastUpdate: toIsoString(progressRecord.updatedAt as Date | string | null),
    };

    try {
      await redisCache.set(`progress:realtime:${userId}`, JSON.stringify(responseData), REALTIME_CACHE_TTL_SECONDS);
    } catch (cacheError) {
      console.error('[REALTIME] Failed to cache realtime progress', cacheError);
    }

    res.status(200).json({ success: true, source: 'database', data: responseData });
  } catch (error) {
    console.error('Error getting realtime progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
};

export const getOptimizedDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const cacheKey = `dashboard:${userId}`;
    const cached = await redisCache.get(cacheKey);

    if (cached) {
      res.status(200).json({ success: true, source: 'cache', data: JSON.parse(cached) });
      return;
    }

    const progress = await Progress.findOne({ userId })
      .select(`
        totalXP
        currentLevel
        streak.current
        streak.longest
        streak.todayProgress
        streak.stats
        streak.milestones
  accuracyData.overallAccuracySummary
        accuracyData.overall
        accuracyData.grammar
        accuracyData.vocabulary
        accuracyData.spelling
        accuracyData.fluency
        accuracyData.punctuation
        accuracyData.capitalization
        accuracyData.syntax
        accuracyData.coherence
        stats.totalSessions
        stats.totalTimeSpent
        stats.averageSessionTime
        xpBreakdown
        skillMetrics
      `)
      .lean();

    if (!progress) {
      res.status(404).json({ error: 'Progress not found' });
      return;
    }

    const progressRecord = progress as Record<string, any>;
    const today = (progressRecord.streak?.todayProgress ?? {}) as Record<string, unknown>;
    const todayMinutesGoalRaw = typeof today.minutesGoal === 'number' ? today.minutesGoal : undefined;
    const todayMessagesGoalRaw = typeof today.messagesGoal === 'number' ? today.messagesGoal : undefined;
    const todayMinutesGoal = todayMinutesGoalRaw && todayMinutesGoalRaw > 0 ? todayMinutesGoalRaw : 10;
    const todayMessagesGoal = todayMessagesGoalRaw && todayMessagesGoalRaw > 0 ? todayMessagesGoalRaw : 5;

    // Use overallAccuracySummary as primary source, fallback to deprecated fields for backward compatibility
    const summary = progressRecord.accuracyData?.overallAccuracySummary;
    const accuracySource = summary
      ? {
          overall: summary.overallAccuracy,
          grammar: summary.overallGrammar,
          vocabulary: summary.overallVocabulary,
          spelling: summary.overallSpelling,
          fluency: summary.overallFluency,
          punctuation: summary.overallPunctuation,
          capitalization: summary.overallCapitalization,
          syntax: summary.overallSyntax,
          coherence: summary.overallCoherence,
          calculationCount: summary.calculationCount,
          lastCalculated: summary.lastCalculated,
        }
      : {
          overall: progressRecord.accuracyData?.overall,
          grammar: progressRecord.accuracyData?.grammar,
          vocabulary: progressRecord.accuracyData?.vocabulary,
          spelling: progressRecord.accuracyData?.spelling,
          fluency: progressRecord.accuracyData?.fluency,
          punctuation: progressRecord.accuracyData?.punctuation,
          capitalization: progressRecord.accuracyData?.capitalization,
          syntax: progressRecord.accuracyData?.syntax,
          coherence: progressRecord.accuracyData?.coherence,
          calculationCount: progressRecord.accuracyData?.calculationCount,
          lastCalculated: progressRecord.accuracyData?.lastCalculated,
        };

    const dashboardData = {
      overview: {
        totalXP: progress.totalXP ?? 0,
        currentLevel: progress.currentLevel ?? 1,
        currentStreak: progress.streak?.current ?? 0,
        longestStreak: progress.streak?.longest ?? 0,
        totalSessions: progress.stats?.totalSessions ?? 0,
        totalHours: Math.round((progress.stats?.totalTimeSpent ?? 0) / 60),
      },
      todayProgress: {
        minutes: Number(today.minutesPracticed ?? 0),
        minutesGoal: todayMinutesGoal,
        messages: Number(today.messagesCount ?? 0),
        messagesGoal: todayMessagesGoal,
        goalMet: Boolean(today.goalMet),
        percentComplete: Math.min(
          100,
          (Number(today.minutesPracticed ?? 0) / todayMinutesGoal) * 50 +
            (Number(today.messagesCount ?? 0) / todayMessagesGoal) * 50
        ),
      },
      accuracy: {
  overall: accuracySource?.overall ?? 0,
  grammar: accuracySource?.grammar ?? 0,
  vocabulary: accuracySource?.vocabulary ?? 0,
  spelling: accuracySource?.spelling ?? 0,
  fluency: accuracySource?.fluency ?? 0,
  punctuation: accuracySource?.punctuation ?? 0,
  capitalization: accuracySource?.capitalization ?? 0,
  syntax: accuracySource?.syntax ?? 0,
  coherence: accuracySource?.coherence ?? 0,
  calculationCount: accuracySource?.calculationCount ?? 0,
  lastCalculated: accuracySource?.lastCalculated ?? null,
      },
      streakStats: {
        current: progressRecord.streak?.current ?? 0,
        longest: progressRecord.streak?.longest ?? 0,
        totalActiveDays: progressRecord.streak?.stats?.totalActiveDays ?? 0,
        averageMinutesPerDay: progressRecord.streak?.stats?.averageMinutesPerDay ?? 0,
      },
      milestones: Array.isArray(progressRecord.streak?.milestones)
        ? progressRecord.streak.milestones.slice(-5)
        : [],
      xpBreakdown: progressRecord.xpBreakdown ?? {},
      skillMetrics: progressRecord.skillMetrics ?? {},
    };

    try {
      await redisCache.set(cacheKey, JSON.stringify(dashboardData), DASHBOARD_CACHE_TTL_SECONDS);
    } catch (cacheError) {
      console.error('[DASHBOARD] Failed to cache dashboard payload', cacheError);
    }

    res.status(200).json({ success: true, source: 'database', data: dashboardData });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
};

export const getBatchStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const stats = batchedProgressService.getStats();

    res.status(200).json({
      success: true,
      data: {
        queueSize: stats.queueSize,
        isProcessing: stats.isProcessing,
        flushInterval: stats.flushInterval,
        status:
          stats.queueSize < 100 ? 'healthy' : stats.queueSize < 500 ? 'moderate' : 'high',
      },
    });
  } catch (error) {
    console.error('Error getting batch stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

export const forceFlushQueue = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await batchedProgressService.flush();

    res.status(200).json({
      success: true,
      message: 'Queue flushed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error flushing queue:', error);
    res.status(500).json({ error: 'Failed to flush queue' });
  }
};

export default {
  getRealtimeProgress,
  getOptimizedDashboard,
  getBatchStats,
  forceFlushQueue,
};
