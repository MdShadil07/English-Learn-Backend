/**
 * 🚀 FAST ACCURACY CACHE SERVICE
 * 
 * Performance-optimized accuracy tracking:
 * - In-memory cache for instant updates
 * - Weighted accuracy calculation with previous data
 * - Auto-save every 30 seconds
 * - Save on logout/tab-switch
 * - Data loss prevention
 */

import Progress from '../../../models/Progress.js';
import { redisCache } from '../../../config/redis.js';
import { calculateCumulativeAccuracy } from '../centralizedAccuracyService.js';

interface AccuracyMetrics {
  overall: number;
  grammar: number;
  vocabulary: number;
  spelling: number;
  fluency: number;
  punctuation: number;
  capitalization: number;
  syntax: number;
  coherence: number;
  messageCount: number;
  lastUpdated: Date;
  isDirty: boolean; // Has unsaved changes
}

interface UserAccuracyCache {
  [userId: string]: AccuracyMetrics;
}

class FastAccuracyCache {
  private cache: UserAccuracyCache = {};
  private saveInterval: NodeJS.Timeout | null = null;
  private readonly SAVE_INTERVAL = 30000; // 30 seconds
  private readonly CACHE_KEY_PREFIX = 'fastAccuracy:';

  constructor() {
    this.startAutoSave();
    console.log('🚀 FastAccuracyCache initialized - Auto-save every 30s');
  }

  /**
   * Initialize user accuracy from database
   * Called once on user login/page load
   */
  async initializeUser(userId: string): Promise<AccuracyMetrics> {
    console.log(`🔄 [FastAccuracy] Initializing user ${userId.substring(0, 8)}...`);

    // Check Redis cache first
    const cached = await this.loadFromRedis(userId);
    if (cached) {
      this.cache[userId] = cached;
      console.log(`✅ [FastAccuracy] Loaded from Redis:`, cached);
      return cached;
    }

    // Load from MongoDB
    const progress = await Progress.findOne({ userId })
      .select('accuracyData')
      .lean();

    if (!progress || !progress.accuracyData) {
      await this.invalidate(userId);
      // New user - initialize with defaults
      const defaultMetrics: AccuracyMetrics = {
        overall: 0,
        grammar: 0,
        vocabulary: 0,
        spelling: 0,
        fluency: 0,
        punctuation: 0,
        capitalization: 0,
        syntax: 0,
        coherence: 0,
        messageCount: 0,
        lastUpdated: new Date(),
        isDirty: false,
      };
      this.cache[userId] = defaultMetrics;
      console.log(`✅ [FastAccuracy] New user initialized with defaults`);
      return defaultMetrics;
    }

    // Load existing accuracy
    const persistedLastUpdated =
      progress.accuracyData.cache?.lastUpdated || progress.accuracyData.lastCalculated;
    const normalizedLastUpdated = (() => {
      if (persistedLastUpdated instanceof Date) {
        return persistedLastUpdated;
      }
      if (typeof persistedLastUpdated === 'string') {
        const parsed = new Date(persistedLastUpdated);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      return new Date();
    })();

    const metrics: AccuracyMetrics = {
      overall: progress.accuracyData.overall || 0,
      grammar: progress.accuracyData.grammar || 0,
      vocabulary: progress.accuracyData.vocabulary || 0,
      spelling: progress.accuracyData.spelling || 0,
      fluency: progress.accuracyData.fluency || 0,
      punctuation: progress.accuracyData.punctuation || 0,
      capitalization: progress.accuracyData.capitalization || 0,
      syntax: progress.accuracyData.syntax || 0,
      coherence: progress.accuracyData.coherence || 0,
      messageCount: progress.accuracyData.cache?.messageCount ?? progress.accuracyData.calculationCount ?? 0,
      lastUpdated: normalizedLastUpdated,
      isDirty: false,
    };

    this.cache[userId] = metrics;
    await this.saveToRedis(userId, metrics);
    console.log(`✅ [FastAccuracy] Loaded from DB:`, metrics);
    return metrics;
  }

  /**
   * Update accuracy with new message (weighted merge)
   * Called immediately after AI response
   */
  async updateAccuracy(
    userId: string,
    newAccuracy: {
      overall: number;
      grammar: number;
      vocabulary: number;
      spelling: number;
      fluency: number;
      punctuation: number;
      capitalization: number;
      syntax?: number;
      coherence?: number;
    }
  ): Promise<AccuracyMetrics> {
    console.log(`📊 [FastAccuracy] Updating accuracy for user ${userId.substring(0, 8)}...`);

    // Ensure user is initialized
    if (!this.cache[userId]) {
      await this.initializeUser(userId);
    }

    const current = this.cache[userId];

    const currentForCalculation = {
      overall: current.overall,
      grammar: current.grammar,
      vocabulary: current.vocabulary,
      spelling: current.spelling,
      fluency: current.fluency,
      punctuation: current.punctuation,
      capitalization: current.capitalization,
      calculationCount: current.messageCount,
    };

    const {
      cumulativeAccuracy,
      calculationCount,
      lastCalculated,
    } = calculateCumulativeAccuracy(currentForCalculation, newAccuracy);

    console.log(`📊 Previous:`, {
      overall: current.overall,
      grammar: current.grammar,
      vocabulary: current.vocabulary,
    });
    console.log(`📊 New:`, {
      overall: newAccuracy.overall,
      grammar: newAccuracy.grammar,
      vocabulary: newAccuracy.vocabulary,
    });
    console.log(`📊 Cumulative (calc #${calculationCount}):`, cumulativeAccuracy);

    const updated: AccuracyMetrics = {
      overall: this.clampAccuracy(cumulativeAccuracy.overall ?? newAccuracy.overall ?? current.overall),
      grammar: this.clampAccuracy(cumulativeAccuracy.grammar ?? newAccuracy.grammar ?? current.grammar),
      vocabulary: this.clampAccuracy(cumulativeAccuracy.vocabulary ?? newAccuracy.vocabulary ?? current.vocabulary),
      spelling: this.clampAccuracy(cumulativeAccuracy.spelling ?? newAccuracy.spelling ?? current.spelling),
      fluency: this.clampAccuracy(cumulativeAccuracy.fluency ?? newAccuracy.fluency ?? current.fluency),
      punctuation: this.clampAccuracy(cumulativeAccuracy.punctuation ?? newAccuracy.punctuation ?? current.punctuation),
      capitalization: this.clampAccuracy(cumulativeAccuracy.capitalization ?? newAccuracy.capitalization ?? current.capitalization),
      syntax: this.clampAccuracy(
        cumulativeAccuracy.syntax ??
          this.computeRollingAverage(current.syntax, newAccuracy.syntax, current.messageCount, calculationCount)
      ),
      coherence: this.clampAccuracy(
        cumulativeAccuracy.coherence ??
          this.computeRollingAverage(current.coherence, newAccuracy.coherence, current.messageCount, calculationCount)
      ),
      messageCount: calculationCount,
      lastUpdated: lastCalculated || new Date(),
      isDirty: true,
    };

    this.cache[userId] = updated;
    await this.saveToRedis(userId, updated); // Update Redis immediately

    console.log(`✅ [FastAccuracy] Updated (calc #${calculationCount}):`, {
      overall: updated.overall,
      grammar: updated.grammar,
      vocabulary: updated.vocabulary,
    });

    return updated;
  }

  private clampAccuracy(value?: number | null): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    if (value <= 0) {
      return 0;
    }
    if (value >= 100) {
      return 100;
    }
    return Math.round(value);
  }

