/**
 * Streak Controller
 * Handles HTTP requests for streak management
 * NOTE: This controller is not currently in use. The UnifiedStreakService is used via middleware instead.
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth/auth.js';

/**
 * Update streak after practice session
 * @deprecated - Use streakTracking middleware instead
 */
export const updateStreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { minutesPracticed, tier } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!minutesPracticed || !tier) {
      res.status(400).json({ error: 'Minutes practiced and tier are required' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Streak update handled by middleware',
      data: null,
    });
  } catch (error) {
    console.error('❌ Error updating streak:', error);
    res.status(500).json({ error: 'Failed to update streak' });
  }
};

/**
 * Get current streak status
 */
export const getStreakStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const tier = req.query.tier as 'free' | 'pro' | 'premium';

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!tier) {
      res.status(400).json({ error: 'Tier is required' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Status check handled by middleware',
      data: null,
    });
  } catch (error) {
    console.error('❌ Error getting streak status:', error);
    res.status(500).json({ error: 'Failed to get streak status' });
  }
};

/**
 * Get streak statistics
 */
export const getStreakStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Stats retrieved via middleware',
      data: null,
    });
  } catch (error) {
    console.error('❌ Error getting streak stats:', error);
    res.status(500).json({ error: 'Failed to get streak stats' });
  }
};

/**
 * Log daily practice session
 */
export const logDailyPractice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { minutesPracticed, messagesCount, accuracyAverage } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (minutesPracticed === undefined || messagesCount === undefined) {
      res.status(400).json({ error: 'Minutes practiced and messages count are required' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Daily practice logged via middleware',
    });
  } catch (error) {
    console.error('❌ Error logging daily practice:', error);
    res.status(500).json({ error: 'Failed to log daily practice' });
  }
};

/**
 * Admin: Reset expired streaks manually
 */
export const resetExpiredStreaks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Expired streaks are reset automatically by cron jobs',
      data: null,
    });
  } catch (error) {
    console.error('❌ Error resetting expired streaks:', error);
    res.status(500).json({ error: 'Failed to reset expired streaks' });
  }
};

export default {
  updateStreak,
  getStreakStatus,
  getStreakStats,
  logDailyPractice,
  resetExpiredStreaks,
};
