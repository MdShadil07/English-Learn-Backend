/**
 * 🔥 ENHANCED STREAK SERVICE WITH DB SYNC
 * Fixes critical issues:
 * 1. Streaks now properly save to database
 * 2. Automatic streak break when goal not met
 * 3. Longest streak updates correctly
 * 4. Redis caching for performance
 * 5. Background validation jobs
 */
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
}
export interface StreakUpdate {
    userId: string | Types.ObjectId;
    minutesPracticed: number;
    messagesCount: number;
    tier: 'free' | 'pro' | 'premium';
}
declare class EnhancedStreakService {
    /**
     * 🎯 Main method: Update streak with full validation and DB persistence
     */
    updateStreak(data: StreakUpdate): Promise<StreakValidationResult>;
    /**
     * Calculate streak update based on time difference
     */
    private calculateStreakUpdate;
    /**
     * Update Progress document with new streak data
     */
    private updateProgressDocument;
    /**
     * Create new Progress document for user
     */
    private createProgressDocument;
    /**
     * Check streak status without updating
     */
    checkStreakStatus(userId: string | Types.ObjectId, tier: 'free' | 'pro' | 'premium'): Promise<{
        current: number;
        longest: number;
        lastActivityDate: Date | null;
        hoursUntilDeadline: number;
        isAtRisk: boolean;
        message: string;
        goalProgress: {
            minutesPracticed: number;
            messagesCount: number;
            goalMet: boolean;
        };
    }>;
    /**
     * Calculate XP reward based on streak length
     */
    private calculateStreakXP;
    /**
     * Helper: Check if same day
     */
    private isSameDay;
    /**
     * Helper: Calculate hours since last activity
     */
    private getHoursSince;
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
    /**
     * 🕐 Background job: Validate all streaks and reset expired ones
     */
    validateAllStreaks(): Promise<{
        checked: number;
        broken: number;
        maintained: number;
    }>;
}
export declare const enhancedStreakService: EnhancedStreakService;
export default enhancedStreakService;
//# sourceMappingURL=enhancedStreakService.d.ts.map