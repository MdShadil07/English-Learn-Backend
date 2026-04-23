/**
 * 🔥 STREAK BREAK DETECTION & AUTO-RESET SERVICE
 * Automatically detects and handles streak breaks based on daily goals
 */

import Progress from '../../models/Progress.js';
import { logger } from '../../utils/calculators/core/logger.js';
import { Types } from 'mongoose';

interface StreakBreakResult {
  userId: string;
  previousStreak: number;
  newStreak: number;
  reason: 'time_expired' | 'goal_not_met' | 'manual_reset';
  longestPreserved: number;
}

export class StreakBreakDetectionService {
  /**
   * Check if user met daily goal requirements
   */
  static async checkDailyGoalMet(userId: string | Types.ObjectId): Promise<boolean> {
    try {
      const progress = await Progress.findOne({ userId })
        .select('streak.todayProgress')
        .lean();

      if (!progress?.streak?.todayProgress) {
        return false;
      }

      const { minutesPracticed, messagesCount, goalMet } = progress.streak.todayProgress;

      // Requirements: 5+ minutes AND 3+ messages
      const meetsRequirements = minutesPracticed >= 5 && messagesCount >= 3;

      return goalMet || meetsRequirements;
    } catch (error) {
      logger.error({ userId: userId.toString(), error }, '❌ Failed to check daily goal');
      return false;
    }
  }

  /**
   * Reset streak to 0 when user fails to meet goal
   */
  static async resetStreakForGoalNotMet(
    userId: string | Types.ObjectId
  ): Promise<StreakBreakResult | null> {
    try {
      const progress = await Progress.findOne({ userId });

      if (!progress) {
        return null;
      }

      const previousStreak = progress.streak.current;
      const longestStreak = progress.streak.longest;

      // Only reset if there was an active streak
      if (previousStreak === 0) {
        return null;
      }

      // Record streak history before breaking
      if (!progress.streak.streakHistory) {
        progress.streak.streakHistory = [];
      }

      progress.streak.streakHistory.push({
        startDate: progress.streak.streakStartDate || new Date(),
        endDate: new Date(),
        length: previousStreak,
        reason: 'broken',
      });

      // Reset streak to 0 (not 1)
      progress.streak.current = 0;
      progress.streak.streakStartDate = null;
      progress.streak.lastActivityDate = null;

      // Update stats
      if (!progress.streak.stats) {
        progress.streak.stats = {
          totalActiveDays: 0,
          averageMinutesPerDay: 0,
          bestWeek: 0,
          totalStreaksBroken: 0,
          totalFreezeUsed: 0,
        };
      }
      progress.streak.stats.totalStreaksBroken += 1;

      // Reset today's progress
      progress.streak.todayProgress = {
        minutesPracticed: 0,
        messagesCount: 0,
        activitiesCompleted: [],
        goalMet: false,
        lastUpdated: null,
      };

      await progress.save();

      logger.info({
        userId: userId.toString(),
        previousStreak,
        longestStreak,
      }, '💔 Streak reset to 0 for goal not met');

      return {
        userId: userId.toString(),
        previousStreak,
        newStreak: 0,
        reason: 'goal_not_met',
        longestPreserved: longestStreak,
      };
    } catch (error) {
      logger.error({ userId: userId.toString(), error }, '❌ Failed to reset streak');
      return null;
    }
  }

  /**
   * Reset streak due to time expiration (past grace period)
   */
  static async resetStreakForTimeExpired(
    userId: string | Types.ObjectId,
    gracePeriodHours: number
  ): Promise<StreakBreakResult | null> {
    try {
      const progress = await Progress.findOne({ userId });

      if (!progress || !progress.streak.lastActivityDate) {
        return null;
      }

      const now = new Date();
      const lastActivity = progress.streak.lastActivityDate;
      const hoursSince = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      const deadline = 24 + gracePeriodHours;

      // Only reset if past deadline
      if (hoursSince <= deadline) {
        return null;
      }

      const previousStreak = progress.streak.current;
      const longestStreak = progress.streak.longest;

      // Record history
      if (!progress.streak.streakHistory) {
        progress.streak.streakHistory = [];
      }

      progress.streak.streakHistory.push({
        startDate: progress.streak.streakStartDate || new Date(),
        endDate: new Date(),
        length: previousStreak,
        reason: 'broken',
      });

      // Reset to 0
      progress.streak.current = 0;
      progress.streak.streakStartDate = null;

      // Update stats
      if (!progress.streak.stats) {
        progress.streak.stats = {
          totalActiveDays: 0,
          averageMinutesPerDay: 0,
          bestWeek: 0,
          totalStreaksBroken: 0,
          totalFreezeUsed: 0,
        };
      }
      progress.streak.stats.totalStreaksBroken += 1;

      await progress.save();

      logger.info({
        userId: userId.toString(),
        previousStreak,
        hoursSince: Math.round(hoursSince),
        deadline,
      }, '💔 Streak reset to 0 for time expired');

      return {
        userId: userId.toString(),
        previousStreak,
        newStreak: 0,
        reason: 'time_expired',
        longestPreserved: longestStreak,
      };
    } catch (error) {
      logger.error({ userId: userId.toString(), error }, '❌ Failed to reset streak');
      return null;
    }
  }

