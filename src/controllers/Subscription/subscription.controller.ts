import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import User from '../../models/User.js';
import * as razorpaySub from '../../services/razorpay.subscription.service.js';
import { redisCache } from '../../config/redis.js';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Subscription Controller
 * Handles subscription plan retrieval, status checks, and cancellation.
 */
export class SubscriptionController {

  /**
   * Get all active subscription plans
   */
  async getPlans(req: Request, res: Response) {
    try {
      const plans = await SubscriptionPlan.findActivePlans();
      return res.json({
        success: true,
        data: { plans },
      });
    } catch (error) {
      console.error('Error fetching plans:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription plans',
      });
    }
  }

  /**
   * Get plans by tier
   */
  async getPlansByTier(req: Request, res: Response) {
    try {
      const { tier } = req.params;
      if (!['pro', 'premium'].includes(tier)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tier. Must be "pro" or "premium"',
        });
      }

      const plans = await SubscriptionPlan.findByTier(tier as 'pro' | 'premium');
      return res.json({
        success: true,
        data: { tier, plans },
      });
    } catch (error) {
      console.error('Error fetching plans by tier:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription plans',
      });
    }
  }

  /**
   * Get user subscription status
   * Returns the authoritative status from the Subscription collection.
   */
  async getSubscription(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const sub = await Subscription.findActiveByUserId(req.user._id);
      
      // If no active subscription, return free tier status
      if (!sub) {
        return res.json({
          success: true,
          data: {
            tier: 'free',
            isPremium: false,
            features: this.getTierFeatures('free'),
            subscription: null,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          tier: sub.tier,
          isPremium: sub.tier === 'premium' || sub.tier === 'pro',
          features: this.getTierFeatures(sub.tier),
          subscription: sub.toObject(),
        },
      });

    } catch (error) {
      console.error('Get subscription status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get subscription status',
      });
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { reason } = req.body;
      const subscription = await Subscription.findActiveByUserId(req.user._id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      // If it's a Razorpay subscription, cancel it there too
      if (subscription.razorpay && subscription.razorpay.subscriptionId) {
        try {
          // Cancel at cycle end by default to let user finish their paid term
          await razorpaySub.cancelSubscription(subscription.razorpay.subscriptionId, false); 
        } catch (rpError) {
          console.error('Error cancelling Razorpay subscription:', rpError);
          // Continue to cancel locally even if Razorpay fails (or maybe it's already cancelled)
        }
      }

      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.reason = reason || 'User requested cancellation';
      await subscription.save();

      // Update User model metadata
      await User.findByIdAndUpdate(req.user._id, {
        'subscription.status': 'none', // or 'expired' or 'active' depending on logic, but 'none' implies no active sub
        // We might want to keep it active until endAt, but for now let's mark as none/canceled
      });

      // Invalidate cache
      if (redisCache) {
        const cacheKey = redisCache.getUserCacheKey(req.user._id.toString());
        await redisCache.del(cacheKey);
      }

      return res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        data: { subscription },
      });

    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel subscription',
      });
    }
  }

  /**
   * Activate a subscription (Manual/Free/Alternative flow)
   */
  async activateSubscription(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { planId, paymentMethod, transactionId } = req.body;

      if (!planId) {
        return res.status(400).json({ success: false, message: 'Plan ID is required' });
      }

      const plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.isActive) {
        return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
      }

      // Cancel existing
      const existing = await Subscription.findActiveByUserId(req.user._id);
      if (existing) {
        existing.status = 'canceled';
        existing.reason = 'Replaced by new subscription';
        await existing.save();
      }

      const startAt = new Date();
      const endAt = new Date();
      if (plan.billingPeriod !== 'lifetime' && plan.durationDays) {
        endAt.setDate(endAt.getDate() + plan.durationDays);
      } else if (plan.billingPeriod === 'lifetime') {
        // endAt remains null or set to null explicitly
      }

      const subscription = await Subscription.create({
        userId: req.user._id,
        planId: plan._id,
        tier: plan.tier,
        planType: plan.billingPeriod, // 'monthly', 'yearly', 'lifetime'
        startAt,
        endAt: plan.billingPeriod === 'lifetime' ? null : endAt,
        status: 'active',
        autoRenew: false,
        paymentMethod: paymentMethod || 'manual',
        transactionId: transactionId || `manual-${Date.now()}`,
      });

      // Update user metadata
      await User.findByIdAndUpdate(req.user._id, {
        'subscription.planCode': plan.code,
        'subscription.status': 'active',
        'subscription.expiresAt': plan.billingPeriod === 'lifetime' ? null : endAt,
        'subscription.subscriptionId': subscription._id,
        'subscription.renewedAt': startAt,
      });

      // Clear cache
      if (redisCache) {
        await redisCache.del(redisCache.getUserCacheKey(req.user._id.toString()));
      }

      return res.json({
        success: true,
        message: 'Subscription activated successfully',
        data: { subscription },
      });

    } catch (error: any) {
      console.error('Error activating subscription:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to activate subscription',
      });
    }
  }

  /**
   * Get active tier for the current user
   */
  async getActiveTier(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const sub = await Subscription.findActiveByUserId(req.user._id);
      const activeTier = sub ? sub.tier : 'free';

      return res.json({
        success: true,
        data: { activeTier },
      });

    } catch (error) {
      console.error('Error fetching active tier:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch active tier',
      });
    }
  }

  /**
   * Activate a test subscription (Admin/Testing)
   */
  async activateTestSubscription(req: AuthRequest, res: Response) {
    try {
      const { userId, tier = 'premium', daysToExpire = 30 } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Find or create a test plan
      let testPlan = await SubscriptionPlan.findOne({ name: `Test ${tier} Plan` });
      if (!testPlan) {
        testPlan = await SubscriptionPlan.create({
          code: `TEST_${tier.toUpperCase()}`,
          name: `Test ${tier} Plan`,
          billingPeriod: 'monthly',
          tier,
          durationDays: daysToExpire,
          price: 0,
          currency: 'USD',
          description: `Test subscription plan for ${tier} tier`,
          features: { maxProjects: 100, aiMessages: 1000, prioritySupport: true },
          isActive: true,
        });
      }

      // Cancel existing
      const existing = await Subscription.findActiveByUserId(user._id);
      if (existing) {
        existing.status = 'canceled';
        existing.reason = 'Replaced by test subscription';
        await existing.save();
      }

      const startAt = new Date();
      const endAt = new Date();
      endAt.setDate(endAt.getDate() + daysToExpire);

      const subscription = await Subscription.create({
        userId: user._id,
        planId: testPlan._id,
        tier,
        planType: 'manual',
        startAt,
        endAt,
        status: 'active',
        autoRenew: false,
        paymentMethod: 'test',
        transactionId: `test-${Date.now()}`,
      });

      // Update user metadata
      await User.findByIdAndUpdate(user._id, {
        'subscription.planCode': testPlan.code,
        'subscription.status': 'active',
        'subscription.expiresAt': endAt,
        'subscription.subscriptionId': subscription._id,
        'subscription.renewedAt': startAt,
      });

      // Clear cache
      if (redisCache) {
        await redisCache.del(redisCache.getUserCacheKey(userId));
      }

      return res.json({
        success: true,
        message: 'Test subscription activated',
        data: { subscription },
      });

    } catch (error: any) {
      console.error('Error activating test subscription:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to activate test subscription',
      });
    }
  }

  /**
   * Get features available for each tier
   */
  private getTierFeatures(tier: string) {
    const features = {
      free: {
        aiPersonalities: ['basic-tutor'],
        messagesPerDay: 50,
        voiceChat: false,
        advancedAnalytics: false,
        priority: false,
      },
      pro: {
        aiPersonalities: ['basic-tutor', 'conversation-coach', 'grammar-expert'],
        messagesPerDay: 500,
        voiceChat: true,
        advancedAnalytics: true,
        priority: false,
      },
      premium: {
        aiPersonalities: ['basic-tutor', 'conversation-coach', 'grammar-expert', 'business-mentor', 'cultural-guide'],
        messagesPerDay: -1, // unlimited
        voiceChat: true,
        advancedAnalytics: true,
        priority: true,
      },
    };

    return features[tier as keyof typeof features] || features.free;
  }
}

export default new SubscriptionController();
