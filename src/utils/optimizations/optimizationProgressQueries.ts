/**
 * 🚀 DATABASE QUERY OPTIMIZATIONS
 * Enhanced queries with indexes, projections, and lean() for performance
 */

import Progress from '../../models/Progress.js';
import { redisCache } from '../../config/redis.js';
import { logger } from '../../utils/calculators/core/logger.js';
import { Types, PipelineStage } from 'mongoose';

type LeaderboardMetric =
  | 'xp'
  | 'weeklyXP'
  | 'monthlyXP'
  | 'streak'
  | 'accuracy'
  | 'grammar'
  | 'vocabulary'
  | 'spelling'
  | 'fluency'
  | 'timeSpent'
  | 'sessions';

interface LeaderboardQueryOptions {
  metric?: LeaderboardMetric;
  timeframe?: 'week' | 'month' | 'all';
  direction?: 'asc' | 'desc';
  tier?: 'free' | 'pro' | 'premium';
}

const resolveLeaderboardSortField = (
  metric: LeaderboardMetric,
  timeframe: 'week' | 'month' | 'all'
): string => {
  if (metric === 'xp') {
    if (timeframe === 'week') {
      return 'weeklyXP';
    }
    if (timeframe === 'month') {
      return 'monthlyXP';
    }
    return 'totalXP';
  }

  const mapping: Record<LeaderboardMetric, string> = {
    xp: 'totalXP',
    weeklyXP: 'weeklyXP',
    monthlyXP: 'monthlyXP',
    streak: 'streak.current',
    accuracy: 'overallAccuracy',
    grammar: 'accuracyData.grammar',
    vocabulary: 'accuracyData.vocabulary',
    spelling: 'accuracyData.spelling',
    fluency: 'accuracyData.fluency',
    timeSpent: 'stats.totalTimeSpent',
    sessions: 'stats.totalSessions',
  };

  return mapping[metric] ?? 'totalXP';
};

// Cache TTLs (in seconds)
const CACHE_TTL = {
  PROGRESS: 300,      // 5 minutes
  STREAK: 300,        // 5 minutes
  LEADERBOARD: 600,   // 10 minutes
  STATS: 3600,        // 1 hour
};

