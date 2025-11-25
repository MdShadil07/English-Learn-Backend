/**
 * 📊 OPTIMIZED ACCURACY TRACKING SERVICE
 * Batched accuracy updates for AI chat conversations
 * 
 * Prevents server overload by:
 * - Batching accuracy calculations
 * - Caching intermediate results
 * - Debouncing frequent updates
 * - Using atomic database operations
 */

import { batchedProgressService } from '../Progress/batchedProgressService.js';
import { redisCache } from '../../config/redis.js';

interface AccuracyUpdate {
  userId: string;
  messageText: string;
  detectedErrors?: any[];
  grammarScore?: number;
  vocabularyScore?: number;
  spellingScore?: number;
  fluencyScore?: number;
  overallScore?: number;
}

class OptimizedAccuracyTracker {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly MIN_UPDATE_INTERVAL = 10000; // 10 seconds between updates
  private lastUpdateTime: Map<string, number> = new Map();

  /**
   * Track accuracy from AI chat message (debounced)
   */
  public async trackAccuracy(update: AccuracyUpdate): Promise<void> {
    const { userId, overallScore, grammarScore, vocabularyScore, spellingScore, fluencyScore } = update;
    
    try {
      // Check if we should update (debouncing)
      const lastUpdate = this.lastUpdateTime.get(userId) || 0;
      const now = Date.now();
      
      if (now - lastUpdate < this.MIN_UPDATE_INTERVAL) {
        // Too soon - cache only, don't queue DB update
        await this.updateCache(userId, update);
        return;
      }
      
      // Update last update time
      this.lastUpdateTime.set(userId, now);
      
      // Calculate XP from accuracy (bonus for high scores)
      const xpGained = this.calculateAccuracyXP(overallScore || 0);
      
      // Queue batched update
      batchedProgressService.queueUpdate({
        userId,
        updates: {
          accuracy: {
            overall: overallScore,
            grammar: grammarScore,
            vocabulary: vocabularyScore,
            spelling: spellingScore,
            fluency: fluencyScore,
          },
          xp: xpGained,
        },
        timestamp: new Date(),
        priority: 'normal',
      });
      
      // Update cache for real-time UI
      await this.updateCache(userId, update);
      
    } catch (error) {
      console.error('Error tracking accuracy:', error);
    }
  }

  /**
   * Update Redis cache for real-time accuracy display
   */
  private async updateCache(userId: string, update: AccuracyUpdate): Promise<void> {
    try {
      const cacheKey = `accuracy:realtime:${userId}`;
      
      const cacheData = {
        overall: update.overallScore || 0,
        grammar: update.grammarScore || 0,
        vocabulary: update.vocabularyScore || 0,
        spelling: update.spellingScore || 0,
        fluency: update.fluencyScore || 0,
        lastMessage: update.messageText.substring(0, 100), // First 100 chars
        timestamp: new Date().toISOString(),
      };
      
      await redisCache.set(cacheKey, JSON.stringify(cacheData), this.CACHE_TTL);
    } catch (error) {
      console.error('Cache update error (non-critical):', error);
    }
  }

  /**
   * Calculate XP bonus from accuracy score
   */
  private calculateAccuracyXP(score: number): number {
    if (score >= 95) return 50; // Excellent
    if (score >= 85) return 30; // Good
    if (score >= 70) return 15; // Average
    if (score >= 50) return 5;  // Needs improvement
    return 0;
  }

  /**
   * Get cached accuracy for real-time display
   */
  public async getCachedAccuracy(userId: string): Promise<any | null> {
    try {
      const cacheKey = `accuracy:realtime:${userId}`;
      const cached = await redisCache.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Track conversation accuracy (accumulated over multiple messages)
   */
  public async trackConversationAccuracy(
    userId: string,
    conversationId: string,
    messages: AccuracyUpdate[]
  ): Promise<void> {
    try {
      // Calculate average scores from all messages
      const avgScores = {
        overall: this.average(messages.map(m => m.overallScore || 0)),
        grammar: this.average(messages.map(m => m.grammarScore || 0)),
        vocabulary: this.average(messages.map(m => m.vocabularyScore || 0)),
        spelling: this.average(messages.map(m => m.spellingScore || 0)),
        fluency: this.average(messages.map(m => m.fluencyScore || 0)),
      };
      
      // Calculate total XP
      const totalXP = this.calculateAccuracyXP(avgScores.overall) * messages.length;
      
      // Queue single batched update for entire conversation
      batchedProgressService.queueUpdate({
        userId,
        updates: {
          accuracy: avgScores,
          xp: totalXP,
        },
        timestamp: new Date(),
        priority: 'high', // Conversation end = important milestone
      });
      
    } catch (error) {
      console.error('Error tracking conversation accuracy:', error);
    }
  }

  /**
   * Calculate average of array
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

export const optimizedAccuracyTracker = new OptimizedAccuracyTracker();
export default optimizedAccuracyTracker;
