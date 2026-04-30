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
import { IStreakMilestone } from '../../models/Progress.js';
import { Types } from 'mongoose';
export interface StreakValidationResult {
    isValid: boolean;
    current: number;
    longest: number;
    message: string;
    shouldReset: boolean;
    gracePeriodRemaining?: number;
    leveledUp?: boolean;
    xpEarned?: number;
    milestone?: IStreakMilestone;
}
export interface StreakUpdate {
    userId: string | Types.ObjectId;
    minutesPracticed: number;
    messagesCount: number;
    tier: 'free' | 'pro' | 'premium';
    activityType?: string;
    accuracyScore?: number;
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
declare class UnifiedStreakService {
    /**
     * 🎯 Main method: Update streak with full validation and DB persistence
     * Combines basic streak logic + milestone tracking
     */
    updateStreak(data: StreakUpdate): Promise<StreakValidationResult>;
    /**
     * Calculate streak update based on time difference
     * Includes milestone detection
     */
    private calculateStreakUpdate;
    /**
     * Update today's progress tracking (from advancedStreakService)
     */
    private updateTodayProgress;
    /**
     * Update Progress document with new streak data
     */
    private updateProgressDocument;
    /**
     * Create new Progress document for user
     */
    private createProgressDocument;
    /**
     * Get comprehensive streak status with all details
     */
    getStreakStatus(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium'): Promise<StreakStatusResponse>;
    /**
     * Use streak freeze (Premium only)
     */
    useStreakFreeze(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium', days?: number): Promise<{
        success: boolean;
        message: string;
        freezeUsed: boolean;
    }>;
    /**
     * Initialize streak settings for new user
     */
    initializeStreak(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium'): Promise<void>;
    /**
     * 🕐 Background job: Validate all streaks and reset expired ones
     */
    validateAllStreaks(): Promise<{
        checked: number;
        broken: number;
        maintained: number;
    }>;
    /**
     * Reset daily progress for all users (called at midnight)
     */
    resetDailyProgress(): Promise<{
        reset: number;
    }>;
    /**
     * Refresh monthly freeze allocations (called on 1st of month)
     */
    refreshMonthlyFreezes(): Promise<{
        totalRefreshed: number;
    }>;
    /**
     * Check streak status (simple version)
     */
    checkStreakStatus(userId: string | Types.ObjectId): Promise<StreakValidationResult>;
    /**
     * Calculate XP earned for streak
     */
    private calculateStreakXP;
    /**
     * Cache streak data
     */
    private cacheResult;
    /**
     * Get from cache
     */
    private getFromCache;
    /**
     * Clear cache
     */
    private clearCache;
}
export declare const unifiedStreakService: UnifiedStreakService;
export { UnifiedStreakService };
export default unifiedStreakService;
//# sourceMappingURL=unifiedStreakService.d.ts.map