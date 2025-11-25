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
import { AdvancedStreakService } from '../services/Gamification/advancedStreakService.js';
import User from '../models/User.js';

/**
 * Get comprehensive streak status
 * GET /api/streak/status
 */
export const getAdvancedStreakStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user tier
    const user = await User.findById(userId);
    const tier = user?.tier || 'free';

    const status = await AdvancedStreakService.getStreakStatus(userId, tier);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('❌ Error getting advanced streak status:', error);
    res.status(500).json({ error: 'Failed to get streak status' });
  }
};

/**
 * Manually track activity (for non-AI chat activities)
 * POST /api/streak/track
 * Body: { minutesPracticed, messagesCount, activityType, accuracyScore }
 */
export const trackStreakActivity = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { minutesPracticed, messagesCount, activityType, accuracyScore } = req.body;

    // Get user tier
    const user = await User.findById(userId);
    const tier = user?.tier || 'free';

    const result = await AdvancedStreakService.trackAIChatActivity({
      userId,
      tier,
      minutesPracticed,
      messagesCount,
      activityType,
      accuracyScore,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ Error tracking streak activity:', error);
    res.status(500).json({ error: 'Failed to track activity' });
  }
};

/**
 * Use streak freeze (Premium only)
 * POST /api/streak/freeze
 */
export const useStreakFreeze = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user tier
    const user = await User.findById(userId);
    const tier = user?.tier || 'free';

    if (tier !== 'premium') {
      res.status(403).json({ 
        error: 'Premium feature',
        message: 'Streak freeze is available for Premium subscribers only' 
      });
      return;
    }

    const result = await AdvancedStreakService.useStreakFreeze(userId, tier);

    if (!result.success) {
      res.status(400).json({ 
        success: false,
        message: result.message 
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('❌ Error using streak freeze:', error);
    res.status(500).json({ error: 'Failed to use streak freeze' });
  }
};

/**
 * Initialize streak for user
 * POST /api/streak/initialize
 */
export const initializeUserStreak = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user tier
    const user = await User.findById(userId);
    const tier = user?.tier || 'free';

    await AdvancedStreakService.initializeStreak(userId, tier);

    res.status(200).json({
      success: true,
      message: 'Streak initialized successfully',
      tier,
      benefits: {
        free: {
          dailyGoal: '10 minutes + 5 AI messages',
          gracePeriod: 'None',
          freezes: 'None',
        },
        pro: {
          dailyGoal: '10 minutes + 5 AI messages',
          gracePeriod: '3 hours after deadline',
          freezes: 'None',
        },
        premium: {
          dailyGoal: '10 minutes + 5 AI messages',
          gracePeriod: '6 hours after deadline',
          freezes: '2 per month (+ milestone bonuses)',
        },
      }[tier as 'free' | 'pro' | 'premium'],
    });
  } catch (error) {
    console.error('❌ Error initializing streak:', error);
    res.status(500).json({ error: 'Failed to initialize streak' });
  }
};

/**
 * Get streak tier benefits comparison
 * GET /api/streak/benefits
 */
export const getStreakBenefits = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: {
        free: {
          tier: 'Free',
          dailyGoal: {
            minutes: 10,
            messages: 5,
          },
          gracePeriod: {
            hours: 0,
            description: 'None - Strict 24-hour deadline',
          },
          freezes: {
            monthly: 0,
            description: 'Not available',
          },
          milestones: [
            { days: 3, reward: '50 XP' },
            { days: 7, reward: '150 XP + Week Warrior badge' },
            { days: 30, reward: '1000 XP + Month Master badge' },
          ],
        },
        pro: {
          tier: 'Pro',
          dailyGoal: {
            minutes: 10,
            messages: 5,
          },
          gracePeriod: {
            hours: 3,
            description: '3 hours after 24-hour deadline',
          },
          freezes: {
            monthly: 0,
            description: 'Not available',
          },
          milestones: [
            { days: 3, reward: '50 XP' },
            { days: 7, reward: '150 XP + Week Warrior badge' },
            { days: 30, reward: '1000 XP + Month Master badge' },
          ],
          exclusive: [
            '3-hour grace period',
            'Streak recovery window',
            'Priority streak notifications',
          ],
        },
        premium: {
          tier: 'Premium',
          dailyGoal: {
            minutes: 10,
            messages: 5,
          },
          gracePeriod: {
            hours: 6,
            description: '6 hours after 24-hour deadline',
          },
          freezes: {
            monthly: 2,
            description: '2 freezes per month + milestone bonuses',
          },
          milestones: [
            { days: 3, reward: '50 XP' },
            { days: 7, reward: '150 XP + Week Warrior badge' },
            { days: 30, reward: '1000 XP + Month Master badge + 1 Freeze Token' },
            { days: 60, reward: '2500 XP + 1 Freeze Token' },
            { days: 100, reward: '5000 XP + Century Club badge + 2 Freeze Tokens' },
            { days: 365, reward: '50000 XP + Year Champion badge + 5 Freeze Tokens' },
          ],
          exclusive: [
            '6-hour grace period',
            '2 streak freezes per month',
            'Bonus freeze tokens at milestones',
            'Automatic streak protection',
            'Premium streak analytics',
            'Custom streak goals',
          ],
        },
      },
    });
  } catch (error) {
    console.error('❌ Error getting streak benefits:', error);
    res.status(500).json({ error: 'Failed to get benefits' });
  }
};

export default {
  getAdvancedStreakStatus,
  trackStreakActivity,
  useStreakFreeze,
  initializeUserStreak,
  getStreakBenefits,
};
