import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: any;
}
/**
 * Subscription Controller
 * Handles subscription plan retrieval, status checks, and cancellation.
 */
export declare class SubscriptionController {
    /**
     * Get all active subscription plans
     */
    getPlans(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get plans by tier
     */
    getPlansByTier(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get user subscription status
     * Returns the authoritative status from the Subscription collection.
     */
    getSubscription(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Cancel subscription
     */
    cancelSubscription(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Activate a subscription (Manual/Free/Alternative flow)
     */
    activateSubscription(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get active tier for the current user
     */
    getActiveTier(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Activate a test subscription (Admin/Testing)
     */
    activateTestSubscription(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get features available for each tier
     */
    private getTierFeatures;
}
declare const _default: SubscriptionController;
export default _default;
//# sourceMappingURL=subscription.controller.d.ts.map