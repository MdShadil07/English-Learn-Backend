/**
 * Streak Controller
 * Handles HTTP requests for streak management
 * NOTE: This controller is not currently in use. The UnifiedStreakService is used via middleware instead.
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth/auth.js';
/**
 * Update streak after practice session
 * @deprecated - Use streakTracking middleware instead
 */
export declare const updateStreak: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Get current streak status
 */
export declare const getStreakStatus: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Get streak statistics
 */
export declare const getStreakStats: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Log daily practice session
 */
export declare const logDailyPractice: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Admin: Reset expired streaks manually
 */
export declare const resetExpiredStreaks: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    updateStreak: (req: AuthRequest, res: Response) => Promise<void>;
    getStreakStatus: (req: AuthRequest, res: Response) => Promise<void>;
    getStreakStats: (req: AuthRequest, res: Response) => Promise<void>;
    logDailyPractice: (req: AuthRequest, res: Response) => Promise<void>;
    resetExpiredStreaks: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=streakController.d.ts.map