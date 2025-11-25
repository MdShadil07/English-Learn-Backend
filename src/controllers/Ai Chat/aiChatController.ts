import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { GeminiAIService, GenerateResponseRequest, ChatMessage } from '../../services/Ai Chat/geminiService.js';
import { authenticate } from '../../middleware/auth/auth.js';
import UserProfile from '../../models/UserProfile.js';
import User from '../../models/User.js';
import aiChatSettingsService from '../../services/Ai Chat/aiChatSettingsService.js';
import Progress from '../../models/Progress.js';
import { progressOptimizationService } from '../../services/Progress/progressOptimizationService.js';
import * as xpCalculator from '../../services/Gamification/xpCalculator.js';
import { optimizedAccuracyTracker } from '../../services/Accuracy/index.js';
import { trackAIChatMessage } from '../../middleware/streakTracking.js';
import { cache } from '../../middleware/cache.js';

// Extend Request interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    _id: any;
    id: string;
    tier?: string;
  };
}

const router = Router();

// Rate limiting for AI requests
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    // Different limits based on user tier
    const userTier = (req as AuthenticatedRequest).user?.tier || 'free';
    return userTier === 'premium' ? 100 : userTier === 'pro' ? 50 : 20;
  },
  message: 'Too many AI requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const geminiService = new GeminiAIService(process.env.GEMINI_API_KEY!);

// Generate AI response with streaming support
router.post('/generate',
  authenticate,
  trackAIChatMessage, // ✨ Automatically track AI chat for streaks
  aiRateLimit,
  [
    body('message').isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
    body('personalityId').isString().withMessage('Valid personality required'),
    body('language').optional().isString().withMessage('Valid language required'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { message, personalityId, language = 'en', conversationHistory = [], userProfile } = req.body;
      const userId = ((req as any).user._id || (req as any).user.id).toString();

      // Fetch AI chat settings to get user's preferred response language
      let responseLanguage = 'english'; // Default
      let userNativeLanguage: string | undefined;
      let userTier: string | undefined;
      
      try {
        // Get AI chat settings for response language
        const effectiveLanguage = await aiChatSettingsService.getEffectiveLanguage(userId);
        responseLanguage = effectiveLanguage.responseLanguage;
        userNativeLanguage = effectiveLanguage.translationLanguage || undefined;
        
        // Also get user tier from User model
        const user = await User.findById(userId);
        userTier = user?.tier;
      } catch (settingsError) {
        console.warn('Could not fetch AI chat settings, using defaults:', settingsError);
        // Continue with defaults
        
        // Try to at least get native language from profile
        try {
          const userProfileDb = await UserProfile.findOne({ userId });
          userNativeLanguage = userProfileDb?.nativeLanguage;
        } catch (profileError) {
          console.warn('Could not fetch user profile:', profileError);
        }
      }

      // Get personality data (would come from database/cache in real implementation)
      const personality = await getPersonalityById(personalityId);
      if (!personality) {
        res.status(400).json({ error: 'Invalid personality' });
        return;
      }

      const request: GenerateResponseRequest = {
        userMessage: message,
        personality,
        conversationHistory: conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.parts,
          timestamp: new Date(msg.timestamp || Date.now()),
        })),
        language,
        userId,
        userNativeLanguage, // Pass native language for translations
        userTier, // Pass tier for enhanced formatting
        responseLanguage, // Pass user's preferred response language
        userProfile: userProfile ? {
          userName: userProfile.userName,
          userLevel: userProfile.userLevel,
          totalXP: userProfile.totalXP,
          currentStreak: userProfile.currentStreak,
          skillLevels: userProfile.skillLevels
        } : undefined
      };

      // Set up Server-Sent Events
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',');
      const origin = req.headers.origin;

      const corsHeaders = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Check if origin is allowed
      if (origin && allowedOrigins.includes(origin)) {
        (corsHeaders as any)['Access-Control-Allow-Origin'] = origin;
      } else if (allowedOrigins.length > 0) {
        (corsHeaders as any)['Access-Control-Allow-Origin'] = allowedOrigins[0];
      }

      res.writeHead(200, corsHeaders);

      let fullResponse = '';

      // Stream the response from Gemini
      const streamResponse = await geminiService.generateResponse(request);

      // For now, send the complete response (we'll implement chunked streaming later)
      fullResponse = streamResponse.response;

      // ⚡ QUEUE ACCURACY ANALYSIS + XP CALCULATION (NON-BLOCKING)
      // This runs in the background, so AI response returns immediately
      try {
        console.log('🔄 ========== QUEUEING BACKGROUND ACCURACY JOB ==========');
        console.log(`👤 User ID: ${userId.substring(0, 8)}`);
        console.log(`📝 Message: "${request.userMessage}"`);
        console.log(`🤖 Response length: ${fullResponse.length} chars`);
        console.log(`🎯 Tier: ${userTier}`);
        
        const { comprehensiveJobScheduler } = await import('../../jobs/comprehensiveJobScheduler.js');
        
        // Queue the job (returns immediately, processes in background)
        const jobId = await comprehensiveJobScheduler.queueAccuracyAnalysis({
          userId,
          userMessage: request.userMessage,
          aiResponse: fullResponse,
          userTier: userTier as 'free' | 'pro' | 'premium',
          userLevel: undefined, // Will be auto-detected from DB
          previousAccuracy: undefined, // Will be fetched from DB
          timestamp: Date.now(),
        });
        
        console.log(`✅ Queued background job ${jobId} for user ${userId.substring(0, 8)}`);
        console.log('🔄 Job will process accuracy + XP in background');
        console.log('========================================================');
      } catch (error) {
        console.error('❌ ========== ERROR QUEUEING BACKGROUND JOB ==========');
        console.error('Error:', error);
        console.error('====================================================');
        // Don't fail the request if queue fails
      }

      // Send the response as SSE IMMEDIATELY (don't wait for accuracy/XP)
      res.write(`data: ${JSON.stringify({ chunk: fullResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

    } catch (error) {
      console.error('AI generation error:', error);
      // Send error as SSE
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate AI response' })}\n\n`);
      res.end();
    }
  }
);

