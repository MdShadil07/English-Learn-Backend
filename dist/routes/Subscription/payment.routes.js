import express, { Router } from 'express';
import { createOrderHandler, webhookHandler, createSubscriptionHandler, confirmPaymentHandler, subscriptionSseHandler, taxPreviewHandler, createSubscriptionProductionHandler, getPlansHandler, getMySubscriptionHandler, getPaymentHandler } from '../../controllers/Subscription/payment.controller.js';
import { getPricingConfig } from '../../controllers/Subscription/pricing.controller.js';
import { authenticate } from '../../middleware/auth/auth.js';
import bodyParser from 'body-parser';
import security from '../../middleware/security/security.js';
const router = Router();
// JSON body for small requests
router.post('/create-order', security.sanitizeInput, security.sensitiveRateLimit, createOrderHandler);
router.post('/subscribe', security.sanitizeInput, security.sensitiveRateLimit, createSubscriptionHandler);
// Production subscription (recurring) - create gateway subscription and return id for client checkout
router.post('/create-subscription', express.json(), security.sanitizeInput, security.sensitiveRateLimit, authenticate, createSubscriptionProductionHandler);
// Public: list active subscription plans
router.get('/plans', express.json(), getPlansHandler);
// Public: get pricing configuration from environment variables
router.get('/pricing-config', getPricingConfig);
// Get current user's subscription
router.get('/my-subscription', authenticate, getMySubscriptionHandler);
// Confirm a payment after client checkout (verifies server-side and provisions subscription)
router.post('/confirm', express.json(), security.sanitizeInput, security.sensitiveRateLimit, confirmPaymentHandler);
// Razorpay webhooks require raw body for signature verification - use bodyParser.raw
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res, next) => {
    // convert raw body to json and attach to req.body for controller
    try {
        // bodyParser.raw is used so we must parse it here
        const json = JSON.parse(req.body.toString('utf8'));
        req.body = json;
    }
    catch (e) {
        // fall through
    }
    return webhookHandler(req, res);
});
// SSE endpoint for subscription updates (requires authentication)
router.get('/sse', authenticate, (req, res, next) => subscriptionSseHandler(req, res));
router.get('/payment/:id', getPaymentHandler);
// Tax preview (no persistence)
router.post('/tax-preview', express.json(), taxPreviewHandler);
export default router;
//# sourceMappingURL=payment.routes.js.map