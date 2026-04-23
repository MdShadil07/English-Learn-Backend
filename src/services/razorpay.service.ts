import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Lazily create Razorpay client to avoid throwing at module import time when
 * environment variables are not yet set. Callers should handle thrown errors
 * and surface clear messages to operators.
 */
function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID || '';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || '';

  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.');
  }

  return new Razorpay({ key_id, key_secret });
}

export async function createOrder(amountInPaise: number, currency = 'INR', receipt?: string, notes?: Record<string, string>) {
  const options = {
    amount: amountInPaise,
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes: notes || {},
  };

  const client = getRazorpayClient();
  return client.orders.create(options);
}

export async function fetchPayment(paymentId: string) {
  const client = getRazorpayClient();
  return client.payments.fetch(paymentId);
}

export function verifySignature(payload: string, signature: string, secret?: string) {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    // If no secret available, verification must fail — don't consider signatures valid.
    // Log a warning to assist debugging but don't throw here.
    // eslint-disable-next-line no-console
    console.warn('RAZORPAY_WEBHOOK_SECRET not set; webhook signatures cannot be verified');
    return false;
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  return expected === signature;
}

/**
 * Verify Razorpay checkout signature for subscription checkouts.
 * The signature is computed as HMAC_SHA256(subscription_id + '|' + payment_id, key_secret)
 */
export function verifyCheckoutSignature(subscriptionId: string, paymentId: string, signature: string) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keySecret) {
    console.warn('RAZORPAY_KEY_SECRET not set; cannot verify checkout signatures');
    return false;
  }
  const payload = `${subscriptionId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
  return expected === signature;
}

export function hasRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export default getRazorpayClient;
