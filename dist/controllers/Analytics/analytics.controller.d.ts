/**
 * 📊 ANALYTICS CONTROLLER
 * Comprehensive analytics endpoints for the dashboard
 * Provides real-time progress, accuracy, XP, and level-up data
 * Uses ProgressOptimizationService for industry-level performance
 */
import { Request, Response } from 'express';
export declare class AnalyticsController {
    /**
     * Get comprehensive analytics data for the dashboard
     * @route GET /api/analytics/dashboard/:userId
     * Uses cached data for < 50ms response time
     */
    getDashboardAnalytics(req: Request, res: Response): Promise<void>;
    /**
     * Get accuracy trends with detailed breakdown
     * @route GET /api/analytics/accuracy-trends/:userId
     */
    getAccuracyTrends(req: Request, res: Response): Promise<void>;
    /**
     * Get XP history and breakdown
     * @route GET /api/analytics/xp-data/:userId
     */
    getXPData(req: Request, res: Response): Promise<void>;
    /**
     * Get level-up history and statistics
     * @route GET /api/analytics/level-stats/:userId
     */
    getLevelStats(req: Request, res: Response): Promise<void>;
    /**
     * Get skills breakdown and performance
     * @route GET /api/analytics/skills/:userId
     */
    getSkillsData(req: Request, res: Response): Promise<void>;
    /**
     * Get category-wise performance
     * @route GET /api/analytics/categories/:userId
     */
    getCategoryData(req: Request, res: Response): Promise<void>;
    /**
     * Get dynamic leaderboard data with filters
     * @route GET /api/analytics/leaderboard
     */
    getLeaderboard(req: Request, res: Response): Promise<void>;
    /**
     * Update accuracy data from chat message
     * @route POST /api/analytics/update-accuracy/:userId
     */
    updateAccuracyData(req: Request, res: Response): Promise<void>;
    private getAccuracyTrendsData;
    private getLevelUpStatsData;
    private getXPBreakdownData;
    private getSkillsOverviewData;
    private getCategoryPerformanceData;
}
export declare const analyticsController: AnalyticsController;
//# sourceMappingURL=analytics.controller.d.ts.map