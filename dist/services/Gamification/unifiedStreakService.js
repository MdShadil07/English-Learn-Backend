/**
 * 🔥 UNIFIED STREAK SERVICE
 * Comprehensive streak management combining core logic + premium features
 *
 * Features:
 * ✅ Core Streak Logic (from enhancedStreakService):
 *    - Basic streak tracking (current, longest)
 *    - Daily goal validation (5 min + 3 messages)
 *    - Grace periods by tier (2h/4h/6h)
 *    - Auto-reset to 0 when expired
 *    - DB persistence with MongoDB
 *    - Redis caching (5-min TTL)
 *    - XP rewards
 *    - Background validation jobs
 *
 * ✅ Premium Features (from advancedStreakService):
 *    - Streak freeze (Premium: 2/month)
 *    - Milestone rewards (badges, XP bonuses, freeze tokens)
 *    - Monthly freeze refresh
 *    - Detailed activity tracking
 *    - Advanced status with milestones
 *    - Activity history logging
 */
import Progress from '../../models/Progress.js';
import { redisCache } from '../../config/redis.js';
import { logger } from '../../utils/calculators/core/logger.js';
// ========================================
// CONSTANTS
// ========================================
// Grace periods by tier (in hours)
const GRACE_PERIODS = {
    free: 2, // 2 hours grace period
    pro: 4, // 4 hours grace period  
    premium: 6, // 6 hours grace period
};
// Minimum requirements
const MIN_MINUTES_REQUIRED = 5;
const MIN_MESSAGES_REQUIRED = 3;
// Redis cache
const CACHE_TTL = 300; // 5 minutes
const getCacheKey = (userId) => `streak:${userId}`;
// Streak freeze allocations by tier
const FREEZE_ALLOCATIONS = {
    free: 0,
    pro: 0,
    premium: 2,
};
// Milestone configuration
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
function getStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function isSameDay(date1, date2) {
    return (date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate());
}
function isNextDay(date1, date2) {
    const nextDay = new Date(date1);
    nextDay.setDate(nextDay.getDate() + 1);
    return isSameDay(nextDay, date2);
}
function getHoursBetween(date1, date2) {
    return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60);
}
function checkMilestone(currentStreak, previousStreak) {
    const milestone = STREAK_MILESTONES.find(m => m.days === currentStreak && previousStreak < m.days);
    if (!milestone)
        return undefined;
    return {
        days: milestone.days,
        reachedAt: new Date(),
        rewards: {
            xpBonus: milestone.xpBonus,
            badgeId: milestone.badgeId,
            freezeToken: milestone.freezeToken || 0,
            title: milestone.title,
        },
    };
}
// ========================================
// UNIFIED STREAK SERVICE CLASS
// ========================================
class UnifiedStreakService {
    // ========================================
    // CORE STREAK METHODS (from enhancedStreakService)
    // ========================================
    /**
     * 🎯 Main method: Update streak with full validation and DB persistence
     * Combines basic streak logic + milestone tracking
     */
    async updateStreak(data) {
        const { userId, minutesPracticed, messagesCount, tier, activityType, accuracyScore } = data;
        const userIdStr = userId.toString();
        try {
            logger.info({ userId: userIdStr, minutesPracticed, messagesCount }, '🔥 Updating streak');
            // 1. Find or create Progress document
            let progress = await Progress.findOne({ userId });
            if (!progress) {
                progress = await this.createProgressDocument(userId, tier);
            }
            if (!progress) {
                throw new Error('Failed to create or find Progress document');
            }
            const now = new Date();
            const lastActivityDate = progress.streak.lastActivityDate;
            const currentStreak = progress.streak.current || 0;
            const longestStreak = progress.streak.longest || 0;
            // 2. Validate minimum requirements
            if (minutesPracticed < MIN_MINUTES_REQUIRED) {
                logger.warn({ userId: userIdStr, minutesPracticed }, 'Insufficient practice time for streak');
                return {
                    isValid: false,
                    current: currentStreak,
                    longest: longestStreak,
                    message: `Need ${MIN_MINUTES_REQUIRED - minutesPracticed} more minutes to maintain streak`,
                    shouldReset: false,
                };
            }
            if (messagesCount < MIN_MESSAGES_REQUIRED) {
                logger.warn({ userId: userIdStr, messagesCount }, 'Insufficient messages for streak');
                return {
                    isValid: false,
                    current: currentStreak,
                    longest: longestStreak,
                    message: `Need ${MIN_MESSAGES_REQUIRED - messagesCount} more messages to maintain streak`,
                    shouldReset: false,
                };
            }
            // 3. Update today's progress tracking
            await this.updateTodayProgress(progress, minutesPracticed, messagesCount, activityType, now);
            // 4. Calculate streak update with milestone check
            const result = await this.calculateStreakUpdate(progress, lastActivityDate, now, currentStreak, longestStreak, tier);
            // 5. Update Progress document
            await this.updateProgressDocument(progress, result, now, minutesPracticed, messagesCount, activityType, accuracyScore);
            // 6. Clear cache
            await this.clearCache(userIdStr);
            logger.info({ userId: userIdStr, result }, '✅ Streak updated successfully');
            return result;
        }
        catch (error) {
            logger.error({ userId: userIdStr, error }, '❌ Failed to update streak');
            throw error;
        }
    }
    /**
     * Calculate streak update based on time difference
     * Includes milestone detection
     */
    async calculateStreakUpdate(progress, lastActivityDate, now, currentStreak, longestStreak, tier) {
        // First-time user
        if (!lastActivityDate) {
            return {
                isValid: true,
                current: 1,
                longest: 1,
                message: '🎉 Streak started!',
                shouldReset: false,
                xpEarned: 10,
            };
        }
        const hoursSince = getHoursBetween(lastActivityDate, now);
        const daysDiff = Math.floor(hoursSince / 24);
        // Same day - no streak change
        if (isSameDay(lastActivityDate, now)) {
            return {
                isValid: true,
                current: currentStreak,
                longest: longestStreak,
                message: `📅 Same day practice (${currentStreak}-day streak maintained)`,
                shouldReset: false,
            };
        }
        // Next day - increment streak
        if (isNextDay(lastActivityDate, now)) {
            const newStreak = currentStreak + 1;
            const newLongest = Math.max(longestStreak, newStreak);
            const xpEarned = this.calculateStreakXP(newStreak);
            // Check for milestone
            const milestone = checkMilestone(newStreak, currentStreak);
            if (milestone && tier === 'premium' && milestone.rewards.freezeToken) {
                progress.streak.freeze.available += milestone.rewards.freezeToken;
            }
            return {
                isValid: true,
                current: newStreak,
                longest: newLongest,
                message: milestone
                    ? `${milestone.rewards.title} - ${newStreak}-day streak! 🎉`
                    : `🔥 ${newStreak}-day streak!`,
                shouldReset: false,
                xpEarned,
                milestone: milestone || undefined,
            };
        }
        // Grace period check
        const gracePeriodHours = GRACE_PERIODS[tier];
        const deadlineHours = 24 + gracePeriodHours;
        if (hoursSince <= deadlineHours) {
            // Within grace period
            const newStreak = currentStreak + 1;
            const newLongest = Math.max(longestStreak, newStreak);
            const remaining = Math.ceil(deadlineHours - hoursSince);
            const xpEarned = this.calculateStreakXP(newStreak);
            return {
                isValid: true,
                current: newStreak,
                longest: newLongest,
                message: `⚡ Streak saved within grace period! (${newStreak} days)`,
                shouldReset: false,
                gracePeriodRemaining: remaining,
                xpEarned,
            };
        }
        // Expired - reset to 0
        return {
            isValid: false,
            current: 0,
            longest: longestStreak,
            message: '💔 Streak expired. Starting fresh!',
            shouldReset: true,
            xpEarned: 10,
        };
    }
    /**
     * Update today's progress tracking (from advancedStreakService)
     */
    async updateTodayProgress(progress, minutesPracticed, messagesCount, activityType, now) {
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
        if (activityType && !progress.streak.todayProgress.activitiesCompleted.includes(activityType)) {
            progress.streak.todayProgress.activitiesCompleted.push(activityType);
        }
        progress.streak.todayProgress.lastUpdated = now;
        // Check if daily goal is met
        const minutesGoalMet = progress.streak.todayProgress.minutesPracticed >= (progress.streak.dailyGoal?.minutesRequired || 10);
        const messagesGoalMet = progress.streak.todayProgress.messagesCount >= (progress.streak.dailyGoal?.messagesRequired || 5);
        progress.streak.todayProgress.goalMet = minutesGoalMet && messagesGoalMet;
    }
    /**
     * Update Progress document with new streak data
     */
    async updateProgressDocument(progress, result, now, minutesPracticed, messagesCount, activityType, accuracyScore) {
        // Update basic streak fields
        progress.streak.current = result.current;
        progress.streak.longest = result.longest;
        progress.streak.lastActivityDate = now;
        // Set streak start date if new streak
        if (result.current === 1 && !progress.streak.streakStartDate) {
            progress.streak.streakStartDate = now;
        }
        // Reset start date if streak was reset
        if (result.shouldReset) {
            progress.streak.streakStartDate = null;
            progress.streak.current = 0;
            // Record in history
            if (progress.streak.streakHistory) {
                progress.streak.streakHistory.push({
                    startDate: progress.streak.streakStartDate || now,
                    endDate: now,
                    length: progress.streak.current,
                    reason: 'broken',
                });
            }
        }
        // Update XP if earned
        if (result.xpEarned) {
            progress.totalXP = (progress.totalXP || 0) + result.xpEarned;
        }
        // Add milestone if reached
        if (result.milestone) {
            if (!progress.streak.milestones) {
                progress.streak.milestones = [];
            }
            progress.streak.milestones.push(result.milestone);
            // Add milestone XP
            if (result.milestone.rewards.xpBonus) {
                progress.totalXP = (progress.totalXP || 0) + result.milestone.rewards.xpBonus;
            }
        }
        // Log daily activity
        const today = getStartOfDay(now);
        const todayActivity = {
            date: today,
            minutesPracticed: progress.streak.todayProgress.minutesPracticed,
            messagesCount: progress.streak.todayProgress.messagesCount,
            accuracyAverage: accuracyScore || 0,
            activitiesCompleted: progress.streak.todayProgress.activitiesCompleted || [],
            goalMet: progress.streak.todayProgress.goalMet,
            xpEarned: result.xpEarned || 0,
        };
        if (!progress.streak.dailyActivities) {
            progress.streak.dailyActivities = [];
        }
        // Update or add today's activity
        const todayIndex = progress.streak.dailyActivities.findIndex((a) => isSameDay(a.date, today));
        if (todayIndex >= 0) {
            progress.streak.dailyActivities[todayIndex] = todayActivity;
        }
        else {
            progress.streak.dailyActivities.push(todayActivity);
        }
        // Save to database
        await progress.save();
        logger.info({ userId: progress.userId.toString() }, '💾 Streak saved to database');
    }
    /**
     * Create new Progress document for user
     */
    async createProgressDocument(userId, tier) {
        try {
            const progress = new Progress({
                userId,
                totalXP: 0,
                streak: {
                    current: 0,
                    longest: 0,
                    lastActivityDate: null,
                    streakStartDate: null,
                    dailyGoal: {
                        minutesRequired: 10,
                        messagesRequired: 5,
                        activitiesRequired: ['ai_chat'],
                    },
                    todayProgress: {
                        minutesPracticed: 0,
                        messagesCount: 0,
                        activitiesCompleted: [],
                        goalMet: false,
                        lastUpdated: new Date(),
                    },
                    gracePeriod: {
                        hours: GRACE_PERIODS[tier],
                        active: false,
                        expiresAt: null,
                    },
                    freeze: {
                        available: FREEZE_ALLOCATIONS[tier],
                        used: 0,
                        lastRefresh: new Date(),
                        active: false,
                        frozenUntil: null,
                    },
                    milestones: [],
                    streakHistory: [],
                    dailyActivities: [],
                },
            });
            await progress.save();
            logger.info({ userId: userId.toString() }, '✅ Created new Progress document');
            return progress;
        }
        catch (error) {
            logger.error({ userId: userId.toString(), error }, '❌ Failed to create Progress document');
            return null;
        }
    }
    // ========================================
    // ADVANCED STATUS & FEATURES (from advancedStreakService)
    // ========================================
    /**
     * Get comprehensive streak status with all details
     */
    async getStreakStatus(userId, tier) {
        const progress = await Progress.findOne({ userId });
        if (!progress) {
            return {
                current: 0,
                longest: 0,
                isAtRisk: false,
                hoursUntilExpiry: 0,
                todayGoalMet: false,
                todayProgress: {
                    minutes: 0,
                    minutesRequired: 10,
                    messages: 0,
                    messagesRequired: 5,
                    percentComplete: 0,
                },
            };
        }
        const now = new Date();
        const lastActivity = progress.streak.lastActivityDate;
        let hoursUntilExpiry = 0;
        let isAtRisk = false;
        if (lastActivity) {
            const hoursSince = getHoursBetween(lastActivity, now);
            const gracePeriodHours = GRACE_PERIODS[tier];
            const deadlineHours = 24 + gracePeriodHours;
            hoursUntilExpiry = Math.max(0, deadlineHours - hoursSince);
            isAtRisk = hoursUntilExpiry < 20 && hoursUntilExpiry > 0;
        }
        const minutesRequired = progress.streak.dailyGoal?.minutesRequired || 10;
        const messagesRequired = progress.streak.dailyGoal?.messagesRequired || 5;
        const minutesCurrent = progress.streak.todayProgress?.minutesPracticed || 0;
        const messagesCurrent = progress.streak.todayProgress?.messagesCount || 0;
        const percentComplete = Math.min(100, ((minutesCurrent / minutesRequired) * 50) +
            ((messagesCurrent / messagesRequired) * 50));
        // Find next milestone
        const nextMilestone = STREAK_MILESTONES.find(m => m.days > progress.streak.current);
        return {
            current: progress.streak.current,
            longest: progress.streak.longest,
            isAtRisk,
            hoursUntilExpiry,
            todayGoalMet: progress.streak.todayProgress?.goalMet || false,
            todayProgress: {
                minutes: minutesCurrent,
                minutesRequired,
                messages: messagesCurrent,
                messagesRequired,
                percentComplete,
            },
            gracePeriod: {
                available: true,
                hours: GRACE_PERIODS[tier],
                active: progress.streak.gracePeriod?.isActive || false,
                expiresAt: progress.streak.gracePeriod?.expiresAt || null,
            },
            freeze: tier === 'premium' ? {
                available: progress.streak.freeze?.available || 0,
                canUse: (progress.streak.freeze?.available || 0) > 0,
            } : undefined,
            nextMilestone: nextMilestone ? {
                days: nextMilestone.days,
                daysRemaining: nextMilestone.days - progress.streak.current,
                reward: `${nextMilestone.title} - ${nextMilestone.xpBonus} XP`,
            } : undefined,
        };
    }
    /**
     * Use streak freeze (Premium only)
     */
    async useStreakFreeze(userId, tier, days = 1) {
        if (tier !== 'premium') {
            return {
                success: false,
                message: 'Streak freeze is only available for Premium users',
                freezeUsed: false,
            };
        }
        const progress = await Progress.findOne({ userId });
        if (!progress) {
            return {
                success: false,
                message: 'Progress not found',
                freezeUsed: false,
            };
        }
        const freezeAvailable = progress.streak.freeze?.available || 0;
        if (freezeAvailable <= 0) {
            return {
                success: false,
                message: 'No streak freezes available',
                freezeUsed: false,
            };
        }
        // Activate freeze
        progress.streak.freeze.available -= 1;
        progress.streak.freeze.used = (progress.streak.freeze.used || 0) + 1;
        progress.streak.freeze.lastUsed = new Date();
        const frozenUntil = new Date();
        frozenUntil.setDate(frozenUntil.getDate() + days);
        progress.streak.freeze.expiresAt = frozenUntil;
        await progress.save();
        return {
            success: true,
            message: `Streak frozen for ${days} day(s). You have ${progress.streak.freeze.available} freezes remaining.`,
            freezeUsed: true,
        };
    }
    /**
     * Initialize streak settings for new user
     */
    async initializeStreak(userId, tier) {
        let progress = await Progress.findOne({ userId });
        if (!progress) {
            progress = await this.createProgressDocument(userId, tier);
            if (!progress)
                return;
        }
        // Update tier-based settings
        progress.streak.dailyGoal = {
            minutesRequired: 10,
            messagesRequired: 5,
            activitiesRequired: ['ai_chat'],
        };
        progress.streak.gracePeriod = {
            hours: GRACE_PERIODS[tier],
            isActive: false,
            expiresAt: null,
        };
        progress.streak.freeze = {
            available: FREEZE_ALLOCATIONS[tier],
            used: 0,
            lastUsed: null,
            expiresAt: null,
        };
        await progress.save();
        logger.info({ userId: userId.toString(), tier }, '✅ Streak initialized');
    }
    // ========================================
    // BACKGROUND JOBS & VALIDATION
    // ========================================
    /**
     * 🕐 Background job: Validate all streaks and reset expired ones
     */
    async validateAllStreaks() {
        try {
            logger.info('🔄 Starting daily streak validation job');
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            // Find all users with active streaks
            const activeUsers = await Progress.find({
                'streak.current': { $gt: 0 },
                'streak.lastActivityDate': { $lt: twentyFourHoursAgo },
            }).select('userId streak tier');
            let broken = 0;
            let maintained = 0;
            for (const progress of activeUsers) {
                const hoursSince = getHoursBetween(progress.streak.lastActivityDate, now);
                // Check if freeze is active
                if (progress.streak.freeze?.expiresAt) {
                    if (now < progress.streak.freeze.expiresAt) {
                        logger.info({ userId: progress.userId.toString() }, '❄️ Streak protected by freeze');
                        maintained++;
                        continue;
                    }
                    else {
                        // Freeze expired
                        progress.streak.freeze.expiresAt = null;
                        await progress.save();
                    }
                }
                // Map numeric tier to grace period
                const numericTier = progress.tier;
                const tierKey = numericTier === undefined ? 'free' :
                    numericTier <= 2 ? 'free' :
                        numericTier <= 4 ? 'pro' : 'premium';
                const gracePeriodHours = GRACE_PERIODS[tierKey];
                const deadlineHours = 24 + gracePeriodHours;
                if (hoursSince > deadlineHours) {
                    // Streak expired - reset to 0
                    const brokenStreak = progress.streak.current;
                    progress.streak.current = 0;
                    progress.streak.streakStartDate = null;
                    // Record in history
                    if (!progress.streak.streakHistory) {
                        progress.streak.streakHistory = [];
                    }
                    progress.streak.streakHistory.push({
                        startDate: progress.streak.streakStartDate || new Date(),
                        endDate: now,
                        length: brokenStreak,
                        reason: 'broken',
                    });
                    await progress.save();
                    broken++;
                    logger.info({ userId: progress.userId.toString(), days: brokenStreak }, '💔 Streak reset to 0 (expired)');
                }
                else {
                    maintained++;
                }
            }
            logger.info({ checked: activeUsers.length, broken, maintained }, '✅ Daily streak validation complete');
            return {
                checked: activeUsers.length,
                broken,
                maintained,
            };
        }
        catch (error) {
            logger.error({ error }, '❌ Failed to validate streaks');
            throw error;
        }
    }
    /**
     * Reset daily progress for all users (called at midnight)
     */
    async resetDailyProgress() {
        try {
            const result = await Progress.updateMany({}, {
                $set: {
                    'streak.todayProgress': {
                        minutesPracticed: 0,
                        messagesCount: 0,
                        activitiesCompleted: [],
                        goalMet: false,
                        lastUpdated: new Date(),
                    },
                },
            });
            logger.info({ reset: result.modifiedCount }, '🔄 Daily progress reset for all users');
            return { reset: result.modifiedCount };
        }
        catch (error) {
            logger.error({ error }, '❌ Failed to reset daily progress');
            throw error;
        }
    }
    /**
     * Refresh monthly freeze allocations (called on 1st of month)
     */
    async refreshMonthlyFreezes() {
        try {
            const now = new Date();
            const result = await Progress.updateMany({ 'streak.freeze.available': { $exists: true } }, [
                {
                    $set: {
                        'streak.freeze.available': {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$tier', 6] }, then: FREEZE_ALLOCATIONS.premium },
                                    { case: { $gte: ['$tier', 3] }, then: FREEZE_ALLOCATIONS.pro },
                                ],
                                default: FREEZE_ALLOCATIONS.free,
                            },
                        },
                        'streak.freeze.used': 0,
                        'streak.freeze.lastRefresh': now,
                    },
                },
            ]);
            logger.info({ refreshed: result.modifiedCount }, '🔄 Monthly freeze allocations refreshed');
            return { totalRefreshed: result.modifiedCount };
        }
        catch (error) {
            logger.error({ error }, '❌ Failed to refresh freeze allocations');
            throw error;
        }
    }
    // ========================================
    // HELPER METHODS
    // ========================================
    /**
     * Check streak status (simple version)
     */
    async checkStreakStatus(userId) {
        const progress = await Progress.findOne({ userId });
        if (!progress) {
            return {
                isValid: false,
                current: 0,
                longest: 0,
                message: 'No streak data found',
                shouldReset: false,
            };
        }
        return {
            isValid: progress.streak.current > 0,
            current: progress.streak.current,
            longest: progress.streak.longest,
            message: `Current streak: ${progress.streak.current} days`,
            shouldReset: false,
        };
    }
    /**
     * Calculate XP earned for streak
     */
    calculateStreakXP(streakDays) {
        // Base XP: 10 per day
        // Bonus for milestones
        const baseXP = 10;
        const milestone = STREAK_MILESTONES.find(m => m.days === streakDays);
        const bonusXP = milestone ? milestone.xpBonus : 0;
        return baseXP + bonusXP;
    }
    /**
     * Cache streak data
     */
    async cacheResult(userId, data) {
        try {
            await redisCache.set(getCacheKey(userId), JSON.stringify(data), CACHE_TTL);
        }
        catch (error) {
            logger.warn({ userId, error }, 'Failed to cache streak data');
        }
    }
    /**
     * Get from cache
     */
    async getFromCache(userId) {
        try {
            const cached = await redisCache.get(getCacheKey(userId));
            return cached ? JSON.parse(cached) : null;
        }
        catch (error) {
            logger.warn({ userId, error }, 'Failed to get cached streak data');
            return null;
        }
    }
    /**
     * Clear cache
     */
    async clearCache(userId) {
        try {
            await redisCache.del(getCacheKey(userId));
        }
        catch (error) {
            logger.warn({ userId, error }, 'Failed to clear streak cache');
        }
    }
}
// ========================================
// EXPORTS
// ========================================
// Singleton export (for instance-based usage)
export const unifiedStreakService = new UnifiedStreakService();
// Class export (for static-like usage if needed)
export { UnifiedStreakService };
// Default export
export default unifiedStreakService;
//# sourceMappingURL=unifiedStreakService.js.map