import { Request, Response, NextFunction } from 'express';
import { User, Subscription } from '../../models/index.js';
import subscriptionService from '../../services/Subscription/subscriptionService.js';

export interface AuthRequest extends Request {
  user?: any;
  subscription?: any;
  activeTier?: 'free' | 'pro' | 'premium';
}

/**
 * Middleware to attach subscription information to the request
 * This ensures consistent subscription validation across all endpoints
 */
export const attachSubscriptionInfo = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      return next();
    }

    // Get authoritative subscription information from Subscription collection
    const subscription = await Subscription.findActiveByUserId(req.user._id);
    
    if (subscription) {
      // Check if subscription is expired
      const isExpired = subscription.expiresAt && new Date() > subscription.expiresAt;
      const activeTier = isExpired ? 'free' : (subscription.tier || 'free');
      
      req.subscription = subscription;
      req.activeTier = activeTier;
    } else {
      // No active subscription found
      req.subscription = null;
      req.activeTier = 'free';
    }

    next();
  } catch (error) {
    console.error('Error attaching subscription info:', error);
    // Continue without subscription info on error
    req.subscription = null;
    req.activeTier = 'free';
    next();
  }
};

/**
 * Middleware to require premium subscription
 */
export const requirePremium = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Get active tier using the authoritative service
    const activeTier = await subscriptionService.getActiveTierForUser(req.user._id);
    
    if (activeTier !== 'premium') {
      res.status(403).json({
        success: false,
        message: 'Premium subscription required',
        code: 'PREMIUM_REQUIRED',
        currentTier: activeTier
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking premium subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify subscription status',
      code: 'SUBSCRIPTION_CHECK_ERROR'
    });
  }
};

/**
 * Middleware to require pro or premium subscription
 */
export const requireProOrPremium = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Get active tier using the authoritative service
    const activeTier = await subscriptionService.getActiveTierForUser(req.user._id);
    
    if (activeTier === 'free') {
      res.status(403).json({
        success: false,
        message: 'Pro or Premium subscription required',
        code: 'PRO_PREMIUM_REQUIRED',
        currentTier: activeTier
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking pro/premium subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify subscription status',
      code: 'SUBSCRIPTION_CHECK_ERROR'
    });
  }
};

/**
 * Middleware to check if user has access to specific features based on tier
 */
export const requireFeatureAccess = (requiredTier: 'pro' | 'premium') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      // Get active tier using the authoritative service
      const activeTier = await subscriptionService.getActiveTierForUser(req.user._id);
      
      const tierHierarchy = { free: 0, pro: 1, premium: 2 };
      const userTierLevel = tierHierarchy[activeTier as keyof typeof tierHierarchy] || 0;
      const requiredTierLevel = tierHierarchy[requiredTier] || 0;
      
      if (userTierLevel < requiredTierLevel) {
        res.status(403).json({
          success: false,
          message: `${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} subscription required`,
          code: 'INSUFFICIENT_TIER',
          currentTier: activeTier,
          requiredTier
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify subscription status',
        code: 'SUBSCRIPTION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Utility function to get user's active tier (can be used in services)
 */
export const getUserActiveTier = async (userId: any): Promise<'free' | 'pro' | 'premium'> => {
  try {
    return await subscriptionService.getActiveTierForUser(userId);
  } catch (error) {
    console.error('Error getting user active tier:', error);
    return 'free';
  }
};

/**
 * Utility function to check if user has specific tier access
 */
export const hasTierAccess = async (userId: any, requiredTier: 'pro' | 'premium'): Promise<boolean> => {
  try {
    const activeTier = await getUserActiveTier(userId);
    const tierHierarchy = { free: 0, pro: 1, premium: 2 };
    const userTierLevel = tierHierarchy[activeTier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 0;
    return userTierLevel >= requiredTierLevel;
  } catch (error) {
    console.error('Error checking tier access:', error);
    return false;
  }
};
