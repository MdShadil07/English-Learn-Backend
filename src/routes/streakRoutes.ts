/**
 * Streak Routes
 * Endpoints for streak management
 */

import express from 'express';
import { authenticate } from '../middleware/auth/auth.js';
import {
  updateStreak,
  getStreakStatus,
  getStreakStats,
  logDailyPractice,
  resetExpiredStreaks,
} from '../controllers/streakController.js';

const router = express.Router();

/**
 * @route   PUT /api/streak/update
 * @desc    Update user's streak after practice session
 * @access  Private
 */
router.put('/update', authenticate, updateStreak);

/**
 * @route   GET /api/streak/status
 * @desc    Get current streak status
 * @access  Private
 */
router.get('/status', authenticate, getStreakStatus);

/**
 * @route   GET /api/streak/stats
 * @desc    Get streak statistics
 * @access  Private
 */
router.get('/stats', authenticate, getStreakStats);

/**
 * @route   POST /api/streak/log
 * @desc    Log daily practice session
 * @access  Private
 */
router.post('/log', authenticate, logDailyPractice);

/**
 * @route   POST /api/streak/reset-expired
 * @desc    Admin endpoint to reset expired streaks
 * @access  Private (Admin only)
 */
router.post('/reset-expired', authenticate, resetExpiredStreaks);

export default router;
