import { Request, Response } from 'express';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import User from '../../models/User.js';
import Payment from '../../models/Payment.js';
import Event from '../../models/Event.js';

import { createOrder, fetchPayment, verifySignature, verifyCheckoutSignature } from '../../services/razorpay.service.js';
import * as razorpaySub from '../../services/razorpay.subscription.service.js';
import { addExpireJob, addRetryJob } from '../../queues/subscriptionQueue.js';
import { verifyToken } from '../../middleware/auth/auth.js';
import authConfig from '../../config/auth.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisPub = new (Redis as any)(REDIS_URL);

// --- Helpers ---

function parseNumber(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

async function resolveBuyerState(req: Request, userId: string | null): Promise<string | null> {
  if (req.body && req.body.buyerState) return req.body.buyerState;
  if (!userId) return null;
  const user = await User.findById(userId);
  // Assuming user has address.state or similar. If not, return null.
  // Adjust this based on actual User model structure.
  return (user as any)?.address?.state || null;
}

function computeGstBreakdown(amount: number, state: string, ratePercent: number) {
  const companyState = process.env.COMPANY_STATE || 'Delhi';
  const isInterState = state && state.toLowerCase() !== companyState.toLowerCase();
  const taxAmount = (amount * ratePercent) / 100;
  
  if (isInterState) {
    return { igst: taxAmount, cgst: 0, sgst: 0, totalTax: taxAmount };
  } else {
    return { igst: 0, cgst: taxAmount / 2, sgst: taxAmount / 2, totalTax: taxAmount };
  }
}

async function updateUserSubscription(userId: mongoose.Types.ObjectId, subscription: any) {
  const user = await User.findById(userId);
  if (!user) return;

  // Update user subscription metadata
  // Using the new nested structure in User model
  user.subscription = {
    planCode: subscription.tier === 'premium' ? 'PREMIUM' : (subscription.tier === 'pro' ? 'PRO' : 'FREE'), // Map tier to code
    status: subscription.status === 'active' ? 'active' : 'expired',
    expiresAt: subscription.endAt,
    subscriptionId: subscription._id,
    renewedAt: subscription.startAt,
  };
  
  await user.save();
  
  // Invalidate cache
  const cacheKey = `user:${userId}`; // Adjust based on redis config
  // redisPub.del(cacheKey); // If using same redis instance for cache
}

async function provisionOrder(payment: any, userId: string) {
  // Logic to provision lifetime access or other non-subscription products
  // For now, just log it
  console.log(`Provisioning order ${payment._id} for user ${userId}`);
}

// --- Handlers ---

export async function createOrderHandler(req: Request, res: Response) {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    const order = await createOrder(amount, currency, receipt, notes);
    return res.json({ success: true, order });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create order' });
  }
}

export async function createSubscriptionHandler(req: Request, res: Response) {
  // Alias to production handler for now, or implement specific logic if different
  return createSubscriptionProductionHandler(req, res);
}

