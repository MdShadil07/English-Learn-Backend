/**
 * 📊 POST-SESSION ANALYTICS ANALYZER
 * Computes deep analytics metrics for Progress dashboard
 * 
 * Features:
 * - Improvement rate calculation (weekly/monthly trends)
 * - Streak health scoring (consistency analysis)
 * - Learning velocity tracking (XP/hour, accuracy gains)
 * - Consistency score (session regularity)
 * - Performance predictions
 * 
 * Runs as background job to avoid blocking real-time endpoints
 */

import Progress, { IProgress } from '../../models/Progress.js';
import { logger } from '../../utils/calculators/core/logger.js';

interface AnalyticsResult {
  userId: string;
  improvementRate: {
    weekly: number; // % change in accuracy (last 7 days)
    monthly: number; // % change in accuracy (last 30 days)
    trend: 'improving' | 'declining' | 'stable';
  };
  streakHealth: {
    score: number; // 0-100
    consistency: number; // % of days with practice
    averageDailyMinutes: number;
    riskLevel: 'low' | 'medium' | 'high'; // Risk of breaking streak
  };
  learningVelocity: {
    xpPerHour: number;
    accuracyGainPerWeek: number;
    sessionsPerWeek: number;
    efficiency: number; // 0-100 (XP/time ratio)
  };
  consistencyScore: number; // 0-100 (session regularity)
  predictions: {
    nextLevelETA: Date | null; // Estimated time to next level
    projectedAccuracy30Days: number; // Predicted accuracy in 30 days
    streakSurvivalRate: number; // % chance of maintaining 30-day streak
  };
  lastAnalyzed: Date;
}