  private computeRollingAverage(
    previous: number,
    incoming: number | undefined,
    previousCount: number,
    newCount: number
  ): number {
    if (incoming === undefined || incoming === null || Number.isNaN(incoming)) {
      return this.clampAccuracy(previous);
    }

    const safePrevious = Number.isFinite(previous) ? previous : 0;
    const effectivePreviousCount = Math.max(previousCount, 0);
    const totalCount = Math.max(newCount, effectivePreviousCount + 1);

    if (totalCount <= 1) {
      return this.clampAccuracy(incoming);
    }

    // Use exponential smoothing to keep new messages influential
    // while still retaining stability from recent history.
    // Fixed current weight mirrors analyzer-first policy (70% current, 30% historical).
    const CURRENT_WEIGHT = 0.7;
    const PREVIOUS_WEIGHT = 1 - CURRENT_WEIGHT;

    const smoothed = CURRENT_WEIGHT * incoming + PREVIOUS_WEIGHT * safePrevious;
    return this.clampAccuracy(smoothed);
  }

  /**
   * Get current accuracy (from cache)
   */
  getAccuracy(userId: string): AccuracyMetrics | null {
    return this.cache[userId] || null;
  }

  /**
   * Force save user's accuracy to database
   */
  async forceSave(userId: string): Promise<boolean> {
    const metrics = this.cache[userId];
    if (!metrics || !metrics.isDirty) {
      console.log(`ℹ️ [FastAccuracy] No unsaved changes for user ${userId.substring(0, 8)}`);
      return false;
    }

    console.log(`💾 [FastAccuracy] Force saving user ${userId.substring(0, 8)}...`);

    try {
      await Progress.updateOne(
        { userId },
        {
          $set: {
            // Write to overallAccuracySummary (single source of truth)
            'accuracyData.overallAccuracySummary.overallAccuracy': metrics.overall,
            'accuracyData.overallAccuracySummary.overallGrammar': metrics.grammar,
            'accuracyData.overallAccuracySummary.overallVocabulary': metrics.vocabulary,
            'accuracyData.overallAccuracySummary.overallSpelling': metrics.spelling,
            'accuracyData.overallAccuracySummary.overallFluency': metrics.fluency,
            'accuracyData.overallAccuracySummary.overallPunctuation': metrics.punctuation,
            'accuracyData.overallAccuracySummary.overallCapitalization': metrics.capitalization,
            'accuracyData.overallAccuracySummary.overallSyntax': metrics.syntax,
            'accuracyData.overallAccuracySummary.overallCoherence': metrics.coherence,
            'accuracyData.overallAccuracySummary.calculationCount': metrics.messageCount,
            'accuracyData.overallAccuracySummary.lastCalculated': metrics.lastUpdated,
            
            // Sync deprecated top-level fields for backward compatibility
            'accuracyData.overall': metrics.overall,
            'accuracyData.grammar': metrics.grammar,
            'accuracyData.vocabulary': metrics.vocabulary,
            'accuracyData.spelling': metrics.spelling,
            'accuracyData.fluency': metrics.fluency,
            'accuracyData.punctuation': metrics.punctuation,
            'accuracyData.capitalization': metrics.capitalization,
            'accuracyData.syntax': metrics.syntax,
            'accuracyData.coherence': metrics.coherence,
            'accuracyData.calculationCount': metrics.messageCount,
            'accuracyData.lastCalculated': metrics.lastUpdated,

            // Persist cache metadata
            'accuracyData.cache.messageCount': metrics.messageCount,
            'accuracyData.cache.lastUpdated': metrics.lastUpdated,
            
            // Update skills from summary rollups
            'skills.accuracy': metrics.overall,
            'skills.overallAccuracy': metrics.overall,
            'skills.grammar': metrics.grammar,
            'skills.vocabulary': metrics.vocabulary,
            'skills.fluency': metrics.fluency,
          },
        }
      );

      metrics.isDirty = false;
      console.log(`✅ [FastAccuracy] Saved to database successfully`);
      return true;
    } catch (error) {
      console.error(`❌ [FastAccuracy] Save failed:`, error);
      return false;
    }
  }