export async function createSubscriptionProductionHandler(req: Request, res: Response) {
  try {
    const { planId, period = 'monthly' } = req.body;
    const userId = (req as any).user._id;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    // Create Razorpay customer if needed
    const user = await User.findById(userId);
    // Assuming we store razorpayCustomerId on user, if not create one
    let customerId = (user as any).razorpayCustomerId;
    if (!customerId) {
      try {
        const customer = await razorpaySub.createCustomer({
          name: user?.getFullName(),
          email: user?.email,
          contact: (user as any).phone // Adjust if phone exists
        });
        customerId = customer.id;
        // Save customerId to user
        if (user) {
          (user as any).razorpayCustomerId = customerId;
          await user.save();
        }
      } catch (customerError: any) {
        // If customer already exists, fetch and reuse it
        if (customerError?.error?.description?.includes('already exists')) {
          console.log('Customer already exists for email:', user?.email, '- fetching existing customer');
          try {
            const existingCustomer = await razorpaySub.fetchCustomerByEmail(user?.email || '');
            if (existingCustomer) {
              customerId = existingCustomer.id;
              // Save customerId to user for future use
              if (user) {
                (user as any).razorpayCustomerId = customerId;
                await user.save();
              }
              console.log('Successfully retrieved existing customer:', customerId);
            } else {
              console.error('Customer exists but could not be found');
              return res.status(500).json({ 
                success: false, 
                message: 'Failed to retrieve customer information. Please contact support.' 
              });
            }
          } catch (fetchError) {
            console.error('Error fetching existing customer:', fetchError);
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to retrieve customer information. Please contact support.' 
            });
          }
        } else {
          throw customerError;
        }
      }
    }

    // Create subscription on Razorpay
    // We need a razorpay plan ID. Assuming it's stored in SubscriptionPlan or we create on the fly.
    // Ideally SubscriptionPlan has razorpayPlanId. If not, create one.
    let razorpayPlanId = (plan as any).razorpayPlanId;
    if (!razorpayPlanId) {
      const rpPlan = await razorpaySub.createPlanOnTheFly({
        name: plan.name,
        period: period === 'yearly' ? 'yearly' : 'monthly',
        amount: plan.price / 100, // price is in paisa
        currency: plan.currency
      });
      razorpayPlanId = rpPlan.id;
      // Save back to plan (optional but good for caching)
      // await SubscriptionPlan.findByIdAndUpdate(planId, { razorpayPlanId });
    }

    // Use standard checkout instead of subscription-only to support all cards
    const subscription = await razorpaySub.createSubscription({
      planId: razorpayPlanId,
      customerId,
      total_count: period === 'lifetime' ? 1 : 120, // 10 years for recurring
      customer_notify: 1,
      quantity: 1,
      notes: {
        plan_name: plan.name,
        tier: plan.tier,
        period: period
      }
    });

    // Create local subscription record
    const localSub = await Subscription.create({
      userId,
      planId: plan._id,
      tier: plan.tier,
      planType: period,
      status: 'pending',
      startAt: new Date(),
      endAt: null, // Will be updated on confirmation
      razorpay: {
        subscriptionId: subscription.id,
      }
    });

    return res.json({
      success: true,
      razorpaySubscription: {
        id: subscription.id,
        status: subscription.status,
        plan_id: subscription.plan_id,
        customer_id: subscription.customer_id,
      },
      key: process.env.RAZORPAY_KEY_ID,
      amount: plan.price,
      currency: plan.currency,
      name: 'Learn English',
      description: plan.description,
      prefill: {
        name: user?.getFullName(),
        email: user?.email,
        contact: (user as any).phone
      },
      notes: {
        localSubscriptionId: localSub._id.toString()
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create subscription' });
  }
}

export async function confirmPaymentHandler(req: Request, res: Response) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, razorpay_subscription_id } = req.body;
    
    let isValid = false;
    if (razorpay_subscription_id) {
      // Verify subscription signature: subscription_id + | + payment_id
      // verifyCheckoutSignature expects (subscriptionId, paymentId, signature) and uses env secret
      isValid = verifyCheckoutSignature(razorpay_subscription_id, razorpay_payment_id, razorpay_signature);
    } else {
      // Verify order signature: order_id + | + payment_id
      const payload = razorpay_order_id + '|' + razorpay_payment_id;
      isValid = verifySignature(payload, razorpay_signature, process.env.RAZORPAY_KEY_SECRET!);
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Update subscription status
    if (razorpay_subscription_id) {
      const sub = await Subscription.findOne({ 'razorpay.subscriptionId': razorpay_subscription_id });
      if (sub) {
        sub.status = 'active';
        sub.razorpay.paymentId = razorpay_payment_id;
        sub.razorpay.signature = razorpay_signature;
        // Fetch subscription details from Razorpay to get end date
        const rpSub = await razorpaySub.fetchSubscription(razorpay_subscription_id);
        if (rpSub.current_end) {
          sub.endAt = new Date(rpSub.current_end * 1000);
        }
        await sub.save();
        await updateUserSubscription(sub.userId, sub);
      }
    }

    // Record payment
    await Payment.create({
      userId: (req as any).user?._id, // Might be null if webhook, but this is confirm handler so user is likely logged in
      amount: 0, // Need to fetch from payment details
      currency: 'INR',
      status: 'captured',
      method: 'razorpay',
      transactionId: razorpay_payment_id,
      orderId: razorpay_order_id || razorpay_subscription_id,
      signature: razorpay_signature
    });

    return res.json({ success: true, message: 'Payment confirmed' });

  } catch (error) {
    console.error('Confirm payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to confirm payment' });
  }
}

