/**
 * 🔥 STREAK BREAK DETECTION & AUTO-RESET SERVICE
 * Automatically detects and handles streak breaks based on daily goals
 */
import { Types } from 'mongoose';
interface StreakBreakResult {
    userId: string;
    previousStreak: number;
    newStreak: number;
    reason: 'time_expired' | 'goal_not_met' | 'manual_reset';
    longestPreserved: number;
}
export declare class StreakBreakDetectionService {
    /**
     * Check if user met daily goal requirements
     */
    static checkDailyGoalMet(userId: string | Types.ObjectId): Promise<boolean>;
    /**
     * Reset streak to 0 when user fails to meet goal
     */
    static resetStreakForGoalNotMet(userId: string | Types.ObjectId): Promise<StreakBreakResult | null>;
    /**
     * Reset streak due to time expiration (past grace period)
     */
    static resetStreakForTimeExpired(userId: string | Types.ObjectId, gracePeriodHours: number): Promise<StreakBreakResult | null>;
    /**
     * Batch check and reset expired streaks
     */
    static batchResetExpiredStreaks(): Promise<{
        checked: number;
        reset: number;
        preserved: number;
    }>;
    /**
     * Get users who are about to lose their streak (warning system)
     */
    static getUsersAtRisk(hoursThreshold?: number): Promise<Array<{
        userId: string;
        streak: number;
        hoursRemaining: number;
    }>>;
    /**
     * Reset today's progress at midnight (for all users)
     */
    static resetDailyProgress(): Promise<number>;
}
export default StreakBreakDetectionService;
//# sourceMappingURL=streakBreakDetectionService.d.ts.map