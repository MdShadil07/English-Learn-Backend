import { Router } from 'express';
import { authenticate } from '../../middleware/auth/auth.js';
import { userLevelController } from '../../controllers/UserLevel/index.js';
import { userController } from '../../controllers/user.controller.js';
import { validateUserProfileUpdate } from '../../middleware/validation/validation.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route GET /api/user/stats
 * @desc Get user statistics
 * @access Private
 */
router.get('/stats', userLevelController.getStats);

/**
 * @route GET /api/user/level
 * @desc Get user level data
 * @access Private
 */
router.get('/level', userLevelController.getUserLevel);

/**
 * @route GET /api/user/profile
 * @desc Get current user profile data
 * @access Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route PUT /api/user/profile
 * @desc Update user profile (firstName, lastName, username)
 * @access Private
 */
router.put('/profile', validateUserProfileUpdate, userController.updateProfile);

/**
 * @route POST /api/user/initialize
 * @desc Initialize user level data
 * @access Private
 */
router.post('/initialize', userLevelController.initializeUserLevel);

/**
 * @route POST /api/user/xp
 * @desc Add XP to user
 * @access Private
 */
router.post('/xp', userLevelController.addXP);

/**
 * @route PUT /api/user/session
 * @desc Update user session
 * @access Private
 */
router.put('/session', userLevelController.updateSession);

/**
 * @route PUT /api/user/skills
 * @desc Update user skills
 * @access Private
 */
router.put('/skills', userLevelController.updateSkills);

export default router;
