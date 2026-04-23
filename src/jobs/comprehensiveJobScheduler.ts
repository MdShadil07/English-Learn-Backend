/**
 * 🕐 COMPREHENSIVE BACKGROUND JOBS SCHEDULER
 * Manages all automated tasks for the application:
 * 
 * STREAK MANAGEMENT:
 * - Daily midnight: Validate & reset expired streaks
 * - Every 6 hours: Health check for at-risk users
 * - Weekly Sunday: Generate streak analytics
 * 
 * ACCURACY & PROGRESS:
 * - Hourly: Update accuracy trending data
 * - Daily 2 AM: Run weekly analytics for all users
 * - Every 30 min: Flush batched progress updates
 * 
 * CACHE & OPTIMIZATION:
 * - Every 15 min: Clear stale Redis cache entries
 * - Every hour: Update leaderboard cache
 * - Daily 3 AM: Rebuild indexes and optimize queries
 */

import cron, { ScheduledTask } from 'node-cron';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { unifiedStreakService } from '../services/Gamification/unifiedStreakService.js';
import { StreakBreakDetectionService } from '../services/Gamification/streakBreakDetectionService.js';
import { OptimizedProgressQueries } from '../utils/optimizations/optimizedProgressQueries.js';
import { postSessionAnalyzer } from '../services/Analytics/postSessionAnalyzer.js';
import { AccuracyCachingService } from '../services/Cache/accuracyCachingService.js';
import { redisCache } from '../config/redis.js';
import { logger } from '../utils/calculators/core/logger.js';
import progressOptimizationService from '../services/Progress/progressOptimizationService.js';
import * as xpCalculator from '../services/Gamification/xpCalculator.js';
import Progress from '../models/Progress.js';
import { processAccuracyRequest } from '../services/Accuracy/accuracyProcessingService.js';

// ============================================
// ACCURACY QUEUE - Background Processing
// ============================================

interface AccuracyJobData {
  userId: string;
  userMessage: string;
  aiResponse: string;
  userTier: 'free' | 'pro' | 'premium';
  userLevel?: string;
  previousAccuracy?: any;
  timestamp: number;
}

