/**
 * 📊 ANALYTICS CONTROLLER
 * Comprehensive analytics endpoints for the dashboard
 * Provides real-time progress, accuracy, XP, and level-up data
 * Uses ProgressOptimizationService for industry-level performance
 */

import { Request, Response } from 'express';
import Progress from '../../models/Progress.js';
import { IProgress } from '../../models/Progress.js';
import { progressOptimizationService } from '../../services/Progress/progressOptimizationService.js';
import { OptimizedProgressQueries } from '../../utils/optimizations/optimizationProgressQueries.js';

export class AnalyticsController {
  
  /**
   * Get comprehensive analytics data for the dashboard
   * @route GET /api/analytics/dashboard/:userId
   * Uses cached data for < 50ms response time
   */
  async getDashboardAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { timeRange = 'week', forceRefresh = 'false' } = req.query;
      
      // Use optimization service for cached analytics
      const analytics = await progressOptimizationService.getAnalyticsData(
        userId,
        timeRange as string
      );
      
      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found. Please initialize progress tracking.',
        });
        return;
      }
      
      // Get progress data from cache
      const progress = await progressOptimizationService.getProgressData(
        userId,
        { forceRefresh: forceRefresh === 'true' }
      );
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found.',
        });
        return;
      }
      
      // Get accuracy trends
      const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
      const accuracyTrends = await this.getAccuracyTrendsData(progress, days);
      
      // Get level-up stats
      const levelUpStats = await this.getLevelUpStatsData(progress);
      
      // Get XP breakdown
      const xpBreakdown = this.getXPBreakdownData(progress, timeRange as string);
      
      // Get skills overview
      const skillsOverview = this.getSkillsOverviewData(progress);
      
      // Get category performance
      const categoryPerformance = this.getCategoryPerformanceData(progress);
      
      res.json({
        success: true,
        data: {
          overview: {
            totalXP: progress.totalXP,
            currentLevel: progress.currentLevel,
            levelProgress: Math.round((progress.currentLevelXP / (progress.currentLevelXP + progress.xpToNextLevel)) * 100),
            overallAccuracy: progress.overallAccuracy,
            streak: progress.streak.current,
            longestStreak: progress.streak.longest,
          },
          accuracyData: progress.accuracyData,
          accuracyTrends,
          levelUpStats,
          xpBreakdown,
          skillsOverview,
          categoryPerformance,
          recentActivity: {
            lastActive: progress.lastActive,
            totalSessions: progress.stats.totalSessions,
            totalTimeSpent: progress.stats.totalTimeSpent,
            averageSessionTime: progress.stats.averageSessionTime,
          },
          analytics: progress.analytics,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching dashboard analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  /**
   * Get accuracy trends with detailed breakdown
   * @route GET /api/analytics/accuracy-trends/:userId
   */
  async getAccuracyTrends(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { days = 7 } = req.query;
      
      const progress = await Progress.findOne({ userId });
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found',
        });
        return;
      }
      
      const trends = await this.getAccuracyTrendsData(progress, Number(days));
      
      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      console.error('❌ Error fetching accuracy trends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch accuracy trends',
      });
    }
  }
  
  /**
   * Get XP history and breakdown
   * @route GET /api/analytics/xp-data/:userId
   */
  async getXPData(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { timeRange = 'week' } = req.query;
      
      const progress = await Progress.findOne({ userId });
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found',
        });
        return;
      }
      
      const xpBreakdown = this.getXPBreakdownData(progress, timeRange as string);
      
      res.json({
        success: true,
        data: {
          totalXP: progress.totalXP,
          dailyXP: progress.dailyXP,
          weeklyXP: progress.weeklyXP,
          monthlyXP: progress.monthlyXP,
          breakdown: progress.xpBreakdown,
          history: progress.xpHistory,
          recentEvents: progress.xpEvents.slice(-20), // Last 20 XP events
          ...xpBreakdown,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching XP data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch XP data',
      });
    }
  }
  
  /**
   * Get level-up history and statistics
   * @route GET /api/analytics/level-stats/:userId
   */
  async getLevelStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const progress = await Progress.findOne({ userId });
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found',
        });
        return;
      }
      
      const levelUpStats = await this.getLevelUpStatsData(progress);
      
      res.json({
        success: true,
        data: {
          currentLevel: progress.currentLevel,
          currentLevelXP: progress.currentLevelXP,
          xpToNextLevel: progress.xpToNextLevel,
          prestigeLevel: progress.prestigeLevel,
          proficiencyLevel: progress.proficiencyLevel,
          ...levelUpStats,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching level stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch level stats',
      });
    }
  }
  
  /**
   * Get skills breakdown and performance
   * @route GET /api/analytics/skills/:userId
   */
  async getSkillsData(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const progress = await Progress.findOne({ userId });
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found',
        });
        return;
      }
      
      const skillsOverview = this.getSkillsOverviewData(progress);
      
      res.json({
        success: true,
        data: {
          skills: progress.skills,
          overallAccuracy: progress.overallAccuracy,
          ...skillsOverview,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching skills data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch skills data',
      });
    }
  }
  
  /**
   * Get category-wise performance
   * @route GET /api/analytics/categories/:userId
   */
  async getCategoryData(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const progress = await Progress.findOne({ userId });
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found',
        });
        return;
      }
      
      const categoryPerformance = this.getCategoryPerformanceData(progress);
      
      res.json({
        success: true,
        data: {
          categories: progress.categories,
          ...categoryPerformance,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching category data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category data',
      });
    }
  }

  /**
   * Get dynamic leaderboard data with filters
   * @route GET /api/analytics/leaderboard
   */
  async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const {
        limit = '10',
        offset = '0',
        metric = 'xp',
        direction = 'desc',
        tier,
        timeframe = 'all',
      } = req.query;

      const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 10));
      const parsedOffset = Math.max(0, Number(offset) || 0);
      const metricKey = typeof metric === 'string' ? metric.toLowerCase() : 'xp';
      const metricMapping: Record<string, string> = {
        xp: 'xp',
        totalxp: 'xp',
        weeklyxp: 'weeklyXP',
        monthlyxp: 'monthlyXP',
        accuracy: 'accuracy',
        grammar: 'grammar',
        vocabulary: 'vocabulary',
        spelling: 'spelling',
        fluency: 'fluency',
        streak: 'streak',
        sessions: 'sessions',
        timespent: 'timeSpent',
      };
      const normalizedMetric = (metricMapping[metricKey] || 'xp') as any;
      const normalizedDirection = direction === 'asc' ? 'asc' : 'desc';
      const timeframeKey = typeof timeframe === 'string' ? timeframe.toLowerCase() : 'all';
      const normalizedTimeframe =
        timeframeKey === 'week' || timeframeKey === 'month' ? timeframeKey : 'all';
      const normalizedTier =
        typeof tier === 'string' && tier.toLowerCase() !== 'all' ? tier.toLowerCase() : undefined;

      const leaderboard = await OptimizedProgressQueries.getLeaderboard(
        parsedLimit,
        parsedOffset,
        {
          metric: normalizedMetric as any,
          direction: normalizedDirection,
          timeframe: normalizedTimeframe as 'week' | 'month' | 'all',
          tier: normalizedTier as any,
        }
      );

      const payload = leaderboard.map((entry: any, index: number) => {
        const fallbackName = 'Learner';
        const profile = entry.userProfile;
        const userName =
          profile?.displayName ||
          profile?.username ||
          entry.user?.username ||
          [entry.user?.firstName, entry.user?.lastName].filter(Boolean).join(' ').trim() ||
          fallbackName;

        return {
          rank: parsedOffset + index + 1,
          user: {
            id: entry.user?._id || entry.userId,
            name: userName || fallbackName,
            username: entry.user?.username || profile?.username || null,
            tier: entry.user?.tier || profile?.tier || null,
            avatarUrl:
              entry.user?.avatar_url ||
              entry.user?.avatarUrl ||
              entry.user?.avatar ||
              entry.user?.avatar?.url ||
              entry.user?.profileImage ||
              entry.user?.profile_image ||
              entry.user?.profile?.avatar_url ||
              entry.user?.profile?.avatarUrl ||
              entry.user?.profile?.avatar ||
              entry.user?.profile?.image ||
              entry.user?.profile?.imageUrl ||
              profile?.avatar_url ||
              profile?.avatarUrl ||
              profile?.avatar ||
              profile?.image ||
              profile?.imageUrl ||
              profile?.profileImage ||
              profile?.profile_image ||
              null,
            country: profile?.country || entry.user?.country || profile?.location || entry.user?.location || null,
            profile: profile || entry.user?.profile || null,
          },
          progress: {
            totalXP: entry.totalXP,
            weeklyXP: entry.weeklyXP,
            monthlyXP: entry.monthlyXP,
            currentLevel: entry.currentLevel,
            tierLevel: entry.tierLevel,
            streak: entry.streak,
            accuracy: {
              overall: entry.accuracyData?.overall ?? entry.overallAccuracy,
              grammar: entry.accuracyData?.grammar ?? 0,
              vocabulary: entry.accuracyData?.vocabulary ?? 0,
              spelling: entry.accuracyData?.spelling ?? 0,
              fluency: entry.accuracyData?.fluency ?? 0,
            },
            sessions: entry.stats?.totalSessions ?? 0,
            timeSpent: entry.stats?.totalTimeSpent ?? 0,
          },
          analytics: {
            improvementRate: entry.analytics?.improvementRate ?? 0,
            learningVelocity: entry.analytics?.learningVelocity ?? 0,
            consistencyScore: entry.analytics?.consistencyScore ?? 0,
            recommendedFocus: entry.analytics?.recommendedFocus ?? [],
            lastActiveAgo: entry.lastActive ? new Date(entry.lastActive).toISOString() : null,
          },
          metricValue: entry.metricValue ?? 0,
          lastActive: entry.lastActive,
        };
      });

      res.json({
        success: true,
        data: {
          meta: {
            limit: parsedLimit,
            offset: parsedOffset,
            metric: normalizedMetric,
            direction: normalizedDirection,
            timeframe: normalizedTimeframe,
            tier: normalizedTier || 'all',
          },
          leaderboard: payload,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching leaderboard analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leaderboard analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  /**
   * Update accuracy data from chat message
   * @route POST /api/analytics/update-accuracy/:userId
   */
  async updateAccuracyData(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { accuracyResult } = req.body;
      
      const progress = await Progress.findOne({ userId });
      
      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Progress data not found',
        });
        return;
      }
      
      // Use centralized accuracy calculation service (prevents overwriting)
      const { progressOptimizationService } = await import('../../services/Progress/progressOptimizationService.js');
      const accuracyPayload = {
        ...accuracyResult,
        lastCalculated: accuracyResult?.lastCalculated ? new Date(accuracyResult.lastCalculated) : new Date(),
        latestSnapshot: accuracyResult?.latestSnapshot || {
          overall: accuracyResult?.overall ?? 0,
          grammar: accuracyResult?.grammar ?? 0,
          vocabulary: accuracyResult?.vocabulary ?? 0,
          spelling: accuracyResult?.spelling ?? 0,
          fluency: accuracyResult?.fluency ?? 0,
          punctuation: accuracyResult?.punctuation ?? 0,
          capitalization: accuracyResult?.capitalization ?? 0,
          syntax: accuracyResult?.syntax ?? 0,
          coherence: accuracyResult?.coherence ?? 0,
          recordedAt: new Date(),
        },
      };

      // Ensure we don't freeze calculation count at 1
      if (accuracyPayload.calculationCount === 1) {
        delete accuracyPayload.calculationCount;
      }

      await progressOptimizationService.updateAccuracyData(userId, accuracyPayload, { immediate: true });
      
      // Fetch updated progress
      const updatedProgress = await Progress.findOne({ userId });
      
      res.json({
        success: true,
        message: 'Accuracy data updated successfully (cumulative)',
        data: {
          accuracyData: updatedProgress?.accuracyData,
          overallAccuracy: updatedProgress?.accuracyData?.overall,
        },
      });
    } catch (error) {
      console.error('❌ Error updating accuracy data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update accuracy data',
      });
    }
  }
  
  // ========================================
  // HELPER METHODS
  // ========================================
  
  private async getAccuracyTrendsData(progress: IProgress, days: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentHistory = progress.accuracyHistory.filter(entry => 
      new Date(entry.date) >= cutoffDate
    );
    
    if (recentHistory.length === 0) {
      return {
        trend: 'stable',
        improvement: 0,
        currentAverage: progress.accuracyData?.overall || 0,
        history: [],
      };
    }
    
    // Calculate averages
    const avgOverall = recentHistory.reduce((sum, e) => sum + e.overall, 0) / recentHistory.length;
    const avgGrammar = recentHistory.reduce((sum, e) => sum + e.grammar, 0) / recentHistory.length;
    const avgVocabulary = recentHistory.reduce((sum, e) => sum + e.vocabulary, 0) / recentHistory.length;
    const avgSpelling = recentHistory.reduce((sum, e) => sum + e.spelling, 0) / recentHistory.length;
    const avgFluency = recentHistory.reduce((sum, e) => sum + e.fluency, 0) / recentHistory.length;
    
    // Determine trend
    const midpoint = Math.floor(recentHistory.length / 2);
    const firstHalf = recentHistory.slice(0, midpoint);
    const secondHalf = recentHistory.slice(midpoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.overall, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.overall, 0) / secondHalf.length;
    
    const improvement = secondHalfAvg - firstHalfAvg;
    const trend = improvement > 5 ? 'improving' : improvement < -5 ? 'declining' : 'stable';
    
    return {
      trend,
      improvement: Math.round(improvement * 100) / 100,
      currentAverage: avgOverall,
      breakdown: {
        grammar: Math.round(avgGrammar * 100) / 100,
        vocabulary: Math.round(avgVocabulary * 100) / 100,
        spelling: Math.round(avgSpelling * 100) / 100,
        fluency: Math.round(avgFluency * 100) / 100,
      },
      history: recentHistory.map(e => ({
        date: e.date,
        overall: e.overall,
        grammar: e.grammar,
        vocabulary: e.vocabulary,
      })),
    };
  }
  
  private async getLevelUpStatsData(progress: IProgress) {
    const recentLevelUps = progress.levelUpHistory.slice(-10);
    
    if (recentLevelUps.length === 0) {
      return {
        totalLevelUps: 0,
        recentLevelUps: [],
        nextLevelProgress: Math.round((progress.currentLevelXP / (progress.currentLevelXP + progress.xpToNextLevel)) * 100),
      };
    }
    
    return {
      totalLevelUps: progress.levelUpHistory.length,
      recentLevelUps: recentLevelUps.map(l => ({
        fromLevel: l.fromLevel,
        toLevel: l.toLevel,
        timestamp: l.timestamp,
        xpAtLevelUp: l.xpAtLevelUp,
        rewards: l.rewards,
      })),
      lastLevelUp: progress.lastLevelUp,
      nextLevelProgress: Math.round((progress.currentLevelXP / (progress.currentLevelXP + progress.xpToNextLevel)) * 100),
    };
  }
  
  private getXPBreakdownData(progress: IProgress, timeRange: string) {
    let relevantEvents = progress.xpEvents;
    
    if (timeRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      relevantEvents = progress.xpEvents.filter(e => new Date(e.timestamp) >= weekAgo);
    } else if (timeRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      relevantEvents = progress.xpEvents.filter(e => new Date(e.timestamp) >= monthAgo);
    }
    
    const bySource = relevantEvents.reduce((acc, event) => {
      acc[event.source] = (acc[event.source] || 0) + event.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalInPeriod: relevantEvents.reduce((sum, e) => sum + e.amount, 0),
      bySource,
      eventCount: relevantEvents.length,
    };
  }
  
  private getSkillsOverviewData(progress: IProgress) {
    const skills = progress.skills;
    const skillEntries = Object.entries(skills) as [string, number][];
    const sortedSkills = skillEntries.sort((a, b) => b[1] - a[1]);
    
    return {
      strongest: sortedSkills.slice(0, 3).map(([name, value]) => ({ name, value })),
      weakest: sortedSkills.slice(-3).reverse().map(([name, value]) => ({ name, value })),
      averageSkillScore: Math.round(skillEntries.reduce((sum, [, value]) => sum + value, 0) / skillEntries.length),
    };
  }
  
  private getCategoryPerformanceData(progress: IProgress) {
    const sortedCategories = [...progress.categories].sort((a, b) => b.accuracy - a.accuracy);
    
    return {
      topCategories: sortedCategories.slice(0, 5).map(c => ({
        name: c.name,
        accuracy: c.accuracy,
        xpEarned: c.xpEarned,
        level: c.level,
      })),
      needsImprovement: sortedCategories.slice(-3).reverse().map(c => ({
        name: c.name,
        accuracy: c.accuracy,
        totalAttempts: c.totalAttempts,
      })),
      totalCategories: progress.categories.length,
    };
  }
}

export const analyticsController = new AnalyticsController();