class PostSessionAnalyzer {
  /**
   * Analyze user's performance and compute deep metrics
   */
  async analyzeUser(userId: string): Promise<AnalyticsResult> {
    try {
      logger.info({ userId }, '🔍 Starting post-session analytics');
      
      const progress = await Progress.findOne({ userId });
      if (!progress) {
        throw new Error(`Progress document not found for user ${userId}`);
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Compute each metric
      const improvementRate = this.calculateImprovementRate(progress, sevenDaysAgo, thirtyDaysAgo);
      const streakHealth = this.calculateStreakHealth(progress);
      const learningVelocity = this.calculateLearningVelocity(progress, sevenDaysAgo);
      const consistencyScore = this.calculateConsistencyScore(progress, thirtyDaysAgo);
      const predictions = this.generatePredictions(progress, improvementRate, streakHealth, learningVelocity);

      const result: AnalyticsResult = {
        userId,
        improvementRate,
        streakHealth,
        learningVelocity,
        consistencyScore,
        predictions,
        lastAnalyzed: now,
      };

      // Store analytics in Progress document
      await this.storeAnalytics(userId, result);

      logger.info({ userId, result }, '✅ Post-session analytics complete');
      return result;
    } catch (error) {
      logger.error({ userId, error }, '❌ Failed to analyze post-session metrics');
      throw error;
    }
  }

  /**
   * Calculate improvement rate (weekly/monthly)
   */
  private calculateImprovementRate(
    progress: IProgress,
    sevenDaysAgo: Date,
    thirtyDaysAgo: Date
  ): AnalyticsResult['improvementRate'] {
    const accuracyHistory = progress.accuracyHistory || [];
    
    // Filter by date range
    const weeklyHistory = accuracyHistory.filter(h => new Date((h as any).date || (h as any).timestamp) >= sevenDaysAgo);
    const monthlyHistory = accuracyHistory.filter(h => new Date((h as any).date || (h as any).timestamp) >= thirtyDaysAgo);
    
    // Calculate average accuracy for each period
    const currentAccuracy = progress.accuracyData?.overall || 0;
    const weeklyAvg = weeklyHistory.length > 0
      ? weeklyHistory.reduce((sum, h) => sum + (h.overall || 0), 0) / weeklyHistory.length
      : currentAccuracy;
    const monthlyAvg = monthlyHistory.length > 0
      ? monthlyHistory.reduce((sum, h) => sum + (h.overall || 0), 0) / monthlyHistory.length
      : currentAccuracy;
    
    // Calculate % change
    const weeklyChange = weeklyHistory.length >= 3
      ? ((currentAccuracy - weeklyAvg) / Math.max(weeklyAvg, 1)) * 100
      : 0;
    const monthlyChange = monthlyHistory.length >= 7
      ? ((currentAccuracy - monthlyAvg) / Math.max(monthlyAvg, 1)) * 100
      : 0;
    
    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (weeklyChange > 2) trend = 'improving';
    else if (weeklyChange < -2) trend = 'declining';
    
    return {
      weekly: +weeklyChange.toFixed(2),
      monthly: +monthlyChange.toFixed(2),
      trend,
    };
  }

  /**
   * Calculate streak health and risk level
   */
  private calculateStreakHealth(progress: IProgress): AnalyticsResult['streakHealth'] {
    const streak = progress.streak;
    const currentStreak = streak?.current || 0;
    const longestStreak = streak?.longest || 0;
    const lastPractice = streak?.lastActivityDate ? new Date(streak.lastActivityDate) : new Date();
    
    // Calculate days since last practice
    const hoursSinceLastPractice = (Date.now() - lastPractice.getTime()) / (1000 * 60 * 60);
    
    // Calculate consistency (% of days with practice in last 30 days)
    const totalDays = 30;
    const practiceDays = Math.min(currentStreak, totalDays);
    const consistency = (practiceDays / totalDays) * 100;
    
    // Calculate average daily minutes
    const totalMinutes = streak?.todayProgress?.minutesPracticed || 0;
    const averageDailyMinutes = currentStreak > 0 ? totalMinutes / currentStreak : 0;
    
    // Calculate health score (0-100)
    let score = 0;
    score += Math.min(currentStreak * 2, 40); // Up to 40 points for streak length
    score += Math.min(consistency, 30); // Up to 30 points for consistency
    score += Math.min(averageDailyMinutes / 60 * 30, 30); // Up to 30 points for time spent
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (hoursSinceLastPractice > 20) riskLevel = 'high'; // 20+ hours without practice
    else if (hoursSinceLastPractice > 12) riskLevel = 'medium'; // 12+ hours
    
    return {
      score: Math.round(Math.min(score, 100)),
      consistency: +consistency.toFixed(1),
      averageDailyMinutes: +averageDailyMinutes.toFixed(1),
      riskLevel,
    };
  }

  /**
   * Calculate learning velocity (XP/hour, accuracy gains)
   */
  private calculateLearningVelocity(
    progress: IProgress,
    sevenDaysAgo: Date
  ): AnalyticsResult['learningVelocity'] {
    const weeklyXP = progress.weeklyXP || 0;
    const totalTimeMinutes = progress.stats?.totalTimeSpent || 0;
    const totalSessions = progress.stats?.totalSessions || 0;
    
    // Calculate XP per hour
    const xpPerHour = totalTimeMinutes > 0 ? (weeklyXP / totalTimeMinutes) * 60 : 0;
    
    // Calculate accuracy gain per week (from history)
    const accuracyHistory = progress.accuracyHistory || [];
    const weeklyAccuracy = accuracyHistory.filter(h => new Date((h as any).date || (h as any).timestamp) >= sevenDaysAgo);
    const accuracyGain = weeklyAccuracy.length >= 2
      ? (weeklyAccuracy[weeklyAccuracy.length - 1]?.overall || 0) - (weeklyAccuracy[0]?.overall || 0)
      : 0;
    
    // Calculate sessions per week (approximate from total)
    const accountAge = progress.createdAt ? (Date.now() - progress.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 7) : 1;
    const sessionsPerWeek = totalSessions / Math.max(accountAge, 1);
    
    // Calculate efficiency (normalized XP/time ratio)
    const efficiency = Math.min((xpPerHour / 100) * 100, 100); // Normalize to 0-100
    
    return {
      xpPerHour: +xpPerHour.toFixed(2),
      accuracyGainPerWeek: +accuracyGain.toFixed(2),
      sessionsPerWeek: +sessionsPerWeek.toFixed(1),
      efficiency: Math.round(efficiency),
    };
  }

  /**
   * Calculate consistency score (session regularity)
   */
  private calculateConsistencyScore(progress: IProgress, thirtyDaysAgo: Date): number {
    const xpHistory = progress.xpHistory || [];
    
    // Count days with activity in last 30 days
    const activeDays = xpHistory.filter(h => new Date(h.date) >= thirtyDaysAgo).length;
    
    // Calculate score (0-100)
    const score = (activeDays / 30) * 100;
    
    // Bonus for consecutive days
    const currentStreak = progress.streak?.current || 0;
    const bonus = Math.min(currentStreak * 0.5, 20); // Up to 20% bonus
    
    return Math.round(Math.min(score + bonus, 100));
  }

  /**
   * Generate predictions based on historical data
   */
  private generatePredictions(
    progress: IProgress,
    improvementRate: AnalyticsResult['improvementRate'],
    streakHealth: AnalyticsResult['streakHealth'],
    learningVelocity: AnalyticsResult['learningVelocity']
  ): AnalyticsResult['predictions'] {
    // Predict next level ETA
    const xpToNextLevel = progress.xpToNextLevel || 100;
    const xpPerDay = learningVelocity.xpPerHour * (streakHealth.averageDailyMinutes / 60);
    const daysToNextLevel = xpPerDay > 0 ? xpToNextLevel / xpPerDay : 999;
    const nextLevelETA = daysToNextLevel < 365
      ? new Date(Date.now() + daysToNextLevel * 24 * 60 * 60 * 1000)
      : null;
    
    // Predict accuracy in 30 days (linear projection)
    const currentAccuracy = progress.accuracyData?.overall || 0;
    const monthlyGain = improvementRate.monthly;
    const projectedAccuracy = Math.min(Math.max(currentAccuracy + monthlyGain, 0), 100);
    
    // Predict streak survival rate (based on consistency and risk)
    let survivalRate = streakHealth.consistency;
    if (streakHealth.riskLevel === 'high') survivalRate *= 0.5;
    else if (streakHealth.riskLevel === 'medium') survivalRate *= 0.75;
    
    return {
      nextLevelETA,
      projectedAccuracy30Days: +projectedAccuracy.toFixed(1),
      streakSurvivalRate: +survivalRate.toFixed(1),
    };
  }

  /**
   * Store analytics in Progress document (embedded or separate collection)
   */
  private async storeAnalytics(userId: string, result: AnalyticsResult): Promise<void> {
    try {
      // Option 1: Store as embedded field in Progress
      await Progress.findOneAndUpdate(
        { userId },
        {
          $set: {
            'analytics.improvementRate': result.improvementRate,
            'analytics.streakHealth': result.streakHealth,
            'analytics.learningVelocity': result.learningVelocity,
            'analytics.consistencyScore': result.consistencyScore,
            'analytics.predictions': result.predictions,
            'analytics.lastAnalyzed': result.lastAnalyzed,
          },
        },
        { upsert: false }
      );
      
      logger.debug({ userId }, '✅ Analytics stored in Progress document');
    } catch (error) {
      logger.error({ userId, error }, '❌ Failed to store analytics');
      throw error;
    }
  }

  /**
   * Batch analyze multiple users (for scheduled jobs)
   */
  async batchAnalyze(userIds: string[]): Promise<AnalyticsResult[]> {
    logger.info({ count: userIds.length }, '📊 Starting batch analytics');
    
    const results: AnalyticsResult[] = [];
    const errors: Array<{ userId: string; error: any }> = [];
    
    for (const userId of userIds) {
      try {
        const result = await this.analyzeUser(userId);
        results.push(result);
      } catch (error) {
        errors.push({ userId, error });
      }
    }
    
    if (errors.length > 0) {
      logger.warn({ errors }, `⚠️ ${errors.length} users failed analytics`);
    }
    
    logger.info({ processed: results.length, failed: errors.length }, '✅ Batch analytics complete');
    return results;
  }

  /**
   * Schedule weekly analyzer job (called from cron/scheduler)
   */
  async runWeeklyAnalysis(): Promise<void> {
    try {
      logger.info('🔄 Starting weekly analytics job');
      
      // Get all active users (users with activity in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activeUsers = await Progress.find({
        'streak.lastPracticeDate': { $gte: sevenDaysAgo },
      }).select('userId').lean();
      
      const userIds = activeUsers.map((u: any) => u.userId.toString());
      logger.info({ count: userIds.length }, `📊 Found ${userIds.length} active users`);
      
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await this.batchAnalyze(batch);
        
        // Small delay to avoid DB overload
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info('✅ Weekly analytics job complete');
    } catch (error) {
      logger.error({ error }, '❌ Weekly analytics job failed');
      throw error;
    }
  }
}

// Singleton instance
export const postSessionAnalyzer = new PostSessionAnalyzer();
export default postSessionAnalyzer;
