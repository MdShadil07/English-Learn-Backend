import { Router } from 'express';
import { userLevelController } from '../../controllers/UserLevel/userLevel.controller.js';

const router = Router();

/**
 * @route GET /api/level/:userId
 * @desc Get user level data
 * @access Private
 */
router.get('/:userId', userLevelController.getUserLevel);

/**
 * @route POST /api/level/initialize
 * @desc Initialize user level
 * @access Private
 */
router.post('/initialize', userLevelController.initializeUserLevel);

/**
 * @route POST /api/level/:userId/xp
 * @desc Add XP to user
 * @access Private
 */
router.post('/:userId/xp', userLevelController.addXP);

/**
 * @route POST /api/level/:userId/session
 * @desc Update user session
 * @access Private
 */
router.post('/:userId/session', userLevelController.updateSession);

/**
 * @route PUT /api/level/:userId/skills
 * @desc Update user skills
 * @access Private
 */
router.put('/:userId/skills', userLevelController.updateSkills);

/**
 * @route GET /api/level/:userId/stats
 * @desc Get user statistics
 * @access Private
 */
router.get('/:userId/stats', userLevelController.getStats);

export default router;