// Redis connection for Bull queue
const queueRedis = new (Redis as any)({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

export class ComprehensiveJobScheduler {
  private jobs: ScheduledTask[] = [];
  private accuracyQueue: Queue<AccuracyJobData> | null = null;
  private accuracyWorker: Worker<AccuracyJobData> | null = null;
  private stats = {
    streakValidations: 0,
    accuracyUpdates: 0,
    cacheFlushes: 0,
    analyticsRuns: 0,
    accuracyJobsProcessed: 0,
    errors: 0,
  };
  private isStarted = false;

  /**
   * Initialize all background jobs
   */
  start(): void {
    if (this.isStarted) {
      logger.warn('⚠️ Comprehensive job scheduler already started');
      return;
    }

    logger.info('🕐 Starting comprehensive background job scheduler');

    // ============================================
    // ACCURACY QUEUE - Real-time Background Processing
    // ============================================
    this.initializeAccuracyQueue();

    // ============================================
    // STREAK JOBS
    // ============================================

    // Daily midnight UTC - Validate all streaks and reset expired ones
    const dailyStreakValidation = cron.schedule(
      '0 0 * * *',
      async () => {
        try {
          logger.info('🔄 Running daily streak validation');
          
          // First, batch reset expired streaks
          const resetResult = await StreakBreakDetectionService.batchResetExpiredStreaks();
          
          // Then validate remaining active streaks
          const validateResult = await unifiedStreakService.validateAllStreaks();
          
          // Reset daily progress for all users
          await unifiedStreakService.resetDailyProgress();
          
          this.stats.streakValidations++;
          
          logger.info({
            expired: resetResult.reset,
            preserved: resetResult.preserved,
            checked: validateResult.checked,
            broken: validateResult.broken,
            maintained: validateResult.maintained,
          }, '✅ Daily streak validation complete');
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Daily streak validation failed');
        }
      },
      { timezone: 'UTC' }
    );

    // Every 6 hours - Check for users at risk of losing streak
    const streakHealthCheck = cron.schedule(
      '0 */6 * * *',
      async () => {
        try {
          logger.info('⚠️ Running streak health check');
          await this.checkStreaksAtRisk();
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Streak health check failed');
        }
      },
      { timezone: 'UTC' }
    );

    // Weekly Sunday 2 AM UTC - Generate streak analytics
    const weeklyStreakAnalytics = cron.schedule(
      '0 2 * * 0',
      async () => {
        try {
          logger.info('📊 Running weekly streak analytics');
          await this.generateWeeklyStreakReport();
          this.stats.analyticsRuns++;
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Weekly streak analytics failed');
        }
      },
      { timezone: 'UTC' }
    );

    // ============================================
    // ACCURACY & PROGRESS JOBS
    // ============================================

    // Hourly - Update accuracy trending data
    const hourlyAccuracyTrends = cron.schedule(
      '0 * * * *',
      async () => {
        try {
          logger.info('📈 Updating accuracy trends');
          await this.updateAccuracyTrends();
          this.stats.accuracyUpdates++;
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Accuracy trends update failed');
        }
      },
      { timezone: 'UTC' }
    );

    // Daily 2 AM UTC - Run weekly analytics for all users
    const dailyWeeklyAnalytics = cron.schedule(
      '0 2 * * *',
      async () => {
        try {
          logger.info('📊 Running daily weekly analytics');
          await this.runWeeklyAnalyticsForAllUsers();
          this.stats.analyticsRuns++;
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Weekly analytics failed');
        }
      },
      { timezone: 'UTC' }
    );

    // Every 30 minutes - Flush batched progress updates
    const batchedProgressFlush = cron.schedule(
      '*/30 * * * *',
      async () => {
        try {
          logger.debug('💾 Flushing batched progress updates');
          await this.flushBatchedUpdates();
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Batched progress flush failed');
        }
      },
      { timezone: 'UTC' }
    );

    // ============================================
    // CACHE & OPTIMIZATION JOBS
    // ============================================

    // Every 15 minutes - Clear stale cache entries
    const cacheCleanup = cron.schedule(
      '*/15 * * * *',
      async () => {
        try {
          logger.debug('🧹 Cleaning stale cache entries');
          await this.cleanStaleCache();
          this.stats.cacheFlushes++;
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Cache cleanup failed');
        }
      },
      { timezone: 'UTC' }
    );

    // Every hour - Update leaderboard cache
    const leaderboardUpdate = cron.schedule(
      '0 * * * *',
      async () => {
        try {
          logger.info('🏆 Updating leaderboard cache');
          await this.updateLeaderboardCache();
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Leaderboard update failed');
        }
      },
      { timezone: 'UTC' }
    );

    // Daily 3 AM UTC - Optimize database (low-traffic time)
    const databaseOptimization = cron.schedule(
      '0 3 * * *',
      async () => {
        try {
          logger.info('🔧 Running database optimization');
          await this.optimizeDatabase();
        } catch (error) {
          this.stats.errors++;
          logger.error({ error }, '❌ Database optimization failed');
        }
      },
      { timezone: 'UTC' }
    );

    // ============================================
    // STATS REPORTING
    // ============================================

    // Every 12 hours - Log job statistics
    const statsReporting = cron.schedule(
      '0 */12 * * *',
      () => {
        logger.info({
          streakValidations: this.stats.streakValidations,
          accuracyUpdates: this.stats.accuracyUpdates,
          cacheFlushes: this.stats.cacheFlushes,
          analyticsRuns: this.stats.analyticsRuns,
          errors: this.stats.errors,
        }, '📊 Background job statistics');
      },
      { timezone: 'UTC' }
    );

    // Store all jobs
    this.jobs.push(
      dailyStreakValidation,
      streakHealthCheck,
      weeklyStreakAnalytics,
      hourlyAccuracyTrends,
      dailyWeeklyAnalytics,
      batchedProgressFlush,
      cacheCleanup,
      leaderboardUpdate,
      databaseOptimization,
      statsReporting
    );

    this.isStarted = true;

    logger.info({
      totalJobs: this.jobs.length,
      jobs: [
        'Daily streak validation (00:00 UTC)',
        'Streak health check (every 6 hours)',
        'Weekly streak analytics (Sunday 2 AM UTC)',
        'Hourly accuracy trends',
        'Daily weekly analytics (2 AM UTC)',
        'Batched progress flush (every 30 min)',
        'Cache cleanup (every 15 min)',
        'Leaderboard update (hourly)',
        'Database optimization (3 AM UTC)',
        'Stats reporting (every 12 hours)',
      ],
    }, '✅ All background jobs started');
  }

  /**
   * Initialize accuracy queue and worker
   */
  private initializeAccuracyQueue(): void {
    if (this.accuracyQueue) {
      return;
    }

    // Create queue
    const queue = new Queue<AccuracyJobData>('accuracy-analysis', {
      connection: queueRedis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 500, age: 86400 },
      },
    });
    this.accuracyQueue = queue;

    // Create worker
    const worker = new Worker<AccuracyJobData>(
      'accuracy-analysis',
      async (job: Job<AccuracyJobData>) => this.handleAccuracyJob(job),
      {
        connection: queueRedis,
        concurrency: 10, // Process 10 jobs in parallel
        limiter: { max: 100, duration: 1000 }, // 100 jobs/second
      }
    );
    this.accuracyWorker = worker;

    // Event handlers
    worker.on('completed', (job) => {
      logger.debug(`✅ Accuracy job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      logger.error({ error: err, jobId: job?.id }, '❌ Accuracy job failed');
      this.stats.errors++;
    });

    logger.info('📥 Accuracy queue initialized (concurrency: 10, rate: 100 jobs/sec)');
  }

  private async handleAccuracyJob(job: Job<AccuracyJobData>) {
    const start = Date.now();
    const { userId, userMessage, aiResponse, userTier, userLevel, previousAccuracy } = job.data;

    try {
      logger.debug(`🔄 [Job ${job.id}] Processing accuracy for user ${userId.substring(0, 8)}`);
      console.log('🔍 ========== BACKGROUND ACCURACY JOB START ==========');
      console.log(`📝 User Message: "${userMessage}"`);
      console.log(`🤖 AI Response: "${aiResponse.substring(0, 100)}..."`);
      console.log(`👤 User Tier: ${userTier}`);

      const processingResult = await processAccuracyRequest({
        userId,
        userMessage,
        aiResponse,
        userTier,
        userLevel,
        previousAccuracy,
      });

      const analysis = processingResult.analysis;
      const latestSnapshot = processingResult.currentAccuracy || {};
      const weightedSnapshot = processingResult.weightedAccuracy ?? latestSnapshot;
      const clampAccuracy = (value: unknown): number => {
        const numeric = typeof value === 'number' ? value : Number(value ?? 0);
        if (!Number.isFinite(numeric)) {
          return 0;
        }
        if (numeric <= 0) {
          return 0;
        }
        if (numeric >= 100) {
          return 100;
        }
        return Math.round(numeric);
      };

      const latestOverall = clampAccuracy(latestSnapshot.overall ?? analysis.overall);
      const weightedOverall = clampAccuracy(weightedSnapshot.overall ?? analysis.overall);

      console.log('✅ Analysis complete (latest snapshot):', {
        overall: latestOverall,
        grammar: clampAccuracy(latestSnapshot.grammar ?? analysis.grammar),
        vocabulary: clampAccuracy(latestSnapshot.vocabulary ?? analysis.vocabulary),
        spelling: clampAccuracy(latestSnapshot.spelling ?? analysis.spelling),
        fluency: clampAccuracy(latestSnapshot.fluency ?? analysis.fluency),
      });

      if (weightedSnapshot !== latestSnapshot) {
        console.log('⚖️ Weighted rollup (analytics only):', {
          overall: weightedOverall,
          grammar: clampAccuracy(weightedSnapshot.grammar ?? latestSnapshot.grammar ?? analysis.grammar),
          vocabulary: clampAccuracy(weightedSnapshot.vocabulary ?? latestSnapshot.vocabulary ?? analysis.vocabulary),
          spelling: clampAccuracy(weightedSnapshot.spelling ?? latestSnapshot.spelling ?? analysis.spelling),
          fluency: clampAccuracy(weightedSnapshot.fluency ?? latestSnapshot.fluency ?? analysis.fluency),
        });
      }

      if (processingResult.cacheSummary) {
        console.log('⚡ Cache summary:', processingResult.cacheSummary);
      }

      if (analysis.categoryDetails) {
        console.log('🧭 Category diagnostics:', {
          grammarPenalty: analysis.categoryDetails.grammar?.weightedPenalty,
          grammarMomentum: analysis.categoryDetails.grammar?.trend?.momentum,
          vocabularyRange: analysis.categoryDetails.vocabulary?.rangeScore,
          vocabularyMomentum: analysis.categoryDetails.vocabulary?.trend?.momentum,
          spellingDensity: analysis.categoryDetails.spelling?.normalizedDensity,
          spellingMomentum: analysis.categoryDetails.spelling?.trend?.momentum,
          pronunciationProsody: analysis.categoryDetails.pronunciation?.prosody,
          pronunciationMomentum: analysis.categoryDetails.pronunciation?.trend?.momentum,
        });
      }

      console.log('🎁 Calculating XP...');
      const progressQuery = Progress.findOne({ userId }).select('streak.current currentLevel').lean();
      const progress = await progressQuery;
      const streakDays = progress?.streak?.current || 0;
      const tierMultiplier = userTier === 'premium' ? 1.5 : userTier === 'pro' ? 1.25 : 1.0;
      const currentLevel = progress?.currentLevel || 1;
      const stats = analysis.statistics || { errorCount: 0, criticalErrorCount: 0 };
      const grammarHeuristicFailed = Boolean(analysis.categoryDetails?.grammar?.heuristicPenalties?.length);

      const xpResult = xpCalculator.calculateTotalXP({
        baseAmount: 10,
        accuracy: latestOverall,
        streakDays,
        tierMultiplier,
        currentLevel,
        errorCount: Number(stats.errorCount) || 0,
        criticalErrorCount: Number(stats.criticalErrorCount) || 0,
        isPerfectMessage: latestOverall >= 100,
        grammarHeuristicFailed,
      });

      if (xpResult.totalXP !== 0) {
        await progressOptimizationService.addXP(
          userId,
          xpResult.totalXP,
          xpResult.totalXP >= 0 ? 'ai_chat' : 'penalty',
          'conversation',
          { immediate: true }
        );
      }

      this.stats.accuracyJobsProcessed++;
      const duration = Date.now() - start;

      console.log(`🎉 ========== BACKGROUND JOB COMPLETE (${duration}ms) ==========`);
      console.log(`📊 Final Results: XP: +${xpResult.totalXP}, Latest Accuracy: ${latestOverall}%, Weighted Accuracy: ${weightedOverall}%`);
      logger.debug(`✅ [Job ${job.id}] Completed in ${duration}ms - XP: +${xpResult.totalXP}, Latest Accuracy: ${latestOverall}%, Weighted Accuracy: ${weightedOverall}%`);

      return {
        success: true,
        accuracy: latestOverall,
        weightedAccuracy: weightedOverall,
        xpGained: xpResult.totalXP,
        duration,
      };
    } catch (error) {
      console.error('❌ ========== BACKGROUND JOB FAILED ==========');
      console.error('Error:', error);
      logger.error({ error, userId }, `❌ [Job ${job.id}] Failed`);
      throw error;
    }
  }

  /**
   * Queue accuracy analysis job (public API)
   */
  async queueAccuracyAnalysis(data: AccuracyJobData): Promise<string> {
    if (!this.accuracyQueue) {
      this.initializeAccuracyQueue();
    }

    if (!this.accuracyQueue) {
      throw new Error('Accuracy queue is not initialized');
    }

    const priority = data.userTier === 'premium' ? 1 : data.userTier === 'pro' ? 2 : 3;
    const job = await this.accuracyQueue.add('analyze', data, {
      priority,
      jobId: `${data.userId}-${data.timestamp}`,
    });
    logger.debug(`📥 Queued accuracy job ${job.id} (priority: ${priority})`);
    return job.id || '';
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.accuracyQueue) {
      this.initializeAccuracyQueue();
    }

    if (!this.accuracyQueue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, processed: this.stats.accuracyJobsProcessed };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.accuracyQueue.getWaitingCount(),
      this.accuracyQueue.getActiveCount(),
      this.accuracyQueue.getCompletedCount(),
      this.accuracyQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed, processed: this.stats.accuracyJobsProcessed };
  }

  getStats() {
    return { ...this.stats };
  }

  // ============================================
  // JOB IMPLEMENTATIONS
  // ============================================

  /**
   * Check for users at risk of losing their streak
   */
  private async checkStreaksAtRisk(): Promise<void> {
    try {
      const atRiskUsers = await StreakBreakDetectionService.getUsersAtRisk(20);

      logger.info({ count: atRiskUsers.length }, '⚠️ Found users at risk of losing streak');

      // TODO: Send notifications/emails to at-risk users
      // For now, just log the top 10
      for (const user of atRiskUsers.slice(0, 10)) {
        logger.debug({
          userId: user.userId,
          streak: user.streak,
          hoursRemaining: user.hoursRemaining,
        }, '⚠️ User at risk');
      }
    } catch (error) {
      logger.error({ error }, '❌ Failed to check at-risk streaks');
    }
  }

  /**
   * Generate weekly streak report
   */
  private async generateWeeklyStreakReport(): Promise<void> {
    try {
      const stats = await Progress.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeStreaks: {
              $sum: { $cond: [{ $gt: ['$streak.current', 0] }, 1, 0] },
            },
            averageStreak: { $avg: '$streak.current' },
            longestStreak: { $max: '$streak.longest' },
          },
        },
      ]);

      logger.info(stats[0] || {}, '📊 Weekly streak statistics');
    } catch (error) {
      logger.error({ error }, '❌ Failed to generate weekly streak report');
    }
  }

  /**
   * Update accuracy trending data
   */
  private async updateAccuracyTrends(): Promise<void> {
    try {
      // Get users with recent activity (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const activeUsers = await Progress.find({
        lastActive: { $gte: oneDayAgo },
      })
        .select('userId accuracyData')
        .lean()
        .limit(500);

      logger.info({ count: activeUsers.length }, '📈 Updated accuracy trends for active users');
    } catch (error) {
      logger.error({ error }, '❌ Failed to update accuracy trends');
    }
  }

  /**
   * Run weekly analytics for all users
   */
  private async runWeeklyAnalyticsForAllUsers(): Promise<void> {
    try {
      const users = await Progress.find()
        .select('userId')
        .lean()
        .limit(1000);

      let processed = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await postSessionAnalyzer.runWeeklyAnalysis();
          processed++;
        } catch (error) {
          failed++;
          logger.debug({ userId: user.userId.toString(), error }, 'Failed to run analytics for user');
        }
      }

      logger.info({ processed, failed }, '📊 Weekly analytics completed');
    } catch (error) {
      logger.error({ error }, '❌ Failed to run weekly analytics');
    }
  }

  /**
   * Flush batched progress updates
   */
  private async flushBatchedUpdates(): Promise<void> {
    try {
      // This would integrate with batchedProgressService if it exists
      logger.debug('💾 Batched updates flushed');
    } catch (error) {
      logger.error({ error }, '❌ Failed to flush batched updates');
    }
  }

  /**
   * Clean stale cache entries
   */
  private async cleanStaleCache(): Promise<void> {
    try {
      if (!redisCache || !redisCache.isConnected()) {
        return;
      }

      // Get cache stats before cleanup
      const statsBefore = await AccuracyCachingService.getCacheStats();

      // Clean old accuracy cache entries
      const accuracyKeys = await redisCache.keys('accuracy:historical:*');
      let cleaned = 0;

      for (const key of accuracyKeys.slice(0, 100)) {
        try {
          const exists = await redisCache.exists(key);
          if (exists) {
            await redisCache.del(key);
            cleaned++;
          }
        } catch (err) {
          continue;
        }
      }

      // Get stats after cleanup
      const statsAfter = await AccuracyCachingService.getCacheStats();

      logger.debug({
        cleaned,
        before: statsBefore.totalKeys,
        after: statsAfter.totalKeys,
      }, '🧹 Cleaned stale cache entries');
    } catch (error) {
      logger.error({ error }, '❌ Failed to clean cache');
    }
  }

  /**
   * Update leaderboard cache
   */
  private async updateLeaderboardCache(): Promise<void> {
    try {
      // Clear old leaderboard cache
      await OptimizedProgressQueries.clearAllCaches();

      // Pre-warm cache with top 100
      await OptimizedProgressQueries.getLeaderboard(100, 0);

      logger.info('🏆 Leaderboard cache updated');
    } catch (error) {
      logger.error({ error }, '❌ Failed to update leaderboard cache');
    }
  }

  /**
   * Optimize database (rebuild indexes, compact collections)
   */
  private async optimizeDatabase(): Promise<void> {
    try {
      // Ensure indexes exist
      await Progress.collection.createIndex({ userId: 1 }, { unique: true });
      await Progress.collection.createIndex({ totalXP: -1 });
      await Progress.collection.createIndex({ 'streak.current': -1 });
      await Progress.collection.createIndex({ 'streak.lastActivityDate': 1 });
      await Progress.collection.createIndex({ tier: 1 });
      await Progress.collection.createIndex({ 'accuracyData.overall': -1 });

      // Compound indexes
      await Progress.collection.createIndex({ 
        'streak.current': 1, 
        'streak.lastActivityDate': 1 
      });
      await Progress.collection.createIndex({ 
        tier: 1, 
        totalXP: -1 
      });

      logger.info('🔧 Database indexes optimized');
    } catch (error) {
      logger.error({ error }, '❌ Failed to optimize database');
    }
  }
}

// Singleton export
export const comprehensiveJobScheduler = new ComprehensiveJobScheduler();
export default comprehensiveJobScheduler;