export async function webhookHandler(req: Request, res: Response) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    // Verify signature logic here (omitted for brevity, assume middleware or helper does it)
    
    const event = req.body;
    
    // Log event
    await Event.create({
      type: event.event,
      data: event.payload,
      source: 'razorpay'
    });

    if (event.event === 'subscription.charged') {
      const subId = event.payload.subscription.entity.id;
      const sub = await Subscription.findOne({ 'razorpay.subscriptionId': subId });
      if (sub) {
        sub.status = 'active';
        sub.endAt = new Date(event.payload.subscription.entity.current_end * 1000);
        await sub.save();
        await updateUserSubscription(sub.userId, sub);
      }
    } else if (event.event === 'subscription.cancelled') {
      const subId = event.payload.subscription.entity.id;
      const sub = await Subscription.findOne({ 'razorpay.subscriptionId': subId });
      if (sub) {
        sub.status = 'canceled';
        sub.canceledAt = new Date();
        await sub.save();
        await updateUserSubscription(sub.userId, sub);
      }
    }

    return res.json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
}

export async function subscriptionSseHandler(req: Request, res: Response) {
  try {
    // Check if user is authenticated
    if (!(req as any).user || !(req as any).user._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const userId = (req as any).user._id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const channel = `subscription_updates:${userId}`;
    const redisSub = new (Redis as any)(REDIS_URL);
    
    redisSub.subscribe(channel);
    
    redisSub.on('message', (chan: string, msg: string) => {
      if (chan === channel) {
        res.write(`data: ${msg}\n\n`);
      }
    });

    req.on('close', () => {
      redisSub.disconnect();
    });

  } catch (err) {
    console.error('subscriptionSseHandler error', err);
    res.status(500).end();
  }
}

export async function taxPreviewHandler(req: Request, res: Response) {
  try {
    const { amount, taxRatePercent = 18 } = req.body || {};
    const amountNum = parseNumber(amount);
    if (!amountNum || amountNum < 0) return res.status(400).json({ success: false, message: 'Invalid amount' });
    const userId = (req as any).user?.id ?? null;
    const resolvedState = await resolveBuyerState(req, userId);
    const usedState = resolvedState || (req.body && String(req.body.buyerState || '')) || null;
    const tax = computeGstBreakdown(amountNum, String(usedState || ''), parseNumber(taxRatePercent));
    return res.json({ success: true, tax, resolvedState: resolvedState || null, note: resolvedState ? 'State resolved from user profile' : (usedState ? 'Used provided buyerState (user unauthenticated or no profile state)' : 'No state available — IGST applied by default') });
  } catch (err) { console.error('taxPreviewHandler error', err); return res.status(500).json({ success: false, message: 'Failed to compute tax' }); }
}

export async function getPlansHandler(req: Request, res: Response) {
  try {
    const plans = await SubscriptionPlan.findActivePlans();
    // Map to simple object if needed, or return as is
    return res.json({ success: true, plans });
  } catch (err) { console.error('getPlansHandler error', err); return res.status(500).json({ success: false, message: 'Failed to fetch plans' }); }
}

export async function getMySubscriptionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const sub = await Subscription.findActiveByUserId(userId);
    return res.json({ success: true, subscription: sub ?? null });
  } catch (err) { console.error('getMySubscriptionHandler error', err); return res.status(500).json({ success: false, message: 'Failed to fetch subscription' }); }
}

export async function getPaymentHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const payment = await fetchPayment(id);
    return res.json({ success: true, payment });
  } catch (err) { console.error('getPaymentHandler error', err); return res.status(500).json({ success: false, message: 'Failed to fetch payment' }); }
}
