/**
 * 🚀 FAST ACCURACY API ENDPOINTS
 * High-performance accuracy endpoints with in-memory caching
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth/auth.js';
import { fastAccuracyCache } from '../../services/Accuracy/index.js';

const router = Router();

/**
 * GET /api/accuracy/fast/init
 * Initialize user's accuracy cache (called on login/page load)
 */
router.get('/fast/init', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`🔄 [FastAccuracy API] Initializing user ${userId.substring(0, 8)}...`);

    const metrics = await fastAccuracyCache.initializeUser(userId);

    res.status(200).json({
      success: true,
      data: {
        overall: metrics.overall,
        grammar: metrics.grammar,
        vocabulary: metrics.vocabulary,
        spelling: metrics.spelling,
        fluency: metrics.fluency,
        punctuation: metrics.punctuation,
        capitalization: metrics.capitalization,
        syntax: metrics.syntax,
        coherence: metrics.coherence,
        messageCount: metrics.messageCount,
        lastUpdated: metrics.lastUpdated,
      },
      source: 'cache',
    });
  } catch (error) {
    console.error('❌ [FastAccuracy API] Init error:', error);
    res.status(500).json({ error: 'Failed to initialize accuracy cache' });
  }
});

/**
 * GET /api/accuracy/fast/current
 * Get current accuracy from cache (instant, no DB query)
 */
router.get('/fast/current', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metrics = fastAccuracyCache.getAccuracy(userId);

    if (!metrics) {
      res.status(404).json({ error: 'User not initialized. Call /fast/init first.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        overall: metrics.overall,
        grammar: metrics.grammar,
        vocabulary: metrics.vocabulary,
        spelling: metrics.spelling,
        fluency: metrics.fluency,
        punctuation: metrics.punctuation,
        capitalization: metrics.capitalization,
        syntax: metrics.syntax,
        coherence: metrics.coherence,
        messageCount: metrics.messageCount,
        lastUpdated: metrics.lastUpdated,
      },
      source: 'memory',
      responseTime: '<1ms',
    });
  } catch (error) {
    console.error('❌ [FastAccuracy API] Get current error:', error);
    res.status(500).json({ error: 'Failed to get accuracy' });
  }
});

/**
 * POST /api/accuracy/fast/save
 * Force save accuracy to database (called on logout/tab-switch)
 */
router.post('/fast/save', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`💾 [FastAccuracy API] Force saving user ${userId.substring(0, 8)}...`);

    const saved = await fastAccuracyCache.forceSave(userId);

    if (saved) {
      res.status(200).json({
        success: true,
        message: 'Accuracy saved to database',
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'No changes to save',
      });
    }
  } catch (error) {
    console.error('❌ [FastAccuracy API] Save error:', error);
    res.status(500).json({ error: 'Failed to save accuracy' });
  }
});

/**
 * POST /api/accuracy/fast/cleanup
 * Cleanup user from cache (called on logout)
 */
router.post('/fast/cleanup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`🧹 [FastAccuracy API] Cleaning up user ${userId.substring(0, 8)}...`);

    await fastAccuracyCache.cleanup(userId);

    res.status(200).json({
      success: true,
      message: 'Cache cleaned up',
    });
  } catch (error) {
    console.error('❌ [FastAccuracy API] Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup cache' });
  }
});

export default router;