  /**
   * Auto-save all dirty users every 30 seconds
   */
  private startAutoSave() {
    this.saveInterval = setInterval(async () => {
      const dirtyUsers = Object.keys(this.cache).filter(
        (userId) => this.cache[userId].isDirty
      );

      if (dirtyUsers.length === 0) {
        return;
      }

      console.log(`🔄 [FastAccuracy] Auto-save: ${dirtyUsers.length} users with unsaved changes`);

      for (const userId of dirtyUsers) {
        await this.forceSave(userId);
      }

      console.log(`✅ [FastAccuracy] Auto-save complete`);
    }, this.SAVE_INTERVAL);
  }

  /**
   * Save to Redis cache (backup)
   */
  private async saveToRedis(userId: string, metrics: AccuracyMetrics): Promise<void> {
    if (!redisCache.isConnected()) return;

    try {
      await redisCache.setJSON(
        `${this.CACHE_KEY_PREFIX}${userId}`,
        metrics,
        3600 // 1 hour TTL
      );
    } catch (error) {
      console.error(`❌ Redis save failed:`, error);
    }
  }

  /**
   * Load from Redis cache
   */
  private async loadFromRedis(userId: string): Promise<AccuracyMetrics | null> {
    if (!redisCache.isConnected()) return null;

    try {
      const cached = await redisCache.getJSON<AccuracyMetrics>(
        `${this.CACHE_KEY_PREFIX}${userId}`
      );
      if (!cached) {
        return null;
      }

      if (cached.lastUpdated && !(cached.lastUpdated instanceof Date)) {
        const parsed = new Date(cached.lastUpdated as unknown as string);
        cached.lastUpdated = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      }

      return cached;
    } catch (error) {
      console.error(`❌ Redis load failed:`, error);
      return null;
    }
  }

  private async deleteFromRedis(userId: string): Promise<void> {
    if (!redisCache.isConnected()) return;

    try {
      await redisCache.del(`${this.CACHE_KEY_PREFIX}${userId}`);
    } catch (error) {
      console.error(`❌ Redis delete failed:`, error);
    }
  }

  hasUser(userId: string): boolean {
    return Boolean(this.cache[userId]);
  }

  async invalidate(userId: string, options?: { includeRedis?: boolean }): Promise<void> {
    if (!userId) {
      return;
    }

    if (this.cache[userId]) {
      delete this.cache[userId];
    }

    const shouldClearRedis = options?.includeRedis !== false;
    if (shouldClearRedis) {
      await this.deleteFromRedis(userId);
    }
  }

  /**
   * Cleanup user from cache (e.g., on logout)
   */
  async cleanup(userId: string): Promise<void> {
    if (!userId) {
      return;
    }

    const hasCache = Boolean(this.cache[userId]);

    if (hasCache) {
      await this.forceSave(userId); // Save before cleanup
    }
    await this.invalidate(userId);

    console.log(`🧹 [FastAccuracy] Cleaned up user ${userId.substring(0, 8)}${hasCache ? '' : ' (no in-memory cache)'}`);
  }

  /**
   * Stop auto-save (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Save all dirty users
    const dirtyUsers = Object.keys(this.cache).filter(
      (userId) => this.cache[userId].isDirty
    );

    console.log(`🛑 [FastAccuracy] Shutting down - saving ${dirtyUsers.length} users...`);

    for (const userId of dirtyUsers) {
      await this.forceSave(userId);
    }

    console.log(`✅ [FastAccuracy] Shutdown complete`);
  }
}

// Singleton instance
export const fastAccuracyCache = new FastAccuracyCache();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await fastAccuracyCache.shutdown();
});

process.on('SIGINT', async () => {
  await fastAccuracyCache.shutdown();
});
