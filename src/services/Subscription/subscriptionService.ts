import User from '../../models/User.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import { redisCache } from '../../config/redis.js';
import mongoose from 'mongoose';

export class SubscriptionService {
  /**
   * Activate a subscription for a user
   */
  async activateSubscription(
    userId: mongoose.Types.ObjectId,
    planId: mongoose.Types.ObjectId,
    paymentMethod?: string,
    transactionId?: string
  ): Promise<{ subscription: any; user: any }> {
    try {
      // Fetch the plan
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.isActive) {
        throw new Error('Subscription plan not found or is inactive');
      }

      // Calculate start and end dates
      const startAt = new Date();
      const endAt = new Date();
      
      if (plan.billingPeriod !== 'lifetime' && plan.durationDays) {
        endAt.setDate(endAt.getDate() + plan.durationDays);
      }

      // Find and cancel existing active subscription if any
      const existingSubscription = await Subscription.findActiveByUserId(userId);
      if (existingSubscription) {
        existingSubscription.status = 'canceled';
        existingSubscription.canceledAt = new Date();
        existingSubscription.reason = 'Replaced by new subscription';
        await existingSubscription.save();
      }

      // Create new subscription
      const subscription = new Subscription({
        userId,
        planId,
        tier: plan.tier,
        planType: plan.billingPeriod, // Map billingPeriod to planType
        startAt,
        endAt: plan.billingPeriod === 'lifetime' ? null : endAt,
        status: 'active',
        autoRenew: false,
        paymentMethod,
        transactionId,
      });

      await subscription.save();

      // Update user's subscription metadata
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.subscription = {
        planCode: plan.code,
        status: 'active',
        expiresAt: plan.billingPeriod === 'lifetime' ? null : endAt,
        subscriptionId: subscription._id,
        renewedAt: startAt,
      };
      await user.save();

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      console.log(`✅ Subscription activated for user ${userId}: ${plan.name}`);

      return {
        subscription: subscription.toObject(),
        user: user.toObject(),
      };
    } catch (error) {
      console.error('Error activating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription for a user
   */
  async cancelSubscription(
    userId: mongoose.Types.ObjectId,
    reason?: string
  ): Promise<any> {
    try {
      // Find and cancel active subscription
      const subscription = await Subscription.findActiveByUserId(userId);
      if (!subscription) {
        throw new Error('No active subscription found for user');
      }

      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.reason = reason || 'User requested cancellation';
      await subscription.save();

      // Update user's subscription metadata
      const user = await User.findById(userId);
      if (user) {
        user.subscription.status = 'none'; // Or 'canceled' if supported by enum, but 'none' implies no active sub
        // We keep other fields for history or clear them? Usually keep history but status is key.
        // Let's set status to 'none' as per User model default
        await user.save();
      }

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      console.log(`✅ Subscription cancelled for user ${userId}`);

      return subscription.toObject();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Check and revoke expired subscriptions
   */
  async revokeExpiredSubscriptions(): Promise<any[]> {
    try {
      // Find all expired subscriptions
      const expiredSubscriptions = await Subscription.findExpiredSubscriptions();

      const revokedUsers = [];

      for (const subscription of expiredSubscriptions) {
        // Update subscription status
        subscription.status = 'expired';
        await subscription.save();

        // Update user's subscription metadata
        const user = await User.findById(subscription.userId);
        if (user) {
          user.subscription.status = 'expired';
          await user.save();

          // Invalidate user cache
          await this.invalidateUserCache(subscription.userId);

          revokedUsers.push({
            userId: subscription.userId,
            previousTier: subscription.tier,
            expiryDate: subscription.endAt,
          });
        }
      }

      if (revokedUsers.length > 0) {
        console.log(`✅ Revoked ${revokedUsers.length} expired subscriptions`);
      }

      return revokedUsers;
    } catch (error) {
      console.error('Error revoking expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get active tier for a user (considering subscription expiration)
   */
  async getActiveTierForUser(userId: mongoose.Types.ObjectId): Promise<'free' | 'pro' | 'premium'> {
    try {
      // Prefer the authoritative Subscription record
      const subscription = await Subscription.findActiveByUserId(userId);
      if (!subscription) return 'free';
      // If subscription has an end date and it's in the past, treat as free
      if (subscription.endAt && new Date() > subscription.endAt) return 'free';
      return subscription.tier || 'free';
    } catch (error) {
      console.error('Error getting active tier:', error);
      return 'free';
    }
  }

  /**
   * Get subscription details for a user
   */
  async getUserSubscription(userId: mongoose.Types.ObjectId): Promise<any> {
    try {
      const subscription = await Subscription.findActiveByUserId(userId);

      if (!subscription) {
        return {
          hasActiveSubscription: false,
          tier: 'free',
          activeTier: 'free',
        };
      }

      // activeTier is authoritative from subscription record
      const activeTier = subscription.tier || 'free';

      return {
        hasActiveSubscription: true,
        subscription: subscription.toObject(),
        tier: subscription.tier,
        activeTier,
        planType: subscription.planType,
        startAt: subscription.startAt,
        endAt: subscription.endAt,
        daysRemaining: subscription.endAt
          ? Math.ceil((subscription.endAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        isExpired: subscription.endAt && new Date() > subscription.endAt,
      };
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return {
        hasActiveSubscription: false,
        tier: 'free',
        activeTier: 'free',
      };
    }
  }

  /**
   * Create or activate a temporary subscription for testing
   */
  async activateTestingSubscription(
    userId: mongoose.Types.ObjectId,
    tier: 'pro' | 'premium',
    daysToExpire: number = 30
  ): Promise<{ subscription: any; user: any }> {
    try {
      // Find or create a test plan
      let testPlan = await SubscriptionPlan.findOne({
        name: `Test ${tier} Plan`,
      });

      if (!testPlan) {
        testPlan = new SubscriptionPlan({
          code: `TEST_${tier.toUpperCase()}`,
          name: `Test ${tier} Plan`,
          billingPeriod: 'monthly',
          tier,
          durationDays: daysToExpire,
          price: 0,
          currency: 'USD',
          description: `Test subscription plan for ${tier} tier (${daysToExpire} days)`,
          features: { maxProjects: 100, aiMessages: 1000, prioritySupport: true },
          isActive: true,
        });
        await testPlan.save();
      }

      // Activate the test subscription
      return await this.activateSubscription(
        userId,
        testPlan._id,
        'test',
        `test-${Date.now()}`
      );
    } catch (error) {
      console.error('Error activating test subscription:', error);
      throw error;
    }
  }

  /**
   * Invalidate user cache after subscription changes
   */
  private async invalidateUserCache(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      if (redisCache && redisCache.isConnected()) {
        const cacheKey = redisCache.getUserCacheKey(userId.toString());
        await redisCache.del(cacheKey);
      }
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }
}

export default new SubscriptionService();
