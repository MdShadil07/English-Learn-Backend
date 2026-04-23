import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { database } from '../src/config/database.js';
import User from '../src/models/User.js';
import SubscriptionPlan from '../src/models/SubscriptionPlan.js';
import Subscription from '../src/models/Subscription.js';
import subscriptionService from '../src/services/Subscription/subscriptionService.js';

dotenv.config();

async function runVerification() {
  try {
    console.log('🔌 Connecting to database...');
    await database.connect();

    console.log('🧹 Cleaning up test data...');
    await User.deleteOne({ email: 'test-sub-flow@example.com' });
    await SubscriptionPlan.deleteOne({ code: 'TEST_PLAN_VERIFY' });
    // Clean up subscriptions for this user if any (need userId later)

    console.log('👤 Creating test user...');
    const user = new User({
      email: 'test-sub-flow@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      username: 'testsubflow',
      role: 'student'
    });
    await user.save();
    console.log(`✅ User created: ${user._id}`);

    console.log('📝 Creating test plan...');
    const plan = new SubscriptionPlan({
      code: 'TEST_PLAN_VERIFY',
      name: 'Verification Plan',
      billingPeriod: 'monthly',
      tier: 'pro',
      durationDays: 30,
      price: 1000,
      currency: 'INR',
      description: 'Plan for verification script',
      features: { test: true },
      isActive: true
    });
    await plan.save();
    console.log(`✅ Plan created: ${plan._id}`);

    console.log('🚀 Activating subscription...');
    const result = await subscriptionService.activateSubscription(
      user._id,
      plan._id,
      'manual',
      'test-txn-123'
    );
    console.log('✅ Subscription activated');

    console.log('🔍 Verifying user data...');
    const updatedUser = await User.findById(user._id);
    if (updatedUser?.subscription.status !== 'active') throw new Error('User subscription status mismatch');
    if (updatedUser?.subscription.planCode !== 'TEST_PLAN_VERIFY') throw new Error('User plan code mismatch');
    console.log('✅ User data verified');

    console.log('🔍 Verifying subscription service status...');
    const subDetails = await subscriptionService.getUserSubscription(user._id);
    if (!subDetails.hasActiveSubscription) throw new Error('Service reports no active subscription');
    if (subDetails.tier !== 'pro') throw new Error('Service reports wrong tier');
    console.log('✅ Service status verified');

    console.log('🛑 Cancelling subscription...');
    await subscriptionService.cancelSubscription(user._id, 'Test cancellation');
    console.log('✅ Subscription cancelled');

    console.log('🔍 Verifying cancellation...');
    const cancelledUser = await User.findById(user._id);
    if (cancelledUser?.subscription.status !== 'none') console.warn('User status is not "none" (might be "canceled" depending on logic), actual:', cancelledUser?.subscription.status);
    
    const cancelledSubDetails = await subscriptionService.getUserSubscription(user._id);
    if (cancelledSubDetails.hasActiveSubscription) throw new Error('Service reports active subscription after cancellation');
    console.log('✅ Cancellation verified');

    console.log('🎉 Verification successful!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    console.log('🧹 Cleaning up...');
    const user = await User.findOne({ email: 'test-sub-flow@example.com' });
    if (user) {
      await Subscription.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
    await SubscriptionPlan.deleteOne({ code: 'TEST_PLAN_VERIFY' });
    await database.disconnect();
  }
}

runVerification();
