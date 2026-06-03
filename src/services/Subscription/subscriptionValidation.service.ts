import { User, Subscription } from '../../models/index.js';
import { redisCache } from '../../config/redis.js';
import mongoose from 'mongoose';

export interface SubscriptionValidationResult {
  isValid: boolean;
  activeTier: 'free' | 'pro' | 'premium';
  subscription: any;
  isExpired: boolean;
  daysRemaining: number | null;
  error?: string;
}

export interface TierFeatures {
  aiPersonalities: string[];
  messagesPerDay: number;
  voiceChat: boolean;
  advancedAnalytics: boolean;
  priority: boolean;
  maxProjects?: number;
  aiMessages?: number;
  prioritySupport?: boolean;
}

/**
 * Comprehensive subscription validation service
 * This is the single source of truth for all subscription-related validations
 */
export class SubscriptionValidationService {
  
  /**
   * Get authoritative subscription status for a user
   * Always checks the Subscription collection as the source of truth
   */
  async getUserSubscriptionStatus(userId: mongoose.Types.ObjectId): Promise<SubscriptionValidationResult> {
    try {
      // Get the authoritative subscription record
      const subscription = await Subscription.findActiveByUserId(userId);
      
      if (!subscription) {
        return {
          isValid: false,
          activeTier: process.env.NODE_ENV === 'production' ? 'free' : 'premium',
          subscription: null,
          isExpired: false,
          daysRemaining: null
        };
      }

      // Check if subscription is expired
      const isExpired = subscription.expiresAt && new Date() > subscription.expiresAt;
      const activeTier = (isExpired ? 'free' : (subscription.tier || 'premium')) as 'free' | 'pro' | 'premium';
      
      // Calculate days remaining
      let daysRemaining: number | null = null;
      if (subscription.expiresAt && !isExpired) {
        const now = new Date();
        const expiryDate = new Date(subscription.expiresAt);
        daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        isValid: (!isExpired && subscription.status === 'active') || false,
        activeTier,
        subscription: subscription.toObject(),
        isExpired: isExpired || false,
        daysRemaining
      };
    } catch (error) {
      console.error('Error getting user subscription status:', error);
      return {
        isValid: false,
        activeTier: 'free',
        subscription: null,
        isExpired: false,
        daysRemaining: null,
        error: 'Failed to validate subscription'
      };
    }
  }

  /**
   * Get user's active tier (consistent across the application)
   */
  async getActiveTier(userId: mongoose.Types.ObjectId): Promise<'free' | 'pro' | 'premium'> {
    const result = await this.getUserSubscriptionStatus(userId);
    return result.activeTier;
  }