export class OptimizedProgressQueries {
  /**
   * Get user progress with caching (read-heavy operation)
   */
  static async getUserProgress(userId: string | Types.ObjectId) {
    const cacheKey = `progress:${userId.toString()}`;

    try {
      // Try cache first
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        logger.debug({ userId: userId.toString() }, '✅ Progress cache hit');
        return JSON.parse(cached);
      }

      // Cache miss - query database with optimizations
      const progress = await Progress.findOne({ userId })
        .select('totalXP currentLevel streak tier badges achievements')
        .lean()  // Convert to plain JS object for faster serialization
        .exec();

      if (progress) {
        // Cache for next time
        await redisCache.set(cacheKey, JSON.stringify(progress), CACHE_TTL.PROGRESS);
        logger.debug({ userId: userId.toString() }, '💾 Progress cached');
      }

      return progress;
    } catch (error) {
      logger.error({ userId: userId.toString(), error }, '❌ Failed to get user progress');
      throw error;
    }
  }

  /**
   * Get streak data only (minimal projection)
   */
  static async getStreakData(userId: string | Types.ObjectId) {
    const cacheKey = `streak:${userId.toString()}`;

    try {
      // Try cache first
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Query only streak fields
      const progress = await Progress.findOne({ userId })
        .select('streak tier')
        .lean()
        .exec();

      if (progress) {
        await redisCache.set(cacheKey, JSON.stringify(progress), CACHE_TTL.STREAK);
      }

      return progress?.streak || null;
    } catch (error) {
      logger.error({ userId: userId.toString(), error }, '❌ Failed to get streak data');
      throw error;
    }
  }

  /**
   * Get leaderboard with pagination and caching
   */
  static async getLeaderboard(
    limit: number = 100,
    offset: number = 0,
    options: LeaderboardQueryOptions = {}
  ) {
    const metric = options.metric ?? 'xp';
    const timeframe = options.timeframe ?? 'all';
    const direction = options.direction === 'asc' ? 'asc' : 'desc';
    const tier = options.tier ?? null;

  const sortField = resolveLeaderboardSortField(metric, timeframe);
    const cacheKey = redisCache.getLeaderboardCacheKey(sortField, limit);

    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        logger.debug('✅ Leaderboard cache hit');
        return JSON.parse(cached);
      }

      const sortDirection = direction === 'asc' ? 1 : -1;

  const pipeline: PipelineStage[] = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  username: 1,
                  tier: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'userprofiles',
            localField: 'userId',
            foreignField: 'userId',
            as: 'userProfile',
            pipeline: [
              {
                $project: {
                  avatar_url: 1,
                  avatar: 1,
                  avatarUrl: 1,
                  profileImage: 1,
                  profile_image: 1,
                  image: 1,
                  imageUrl: 1,
                  country: 1,
                  location: 1,
                  displayName: 1,
                  username: 1,
                  tier: 1,
                  userId: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$userProfile',
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (tier) {
        pipeline.push({
          $match: {
            'user.tier': tier,
          },
        });
      }

      pipeline.push({
        $addFields: {
          metricValue: {
            $ifNull: [`$${sortField}`, 0],
          },
        },
      });

      pipeline.push({
        $sort: {
          metricValue: sortDirection,
          totalXP: -1,
          lastActive: -1,
        },
      });

      if (offset > 0) {
        pipeline.push({ $skip: offset });
      }

      pipeline.push({ $limit: limit });

      pipeline.push({
        $project: {
          _id: 0,
          progressId: '$_id',
          userId: '$userId',
          user: '$user',
          totalXP: { $ifNull: ['$totalXP', 0] },
          weeklyXP: { $ifNull: ['$weeklyXP', 0] },
          monthlyXP: { $ifNull: ['$monthlyXP', 0] },
          dailyXP: { $ifNull: ['$dailyXP', 0] },
          currentLevel: { $ifNull: ['$currentLevel', 0] },
          tierLevel: { $ifNull: ['$tier', 0] },
          streak: {
            current: { $ifNull: ['$streak.current', 0] },
            longest: { $ifNull: ['$streak.longest', 0] },
          },
          overallAccuracy: { $ifNull: ['$overallAccuracy', 0] },
          accuracyData: {
            overall: { $ifNull: ['$accuracyData.overall', 0] },
            grammar: { $ifNull: ['$accuracyData.grammar', 0] },
            vocabulary: { $ifNull: ['$accuracyData.vocabulary', 0] },
            spelling: { $ifNull: ['$accuracyData.spelling', 0] },
            fluency: { $ifNull: ['$accuracyData.fluency', 0] },
            punctuation: { $ifNull: ['$accuracyData.punctuation', 0] },
            capitalization: { $ifNull: ['$accuracyData.capitalization', 0] },
            syntax: { $ifNull: ['$accuracyData.syntax', 0] },
            coherence: { $ifNull: ['$accuracyData.coherence', 0] },
          },
          stats: {
            totalSessions: { $ifNull: ['$stats.totalSessions', 0] },
            totalTimeSpent: { $ifNull: ['$stats.totalTimeSpent', 0] },
            averageSessionTime: { $ifNull: ['$stats.averageSessionTime', 0] },
          },
          leaderboard: {
            weeklyXP: { $ifNull: ['$leaderboard.weeklyXP', 0] },
            monthlyXP: { $ifNull: ['$leaderboard.monthlyXP', 0] },
            globalRank: { $ifNull: ['$leaderboard.globalRank', 0] },
            lastRankUpdate: '$leaderboard.lastRankUpdate',
          },
          analytics: {
            learningVelocity: { $ifNull: ['$analytics.learningVelocity', 0] },
            consistencyScore: { $ifNull: ['$analytics.consistencyScore', 0] },
            improvementRate: { $ifNull: ['$analytics.improvementRate', 0] },
            strongestSkill: { $ifNull: ['$analytics.strongestSkill', ''] },
            weakestSkill: { $ifNull: ['$analytics.weakestSkill', ''] },
            recommendedFocus: { $ifNull: ['$analytics.recommendedFocus', []] },
          },
          lastActive: '$lastActive',
          metricValue: { $ifNull: ['$metricValue', 0] },
          userProfile: '$userProfile',
        },
      });

      const leaderboard = await Progress.aggregate(pipeline).exec();

      const normalized = leaderboard.map((entry: any) => {
        const profile = entry.userProfile
          ? {
              ...entry.userProfile,
              _id: entry.userProfile._id?.toString?.() ?? null,
              userId: entry.userProfile.userId?.toString?.() ?? null,
            }
          : null;

        const user = entry.user
          ? {
              ...entry.user,
              _id: entry.user._id?.toString?.() ?? null,
              profile,
            }
          : profile
          ? {
              _id: profile.userId,
              username: profile.username ?? null,
              tier: profile.tier ?? null,
              country: profile.country ?? profile.location ?? null,
              profile,
            }
          : null;

        return {
          ...entry,
          progressId: entry.progressId?.toString?.() ?? null,
          userId: entry.userId?.toString?.() ?? null,
          user,
          userProfile: profile,
        };
      });

      await redisCache.set(cacheKey, JSON.stringify(normalized), CACHE_TTL.LEADERBOARD);
      logger.debug('💾 Leaderboard cached');

      return normalized;
    } catch (error) {
      logger.error({ error }, '❌ Failed to get leaderboard');
      throw error;
    }
  }

  /**
   * Get active streaks count (aggregation with index)
   */
  static async getActiveStreaksCount() {
    const cacheKey = 'stats:active_streaks';

    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return parseInt(cached, 10);
      }

      // Use aggregation pipeline for efficiency
      const result = await Progress.aggregate([
        { $match: { 'streak.current': { $gt: 0 } } },
        { $count: 'activeStreaks' },
      ]);

      const count = result[0]?.activeStreaks || 0;

      await redisCache.set(cacheKey, count.toString(), CACHE_TTL.STATS);

      return count;
    } catch (error) {
      logger.error({ error }, '❌ Failed to get active streaks count');
      throw error;
    }
  }

  /**
   * Get users with expiring streaks (for notifications)
   */
  static async getUsersWithExpiringStreaks(hoursThreshold: number = 4) {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - hoursThreshold * 60 * 60 * 1000);

      // Find users with streaks that haven't been updated recently
      const users = await Progress.find({
        'streak.current': { $gt: 0 },
        'streak.lastActivityDate': { $lt: cutoffTime },
      })
        .select('userId streak tier')
        .lean()
        .exec();

      return users;
    } catch (error) {
      logger.error({ error }, '❌ Failed to get users with expiring streaks');
      throw error;
    }
  }

  /**
   * Batch update multiple users' progress (for background jobs)
   */
  static async batchUpdateProgress(updates: Array<{ userId: string; updates: any }>) {
    try {
      const operations = updates.map(({ userId, updates }) => ({
        updateOne: {
          filter: { userId },
          update: { $set: updates },
        },
      }));

      const result = await Progress.bulkWrite(operations);

      logger.info({ modified: result.modifiedCount }, '✅ Batch progress update complete');

      // Clear affected caches
      await Promise.all(
        updates.map(({ userId }) =>
          redisCache.del(`progress:${userId}`, `streak:${userId}`)
        )
      );

      return result;
    } catch (error) {
      logger.error({ error }, '❌ Failed to batch update progress');
      throw error;
    }
  }

  /**
   * Clear all progress-related caches
   */
  static async clearAllCaches() {
    try {
      const keys = await redisCache.keys('progress:*');
      const streakKeys = await redisCache.keys('streak:*');
      const leaderboardKeys = await redisCache.keys('leaderboard:*');

      const allKeys = [...keys, ...streakKeys, ...leaderboardKeys];

      if (allKeys.length > 0) {
        await redisCache.del(...allKeys);
        logger.info({ cleared: allKeys.length }, '🗑️ Cleared all progress caches');
      }
    } catch (error) {
      logger.error({ error }, '❌ Failed to clear caches');
    }
  }

  /**
   * Invalidate user-specific cache
   */
  static async invalidateUserCache(userId: string | Types.ObjectId) {
    const userIdStr = userId.toString();
    try {
      await redisCache.del(
        `progress:${userIdStr}`,
        `streak:${userIdStr}`
      );
      logger.debug({ userId: userIdStr }, '🗑️ User cache invalidated');
    } catch (error) {
      logger.warn({ userId: userIdStr, error }, '⚠️ Failed to invalidate user cache');
    }
  }
}

/**
 * 📊 Recommended MongoDB Indexes
 * Add these indexes to your Progress collection for optimal performance:
 * 
 * db.progress.createIndex({ userId: 1 }, { unique: true })
 * db.progress.createIndex({ totalXP: -1 })
 * db.progress.createIndex({ "streak.current": -1 })
 * db.progress.createIndex({ "streak.lastActivityDate": 1 })
 * db.progress.createIndex({ tier: 1 })
 * 
 * Compound indexes for common queries:
 * db.progress.createIndex({ "streak.current": 1, "streak.lastActivityDate": 1 })
 * db.progress.createIndex({ tier: 1, totalXP: -1 })
 */

export default OptimizedProgressQueries;
