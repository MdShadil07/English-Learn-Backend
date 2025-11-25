import { Router } from 'express';
import subscriptionController from '../../controllers/Subscription/subscription.controller.js';
import { authenticate } from '../../middleware/auth/auth.js';

const router = Router();

/**
 * Subscription Routes - New Production-Grade System
 */

// Public routes - get available plans
router.get('/plans', subscriptionController.getPlans.bind(subscriptionController));
router.get('/plans/:tier', subscriptionController.getPlansByTier.bind(subscriptionController));

// Protected routes - user subscription management
router.post('/activate', authenticate, subscriptionController.activateSubscription.bind(subscriptionController));
router.post('/cancel', authenticate, subscriptionController.cancelSubscription.bind(subscriptionController));
router.get('/current', authenticate, subscriptionController.getSubscription.bind(subscriptionController));
router.get('/active-tier', authenticate, subscriptionController.getActiveTier.bind(subscriptionController));

// Testing/Admin endpoint
router.post('/test-activate', subscriptionController.activateTestSubscription.bind(subscriptionController));

export default router;
