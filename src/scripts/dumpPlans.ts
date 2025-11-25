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
    const plans = await SubscriptionPlan.find({ isActive: true }).lean().exec();
    console.log(JSON.stringify(plans, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to fetch plans', err);
    process.exit(2);
  }
}

main();
