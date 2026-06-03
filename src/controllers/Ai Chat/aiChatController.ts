import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { GeminiAIService, GenerateResponseRequest, ChatMessage } from '../../services/Ai Chat/geminiService.js';
import { authenticate, AuthRequest } from '../../middleware/auth/auth.js';
import UserProfile from '../../models/UserProfile.js';
import User from '../../models/User.js';
import aiChatSettingsService from '../../services/Ai Chat/aiChatSettingsService.js';
import Progress from '../../models/Progress.js';
import { progressOptimizationService } from '../../services/Progress/progressOptimizationService.js';
import * as xpCalculator from '../../services/Gamification/xpCalculator.js';
import { optimizedAccuracyTracker } from '../../services/Accuracy/index.js';
import { trackAIChatMessage } from '../../middleware/streakTracking.js';
import { cache } from '../../middleware/cache.js';
import { conversationPersistenceService } from '../../services/Ai Chat/conversationPersistenceService.js';
import { getAIChatConversationQueueStats } from '../../queues/aiChatConversationQueue.js';

// Type alias for consistency
type AuthenticatedRequest = AuthRequest;

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

const getAuthUserId = (req: AuthenticatedRequest): string => {
  return ((req as any).user._id || (req as any).user.id).toString();
};

// Load saved AI conversations for the signed-in user.
router.get('/conversations', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = getAuthUserId(req);
    const limit = Number(req.query.limit || 50);
    const conversations = await conversationPersistenceService.listConversations(userId, limit);

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error('Failed to load AI chat conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load AI chat conversations',
    });
  }
});

// Load messages for one saved conversation.
router.get('/conversations/:conversationId/messages', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = getAuthUserId(req);
    const { conversationId } = req.params;
    const limit = Number(req.query.limit || 1000);
    const messages = await conversationPersistenceService.getMessages(userId, conversationId, limit);

    res.json({
      success: true,
      conversationId,
      messages,
    });
  } catch (error) {
    console.error('Failed to load AI chat messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load AI chat messages',
    });
  }
});

// Queue a completed user+assistant turn. The service batches DB writes behind the scenes.
router.post(
  '/conversations/turn',
  authenticate,
  [
    body('conversationId').isString().isLength({ min: 1, max: 120 }).withMessage('Valid conversationId is required'),
    body('personalityId').isString().isLength({ min: 1, max: 80 }).withMessage('Valid personalityId is required'),
    body('title').optional().isString().isLength({ max: 160 }).withMessage('Title is too long'),
    body('messages').isArray({ min: 1, max: 10 }).withMessage('Messages must be a small array'),
    body('messages.*.messageId').isString().isLength({ min: 1, max: 120 }).withMessage('Message id is required'),
    body('messages.*.role').isIn(['user', 'assistant']).withMessage('Invalid message role'),
    body('messages.*.content').isString().isLength({ min: 1, max: 12000 }).withMessage('Message content is required'),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const userId = getAuthUserId(req);
      const { conversationId, personalityId, title = 'AI Chat', messages } = req.body;

      const queueResult = await conversationPersistenceService.queueTurn({
        userId,
        conversationId,
        personalityId,
        title,
        messages: messages.map((message: any) => ({
          messageId: message.messageId,
          role: message.role,
          content: message.content,
          timestamp: new Date(message.timestamp || Date.now()),
          personalityId: message.personalityId || personalityId,
        })),
      });

      res.status(202).json({
        success: true,
        ...queueResult,
      });
    } catch (error) {
      console.error('Failed to queue AI chat turn:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to queue AI chat turn',
      });
    }
  }
);

// Report queue status. Durable queue processing is handled by workers, not API memory.
router.post('/conversations/flush', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stats = await getAIChatConversationQueueStats();

    res.json({
      success: true,
      queued: stats.waiting + stats.active + stats.delayed,
      stats,
    });
  } catch (error) {
    console.error('Failed to flush AI chat conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flush AI chat conversations',
    });
  }
});

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
      const userId = getAuthUserId(req);

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
        userTier = user?.tier as unknown as string | undefined;
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

      // Call Gemini WITHOUT streaming — get the complete response reliably
      const streamResponse = await geminiService.generateResponse({
        ...request,
        // No onChunk — forces non-streaming Gemini call for guaranteed full response
      });

      const fullResponse = streamResponse.response;

      // ⚡ QUEUE ACCURACY ANALYSIS + XP CALCULATION (NON-BLOCKING)
      try {
        console.log('🔄 ========== QUEUEING BACKGROUND ACCURACY JOB ==========');
        console.log(`👤 User ID: ${userId.substring(0, 8)}`);
        console.log(`📝 Message: "${request.userMessage}"`);
        console.log(`🤖 Response length: ${fullResponse.length} chars`);
        console.log(`🎯 Tier: ${userTier}`);
        
        const { comprehensiveJobScheduler } = await import('../../jobs/comprehensiveJobScheduler.js');
        
        const jobId = await comprehensiveJobScheduler.queueAccuracyAnalysis({
          userId,
          userMessage: request.userMessage,
          aiResponse: fullResponse,
          userTier: userTier as 'free' | 'pro' | 'premium',
          userLevel: undefined,
          previousAccuracy: undefined,
          timestamp: Date.now(),
        });
        
        console.log(`✅ Queued background job ${jobId} for user ${userId.substring(0, 8)}`);
        console.log('🔄 Job will process accuracy + XP in background');
        console.log('========================================================');
      } catch (error) {
        console.error('❌ ========== ERROR QUEUEING BACKGROUND JOB ==========');
        console.error('Error:', error);
        console.error('====================================================');
      }

      // Send the complete response as JSON — no SSE, no chunks, no data loss
      res.json({
        success: true,
        response: fullResponse,
      });

    } catch (error) {
      console.error('AI generation error:', error);
      res.status(500).json({ error: 'Failed to generate AI response' });
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
