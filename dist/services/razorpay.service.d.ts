import Razorpay from 'razorpay';
/**
 * Lazily create Razorpay client to avoid throwing at module import time when
 * environment variables are not yet set. Callers should handle thrown errors
 * and surface clear messages to operators.
 */
declare function getRazorpayClient(): Razorpay;
export declare function createOrder(amountInPaise: number, currency?: string, receipt?: string, notes?: Record<string, string>): Promise<import("razorpay/dist/types/orders.js").Orders.RazorpayOrder>;
export declare function fetchPayment(paymentId: string): Promise<import("razorpay/dist/types/payments.js").Payments.RazorpayPayment>;
export declare function verifySignature(payload: string, signature: string, secret?: string): boolean;
/**
 * Verify Razorpay checkout signature for subscription checkouts.
 * The signature is computed as HMAC_SHA256(subscription_id + '|' + payment_id, key_secret)
 */
export declare function verifyCheckoutSignature(subscriptionId: string, paymentId: string, signature: string): boolean;
export declare function hasRazorpayConfigured(): boolean;
export default getRazorpayClient;
//# sourceMappingURL=razorpay.service.d.ts.map