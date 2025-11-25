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

import Progress from '../../models/Progress.js';
import { redisCache } from '../../config/redis.js';

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
  private readonly CACHE_KEY_PREFIX = 'fast-accuracy:';

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
      messageCount: progress.accuracyData.calculationCount || 0,
      lastUpdated: progress.accuracyData.lastCalculated || new Date(),
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
    const messageCount = current.messageCount + 1;

    // Calculate dynamic weights based on message count
    let historicalWeight = 0.3; // Start with 30% historical weight
    let currentWeight = 0.7; // 70% current weight

    if (messageCount > 10) {
      historicalWeight = 0.5; // After 10 messages, 50-50 balance
      currentWeight = 0.5;
    }
    if (messageCount > 50) {
      historicalWeight = 0.7; // After 50 messages, favor historical
      currentWeight = 0.3;
    }

    console.log(`📊 Weights: Historical ${historicalWeight * 100}%, Current ${currentWeight * 100}%`);
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

    // Weighted merge
    const updated: AccuracyMetrics = {
      overall: Math.round(current.overall * historicalWeight + newAccuracy.overall * currentWeight),
      grammar: Math.round(current.grammar * historicalWeight + newAccuracy.grammar * currentWeight),
      vocabulary: Math.round(current.vocabulary * historicalWeight + newAccuracy.vocabulary * currentWeight),
      spelling: Math.round(current.spelling * historicalWeight + newAccuracy.spelling * currentWeight),
      fluency: Math.round(current.fluency * historicalWeight + newAccuracy.fluency * currentWeight),
      punctuation: Math.round(current.punctuation * historicalWeight + newAccuracy.punctuation * currentWeight),
      capitalization: Math.round(current.capitalization * historicalWeight + newAccuracy.capitalization * currentWeight),
      syntax: Math.round(current.syntax * historicalWeight + (newAccuracy.syntax || 0) * currentWeight),
      coherence: Math.round(current.coherence * historicalWeight + (newAccuracy.coherence || 0) * currentWeight),
      messageCount,
      lastUpdated: new Date(),
      isDirty: true, // Mark as needing save
    };

    this.cache[userId] = updated;
    await this.saveToRedis(userId, updated); // Update Redis immediately

    console.log(`✅ [FastAccuracy] Updated (message #${messageCount}):`, {
      overall: updated.overall,
      grammar: updated.grammar,
      vocabulary: updated.vocabulary,
    });

    return updated;
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
      return cached;
    } catch (error) {
      console.error(`❌ Redis load failed:`, error);
      return null;
    }
  }

  /**
   * Cleanup user from cache (e.g., on logout)
   */
  async cleanup(userId: string): Promise<void> {
    await this.forceSave(userId); // Save before cleanup
    delete this.cache[userId];
    console.log(`🧹 [FastAccuracy] Cleaned up user ${userId.substring(0, 8)}`);
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
