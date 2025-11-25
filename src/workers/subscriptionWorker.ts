import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new (IORedis as any)(process.env.REDIS_URL || 'redis://localhost:6379');

const worker = new Worker('subscription-tasks', async (job) => {
  if (job.name === 'expire-subscription') {
    const { subscriptionId } = job.data as { subscriptionId: string };
    try {
      const Subscription = (await import('../models/Subscription.js')).default;
      const User = (await import('../models/User.js')).default;
      const s = await Subscription.findById(subscriptionId).exec();
      if (!s) {
        console.warn('Expire job: subscription not found', subscriptionId);
        return;
      }
      if (s.status !== 'active') {
        console.log('Expire job: subscription already not active', subscriptionId, s.status);
        return;
      }
      await Subscription.findByIdAndUpdate(subscriptionId, { status: 'expired' });
      await User.findByIdAndUpdate(s.userId, { subscriptionStatus: 'expired', tier: 'free', subscriptionEndDate: s.endAt });
      console.log('Expired subscription', subscriptionId);
    } catch (err) {
      console.error('Error processing expire-subscription job', err);
      throw err;
    }
  }
  if (job.name === 'retry-payment') {
    const { subscriptionId, attempt } = job.data as { subscriptionId: string; attempt?: number };
    const tries = attempt ? Number(attempt) : 1;
    try {
      const Subscription = (await import('../models/Subscription.js')).default;
      const User = (await import('../models/User.js')).default;
      const razorpaySub = await import('../services/razorpay.subscription.service.js');
      const s = await Subscription.findById(subscriptionId).exec();
      if (!s) {
        console.warn('Retry job: subscription not found', subscriptionId);
        return;
      }

      // If no razorpay subscription id, nothing to retry
      const rpSubId = (s as any)?.razorpay?.subscriptionId;
      if (!rpSubId) {
        console.warn('Retry job: no razorpay subscription id for', subscriptionId);
        return;
      }

      // Fetch latest subscription from Razorpay
      let remoteSub: any = null;
      try {
        remoteSub = await razorpaySub.fetchSubscription(String(rpSubId));
      } catch (fetchErr) {
        console.error('Retry job: failed to fetch razorpay subscription', fetchErr);
      }

      // If remote subscription shows active and last payment succeeded, clear retries
      if (remoteSub && remoteSub.status === 'active') {
        // best-effort: clear billingRetries
        try {
          await Subscription.findByIdAndUpdate(subscriptionId, { billingRetries: 0, lastFailedPaymentAt: null });
        } catch (uerr) {
          console.debug('Retry job: failed to clear billing retries', uerr);
        }
        console.log('Retry job: subscription active - cleared retries', subscriptionId);
        return;
      }

      // Otherwise increment retry count
      const currentRetries = ((s as any).billingRetries || 0) + 1;
      await Subscription.findByIdAndUpdate(subscriptionId, { billingRetries: currentRetries, lastFailedPaymentAt: new Date() });

      const MAX_RETRIES = 3;
      if (currentRetries < MAX_RETRIES) {
        // Exponential backoff delays: 1h, 6h, 24h
        const delays = [60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];
        const delay = delays[Math.min(currentRetries - 1, delays.length - 1)];
        const { addRetryJob } = await import('../queues/subscriptionQueue.js');
        await addRetryJob(subscriptionId, currentRetries + 1, delay);
        console.log('Retry job: scheduled next retry', subscriptionId, 'attempt', currentRetries + 1);
      } else {
        // Exhausted retries: mark subscription expired and downgrade user
        try {
          await Subscription.findByIdAndUpdate(subscriptionId, { status: 'expired' });
          await User.findByIdAndUpdate(s.userId, { subscriptionStatus: 'expired', tier: 'free' });
          console.log('Retry job: exhausted retries, expired subscription', subscriptionId);
        } catch (finalErr) {
          console.error('Retry job: failed to expire subscription', finalErr);
        }
      }
    } catch (err) {
      console.error('Error processing retry-payment job', err);
      throw err;
    }
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error('Subscription worker job failed', job?.id, job?.name, err);
});

export default worker;
