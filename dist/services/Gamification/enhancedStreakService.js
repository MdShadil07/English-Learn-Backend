/**
 * 🔥 ENHANCED STREAK SERVICE WITH DB SYNC
 * Fixes critical issues:
 * 1. Streaks now properly save to database
 * 2. Automatic streak break when goal not met
 * 3. Longest streak updates correctly
 * 4. Redis caching for performance
 * 5. Background validation jobs
 */
import Progress from '../../models/Progress.js';
import { redisCache } from '../../config/redis.js';
import { logger } from '../../utils/calculators/core/logger.js';
// Grace periods by tier (in hours)
const GRACE_PERIODS = {
    free: 2, // 2 hours grace period
    pro: 4, // 4 hours grace period  
    premium: 6, // 6 hours grace period
};
// Minimum requirements
const MIN_MINUTES_REQUIRED = 5;
const MIN_MESSAGES_REQUIRED = 3;
// Redis cache keys
const CACHE_TTL = 300; // 5 minutes
const getCacheKey = (userId) => `streak:${userId}`;
class EnhancedStreakService {
    /**
     * 🎯 Main method: Update streak with full validation and DB persistence
     */
    async updateStreak(data) {
        const { userId, minutesPracticed, messagesCount, tier } = data;
        const userIdStr = userId.toString();
        try {
            logger.info({ userId: userIdStr, minutesPracticed, messagesCount }, '🔥 Updating streak');
            // 1. Find or create Progress document
            let progress = await Progress.findOne({ userId });
            if (!progress) {
                progress = await this.createProgressDocument(userId);
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
            // 3. Calculate day difference
            const result = this.calculateStreakUpdate(lastActivityDate, now, currentStreak, longestStreak, tier);
            // 4. Update Progress document
            await this.updateProgressDocument(progress, result, now, minutesPracticed, messagesCount);
            // 5. Clear cache
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
     */
    calculateStreakUpdate(lastActivityDate, now, currentStreak, longestStreak, tier) {
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
        const hoursSince = this.getHoursSince(lastActivityDate, now);
        const daysDiff = Math.floor(hoursSince / 24);
        // Same day - no streak change
        if (this.isSameDay(lastActivityDate, now)) {
            return {
                isValid: true,
                current: currentStreak,
                longest: longestStreak,
                message: '✅ Daily goal maintained',
                shouldReset: false,
            };
        }
        // Consecutive day (within 24-48 hours)
        if (daysDiff === 1 || (hoursSince >= 24 && hoursSince <= 48)) {
            const newStreak = currentStreak + 1;
            const newLongest = Math.max(longestStreak, newStreak);
            return {
                isValid: true,
                current: newStreak,
                longest: newLongest,
                message: `🔥 ${newStreak}-day streak!`,
                shouldReset: false,
                leveledUp: newStreak > longestStreak,
                xpEarned: this.calculateStreakXP(newStreak),
            };
        }
        // Check grace period
        const gracePeriodHours = GRACE_PERIODS[tier];
        const deadlineHours = 24 + gracePeriodHours;
        if (hoursSince <= deadlineHours) {
            // Within grace period - save streak
            const newStreak = currentStreak + 1;
            const newLongest = Math.max(longestStreak, newStreak);
            return {
                isValid: true,
                current: newStreak,
                longest: newLongest,
                message: `⚡ Streak saved within grace period! ${newStreak} days`,
                shouldReset: false,
                gracePeriodRemaining: deadlineHours - hoursSince,
                xpEarned: this.calculateStreakXP(newStreak),
            };
        }
        // ❌ Streak broken - reset to 1
        return {
            isValid: false,
            current: 1,
            longest: longestStreak, // Keep longest streak
            message: `💔 ${currentStreak}-day streak ended. Starting fresh!`,
            shouldReset: true,
            xpEarned: 5, // Consolation XP
        };
    }
    /**
     * Update Progress document with new streak data
     */
    async updateProgressDocument(progress, result, now, minutesPracticed, messagesCount) {
        // Update streak data
        progress.streak.current = result.current;
        progress.streak.longest = result.longest;
        progress.streak.lastActivityDate = now;
        // Update today's progress
        if (!progress.streak.todayProgress) {
            progress.streak.todayProgress = {
                minutesPracticed: 0,
                messagesCount: 0,
                activitiesCompleted: [],
                goalMet: false,
                lastUpdated: now,
            };
        }
        progress.streak.todayProgress.minutesPracticed += minutesPracticed;
        progress.streak.todayProgress.messagesCount += messagesCount;
        progress.streak.todayProgress.lastUpdated = now;
        progress.streak.todayProgress.goalMet =
            progress.streak.todayProgress.minutesPracticed >= MIN_MINUTES_REQUIRED &&
                progress.streak.todayProgress.messagesCount >= MIN_MESSAGES_REQUIRED;
        if (!progress.streak.todayProgress.activitiesCompleted.includes('ai_chat')) {
            progress.streak.todayProgress.activitiesCompleted.push('ai_chat');
        }
        // Add XP if earned
        if (result.xpEarned && result.xpEarned > 0) {
            await progress.addXP(result.xpEarned, 'streak', 'streak');
        }
        // Update streak start date if new streak
        if (result.current === 1 && result.shouldReset) {
            progress.streak.streakStartDate = now;
        }
        // Update total streak days
        if (result.isValid && !this.isSameDay(progress.streak.lastActivityDate, now)) {
            progress.streak.totalStreakDays = (progress.streak.totalStreakDays || 0) + 1;
        }
        // Save to database
        await progress.save();
        logger.info({ userId: progress.userId.toString() }, '💾 Streak saved to database');
    }
    /**
     * Create new Progress document for user
     */
    async createProgressDocument(userId) {
        const progress = new Progress({
            userId,
            totalXP: 0,
            currentLevel: 1,
            currentLevelXP: 0,
            xpToNextLevel: 100,
            streak: {
                current: 0,
                longest: 0,
                lastActivityDate: null,
                streakStartDate: null,
                totalStreakDays: 0,
                todayProgress: {
                    minutesPracticed: 0,
                    messagesCount: 0,
                    activitiesCompleted: [],
                    goalMet: false,
                    lastUpdated: null,
                },
            },
        });
        await progress.save();
        logger.info({ userId: userId.toString() }, '📊 Created new Progress document');
        return progress;
    }
    /**
     * Check streak status without updating
     */
    async checkStreakStatus(userId, tier) {
        const userIdStr = userId.toString();
        try {
            // Try cache first
            const cached = await this.getFromCache(userIdStr);
            if (cached) {
                return cached;
            }
            const progress = await Progress.findOne({ userId }).lean();
            if (!progress || !progress.streak.lastActivityDate) {
                return {
                    current: 0,
                    longest: progress?.streak.longest || 0,
                    lastActivityDate: null,
                    hoursUntilDeadline: 24,
                    isAtRisk: false,
                    message: 'No active streak',
                    goalProgress: {
                        minutesPracticed: 0,
                        messagesCount: 0,
                        goalMet: false,
                    },
                };
            }
            const now = new Date();
            const hoursSince = this.getHoursSince(progress.streak.lastActivityDate, now);
            const gracePeriodHours = GRACE_PERIODS[tier];
            const deadlineHours = 24 + gracePeriodHours;
            const hoursUntilDeadline = Math.max(0, deadlineHours - hoursSince);
            const isAtRisk = hoursSince > 18 && hoursSince < deadlineHours;
            let message = '✅ Streak safe';
            if (hoursUntilDeadline === 0) {
                message = '❌ Streak expired';
            }
            else if (isAtRisk) {
                message = `⚠️ ${Math.round(hoursUntilDeadline)}h remaining`;
            }
            const result = {
                current: progress.streak.current,
                longest: progress.streak.longest,
                lastActivityDate: progress.streak.lastActivityDate,
                hoursUntilDeadline,
                isAtRisk,
                message,
                goalProgress: {
                    minutesPracticed: progress.streak.todayProgress?.minutesPracticed || 0,
                    messagesCount: progress.streak.todayProgress?.messagesCount || 0,
                    goalMet: progress.streak.todayProgress?.goalMet || false,
                },
            };
            // Cache result
            await this.cacheResult(userIdStr, result);
            return result;
        }
        catch (error) {
            logger.error({ userId: userIdStr, error }, '❌ Failed to check streak status');
            throw error;
        }
    }
    /**
     * Calculate XP reward based on streak length
     */
    calculateStreakXP(streakDays) {
        if (streakDays <= 0)
            return 0;
        // Base: 10 XP per day
        let xp = 10;
        // Milestones
        if (streakDays >= 7)
            xp += 50; // 1 week bonus
        if (streakDays >= 14)
            xp += 75; // 2 week bonus
        if (streakDays >= 30)
            xp += 100; // 1 month bonus
        if (streakDays >= 60)
            xp += 200; // 2 month bonus
        if (streakDays >= 100)
            xp += 500; // 100 day bonus
        return xp;
    }
    /**
     * Helper: Check if same day
     */
    isSameDay(date1, date2) {
        return (date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate());
    }
    /**
     * Helper: Calculate hours since last activity
     */
    getHoursSince(lastDate, now) {
        return (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
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
                const hoursSince = this.getHoursSince(progress.streak.lastActivityDate, now);
                // Progress.tier in the schema is stored as a number (1-6).
                // Map numeric tiers to 'free'|'pro'|'premium' for grace period lookup.
                const numericTier = progress.tier;
                const tierKey = numericTier === undefined
                    ? 'free'
                    : numericTier <= 2
                        ? 'free'
                        : numericTier <= 4
                            ? 'pro'
                            : 'premium';
                const gracePeriodHours = GRACE_PERIODS[tierKey];
                const deadlineHours = 24 + gracePeriodHours;
                if (hoursSince > deadlineHours) {
                    // Streak expired - reset to 0
                    progress.streak.current = 0;
                    progress.streak.streakStartDate = null;
                    await progress.save();
                    broken++;
                    logger.info({ userId: progress.userId.toString() }, '💔 Streak reset to 0 (expired)');
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
}
// Singleton export
export const enhancedStreakService = new EnhancedStreakService();
export default enhancedStreakService;
//# sourceMappingURL=enhancedStreakService.js.map