  /**
   * Check if user has access to specific tier features
   */
  async hasTierAccess(userId: mongoose.Types.ObjectId, requiredTier: 'pro' | 'premium'): Promise<boolean> {
    const activeTier = await this.getActiveTier(userId);
    const tierHierarchy = { free: 0, pro: 1, premium: 2 };
    const userTierLevel = tierHierarchy[activeTier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 0;
    return userTierLevel >= requiredTierLevel;
  }

  /**
   * Get features available for a specific tier
   */
  getTierFeatures(tier: 'free' | 'pro' | 'premium'): TierFeatures {
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

    return features[tier] || features.free;
  }

  /**
   * Validate if user can access a specific feature
   */
  async canAccessFeature(userId: mongoose.Types.ObjectId, feature: keyof TierFeatures): Promise<boolean> {
    const activeTier = await this.getActiveTier(userId);
    const features = this.getTierFeatures(activeTier);
    return !!features[feature];
  }

  /**
   * Check if user has reached daily message limit
   */
  async checkDailyMessageLimit(userId: mongoose.Types.ObjectId): Promise<{
    canSendMessage: boolean;
    messagesRemaining: number;
    dailyLimit: number;
    isUnlimited: boolean;
  }> {
    try {
      const activeTier = await this.getActiveTier(userId);
      const features = this.getTierFeatures(activeTier);
      
      if (features.messagesPerDay === -1) {
        return {
          canSendMessage: true,
          messagesRemaining: -1,
          dailyLimit: -1,
          isUnlimited: true
        };
      }

      // Get today's message count from cache or database
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `user:${userId}:messages:${today}`;
      
      let messageCount = 0;
      if (redisCache) {
        const cached = await redisCache.get(cacheKey);
        messageCount = parseInt(cached || '0');
      } else {
        // Fallback to database query if cache is not available
        // This would require implementing a message tracking system
        messageCount = 0;
      }

      const messagesRemaining = Math.max(0, features.messagesPerDay - messageCount);
      const canSendMessage = messagesRemaining > 0;

      return {
        canSendMessage,
        messagesRemaining,
        dailyLimit: features.messagesPerDay,
        isUnlimited: false
      };
    } catch (error) {
      console.error('Error checking daily message limit:', error);
      // Default to allowing messages if there's an error
      return {
        canSendMessage: true,
        messagesRemaining: 0,
        dailyLimit: 0,
        isUnlimited: false
      };
    }
  }

  /**
   * Increment user's daily message count
   */
  async incrementDailyMessageCount(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `user:${userId}:messages:${today}`;
      
      if (redisCache) {
        // Use Redis client directly for operations
        const redis = require('redis');
        const client = redis.createClient();
        await client.connect();
        await client.incr(cacheKey);
        // Set expiry to end of day
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const ttlSeconds = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
        await client.expire(cacheKey, ttlSeconds);
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error incrementing daily message count:', error);
    }
  }

  /**
   * Validate subscription consistency between User and Subscription models
   * This helps identify data inconsistencies
   */
  async validateSubscriptionConsistency(userId: mongoose.Types.ObjectId): Promise<{
    isConsistent: boolean;
    userSubscription: any;
    authoritativeSubscription: any;
    issues: string[];
  }> {
    try {
      const user = await User.findById(userId);
      const authoritativeSub = await Subscription.findActiveByUserId(userId);
      
      const issues: string[] = [];
      let isConsistent = true;

      if (!user) {
        return {
          isConsistent: false,
          userSubscription: null,
          authoritativeSubscription: authoritativeSub,
          issues: ['User not found']
        };
      }

      const userSub = user.subscription;

      // Check if both models have the same subscription status
      if (authoritativeSub) {
        const expectedStatus = authoritativeSub.expiresAt && new Date() > authoritativeSub.expiresAt ? 'expired' : authoritativeSub.status;
        if (userSub?.status !== expectedStatus) {
          issues.push(`User subscription status (${userSub?.status}) doesn't match authoritative status (${expectedStatus})`);
          isConsistent = false;
        }

        // Check if subscription IDs match
        if (userSub?.subscriptionId && !userSub.subscriptionId.equals(authoritativeSub._id)) {
          issues.push('User subscriptionId doesn\'t match authoritative subscription ID');
          isConsistent = false;
        }

        // Check if expiration dates match
        if (userSub?.expiresAt && authoritativeSub.expiresAt && 
            new Date(userSub.expiresAt).getTime() !== new Date(authoritativeSub.expiresAt).getTime()) {
          issues.push('User subscription expiresAt doesn\'t match authoritative expiresAt');
          isConsistent = false;
        }
      } else {
        // No authoritative subscription found
        if (userSub?.status === 'active') {
          issues.push('User shows active subscription but no authoritative subscription found');
          isConsistent = false;
        }
      }

      return {
        isConsistent,
        userSubscription: userSub,
        authoritativeSubscription: authoritativeSub,
        issues
      };
    } catch (error) {
      console.error('Error validating subscription consistency:', error);
      return {
        isConsistent: false,
        userSubscription: null,
        authoritativeSubscription: null,
        issues: ['Error during validation']
      };
    }
  }

  /**
   * Fix subscription inconsistencies between User and Subscription models
   */
  async fixSubscriptionConsistency(userId: mongoose.Types.ObjectId): Promise<{
    fixed: boolean;
    issuesFixed: string[];
    error?: string;
  }> {
    try {
      const validation = await this.validateSubscriptionConsistency(userId);
      
      if (validation.isConsistent) {
        return {
          fixed: true,
          issuesFixed: []
        };
      }

      const user = await User.findById(userId);
      if (!user) {
        return {
          fixed: false,
          issuesFixed: [],
          error: 'User not found'
        };
      }

      const issuesFixed: string[] = [];

      // Fix User model based on authoritative subscription
      if (validation.authoritativeSubscription) {
        const authSub = validation.authoritativeSubscription;
        const isExpired = authSub.expiresAt && new Date() > authSub.expiresAt;
        const status = isExpired ? 'expired' : authSub.status;

        user.subscription = {
          planCode: authSub.tier.toUpperCase(),
          status: status,
          expiresAt: authSub.expiresAt,
          subscriptionId: authSub._id,
          renewedAt: authSub.startAt,
        };

        issuesFixed.push('Updated user subscription to match authoritative subscription');
      } else {
        // No authoritative subscription - set user to free tier
        user.subscription = {
          planCode: 'FREE',
          status: 'none',
          expiresAt: null,
          subscriptionId: null,
          renewedAt: null,
        };

        issuesFixed.push('Set user subscription to free tier (no authoritative subscription found)');
      }

      await user.save();

      // Invalidate cache
      if (redisCache) {
        const cacheKey = redisCache.getUserCacheKey(userId.toString());
        await redisCache.del(cacheKey);
      }

      return {
        fixed: true,
        issuesFixed
      };
    } catch (error) {
      console.error('Error fixing subscription consistency:', error);
      return {
        fixed: false,
        issuesFixed: [],
        error: 'Failed to fix subscription consistency'
      };
    }
  }
}

// Configurable default tier for deployment
const DEFAULT_TIER = process.env.NODE_ENV === 'production' ? 'free' : 'premium';

export default new SubscriptionValidationService();
