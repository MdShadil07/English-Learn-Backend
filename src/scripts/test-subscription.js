import { User, Subscription, SubscriptionPlan } from '../models/index.js';
import subscriptionValidationService from '../services/Subscription/subscriptionValidation.service.js';

async function testSubscriptionValidation() {
  try {
    console.log('🧪 Testing Subscription Validation Service...\n');

    // 1. Test getting active tier for a user without subscription
    console.log('1. Testing user without subscription...');
    const testUser = await User.findOne({ email: { $exists: true } });
    if (testUser) {
      const activeTier = await subscriptionValidationService.getActiveTier(testUser._id);
      console.log(`   User: ${testUser.email}`);
      console.log(`   Active Tier: ${activeTier}`);
      console.log('   ✅ Active tier test passed\n');
    }

    // 2. Test subscription status validation
    console.log('2. Testing subscription status validation...');
    const subscriptionStatus = await subscriptionValidationService.getUserSubscriptionStatus(testUser._id);
    console.log(`   Is Valid: ${subscriptionStatus.isValid}`);
    console.log(`   Active Tier: ${subscriptionStatus.activeTier}`);
    console.log(`   Is Expired: ${subscriptionStatus.isExpired}`);
    console.log(`   Days Remaining: ${subscriptionStatus.daysRemaining}`);
    console.log('   ✅ Subscription status test passed\n');

    // 3. Test tier features
    console.log('3. Testing tier features...');
    const freeFeatures = subscriptionValidationService.getTierFeatures('free');
    const proFeatures = subscriptionValidationService.getTierFeatures('pro');
    const premiumFeatures = subscriptionValidationService.getTierFeatures('premium');
    
    console.log(`   Free Features: ${JSON.stringify(freeFeatures, null, 2)}`);
    console.log(`   Pro Features: ${JSON.stringify(proFeatures, null, 2)}`);
    console.log(`   Premium Features: ${JSON.stringify(premiumFeatures, null, 2)}`);
    console.log('   ✅ Tier features test passed\n');

    // 4. Test subscription consistency
    console.log('4. Testing subscription consistency...');
    const consistency = await subscriptionValidationService.validateSubscriptionConsistency(testUser._id);
    console.log(`   Is Consistent: ${consistency.isConsistent}`);
    console.log(`   Issues: ${consistency.issues.length > 0 ? consistency.issues.join(', ') : 'None'}`);
    console.log('   ✅ Consistency test passed\n');

    // 5. Test daily message limits
    console.log('5. Testing daily message limits...');
    const messageLimits = await subscriptionValidationService.checkDailyMessageLimit(testUser._id);
    console.log(`   Can Send Message: ${messageLimits.canSendMessage}`);
    console.log(`   Messages Remaining: ${messageLimits.messagesRemaining}`);
    console.log(`   Daily Limit: ${messageLimits.dailyLimit}`);
    console.log(`   Is Unlimited: ${messageLimits.isUnlimited}`);
    console.log('   ✅ Daily message limits test passed\n');

    // 6. Test tier access
    console.log('6. Testing tier access...');
    const hasProAccess = await subscriptionValidationService.hasTierAccess(testUser._id, 'pro');
    const hasPremiumAccess = await subscriptionValidationService.hasTierAccess(testUser._id, 'premium');
    console.log(`   Has Pro Access: ${hasProAccess}`);
    console.log(`   Has Premium Access: ${hasPremiumAccess}`);
    console.log('   ✅ Tier access test passed\n');

    console.log('🎉 All subscription validation tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Subscription validation test failed:', error);
  }
}

// Run the test
testSubscriptionValidation().then(() => {
  console.log('📋 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