// Analyze message accuracy
router.post('/analyze',
  authenticate,
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many analysis requests',
  }),
  [
    body('message').isLength({ min: 1, max: 2000 }).withMessage('Message too long'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { message } = req.body;
      const userId = (req.user!._id || req.user!.id).toString();
      const userTier = req.user!.tier || 'free';

  const analysis = await geminiService.analyzeMessage(message, userId, userTier);

      // ⚡ OPTIMIZED: Track accuracy using batched service (non-blocking, debounced)
      try {
        optimizedAccuracyTracker.trackAccuracy({
          userId,
          messageText: message,
          overallScore: analysis.overall || 0,
          grammarScore: analysis.grammar || 0,
          vocabularyScore: analysis.vocabulary || 0,
          spellingScore: analysis.spelling || 0,
          fluencyScore: analysis.fluency || 0,
        }).catch((error: Error) => {
          console.error('❌ Error tracking accuracy (non-blocking):', error);
        });

        console.log(`✅ Accuracy queued for user ${userId}: Overall=${analysis.overall}%`);
      } catch (error) {
        console.error('❌ Error queuing accuracy:', error);
        // Don't fail the request if tracking fails
      }

      // ⚡ CALCULATE & AWARD XP (Optimized - Cached & Batched)
      try {
        // Get user progress for streak calculation
        const progress = await Progress.findOne({ userId }).select('streak.current tier currentLevel').lean();
        const streakDays = progress?.streak?.current || 0;
        const tierMultiplier = progress?.tier || (userTier === 'premium' ? 1.5 : userTier === 'pro' ? 1.25 : 1.0);
        const currentLevel = progress?.currentLevel || 1;

        // ✅ Calculate XP using Gamification service (single source of truth)
        const analysisStats = (analysis as any)?.statistics || {};
        const errorCount = analysisStats.errorCount ?? analysisStats.totalErrors ?? (analysis as any)?.totalErrors ?? 0;
        const criticalErrorCount = analysisStats.criticalErrorCount ?? analysisStats.criticalErrors ?? 0;
        const grammarHeuristicFailed = Boolean((analysis as any)?.categoryDetails?.grammar?.heuristicPenalties?.length);

        const xpResult = xpCalculator.calculateTotalXP({
          baseAmount: 10, // Base XP for a message
          accuracy: analysis.overall || 0,
          streakDays,
          tierMultiplier,
          currentLevel,
          errorCount: Number(errorCount) || 0,
          criticalErrorCount: Number(criticalErrorCount) || 0,
          isPerfectMessage: analysis.overall >= 100,
          grammarHeuristicFailed,
        });

        if (xpResult.totalXP !== 0) {
          const xpSource = xpResult.totalXP >= 0 ? 'ai_chat' : 'penalty';

          // ✅ Award XP using optimization service (debounced & batched)
          await progressOptimizationService.addXP(
            userId,
            xpResult.totalXP,
            xpSource,
            'conversation'
          );
        }

  console.log(`✅ XP result for user ${userId}: ${xpResult.totalXP >= 0 ? '+' : ''}${xpResult.totalXP} XP (accuracy: ${analysis.overall}%, errors: ${Number(errorCount) || 0}, level: ${currentLevel})`);
      } catch (error) {
        console.error('❌ Error awarding XP:', error);
        // Don't fail the request if XP fails
      }

      res.json(analysis);
    } catch (error: any) {
      console.error('Analysis error:', error);

      // Provide user-friendly error message
      const errorMessage = error?.message || 'An unexpected error occurred';
      const statusCode = error?.statusCode || 500;

      res.status(statusCode).json({
        error: 'Failed to analyze message',
        message: process.env.NODE_ENV === 'development' ? errorMessage : 'Please try again later'
      });
    }
  }
);

