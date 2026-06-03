import { Request, Response, NextFunction } from 'express';
import subscriptionValidationService from '../../services/Subscription/subscriptionValidation.service.js';
import { IUser } from '../../models/User.js';

// Extend Express Request type to include subscription properties
declare global {
  namespace Express {
    interface Request {
      subscriptionStatus?: any;
      userTier?: 'free' | 'pro' | 'premium';
      isPremium?: boolean;
      isPro?: boolean;
      user?: IUser;
    }
  }
}

/**
 * Middleware to verify subscription status for premium features
 * This uses the SINGLE SOURCE OF TRUTH for all subscription verification
 */
export const verifySubscription = (requiredTier: 'premium' | 'pro' | 'free' = 'premium') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user._id;
      const subscriptionStatus = await subscriptionValidationService.getUserSubscriptionStatus(userId);
      
      // Check if user has required tier
      const hasRequiredTier = requiredTier === 'free' || 
        (requiredTier === 'pro' && subscriptionStatus.activeTier === 'pro') ||
        (requiredTier === 'premium' && subscriptionStatus.activeTier === 'premium');

      if (!hasRequiredTier) {
        return res.status(403).json({
          success: false,
          message: `This feature requires ${requiredTier} subscription`,
          currentTier: subscriptionStatus.activeTier,
          isPremium: subscriptionStatus.activeTier === 'premium',
          isPro: subscriptionStatus.activeTier === 'pro'
        });
      }

      // Attach subscription info to request for downstream use
      req.subscriptionStatus = subscriptionStatus;
      req.userTier = subscriptionStatus.activeTier;
      req.isPremium = subscriptionStatus.activeTier === 'premium';
      req.isPro = subscriptionStatus.activeTier === 'pro';
      
      next();
    } catch (error) {
      console.error('❌ Subscription verification middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware specifically for premium features
 */
export const requirePremium = verifySubscription('premium');

/**
 * Middleware specifically for pro features
 */
export const requirePro = verifySubscription('pro');

/**
 * Middleware to attach subscription info (no tier requirement)
 */
export const attachSubscriptionInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user._id) {
      return next();
    }

    const userId = req.user._id;
    const subscriptionStatus = await subscriptionValidationService.getUserSubscriptionStatus(userId);
    
    // Attach subscription info to request
    req.subscriptionStatus = subscriptionStatus;
    req.userTier = subscriptionStatus.activeTier;
    req.isPremium = subscriptionStatus.activeTier === 'premium';
    req.isPro = subscriptionStatus.activeTier === 'pro';
    
    next();
  } catch (error) {
    console.error('❌ Subscription attachment middleware error:', error);
    next();
  }
};
