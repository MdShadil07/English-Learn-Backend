import { Router } from 'express';
import { progressController } from '../../controllers/Progress/progress.controller.js';
import { authenticate } from '../../middleware/auth/auth.js';

const router = Router();

/**
 * @route POST /api/progress/calculate-xp-reward
 * @desc Calculate XP reward for action
 * @access Public
 */
router.post('/calculate-xp-reward', progressController.calculateXPReward);

/**
 * @route POST /api/progress/get-level-info
 * @desc Get level information from total XP
 * @access Public
 */
router.post('/get-level-info', progressController.getLevelInfo);

/**
 * @route POST /api/progress/calculate-xp-for-level
 * @desc Calculate XP required for specific level
 * @access Public
 */
router.post('/calculate-xp-for-level', progressController.calculateXPForLevel);

/**
 * @route POST /api/progress/calculate-xp-for-next-level
 * @desc Calculate XP required for next level
 * @access Public
 */
router.post('/calculate-xp-for-next-level', progressController.calculateXPForNextLevel);

/**
 * @route POST /api/progress/calculate-level-from-xp
 * @desc Calculate level from total XP
 * @access Public
 */
router.post('/calculate-level-from-xp', progressController.calculateLevelFromXP);

/**
 * @route POST /api/progress/calculate-current-level-xp
 * @desc Calculate current XP within level
 * @access Public
 */
router.post('/calculate-current-level-xp', progressController.calculateCurrentLevelXP);

/**
 * @route POST /api/progress/calculate-xp-to-next-level
 * @desc Calculate XP needed for next level
 * @access Public
 */
router.post('/calculate-xp-to-next-level', progressController.calculateXPToNextLevel);

/**
 * @route POST /api/progress/check-level-up
 * @desc Check if user leveled up
 * @access Public
 */
router.post('/check-level-up', progressController.checkLevelUp);

/**
 * @route POST /api/progress/calculate-total-xp-for-level
 * @desc Calculate total XP required for level
 * @access Public
 */
router.post('/calculate-total-xp-for-level', progressController.calculateTotalXPForLevel);

/**
 * @route POST /api/progress/:userId/update
 * @desc Update user progress
 * @access Private
 */
router.post('/:userId/update', authenticate, progressController.updateProgress);

export default router;
