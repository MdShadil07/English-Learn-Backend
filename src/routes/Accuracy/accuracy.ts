import { Router } from 'express';
import { accuracyController } from '../../controllers/Accuracy/accuracy.controller.js';
import fastAccuracyController from '../../controllers/Accuracy/fastAccuracyController.js';

const router = Router();

/**
 * @route POST /api/accuracy/analyze
 * @desc Analyze message for accuracy with advanced weighted calculation
 * @access Public
 */
router.post('/analyze', accuracyController.analyzeMessage);

/**
 * @route GET /api/accuracy/insights/:userId
 * @desc Get real-time accuracy insights and trends
 * @access Private
 */
router.get('/insights/:userId', accuracyController.getAccuracyInsights);

/**
 * @route GET /api/accuracy/history/:userId
 * @desc Get user's analysis history
 * @access Private
 */
router.get('/history/:userId', accuracyController.getAnalysisHistory);

// 🚀 Fast Accuracy Cache Routes (in-memory, high performance)
router.use('/fast', fastAccuracyController);

export default router;