import mongoose from 'mongoose';
import { User, SubscriptionPlan, Subscription, Payment, Event } from '../src/models';
import dotenv from 'dotenv';

dotenv.config();

async function verifySchemas() {
  console.log('Verifying schemas...');

  try {
    // 1. Verify User Schema
    console.log('Checking User schema...');
    const userPaths = User.schema.paths;
    if (!userPaths['subscription.planCode']) throw new Error('User: subscription.planCode missing');
    if (!userPaths['subscription.status']) throw new Error('User: subscription.status missing');
    console.log('User schema OK');

    // 2. Verify SubscriptionPlan Schema
    console.log('Checking SubscriptionPlan schema...');
    const planPaths = SubscriptionPlan.schema.paths;
    if (!planPaths['code']) throw new Error('SubscriptionPlan: code missing');
    if (!planPaths['billingPeriod']) throw new Error('SubscriptionPlan: billingPeriod missing');
    console.log('SubscriptionPlan schema OK');

    // 3. Verify Subscription Schema
    console.log('Checking Subscription schema...');
    const subPaths = Subscription.schema.paths;
    if (!subPaths['razorpay.subscriptionId']) throw new Error('Subscription: razorpay.subscriptionId missing');
    if (!subPaths['status']) throw new Error('Subscription: status missing');
    console.log('Subscription schema OK');

    // 4. Verify Payment Schema
    console.log('Checking Payment schema...');
    const paymentPaths = Payment.schema.paths;
    if (!paymentPaths['paymentId']) throw new Error('Payment: paymentId missing');
    if (!paymentPaths['status']) throw new Error('Payment: status missing');
    console.log('Payment schema OK');

    // 5. Verify Event Schema
    console.log('Checking Event schema...');
    const eventPaths = Event.schema.paths;
    if (!eventPaths['type']) throw new Error('Event: type missing');
    console.log('Event schema OK');

    console.log('All schemas verified successfully!');
  } catch (error) {
    console.error('Schema verification failed:', error);
    process.exit(1);
  }
}

verifySchemas();
