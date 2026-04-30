/**
 * 🔥 ADVANCED STREAK CONTROLLER
 * HTTP endpoints for advanced streak management
 *
 * Features:
 * - Real-time streak status
 * - Manual activity tracking
 * - Streak freeze (Premium)
 * - Milestone tracking
 * - Analytics and statistics
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth/auth.js';
/**
 * Get comprehensive streak status
 * GET /api/streak/status
 */
export declare const getAdvancedStreakStatus: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Manually track activity (for non-AI chat activities)
 * POST /api/streak/track
 * Body: { minutesPracticed, messagesCount, activityType, accuracyScore }
 */
export declare const trackStreakActivity: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Use streak freeze (Premium only)
 * POST /api/streak/freeze
 */
export declare const useStreakFreeze: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Initialize streak for user
 * POST /api/streak/initialize
 */
export declare const initializeUserStreak: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Get streak tier benefits comparison
 * GET /api/streak/benefits
 */
export declare const getStreakBenefits: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    getAdvancedStreakStatus: (req: AuthRequest, res: Response) => Promise<void>;
    trackStreakActivity: (req: AuthRequest, res: Response) => Promise<void>;
    useStreakFreeze: (req: AuthRequest, res: Response) => Promise<void>;
    initializeUserStreak: (req: AuthRequest, res: Response) => Promise<void>;
    getStreakBenefits: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=advancedStreakController.d.ts.map