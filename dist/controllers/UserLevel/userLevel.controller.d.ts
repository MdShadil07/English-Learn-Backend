import { Request, Response } from 'express';
/**
 * User Level Controller
 * Handles user level progression, XP, and skill tracking
 */
export declare class UserLevelController {
    /**
     * Get user level data
     */
    getUserLevel(req: Request, res: Response): Promise<void>;
    /**
     * Initialize user level (create if doesn't exist)
     */
    initializeUserLevel(req: Request, res: Response): Promise<void>;
    /**
     * Add XP to user
     */
    addXP(req: Request, res: Response): Promise<void>;
    /**
     * Update user session (increment session count)
     */
    updateSession(req: Request, res: Response): Promise<void>;
    /**
     * Update user skills
     */
    updateSkills(req: Request, res: Response): Promise<void>;
    /**
     * Get user statistics
     */
    getStats(req: Request, res: Response): Promise<void>;
}
export declare const userLevelController: UserLevelController;
//# sourceMappingURL=userLevel.controller.d.ts.map