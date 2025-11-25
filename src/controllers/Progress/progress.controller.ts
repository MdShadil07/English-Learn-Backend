import { Request, Response } from 'express';
import { UserLevel } from '../../models/index.js';
import {
  calculateTotalXP,
  getLevelInfo,
  calculateXPForLevel,
  calculateXPForNextLevel,
  calculateLevelFromXP,
  calculateCurrentLevelXP,
  calculateXPToNextLevel,
  calculateTotalXPForLevel,
  type XPCalculationParams,
} from '../../services/Gamification/index.js';

/**
 * Progress Controller
 * Handles XP calculations, level progression, and progress tracking
 */

export class ProgressController {

  /**
   * Calculate XP reward for action
   */
  async calculateXPReward(req: Request, res: Response) {
    try {
      const {
        baseAmount = 10,
        accuracy = 100,
        streakDays = 0,
        isPremium = false,
        eventMultiplier = 1.0,
        isPerfectMessage = false,
        adaptiveMultiplier = 1.0,
      } = req.body;

      const xpParams: XPCalculationParams = {
        baseAmount,
        accuracy,
        streakDays,
        tierMultiplier: isPremium ? 1.5 : 1.0,
        eventMultiplier,
        isPerfectMessage,
      };

      const reward = calculateTotalXP(xpParams);

      res.json({
        success: true,
        data: reward
      });
    } catch (error) {
      console.error('Error calculating XP reward:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate XP reward'
      });
    }
  }

  /**
   * Get level information
   */
  async getLevelInfo(req: Request, res: Response) {
    try {
      const { totalXP } = req.body;

      const levelInfo = getLevelInfo(totalXP);

      res.json({
        success: true,
        data: levelInfo
      });
    } catch (error) {
      console.error('Error getting level info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get level info'
      });
    }
  }

  /**
   * Calculate XP for specific level
   */
  async calculateXPForLevel(req: Request, res: Response) {
    try {
      const { level } = req.body;

      const xpRequired = calculateXPForLevel(level);

      res.json({
        success: true,
        data: { level, xpRequired }
      });
    } catch (error) {
      console.error('Error calculating XP for level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate XP for level'
      });
    }
  }

  /**
   * Calculate XP for next level
   */
  async calculateXPForNextLevel(req: Request, res: Response) {
    try {
      const { currentLevel } = req.body;

      const xpRequired = calculateXPForNextLevel(currentLevel);

      res.json({
        success: true,
        data: { currentLevel, xpRequired }
      });
    } catch (error) {
      console.error('Error calculating XP for next level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate XP for next level'
      });
    }
  }

  /**
   * Calculate level from total XP
   */
  async calculateLevelFromXP(req: Request, res: Response) {
    try {
      const { totalXP } = req.body;

      const level = calculateLevelFromXP(totalXP);

      res.json({
        success: true,
        data: { totalXP, level }
      });
    } catch (error) {
      console.error('Error calculating level from XP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate level from XP'
      });
    }
  }

  /**
   * Calculate current level XP
   */
  async calculateCurrentLevelXP(req: Request, res: Response) {
    try {
      const { totalXP, currentLevel } = req.body;

      const currentLevelXP = calculateCurrentLevelXP(totalXP, currentLevel);

      res.json({
        success: true,
        data: { totalXP, currentLevel, currentLevelXP }
      });
    } catch (error) {
      console.error('Error calculating current level XP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate current level XP'
      });
    }
  }

  /**
   * Calculate XP to next level
   */
  async calculateXPToNextLevel(req: Request, res: Response) {
    try {
      const { totalXP, currentLevel } = req.body;

      const xpToNext = calculateXPToNextLevel(totalXP, currentLevel);

      res.json({
        success: true,
        data: { totalXP, currentLevel, xpToNext }
      });
    } catch (error) {
      console.error('Error calculating XP to next level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate XP to next level'
      });
    }
  }

  /**
   * Check level up
   */
  async checkLevelUp(req: Request, res: Response) {
    try {
      const { oldXP, newXP } = req.body;

      const leveledUp = calculateLevelFromXP(newXP) > calculateLevelFromXP(oldXP);

      res.json({
        success: true,
        data: { leveledUp }
      });
    } catch (error) {
      console.error('Error checking level up:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check level up'
      });
    }
  }

  /**
   * Calculate total XP for level
   */
  async calculateTotalXPForLevel(req: Request, res: Response) {
    try {
      const { targetLevel } = req.body;

      const totalXP = calculateTotalXPForLevel(targetLevel);

      res.json({
        success: true,
        data: { targetLevel, totalXP }
      });
    } catch (error) {
      console.error('Error calculating total XP for level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate total XP for level'
      });
    }
  }

  /**
   * Update user progress
   */
  async updateProgress(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { xpAmount, accuracy, skills } = req.body;

      // TODO: Implement UserLevel model integration
      // For now, return success with mock data
      const mockProgress = {
        level: 1,
        currentXP: 0,
        totalXP: xpAmount || 0,
        xpToNextLevel: 500,
        progressPercentage: 0,
        skills: {
          accuracy: accuracy || 0,
          vocabulary: 0,
          grammar: 0,
          pronunciation: 0,
          fluency: 0
        }
      };

      res.json({
        success: true,
        data: mockProgress
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update progress'
      });
    }
  }

  // ============================================
  // USER LEVEL METHODS (Consolidated from UserLevelController)
  // ============================================

  /**
   * Get user level data
   * @route GET /api/progress/level/:userId
   */
  async getUserLevel(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      let userLevel = await UserLevel.findOne({ userId });

      if (!userLevel) {
        res.status(404).json({
          success: false,
          message: 'User level not found'
        });
        return;
      }

      res.json({
        success: true,
        data: userLevel
      });
    } catch (error) {
      console.error('Error getting user level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user level'
      });
    }
  }

  /**
   * Initialize user level (create if doesn't exist)
   * @route POST /api/progress/level/initialize
   */
  async initializeUserLevel(req: Request, res: Response): Promise<void> {
    try {
      const { userId, userName, userEmail } = req.body;

      let userLevel = await UserLevel.findOne({ userId });

      if (!userLevel) {
        userLevel = new UserLevel({
          userId,
          userName: userName || 'User',
          userEmail: userEmail || '',
          level: 1,
          currentXP: 0,
          totalXP: 0,
          xpToNextLevel: 500,
          streak: 0,
          totalSessions: 0,
          accuracy: 0,
          vocabulary: 0,
          grammar: 0,
          pronunciation: 0,
          fluency: 0
        });
        await userLevel.save();
      }

      res.json({
        success: true,
        data: userLevel
      });
    } catch (error) {
      console.error('Error initializing user level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize user level'
      });
    }
  }

  /**
   * Add XP to user
   * @route POST /api/progress/level/:userId/xp
   */
  async addXP(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { xpAmount, reason } = req.body;

      let userLevel = await UserLevel.findOne({ userId });

      if (!userLevel) {
        res.status(404).json({
          success: false,
          message: 'User level not found'
        });
        return;
      }

      const oldLevel = userLevel.level;
      const result = userLevel.addXP(xpAmount);
      await userLevel.save();

      console.log(`✅ +${xpAmount} XP awarded to ${userId} for: ${reason || 'unknown'}`);

      res.json({
        success: true,
        data: {
          userLevel,
          xpAdded: xpAmount,
          leveledUp: result.leveledUp,
          previousLevel: oldLevel,
          newLevel: result.newLevel
        }
      });
    } catch (error) {
      console.error('Error adding XP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add XP'
      });
    }
  }

  /**
   * Update user session (increment session count)
   * @route POST /api/progress/level/:userId/session
   */
  async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      let userLevel = await UserLevel.findOne({ userId });

      if (!userLevel) {
        res.status(404).json({
          success: false,
          message: 'User level not found'
        });
        return;
      }

      userLevel.totalSessions += 1;
      userLevel.lastActive = new Date();
      await userLevel.save();

      res.json({
        success: true,
        data: {
          totalSessions: userLevel.totalSessions,
          streak: userLevel.streak
        }
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session'
      });
    }
  }

  /**
   * Update user skills
   * @route PUT /api/progress/level/:userId/skills
   */
  async updateSkills(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const skills = req.body;

      let userLevel = await UserLevel.findOne({ userId });

      if (!userLevel) {
        res.status(404).json({
          success: false,
          message: 'User level not found'
        });
        return;
      }

      // Update only provided skills
      if (skills.accuracy !== undefined) userLevel.accuracy = skills.accuracy;
      if (skills.vocabulary !== undefined) userLevel.vocabulary = skills.vocabulary;
      if (skills.grammar !== undefined) userLevel.grammar = skills.grammar;
      if (skills.pronunciation !== undefined) userLevel.pronunciation = skills.pronunciation;
      if (skills.fluency !== undefined) userLevel.fluency = skills.fluency;

      userLevel.lastActive = new Date();
      await userLevel.save();

      res.json({
        success: true,
        data: userLevel
      });
    } catch (error) {
      console.error('Error updating skills:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update skills'
      });
    }
  }

  /**
   * Get user statistics
   * @route GET /api/progress/level/:userId/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      let userLevel = await UserLevel.findOne({ userId });

      if (!userLevel) {
        res.status(404).json({
          success: false,
          message: 'User level not found'
        });
        return;
      }

      const stats = {
        level: userLevel.level,
        totalXP: userLevel.totalXP,
        currentXP: userLevel.currentXP,
        xpToNextLevel: userLevel.xpToNextLevel,
        progressPercentage: userLevel.totalXP > 0
          ? Math.round((userLevel.currentXP / userLevel.xpToNextLevel) * 100)
          : 0,
        streak: userLevel.streak,
        totalSessions: userLevel.totalSessions,
        averageSkill: Math.round(
          (userLevel.accuracy + userLevel.vocabulary + userLevel.grammar +
           userLevel.pronunciation + userLevel.fluency) / 5
        ),
        skills: {
          accuracy: userLevel.accuracy,
          vocabulary: userLevel.vocabulary,
          grammar: userLevel.grammar,
          pronunciation: userLevel.pronunciation,
          fluency: userLevel.fluency
        }
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get stats'
      });
    }
  }
}

export const progressController = new ProgressController();
