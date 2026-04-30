/**
 * Subscription-related helpers for Razorpay
 * - createCustomer
 * - createPlan (on-the-fly plan creation)
 * - createSubscription (with trial days)
 * - fetchSubscription
 *
 * These helpers wrap the Razorpay client and centralize error handling.
 */
export declare function createCustomer(details: {
    name?: string;
    email?: string;
    contact?: string;
}): Promise<import("razorpay/dist/types/customers.js").Customers.RazorpayCustomer>;
export declare function createPlanOnTheFly(options: {
    name: string;
    period: 'monthly' | 'yearly' | 'lifetime';
    amount: number;
    currency?: string;
}): Promise<import("razorpay/dist/types/plans.js").Plans.RazorPayPlans>;
export declare function createSubscription(params: {
    planId: string;
    customerId: string;
    trial_days?: number;
    total_count?: number | null;
    customer_notify?: number;
    quantity?: number;
    notes?: Record<string, string>;
}): Promise<import("razorpay/dist/types/subscriptions.js").Subscriptions.RazorpaySubscription>;
export declare function createPaymentLink(options: {
    amountInPaise: number;
    currency?: string;
    description?: string;
    customer?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    callback_url?: string;
    callback_method?: 'get' | 'post';
}): Promise<import("razorpay/dist/types/paymentLink.js").PaymentLinks.RazorpayPaymentLink>;
export declare function fetchSubscription(subscriptionId: string): Promise<import("razorpay/dist/types/subscriptions.js").Subscriptions.RazorpaySubscription>;
export declare function cancelSubscription(subscriptionId: string, cancelAtCycleEnd?: boolean): Promise<import("razorpay/dist/types/subscriptions.js").Subscriptions.RazorpaySubscription>;
export declare function fetchCustomerByEmail(email: string): Promise<import("razorpay/dist/types/customers.js").Customers.RazorpayCustomer | undefined>;
declare const _default: {
    createCustomer: typeof createCustomer;
    createPlanOnTheFly: typeof createPlanOnTheFly;
    createSubscription: typeof createSubscription;
    fetchSubscription: typeof fetchSubscription;
    cancelSubscription: typeof cancelSubscription;
    fetchCustomerByEmail: typeof fetchCustomerByEmail;
};
export default _default;
//# sourceMappingURL=razorpay.subscription.service.d.ts.map