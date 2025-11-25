/**
 * 🔥 ADVANCED STREAK SERVICE
 * Comprehensive streak management with tier-based features
 * 
 * Features:
 * - Automatic daily goal tracking (10 minutes + 5 AI messages)
 * - Grace period (Pro: 3h, Premium: 6h)
 * - Streak freeze (Premium: 2/month)
 * - Milestone rewards (XP bonuses, badges, freeze tokens)
 * - Auto-reset at midnight (cron job)
 * - Real-time progress tracking
 * - Activity logging and analytics
 */

import Progress, { IDailyActivity, IStreakMilestone } from '../../models/Progress.js';
import { Types } from 'mongoose';

// ========================================
// TYPES & INTERFACES
// ========================================

export interface StreakUpdateOptions {
  userId: string | Types.ObjectId;
  tier: 'free' | 'pro' | 'premium';
  minutesPracticed?: number;
  messagesCount?: number;
  activityType?: string;
  accuracyScore?: number;
}

export interface StreakValidationResult {
  success: boolean;
  streak: {
    current: number;
    longest: number;
    goalMet: boolean;
    progress: {
      minutes: number;
      minutesRequired: number;
      messages: number;
      messagesRequired: number;
    };
  };
  message: string;
  milestone?: IStreakMilestone;
  gracePeriod?: {
    active: boolean;
    hoursRemaining: number;
  };
}

export interface StreakStatusResponse {
  current: number;
  longest: number;
  isAtRisk: boolean;
  hoursUntilExpiry: number;
  todayGoalMet: boolean;
  todayProgress: {
    minutes: number;
    minutesRequired: number;
    messages: number;
    messagesRequired: number;
    percentComplete: number;
  };
  gracePeriod?: {
    available: boolean;
    hours: number;
    active: boolean;
    expiresAt: Date | null;
  };
  freeze?: {
    available: number;
    canUse: boolean;
  };
  nextMilestone?: {
    days: number;
    daysRemaining: number;
    reward: string;
  };
}

// ========================================
// STREAK MILESTONES CONFIGURATION
// ========================================

const STREAK_MILESTONES = [
  { days: 3, xpBonus: 50, title: '🔥 3-Day Warrior' },
  { days: 7, xpBonus: 150, badgeId: 'week_warrior', title: '⚡ Week Warrior', freezeToken: 0 },
  { days: 14, xpBonus: 300, title: '💪 Fortnight Champion', freezeToken: 0 },
  { days: 30, xpBonus: 1000, badgeId: 'month_master', title: '👑 Month Master', freezeToken: 1 },
  { days: 60, xpBonus: 2500, title: '🏆 60-Day Legend', freezeToken: 1 },
  { days: 100, xpBonus: 5000, badgeId: 'century_club', title: '💎 Century Club', freezeToken: 2 },
  { days: 200, xpBonus: 12000, title: '🌟 Bicentennial Star', freezeToken: 3 },
  { days: 365, xpBonus: 50000, badgeId: 'year_champion', title: '🎯 Year Champion', freezeToken: 5 },
];

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get grace period hours based on tier
 */
function getGracePeriodHours(tier: 'free' | 'pro' | 'premium'): number {
  switch (tier) {
    case 'premium':
      return 6;
    case 'pro':
      return 3;
    case 'free':
    default:
      return 0;
  }
}

/**
 * Get streak freeze allocation based on tier
 */
