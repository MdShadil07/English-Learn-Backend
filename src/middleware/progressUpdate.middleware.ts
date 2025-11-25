/**
 * 🔄 PROGRESS UPDATE MIDDLEWARE
 * Optimized middleware for updating progress data from AI chat messages
 * Uses debouncing and caching to reduce database load
 */

import { Request, Response, NextFunction } from 'express';
import { progressOptimizationService } from '../services/Progress/progressOptimizationService.js';
import { IAccuracyData } from '../models/Progress.js';

/**
 * Middleware to update accuracy data after AI chat message
 * Debounces updates to prevent excessive DB writes
 */
export const updateAccuracyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract accuracy data from request body or response locals
    const accuracyResult = res.locals.accuracyResult || req.body.accuracyResult;
    const userId = res.locals.userId || req.body.userId || (req as any).user?.id;

    if (!accuracyResult || !userId) {
      // No accuracy data to update, continue
      next();
      return;
    }

    // Extract accuracy data
    const accuracyData: Partial<IAccuracyData> = {
      overall: accuracyResult.overallScore || accuracyResult.overall,
      adjustedOverall: accuracyResult.adjustedScore || accuracyResult.adjustedOverall,
      grammar: accuracyResult.grammarScore || accuracyResult.grammar,
      vocabulary: accuracyResult.vocabularyScore || accuracyResult.vocabulary,
      spelling: accuracyResult.spellingScore || accuracyResult.spelling,
      fluency: accuracyResult.fluencyScore || accuracyResult.fluency,
      punctuation: accuracyResult.punctuationScore || accuracyResult.punctuation,
      capitalization: accuracyResult.capitalizationScore || accuracyResult.capitalization,
      syntax: accuracyResult.syntaxScore || accuracyResult.syntax,
      coherence: accuracyResult.coherenceScore || accuracyResult.coherence,
      
      totalErrors: accuracyResult.totalErrors || 0,
      criticalErrors: accuracyResult.criticalErrors || 0,
      
      errorsByType: accuracyResult.errorsByCategory || {
        grammar: 0,
        vocabulary: 0,
        spelling: 0,
        punctuation: 0,
        capitalization: 0,
        syntax: 0,
        style: 0,
        coherence: 0,
      },
      
      lastCalculated: new Date(),
      latestSnapshot: {
        overall: accuracyResult.overall,
        grammar: accuracyResult.grammarScore || accuracyResult.grammar || 0,
        vocabulary: accuracyResult.vocabularyScore || accuracyResult.vocabulary || 0,
        spelling: accuracyResult.spellingScore || accuracyResult.spelling || 0,
        fluency: accuracyResult.fluencyScore || accuracyResult.fluency || 0,
        punctuation: accuracyResult.punctuationScore || accuracyResult.punctuation || 0,
        capitalization: accuracyResult.capitalizationScore || accuracyResult.capitalization || 0,
        syntax: accuracyResult.syntaxScore || accuracyResult.syntax || 0,
        coherence: accuracyResult.coherenceScore || accuracyResult.coherence || 0,
        recordedAt: new Date(),
      },
    };

    // Update using optimization service (debounced)
    await progressOptimizationService.updateAccuracyData(
      userId,
      accuracyData,
      { priority: 'medium' }
    );

    // Continue with request
    next();
  } catch (error) {
    console.error('❌ Error in updateAccuracyMiddleware:', error);
    // Don't block the request on error
    next();
  }
};

/**
 * Middleware to add XP after AI chat message
 * Debounces XP updates to batch database writes
 */
export const addXPMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
  const rawXP = res.locals.xpAmount ?? req.body.xpAmount;
  const xpAmount = typeof rawXP === 'number' ? rawXP : Number(rawXP);
    const xpSource = res.locals.xpSource || req.body.xpSource || 'ai_chat';
    const category = res.locals.category || req.body.category;
    const userId = res.locals.userId || req.body.userId || (req as any).user?.id;

    if (!Number.isFinite(xpAmount) || xpAmount === 0 || !userId) {
      next();
      return;
    }

    const resolvedSource = xpAmount >= 0 ? xpSource : 'penalty';

    await progressOptimizationService.addXP(
      userId,
      xpAmount,
      resolvedSource,
      category,
      { immediate: false }
    );

    next();
  } catch (error) {
    console.error('❌ Error in addXPMiddleware:', error);
    next();
  }
};

/**
 * Middleware to handle level-up events
 * Always immediate (high priority)
 */
export const handleLevelUpMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const levelUpData = res.locals.levelUpData;
    const userId = res.locals.userId || (req as any).user?.id;

    if (!levelUpData || !userId) {
      next();
      return;
    }

    // Level-up is always immediate
    await progressOptimizationService.updateLevel(
      userId,
      levelUpData.newLevel,
      levelUpData.rewards
    );

    next();
  } catch (error) {
    console.error('❌ Error in handleLevelUpMiddleware:', error);
    next();
  }
};

/**
 * Invalidate cache on specific events
 * Use this after personality change or page refresh
 */
export const invalidateCacheMiddleware = (dataType?: 'progress' | 'analytics' | 'all') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = res.locals.userId || (req as any).user?.id;

      if (!userId) {
        next();
        return;
      }

      await progressOptimizationService.invalidateCache(userId, dataType);
      next();
    } catch (error) {
      console.error('❌ Error in invalidateCacheMiddleware:', error);
      next();
    }
  };
};

export default {
  updateAccuracyMiddleware,
  addXPMiddleware,
  handleLevelUpMiddleware,
  invalidateCacheMiddleware,
};
