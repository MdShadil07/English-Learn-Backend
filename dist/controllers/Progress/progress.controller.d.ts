import { Request, Response } from 'express';
/**
 * Progress Controller
 * Handles XP calculations, level progression, and progress tracking
 */
export declare class ProgressController {
    /**
     * Calculate XP reward for action
     */
    calculateXPReward(req: Request, res: Response): Promise<void>;
    /**
     * Get level information
     */
    getLevelInfo(req: Request, res: Response): Promise<void>;
    /**
     * Calculate XP for specific level
     */
    calculateXPForLevel(req: Request, res: Response): Promise<void>;
    /**
     * Calculate XP for next level
     */
    calculateXPForNextLevel(req: Request, res: Response): Promise<void>;
    /**
     * Calculate level from total XP
     */
    calculateLevelFromXP(req: Request, res: Response): Promise<void>;
    /**
     * Calculate current level XP
     */
    calculateCurrentLevelXP(req: Request, res: Response): Promise<void>;
    /**
     * Calculate XP to next level
     */
    calculateXPToNextLevel(req: Request, res: Response): Promise<void>;
    /**
     * Check level up
     */
    checkLevelUp(req: Request, res: Response): Promise<void>;
    /**
     * Calculate total XP for level
     */
    calculateTotalXPForLevel(req: Request, res: Response): Promise<void>;
    /**
     * Update user progress
     */
    updateProgress(req: Request, res: Response): Promise<void>;
    /**
     * Get user level data
     * @route GET /api/progress/level/:userId
     */
    getUserLevel(req: Request, res: Response): Promise<void>;
    /**
     * Initialize user level (create if doesn't exist)
     * @route POST /api/progress/level/initialize
     */
    initializeUserLevel(req: Request, res: Response): Promise<void>;
    /**
     * Add XP to user
     * @route POST /api/progress/level/:userId/xp
     */
    addXP(req: Request, res: Response): Promise<void>;
    /**
     * Update user session (increment session count)
     * @route POST /api/progress/level/:userId/session
     */
    updateSession(req: Request, res: Response): Promise<void>;
    /**
     * Update user skills
     * @route PUT /api/progress/level/:userId/skills
     */
    updateSkills(req: Request, res: Response): Promise<void>;
    /**
     * Get user statistics
     * @route GET /api/progress/level/:userId/stats
     */
    getStats(req: Request, res: Response): Promise<void>;
}
export declare const progressController: ProgressController;
//# sourceMappingURL=progress.controller.d.ts.map