import { Request, Response } from 'express';
import { UserLevel } from '../../models/index.js';

/**
 * User Level Controller
 * Handles user level progression, XP, and skill tracking
 */

export class UserLevelController {

  /**
   * Get user level data
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

export const userLevelController = new UserLevelController();