// Get available personalities (cached)
router.get('/personalities',
  cache('personalities', 3600), // Cache for 1 hour
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      const personalities = await getAvailablePersonalities(user?.tier || 'free');
      res.json(personalities);
    } catch (error) {
      console.error('Personalities fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch personalities' });
    }
  }
);

// Health check for AI service
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if queues are healthy
    const responseQueueHealth = await geminiService.checkQueueHealth();
    res.json({
      status: 'healthy',
      queues: responseQueueHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check error:', error);

    const errorMessage = error?.message || 'Unknown health check error';
    res.status(503).json({
      status: 'unhealthy',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions (would be in separate service layer)
async function getPersonalityById(id: string) {
  // All trained AI personalities
  const personalities = {
    'basic-tutor': {
      id: 'basic-tutor',
      name: 'Alex Mentor',
      tier: 'free' as const,
      features: ['Basic grammar', 'Vocabulary building', 'Step-by-step learning'],
    },
    'conversation-coach': {
      id: 'conversation-coach',
      name: 'Nova Coach',
      tier: 'pro' as const,
      features: ['Conversation practice', 'Pronunciation', 'Natural dialogue'],
    },
    'grammar-expert': {
      id: 'grammar-expert',
      name: 'Iris Expert',
      tier: 'pro' as const,
      features: ['Advanced grammar', 'Writing improvement', 'Error analysis'],
    },
    'business-mentor': {
      id: 'business-mentor',
      name: 'Atlas Professional',
      tier: 'premium' as const,
      features: ['Business English', 'Professional communication', 'Interview prep'],
    },
    'cultural-guide': {
      id: 'cultural-guide',
      name: 'Luna Culture',
      tier: 'premium' as const,
      features: ['Cultural insights', 'Idiomatic expressions', 'Regional variations'],
    },
  };

  return personalities[id as keyof typeof personalities] || null;
}

async function getAvailablePersonalities(userTier: string) {
  // Return personalities available to user's tier
  const allPersonalities = [
    {
      id: 'basic-tutor',
      name: 'Alex Mentor',
      description: 'Encouraging starter coach',
      tier: 'free',
      features: ['Step-by-step grammar', 'Vocabulary building', 'Beginner-friendly'],
    },
    {
      id: 'conversation-coach',
      name: 'Nova Coach',
      description: 'Dynamic conversation guide',
      tier: 'pro',
      features: ['Natural dialogue', 'Pronunciation tips', 'Real-world scenarios'],
    },
    {
      id: 'grammar-expert',
      name: 'Iris Expert',
      description: 'Advanced grammar specialist',
      tier: 'pro',
      features: ['Advanced grammar', 'Writing improvement', 'Error analysis'],
    },
    {
      id: 'business-mentor',
      name: 'Atlas Professional',
      description: 'Business English expert',
      tier: 'premium',
      features: ['Business communication', 'Professional writing', 'Interview prep'],
    },
    {
      id: 'cultural-guide',
      name: 'Luna Culture',
      description: 'Cultural insights specialist',
      tier: 'premium',
      features: ['Cultural nuances', 'Idiomatic expressions', 'Regional variations'],
    },
  ];

  const tierOrder = { free: 0, pro: 1, premium: 2 };
  const userTierLevel = tierOrder[userTier as keyof typeof tierOrder] || 0;

  return allPersonalities.filter(p =>
    tierOrder[p.tier as keyof typeof tierOrder] <= userTierLevel
  );
}

export default router;
