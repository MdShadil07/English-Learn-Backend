import request from 'supertest';
import { app } from '../index.js';
import { User, Subscription, SubscriptionPlan } from '../models/index.js';
import { generateTokens } from '../middleware/auth/auth.js';

describe('Subscription API Tests', () => {
  let authToken: string;
  let testUser: any;
  let testPlan: any;

  beforeAll(async () => {
    // Create a test user
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser',
      role: 'user',
      isEmailVerified: true
    });

    // Generate auth token
    const tokens = generateTokens(testUser._id.toString(), testUser.email, testUser.role);
    authToken = tokens.accessToken;

    // Create a test subscription plan
    testPlan = await SubscriptionPlan.create({
      code: 'TEST_PRO',
      name: 'Test Pro Plan',
      billingPeriod: 'monthly',
      tier: 'pro',
      durationDays: 30,
      price: 9.99,
      currency: 'USD',
      description: 'Test pro subscription plan',
      features: { maxProjects: 50, aiMessages: 500, prioritySupport: true },
      isActive: true
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await User.deleteMany({ email: 'test@example.com' });
    await Subscription.deleteMany({ userId: testUser._id });
    await SubscriptionPlan.deleteMany({ code: 'TEST_PRO' });
  });

  describe('GET /api/subscription/current', () => {
    it('should return free tier for user without subscription', async () => {
      const response = await request(app)
        .get('/api/subscription/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tier).toBe('free');
      expect(response.body.data.isPremium).toBe(false);
      expect(response.body.data.subscription).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/subscription/current')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });
  });

  describe('GET /api/subscription/active-tier', () => {
    it('should return free tier for user without subscription', async () => {
      const response = await request(app)
        .get('/api/subscription/active-tier')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.activeTier).toBe('free');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/subscription/active-tier')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/subscription/activate', () => {
    it('should activate a subscription successfully', async () => {
      const response = await request(app)
        .post('/api/subscription/activate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: testPlan._id,
          paymentMethod: 'test'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription).toBeDefined();
      expect(response.body.data.subscription.tier).toBe('pro');
      expect(response.body.data.subscription.status).toBe('active');
    });

    it('should require planId', async () => {
      const response = await request(app)
        .post('/api/subscription/activate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethod: 'test'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Plan ID is required');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/subscription/activate')
        .send({
          planId: testPlan._id,
          paymentMethod: 'test'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/subscription/cancel', () => {
    it('should cancel active subscription', async () => {
      // First activate a subscription
      await request(app)
        .post('/api/subscription/activate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: testPlan._id,
          paymentMethod: 'test'
        });

      // Then cancel it
      const response = await request(app)
        .post('/api/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test cancellation'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.status).toBe('canceled');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/subscription/cancel')
        .send({
          reason: 'Test cancellation'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/subscription/plans', () => {
    it('should return active subscription plans', async () => {
      const response = await request(app)
        .get('/api/subscription/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toBeDefined();
      expect(Array.isArray(response.body.data.plans)).toBe(true);
    });
  });

  describe('GET /api/subscription/plans/:tier', () => {
    it('should return plans for specific tier', async () => {
      const response = await request(app)
        .get('/api/subscription/plans/pro')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tier).toBe('pro');
      expect(response.body.data.plans).toBeDefined();
    });

    it('should reject invalid tier', async () => {
      const response = await request(app)
        .get('/api/subscription/plans/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid tier. Must be "pro" or "premium"');
    });
  });
});

// Integration tests for subscription validation service
describe('Subscription Validation Service', () => {
  let testUser: any;
  let testPlan: any;

  beforeAll(async () => {
    testUser = await User.create({
      email: 'validation@example.com',
      password: 'password123',
      username: 'validationuser',
      role: 'user',
      isEmailVerified: true
    });

    testPlan = await SubscriptionPlan.create({
      code: 'VALIDATION_PRO',
      name: 'Validation Pro Plan',
      billingPeriod: 'monthly',
      tier: 'pro',
      durationDays: 30,
      price: 9.99,
      currency: 'USD',
      description: 'Validation test pro subscription plan',
      features: { maxProjects: 50, aiMessages: 500, prioritySupport: true },
      isActive: true
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'validation@example.com' });
    await Subscription.deleteMany({ userId: testUser._id });
    await SubscriptionPlan.deleteMany({ code: 'VALIDATION_PRO' });
  });

  it('should return free tier for user without subscription', async () => {
    const subscriptionValidationService = await import('../services/Subscription/subscriptionValidation.service.js');
    const activeTier = await subscriptionValidationService.default.getActiveTier(testUser._id);
    expect(activeTier).toBe('free');
  });

  it('should validate subscription consistency', async () => {
    const subscriptionValidationService = await import('../services/Subscription/subscriptionValidation.service.js');
    const validation = await subscriptionValidationService.default.validateSubscriptionConsistency(testUser._id);
    expect(validation.isConsistent).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('should fix subscription inconsistencies', async () => {
    const subscriptionValidationService = await import('../services/Subscription/subscriptionValidation.service.js');
    const fix = await subscriptionValidationService.default.fixSubscriptionConsistency(testUser._id);
    expect(fix.fixed).toBe(true);
  });
});
