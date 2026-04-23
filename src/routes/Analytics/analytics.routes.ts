/**
 * 📊 ANALYTICS ROUTES
 * Comprehensive analytics endpoints for the dashboard
 */

import { Router } from 'express';
import { analyticsController } from '../../controllers/Analytics/analytics.controller.js';
import { authenticate } from '../../middleware/auth/auth.js';

const router = Router();

/**
 * @route GET /api/analytics/dashboard/:userId
 * @desc Get comprehensive dashboard analytics
 * @access Private
 */
router.get('/dashboard/:userId', authenticate, analyticsController.getDashboardAnalytics.bind(analyticsController));

/**
 * @route GET /api/analytics/accuracy-trends/:userId
 * @desc Get accuracy trends with detailed breakdown
 * @access Private
 */
router.get('/accuracy-trends/:userId', authenticate, analyticsController.getAccuracyTrends.bind(analyticsController));

/**
 * @route GET /api/analytics/xp-data/:userId
 * @desc Get XP history and breakdown
 * @access Private
 */
router.get('/xp-data/:userId', authenticate, analyticsController.getXPData.bind(analyticsController));

/**
 * @route GET /api/analytics/level-stats/:userId
 * @desc Get level-up history and statistics
 * @access Private
 */
router.get('/level-stats/:userId', authenticate, analyticsController.getLevelStats.bind(analyticsController));

/**
 * @route GET /api/analytics/skills/:userId
 * @desc Get skills breakdown and performance
 * @access Private
 */
router.get('/skills/:userId', authenticate, analyticsController.getSkillsData.bind(analyticsController));

/**
 * @route GET /api/analytics/categories/:userId
 * @desc Get category-wise performance
 * @access Private
 */
router.get('/categories/:userId', authenticate, analyticsController.getCategoryData.bind(analyticsController));

/**
 * @route GET /api/analytics/leaderboard
 * @desc Get global leaderboard analytics
 * @access Private
 */
router.get('/leaderboard', authenticate, analyticsController.getLeaderboard.bind(analyticsController));

/**
 * @route POST /api/analytics/update-accuracy/:userId
 * @desc Update accuracy data from chat message
 * @access Private
 */
router.post('/update-accuracy/:userId', authenticate, analyticsController.updateAccuracyData.bind(analyticsController));

export default router;
