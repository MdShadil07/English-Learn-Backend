import mongoose from 'mongoose';
export declare class SubscriptionService {
    /**
     * Activate a subscription for a user
     */
    activateSubscription(userId: mongoose.Types.ObjectId, planId: mongoose.Types.ObjectId, paymentMethod?: string, transactionId?: string): Promise<{
        subscription: any;
        user: any;
    }>;
    /**
     * Cancel a subscription for a user
     */
    cancelSubscription(userId: mongoose.Types.ObjectId, reason?: string): Promise<any>;
    /**
     * Check and revoke expired subscriptions
     */
    revokeExpiredSubscriptions(): Promise<any[]>;
    /**
     * Get active tier for a user (considering subscription expiration)
     */
    getActiveTierForUser(userId: mongoose.Types.ObjectId): Promise<'free' | 'pro' | 'premium'>;
    /**
     * Get subscription details for a user
     */
    getUserSubscription(userId: mongoose.Types.ObjectId): Promise<any>;
    /**
     * Create or activate a temporary subscription for testing
     */
    activateTestingSubscription(userId: mongoose.Types.ObjectId, tier: 'pro' | 'premium', daysToExpire?: number): Promise<{
        subscription: any;
        user: any;
    }>;
    /**
     * Invalidate user cache after subscription changes
     */
    private invalidateUserCache;
}
declare const _default: SubscriptionService;
export default _default;
//# sourceMappingURL=subscriptionService.d.ts.map