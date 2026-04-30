import getRazorpayClient from './razorpay.service.js';
/**
 * Subscription-related helpers for Razorpay
 * - createCustomer
 * - createPlan (on-the-fly plan creation)
 * - createSubscription (with trial days)
 * - fetchSubscription
 *
 * These helpers wrap the Razorpay client and centralize error handling.
 */
export async function createCustomer(details) {
    const client = getRazorpayClient();
    return client.customers.create({
        name: details.name,
        email: details.email,
        contact: details.contact,
    });
}
export async function createPlanOnTheFly(options) {
    const client = getRazorpayClient();
    const period = options.period === 'monthly' ? 'monthly' : options.period === 'yearly' ? 'yearly' : 'weekly';
    // Razorpay plan creation expects amount in paise
    const amountInPaise = Math.round(options.amount * 100);
    const payload = {
        period: period,
        interval: 1,
        item: {
            name: options.name,
            amount: amountInPaise,
            currency: options.currency || 'INR',
        },
    };
    return client.plans.create(payload);
}
export async function createSubscription(params) {
    const client = getRazorpayClient();
    const payload = {
        plan_id: params.planId,
        customer_id: params.customerId,
        customer_notify: params.customer_notify || 1,
        quantity: params.quantity || 1,
    };
    if (typeof params.trial_days === 'number')
        payload.trial_days = params.trial_days;
    if (typeof params.total_count === 'number')
        payload.total_count = params.total_count;
    if (params.notes)
        payload.notes = params.notes;
    // When total_count is null/undefined, Razorpay may treat it as recurring until cancelled
    return client.subscriptions.create(payload);
}
export async function createPaymentLink(options) {
    const client = getRazorpayClient();
    const payload = {
        amount: options.amountInPaise,
        currency: options.currency || 'INR',
        accept_partial: false,
        description: options.description || 'Subscription payment',
        customer: options.customer || {},
        notify: { sms: false, email: true },
        reminder_enable: false,
        notes: options.notes || {},
    };
    if (options.callback_url)
        payload.callback_url = options.callback_url;
    if (options.callback_method)
        payload.callback_method = options.callback_method;
    return client.paymentLink.create(payload);
}
export async function fetchSubscription(subscriptionId) {
    const client = getRazorpayClient();
    return client.subscriptions.fetch(subscriptionId);
}
export async function cancelSubscription(subscriptionId, cancelAtCycleEnd = false) {
    const client = getRazorpayClient();
    return client.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}
export async function fetchCustomerByEmail(email) {
    const client = getRazorpayClient();
    // Razorpay doesn't have direct email search, so we fetch all and filter
    // In production, you should store customerId in your database
    const customers = await client.customers.all();
    return customers.items.find((c) => c.email === email);
}
export default {
    createCustomer,
    createPlanOnTheFly,
    createSubscription,
    fetchSubscription,
    cancelSubscription,
    fetchCustomerByEmail,
};
//# sourceMappingURL=razorpay.subscription.service.js.map