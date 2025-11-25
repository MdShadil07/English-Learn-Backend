#!/usr/bin/env tsx
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || '';
  if (!mongoUri) {
    console.error('MONGODB connection string not found in env (MONGODB_URI / MONGO_URI / DATABASE_URL)');
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const existing = await SubscriptionPlan.find({}).lean().exec();
    if (existing && existing.length > 0) {
      console.log('Existing plans found, aborting seed.');
      console.log(JSON.stringify(existing, null, 2));
      await mongoose.disconnect();
      process.exit(0);
    }

    const toCreate = [
      { name: 'Pro Monthly', tier: 'pro', planType: 'monthly', durationDays: 30, price: 499, currency: 'INR', description: 'Pro monthly plan', features: [], isActive: true },
      { name: 'Pro Yearly', tier: 'pro', planType: 'yearly', durationDays: 365, price: 4990, currency: 'INR', description: 'Pro yearly plan', features: [], isActive: true },
      { name: 'Premium Monthly', tier: 'premium', planType: 'monthly', durationDays: 30, price: 999, currency: 'INR', description: 'Premium monthly plan', features: [], isActive: true },
      { name: 'Premium Yearly', tier: 'premium', planType: 'yearly', durationDays: 365, price: 9990, currency: 'INR', description: 'Premium yearly plan', features: [], isActive: true },
    ];

    const created = await SubscriptionPlan.create(toCreate as any);
    console.log('Created plans:');
    console.log(JSON.stringify(created, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed plans', err);
    process.exit(2);
  }
}

main();
