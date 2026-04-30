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
import { IStreakMilestone } from '../../models/Progress.js';
import { Types } from 'mongoose';
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
export declare class AdvancedStreakService {
    /**
     * Initialize streak settings for new user or update existing
     */
    static initializeStreak(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium'): Promise<void>;
    /**
     * Track AI Chat activity and update streak progress
     */
    static trackAIChatActivity(options: StreakUpdateOptions): Promise<StreakValidationResult>;
    /**
     * Get current streak status
     */
    static getStreakStatus(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium'): Promise<StreakStatusResponse>;
    /**
     * Use streak freeze (Premium only)
     */
    static useStreakFreeze(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium'): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Reset expired streaks (called by cron job)
     */
    static resetExpiredStreaks(): Promise<{
        totalChecked: number;
        totalReset: number;
        resetUsers: string[];
    }>;
    /**
     * Refresh monthly freeze allocations (called on 1st of month)
     */
    static refreshMonthlyFreezes(): Promise<{
        totalRefreshed: number;
    }>;
}
export default AdvancedStreakService;
//# sourceMappingURL=advancedStreakService.d.ts.map