function getMonthlyFreezeAllocation(tier: 'free' | 'pro' | 'premium'): number {
  switch (tier) {
    case 'premium':
      return 2; // Premium users get 2 freezes per month
    case 'pro':
      return 0; // Pro users don't get freezes
    case 'free':
    default:
      return 0;
  }
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if date2 is the day after date1
 */
function isNextDay(date1: Date, date2: Date): boolean {
  const nextDay = new Date(date1);
  nextDay.setDate(nextDay.getDate() + 1);
  return isSameDay(nextDay, date2);
}

/**
 * Get start of day (00:00:00)
 */
function getStartOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Get end of day (23:59:59)
 */
function getEndOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/**
 * Get hours between two dates
 */
function getHoursBetween(date1: Date, date2: Date): number {
  return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if milestone reached
 */
function checkMilestone(currentStreak: number, previousStreak: number): IStreakMilestone | null {
  const milestone = STREAK_MILESTONES.find(
    (m) => m.days === currentStreak && previousStreak < currentStreak
  );
  
  if (milestone) {
    return {
      days: milestone.days,
      reachedAt: new Date(),
      rewards: {
        xpBonus: milestone.xpBonus,
        badgeId: milestone.badgeId,
        freezeToken: milestone.freezeToken,
        title: milestone.title,
      },
    };
  }
  
  return null;
}

// ========================================
// ADVANCED STREAK SERVICE CLASS
// ========================================

export class AdvancedStreakService {
  /**
   * Initialize streak settings for new user or update existing
   */
  static async initializeStreak(
    userId: string | Types.ObjectId,
    tier: 'free' | 'pro' | 'premium'
  ): Promise<void> {
    const progress = await Progress.findOne({ userId });
    if (!progress) return;

    // Set tier-based defaults
    progress.streak.dailyGoal.minutesRequired = 10;
    progress.streak.dailyGoal.messagesRequired = 5;
    progress.streak.dailyGoal.activitiesRequired = ['ai_chat'];
    
    progress.streak.gracePeriod.hours = getGracePeriodHours(tier);
    progress.streak.freeze.available = getMonthlyFreezeAllocation(tier);

    await progress.save();
    
    console.log(`✅ Streak initialized for user ${userId} (${tier})`);
  }

  /**
   * Track AI Chat activity and update streak progress
   */
  static async trackAIChatActivity(options: StreakUpdateOptions): Promise<StreakValidationResult> {
    const { userId, tier, minutesPracticed = 0, messagesCount = 0, accuracyScore = 0 } = options;

    const progress = await Progress.findOne({ userId });
    if (!progress) {
      return {
        success: false,
        streak: { current: 0, longest: 0, goalMet: false, progress: { minutes: 0, minutesRequired: 10, messages: 0, messagesRequired: 5 } },
        message: 'Progress not found',
      };
    }

    const now = new Date();
    const today = getStartOfDay(now);

    // Initialize today's progress if it's a new day
    if (!progress.streak.todayProgress.lastUpdated || !isSameDay(progress.streak.todayProgress.lastUpdated, now)) {
      progress.streak.todayProgress = {
        minutesPracticed: 0,
        messagesCount: 0,
        activitiesCompleted: [],
        goalMet: false,
        lastUpdated: now,
      };
    }

    // Update today's progress
    progress.streak.todayProgress.minutesPracticed += minutesPracticed;
    progress.streak.todayProgress.messagesCount += messagesCount;
    
    if (options.activityType && !progress.streak.todayProgress.activitiesCompleted.includes(options.activityType)) {
      progress.streak.todayProgress.activitiesCompleted.push(options.activityType);
    }
    
    progress.streak.todayProgress.lastUpdated = now;

    // Check if daily goal is met
    const minutesGoalMet = progress.streak.todayProgress.minutesPracticed >= progress.streak.dailyGoal.minutesRequired;
    const messagesGoalMet = progress.streak.todayProgress.messagesCount >= progress.streak.dailyGoal.messagesRequired;
    const goalMet = minutesGoalMet && messagesGoalMet;
    
    progress.streak.todayProgress.goalMet = goalMet;

    // If goal just met, update streak
    let milestone: IStreakMilestone | undefined;
    
    if (goalMet && progress.streak.lastActivityDate) {
      const lastActivity = progress.streak.lastActivityDate;
      
      // Same day - just update timestamp
      if (isSameDay(lastActivity, now)) {
        progress.streak.lastActivityDate = now;
      }
      // Next day - increment streak
      else if (isNextDay(lastActivity, now)) {
        const previousStreak = progress.streak.current;
        progress.streak.current += 1;
        progress.streak.longest = Math.max(progress.streak.longest, progress.streak.current);
        progress.streak.totalStreakDays += 1;
        progress.streak.lastActivityDate = now;
        progress.streak.stats.totalActiveDays += 1;
        
        // Check for milestone
        const milestoneReached = checkMilestone(progress.streak.current, previousStreak);
        if (milestoneReached) {
          milestone = milestoneReached;
          progress.streak.milestones.push(milestone);
          
          // Award freeze tokens for premium users
          if (tier === 'premium' && milestone.rewards.freezeToken) {
            progress.streak.freeze.available += milestone.rewards.freezeToken;
          }
          
          console.log(`🎉 Milestone reached: ${milestone.days} days! Reward: ${milestone.rewards.xpBonus} XP`);
        }
      }
      // Missed day - check grace period or freeze
      else {
        const hoursSince = getHoursBetween(lastActivity, now);
        const gracePeriodHours = progress.streak.gracePeriod.hours;
        const deadline = 24 + gracePeriodHours;
        
        if (hoursSince <= deadline) {
          // Within grace period - save streak
          progress.streak.current += 1;
          progress.streak.longest = Math.max(progress.streak.longest, progress.streak.current);
          progress.streak.totalStreakDays += 1;
          progress.streak.lastActivityDate = now;
          progress.streak.gracePeriod.isActive = true;
          progress.streak.gracePeriod.expiresAt = new Date(now.getTime() + (deadline - hoursSince) * 60 * 60 * 1000);
          progress.streak.stats.totalActiveDays += 1;
          
          console.log(`⚡ Streak saved within grace period: ${progress.streak.current} days`);
        } else {
          // Beyond grace period - streak broken (will be handled by cron)
          console.log(`💔 Streak broken. Hours since last activity: ${hoursSince}`);
        }
      }
    } else if (goalMet && !progress.streak.lastActivityDate) {
      // First time achieving goal
      progress.streak.current = 1;
      progress.streak.longest = 1;
      progress.streak.totalStreakDays = 1;
      progress.streak.lastActivityDate = now;
      progress.streak.streakStartDate = now;
      progress.streak.stats.totalActiveDays = 1;
      
      console.log(`🔥 New streak started!`);
    }

    // Log daily activity
    const todayActivity: IDailyActivity = {
      date: today,
      minutesPracticed: progress.streak.todayProgress.minutesPracticed,
      messagesCount: progress.streak.todayProgress.messagesCount,
      accuracyAverage: accuracyScore,
      activitiesCompleted: progress.streak.todayProgress.activitiesCompleted,
      goalMet,
      xpEarned: 0, // Will be calculated elsewhere
    };
    
    // Update or add today's activity
    const todayIndex = progress.streak.dailyActivities.findIndex((a) => isSameDay(a.date, today));
    if (todayIndex >= 0) {
      progress.streak.dailyActivities[todayIndex] = todayActivity;
    } else {
      progress.streak.dailyActivities.push(todayActivity);
      
      // Keep only last 30 days
      if (progress.streak.dailyActivities.length > 30) {
        progress.streak.dailyActivities = progress.streak.dailyActivities.slice(-30);
      }
    }

    // Update statistics
    const totalMinutes = progress.streak.dailyActivities.reduce((sum, a) => sum + a.minutesPracticed, 0);
    progress.streak.stats.averageMinutesPerDay = totalMinutes / progress.streak.stats.totalActiveDays || 0;

    await progress.save();

    return {
      success: true,
      streak: {
        current: progress.streak.current,
        longest: progress.streak.longest,
        goalMet,
        progress: {
          minutes: progress.streak.todayProgress.minutesPracticed,
          minutesRequired: progress.streak.dailyGoal.minutesRequired,
          messages: progress.streak.todayProgress.messagesCount,
          messagesRequired: progress.streak.dailyGoal.messagesRequired,
        },
      },
      message: goalMet
        ? `🔥 Daily goal achieved! Streak: ${progress.streak.current} days`
        : `Keep going! ${progress.streak.dailyGoal.minutesRequired - progress.streak.todayProgress.minutesPracticed} min, ${progress.streak.dailyGoal.messagesRequired - progress.streak.todayProgress.messagesCount} messages left`,
      milestone,
    };
  }

  /**
   * Get current streak status
   */
  static async getStreakStatus(
    userId: string | Types.ObjectId,
    tier: 'free' | 'pro' | 'premium'
  ): Promise<StreakStatusResponse> {
    const progress = await Progress.findOne({ userId });
    
    if (!progress) {
      return {
        current: 0,
        longest: 0,
        isAtRisk: false,
        hoursUntilExpiry: 24,
        todayGoalMet: false,
        todayProgress: { minutes: 0, minutesRequired: 10, messages: 0, messagesRequired: 5, percentComplete: 0 },
      };
    }

    const now = new Date();
    const lastActivity = progress.streak.lastActivityDate;
    
    // Calculate time until expiry
    let hoursUntilExpiry = 24;
    let isAtRisk = false;
    
    if (lastActivity) {
      const hoursSince = getHoursBetween(lastActivity, now);
      const gracePeriodHours = getGracePeriodHours(tier);
      const deadline = 24 + gracePeriodHours;
      hoursUntilExpiry = Math.max(0, deadline - hoursSince);
      isAtRisk = hoursUntilExpiry > 0 && hoursUntilExpiry < 6; // At risk if < 6 hours left
    }

    // Calculate today's progress percentage
    const minutesProgress = (progress.streak.todayProgress.minutesPracticed / progress.streak.dailyGoal.minutesRequired) * 50;
    const messagesProgress = (progress.streak.todayProgress.messagesCount / progress.streak.dailyGoal.messagesRequired) * 50;
    const percentComplete = Math.min(100, minutesProgress + messagesProgress);

    // Find next milestone
    const nextMilestone = STREAK_MILESTONES.find((m) => m.days > progress.streak.current);

    return {
      current: progress.streak.current,
      longest: progress.streak.longest,
      isAtRisk,
      hoursUntilExpiry,
      todayGoalMet: progress.streak.todayProgress.goalMet,
      todayProgress: {
        minutes: progress.streak.todayProgress.minutesPracticed,
        minutesRequired: progress.streak.dailyGoal.minutesRequired,
        messages: progress.streak.todayProgress.messagesCount,
        messagesRequired: progress.streak.dailyGoal.messagesRequired,
        percentComplete,
      },
      gracePeriod: {
        available: getGracePeriodHours(tier) > 0,
        hours: getGracePeriodHours(tier),
        active: progress.streak.gracePeriod.isActive,
        expiresAt: progress.streak.gracePeriod.expiresAt,
      },
      freeze: tier === 'premium' ? {
        available: progress.streak.freeze.available,
        canUse: progress.streak.freeze.available > 0 && !progress.streak.todayProgress.goalMet,
      } : undefined,
      nextMilestone: nextMilestone ? {
        days: nextMilestone.days,
        daysRemaining: nextMilestone.days - progress.streak.current,
        reward: `${nextMilestone.xpBonus} XP + ${nextMilestone.title}`,
      } : undefined,
    };
  }

  /**
   * Use streak freeze (Premium only)
   */
  static async useStreakFreeze(
    userId: string | Types.ObjectId,
    tier: 'free' | 'pro' | 'premium'
  ): Promise<{ success: boolean; message: string }> {
    if (tier !== 'premium') {
      return { success: false, message: 'Streak freeze is a Premium feature' };
    }

    const progress = await Progress.findOne({ userId });
    if (!progress) {
      return { success: false, message: 'Progress not found' };
    }

    if (progress.streak.freeze.available <= 0) {
      return { success: false, message: 'No streak freezes available' };
    }

    if (progress.streak.todayProgress.goalMet) {
      return { success: false, message: "Today's goal already met, freeze not needed" };
    }

    // Use freeze
    progress.streak.freeze.available -= 1;
    progress.streak.freeze.used += 1;
    progress.streak.freeze.lastUsed = new Date();
    progress.streak.freeze.expiresAt = getEndOfDay(new Date());
    
    // Mark today as goal met
    progress.streak.todayProgress.goalMet = true;
    progress.streak.stats.totalFreezeUsed += 1;

    await progress.save();

    console.log(`❄️ Streak freeze used by user ${userId}. Remaining: ${progress.streak.freeze.available}`);

    return {
      success: true,
      message: `Streak freeze activated! Your ${progress.streak.current}-day streak is safe. ${progress.streak.freeze.available} freezes remaining.`,
    };
  }

  /**
   * Reset expired streaks (called by cron job)
   */
  static async resetExpiredStreaks(): Promise<{
    totalChecked: number;
    totalReset: number;
    resetUsers: string[];
  }> {
    console.log('🔄 Starting advanced streak reset check...');

    const allProgress = await Progress.find({
      'streak.current': { $gt: 0 },
    }).populate('userId', 'tier');

    let totalReset = 0;
    const resetUsers: string[] = [];
    const now = new Date();

    for (const progress of allProgress) {
      const lastActivity = progress.streak.lastActivityDate;
      if (!lastActivity) continue;

      const userId = progress.userId as any;
      const tier = userId?.tier || 'free';
      const gracePeriodHours = getGracePeriodHours(tier);
      const hoursSince = getHoursBetween(lastActivity, now);
      const deadline = 24 + gracePeriodHours;

      // Check if freeze is active
      const freezeActive = progress.streak.freeze.expiresAt && progress.streak.freeze.expiresAt > now;

      if (freezeActive) {
        console.log(`❄️ User ${userId._id} protected by streak freeze`);
        continue;
      }

      // Reset if deadline passed
      if (hoursSince > deadline) {
        const previousStreak = progress.streak.current;
        
        // Add to history
        if (progress.streak.streakStartDate) {
          progress.streak.streakHistory.push({
            startDate: progress.streak.streakStartDate,
            endDate: lastActivity,
            length: previousStreak,
            reason: 'broken',
          });
        }
        
        // Reset streak
        progress.streak.current = 0;
        progress.streak.lastActivityDate = null;
        progress.streak.streakStartDate = null;
        progress.streak.gracePeriod.isActive = false;
        progress.streak.gracePeriod.expiresAt = null;
        progress.streak.stats.totalStreaksBroken += 1;
        
        await progress.save();

        console.log(`💔 Streak reset for user ${userId._id}: ${previousStreak} days lost`);
        totalReset++;
        resetUsers.push(userId._id.toString());
      }
    }

    // Reset daily progress for all users at midnight
    await Progress.updateMany(
      {},
      {
        $set: {
          'streak.todayProgress.minutesPracticed': 0,
          'streak.todayProgress.messagesCount': 0,
          'streak.todayProgress.activitiesCompleted': [],
          'streak.todayProgress.goalMet': false,
          'streak.todayProgress.lastUpdated': null,
        },
      }
    );

    console.log(`✅ Advanced streak reset complete: ${totalReset}/${allProgress.length} streaks reset`);

    return {
      totalChecked: allProgress.length,
      totalReset,
      resetUsers,
    };
  }

  /**
   * Refresh monthly freeze allocations (called on 1st of month)
   */
  static async refreshMonthlyFreezes(): Promise<{ totalRefreshed: number }> {
    console.log('🔄 Refreshing monthly streak freezes...');

    const allProgress = await Progress.find({}).populate('userId', 'tier');
    let totalRefreshed = 0;

    for (const progress of allProgress) {
      const userId = progress.userId as any;
      const tier = userId?.tier || 'free';
      const allocation = getMonthlyFreezeAllocation(tier);

      if (allocation > 0) {
        progress.streak.freeze.available = allocation;
        progress.streak.freeze.used = 0;
        await progress.save();
        totalRefreshed++;
      }
    }

    console.log(`✅ Monthly freezes refreshed for ${totalRefreshed} premium users`);

    return { totalRefreshed };
  }
}

export default AdvancedStreakService;