  /**
   * Batch check and reset expired streaks
   */
  static async batchResetExpiredStreaks(): Promise<{
    checked: number;
    reset: number;
    preserved: number;
  }> {
    try {
      const now = new Date();
      const twentySixHoursAgo = new Date(now.getTime() - 26 * 60 * 60 * 1000);

      // Find users with active streaks that haven't been updated
      const activeUsers = await Progress.find({
        'streak.current': { $gt: 0 },
        'streak.lastActivityDate': { $lt: twentySixHoursAgo },
      }).select('userId streak tier');

      let reset = 0;
      let preserved = 0;

      for (const progress of activeUsers) {
        const hoursSince = (now.getTime() - progress.streak.lastActivityDate!.getTime()) / (1000 * 60 * 60);
        
        // Determine grace period based on tier
        const tierNum = (progress as any).tier || 1;
        const gracePeriodHours = tierNum <= 2 ? 2 : tierNum <= 4 ? 4 : 6;
        const deadline = 24 + gracePeriodHours;

        if (hoursSince > deadline) {
          // Reset to 0
          const result = await this.resetStreakForTimeExpired(
            progress.userId,
            gracePeriodHours
          );
          
          if (result) {
            reset++;
          }
        } else {
          preserved++;
        }
      }

      logger.info({
        checked: activeUsers.length,
        reset,
        preserved,
      }, '✅ Batch streak reset complete');

      return { checked: activeUsers.length, reset, preserved };
    } catch (error) {
      logger.error({ error }, '❌ Failed to batch reset streaks');
      return { checked: 0, reset: 0, preserved: 0 };
    }
  }

  /**
   * Get users who are about to lose their streak (warning system)
   */
  static async getUsersAtRisk(hoursThreshold: number = 20): Promise<Array<{
    userId: string;
    streak: number;
    hoursRemaining: number;
  }>> {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - hoursThreshold * 60 * 60 * 1000);

      const atRiskUsers = await Progress.find({
        'streak.current': { $gt: 0 },
        'streak.lastActivityDate': { $lt: cutoffTime },
      })
        .select('userId streak tier')
        .lean()
        .limit(1000);

      const results = atRiskUsers.map(user => {
        const hoursSince = (now.getTime() - user.streak.lastActivityDate!.getTime()) / (1000 * 60 * 60);
        const tierNum = (user as any).tier || 1;
        const gracePeriodHours = tierNum <= 2 ? 2 : tierNum <= 4 ? 4 : 6;
        const deadline = 24 + gracePeriodHours;
        const hoursRemaining = Math.max(0, deadline - hoursSince);

        return {
          userId: user.userId.toString(),
          streak: user.streak.current,
          hoursRemaining: Math.round(hoursRemaining),
        };
      });

      return results.filter(r => r.hoursRemaining > 0);
    } catch (error) {
      logger.error({ error }, '❌ Failed to get users at risk');
      return [];
    }
  }

  /**
   * Reset today's progress at midnight (for all users)
   */
  static async resetDailyProgress(): Promise<number> {
    try {
      const result = await Progress.updateMany(
        {},
        {
          $set: {
            'streak.todayProgress': {
              minutesPracticed: 0,
              messagesCount: 0,
              activitiesCompleted: [],
              goalMet: false,
              lastUpdated: null,
            },
          },
        }
      );

      logger.info({ count: result.modifiedCount }, '🔄 Reset daily progress for all users');

      return result.modifiedCount;
    } catch (error) {
      logger.error({ error }, '❌ Failed to reset daily progress');
      return 0;
    }
  }
}

export default StreakBreakDetectionService;
