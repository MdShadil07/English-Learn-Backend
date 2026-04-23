import { Request, Response } from 'express';
import { analyzeMessage } from '../../utils/calculators/accuracyCalculator.js';


import Progress, { IAccuracyData } from '../../models/Progress.js';
import { centralizedAccuracyService } from '../../services/Accuracy/centralizedAccuracyService.js';
import { processAccuracyRequest } from '../../services/Accuracy/accuracyProcessingService.js';
import type {
  UserTier,
  UserProficiencyLevel,
  UnifiedAccuracyResult,
  CategoryMetricMap,
  CategoryTrendInsight,
} from '../../utils/calculators/unifiedAccuracyCalculators.js';

const ALLOWED_USER_TIERS: ReadonlyArray<UserTier> = ['free', 'pro', 'premium'];

const normalizeTier = (value: unknown): UserTier => {
  if (typeof value === 'string') {
    const lowered = value.toLowerCase() as UserTier;
    if ((ALLOWED_USER_TIERS as ReadonlyArray<UserTier>).includes(lowered)) {
      return lowered;
    }
  }
  return 'free';
};

const isValidObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

type AccuracyMilestone = {
  type: 'Beginner' | 'Intermediate' | 'Advanced';
  target: number;
  current: number;
  progress: number;
};

type CategoryKey = 'grammar' | 'vocabulary' | 'spelling' | 'pronunciation';

type CategoryDiagnostic = {
  score: number;
  metrics?: CategoryMetricMap[CategoryKey];
  milestone: AccuracyMilestone | null;
  milestoneHint?: string | null;
  trend?: CategoryTrendInsight;
};

const deriveCategoryHint = (
  category: CategoryKey,
  metrics: CategoryMetricMap[CategoryKey] | undefined,
  milestone: AccuracyMilestone | null
): string | null => {
  if (!metrics) {
    return milestone ? `You are ${Math.max(0, milestone.target - milestone.current)} points away from the ${milestone.type.toLowerCase()} milestone for ${category}.` : null;
  }

  let hint: string | null = null;

  switch (category) {
    case 'grammar': {
      const grammarMetrics = metrics as CategoryMetricMap['grammar'];
      if ((grammarMetrics?.totalErrors ?? 0) === 0) {
        hint = 'Maintain your error-free grammar streak to lock in the next milestone.';
        break;
      }
      const dominantPattern = grammarMetrics?.dominantPatterns?.[0];
      if (dominantPattern) {
        hint = `Address ${dominantPattern.toLowerCase()} to boost grammar accuracy.`;
        break;
      }
      if ((grammarMetrics?.weightedPenalty ?? 0) > 35) {
        hint = 'Reduce high-severity grammar issues to accelerate milestone progress.';
      }
      break;
    }
    case 'vocabulary': {
      const vocabularyMetrics = metrics as CategoryMetricMap['vocabulary'];
      if ((vocabularyMetrics?.repetitionRate ?? 0) > 30) {
        hint = 'Increase word variety to cut repetition penalties in vocabulary.';
        break;
      }
      if ((vocabularyMetrics?.rangeScore ?? 0) < 65) {
        hint = 'Incorporate advanced word choices to widen your vocabulary range.';
      }
      break;
    }
    case 'spelling': {
      const spellingMetrics = metrics as CategoryMetricMap['spelling'];
      if ((spellingMetrics?.normalizedDensity ?? 0) > 5) {
        hint = 'Focus on proofreading key content words to tighten spelling accuracy.';
        break;
      }
      const contentDensity = spellingMetrics?.densityPerTokenType?.content ?? 0;
      const functionDensity = spellingMetrics?.densityPerTokenType?.function ?? 0;
      if (functionDensity > contentDensity) {
        hint = 'Watch common connectors and contractions—they are driving your spelling slips.';
      }
      break;
    }
    case 'pronunciation': {
      const pronunciationMetrics = metrics as CategoryMetricMap['pronunciation'];
      if ((pronunciationMetrics?.prosody ?? 0) < 70) {
        hint = 'Add more varied punctuation to mirror natural speech rhythm.';
        break;
      }
      if ((pronunciationMetrics?.intelligibility ?? 0) < 65) {
        hint = 'Break complex ideas into shorter phrases to improve intelligibility.';
      }
      break;
    }
  }

  if (!hint && metrics?.trend?.momentum === 'declining') {
    const readableCategory = category === 'pronunciation' ? 'fluency' : category;
    return `Your ${readableCategory} accuracy is trending down—focus on recent practice to regain momentum.`;
  }

  if (hint) {
    return hint;
  }

  if (milestone) {
    return `Push ${Math.max(0, milestone.target - milestone.current)} more points to reach the ${milestone.type.toLowerCase()} milestone for ${category}.`;
  }
  return null;
};

const buildCategoryDiagnostics = (analysis: UnifiedAccuracyResult): Record<CategoryKey, CategoryDiagnostic> => {
  const diagnostics = {} as Record<CategoryKey, CategoryDiagnostic>;
  const details = analysis.categoryDetails as CategoryMetricMap | undefined;

  const mapping: Array<[CategoryKey, number]> = [
    ['grammar', analysis.grammar],
    ['vocabulary', analysis.vocabulary],
    ['spelling', analysis.spelling],
    ['pronunciation', analysis.fluency],
  ];

  for (const [category, score] of mapping) {
    const milestone = computeNextMilestone(score);
    const metrics = details?.[category];
    diagnostics[category] = {
      score,
      metrics,
      milestone,
      milestoneHint: deriveCategoryHint(category, metrics, milestone),
      trend: metrics?.trend,
    };
  }

  return diagnostics;
};

const computeNextMilestone = (score?: number | null): AccuracyMilestone | null => {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return null;
  }

  const value = Math.max(0, Math.min(100, score));

  if (value < 60) {
    return {
      type: 'Beginner',
      target: 60,
      current: value,
      progress: Math.round((value / 60) * 100),
    };
  }

  if (value < 80) {
    return {
      type: 'Intermediate',
      target: 80,
      current: value,
      progress: Math.round(((value - 60) / 20) * 100),
    };
  }

  if (value < 90) {
    return {
      type: 'Advanced',
      target: 90,
      current: value,
      progress: Math.round(((value - 80) / 10) * 100),
    };
  }

  return null;
};

/**
 * ENTERPRISE ACCURACY CONTROLLER WITH NLP INTEGRATION
 * Handles tier-based message analysis with premium features
 * Integrates LanguageTool & GPT fluency scoring
 * Redis caching for NLP responses
 * Saves to Progress schema with XP calculation
 * Backward compatible with legacy enhanced calculator
 */
/**
 * Accuracy Controller
 * Handles message analysis and accuracy calculations
 */

export class AccuracyController {
 

  /**
   * * 💎 Analyze message with tier-based premium features
   * 
   * FREE: Basic grammar (7 patterns), simple feedback
   * PRO: Advanced grammar (20+ patterns), tone analysis, readability, detailed explanations
   * PREMIUM: Everything + AI analysis, coherence, style, idiomatic suggestions, learning path
   * 
   * ✅ NOW SAVES TO PROGRESS SCHEMA (optimized with debouncing & caching)
   * Analyze message accuracy
   */
  async analyzeMessage(req: Request, res: Response) {
    try {
      const {
        userMessage,
        aiResponse = '',
        previousAccuracy,
        userTier = 'free',
        userLevel,
        userId,
      } = req.body ?? {};

      if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'User message is required',
        });
      }

      const tier = normalizeTier(userTier);
      const proficiency = typeof userLevel === 'string' ? (userLevel as UserProficiencyLevel) : undefined;

      let validatedUserId: string | undefined;
      let effectivePreviousAccuracy: Partial<IAccuracyData> | undefined;

      if (isValidObjectId(userId)) {
        validatedUserId = userId;

        if (previousAccuracy && typeof previousAccuracy === 'object') {
          effectivePreviousAccuracy = previousAccuracy as Partial<IAccuracyData>;
        }
      } else if (userId) {
        console.warn('[Accuracy] Received invalid userId; skipping weighted merge.');
      }

      console.log('[Accuracy] analyzeMessage', {
        userId: validatedUserId,
        tier,
        withHistory: Boolean(effectivePreviousAccuracy),
      });

      const result = await processAccuracyRequest({
        userId: validatedUserId,
        userMessage,
        aiResponse,
        userTier: tier,
        userLevel: proficiency,
        previousAccuracy: effectivePreviousAccuracy,
      });

      const accuracySummary = {
        current: result.currentAccuracy,
        weighted: result.weightedAccuracy,
        cache: result.cacheSummary,
        previous: effectivePreviousAccuracy ?? null,
      };

      const categoryDiagnostics = buildCategoryDiagnostics(result.analysis);
      const categoryMomentum: Record<CategoryKey, CategoryTrendInsight['momentum']> = {
        grammar: 'stable',
        vocabulary: 'stable',
        spelling: 'stable',
        pronunciation: 'stable',
      };

      for (const key of Object.keys(categoryDiagnostics) as CategoryKey[]) {
        const diagnostic = categoryDiagnostics[key];
        if (diagnostic?.trend?.momentum) {
          categoryMomentum[key] = diagnostic.trend.momentum;
        }
      }

      const milestoneHints = Object.values(categoryDiagnostics)
        .map((item) => item.milestoneHint)
        .filter((hint): hint is string => Boolean(hint));

      const tierInfo = {
        tier,
        isPro: tier !== 'free',
        isPremium: tier === 'premium',
      };

      const nextMilestone = computeNextMilestone(
        result.weightedAccuracy.overall ?? result.analysis.overall
      );

      const analysis = analyzeMessage(userMessage, aiResponse);

      return res.json({
        success: true,
        data: {
          analysis: {
            ...result.analysis,
            tierInfo,
            accuracyInsights: {
              trendDirection: 'stable',
              confidenceLevel: result.analysis.insights?.confidence,
              recommendations: result.analysis.feedback?.slice(0, 3) ?? [],
              nextMilestone,
              milestoneHints,
              categoryMomentum,
            },
            categoryDiagnostics,
          },
          accuracy: accuracySummary,
          historicalControls: result.historicalControls ?? null,
        },
      });
    } catch (error) {
      console.error('❌ Error analyzing message:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze message',
      });
    }
  }

  /**
   * Get real-time accuracy insights and trends
   * GET /api/accuracy/insights/:userId
   */
  async getAccuracyInsights(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      console.log(`📊 Getting accuracy insights for user: ${userId}`);

      // Get real-time accuracy from centralized service
      const realTimeAccuracy = await centralizedAccuracyService.getRealTimeAccuracy(userId);
      
      if (!realTimeAccuracy) {
        return res.status(404).json({
          success: false,
          message: 'No accuracy data found for user'
        });
      }

      // Get historical context for additional insights
      const { enhancedWeightedAccuracyService } = await import('../../utils/calculators/enhancedWeightedAccuracy.js');
      // Note: getHistoricalContext not exposed in new service, using basic context
      const historicalContext = null; // TODO: Add getHistoricalContext to enhancedWeightedAccuracyService

      const insights = {
        realTimeAccuracy,
        historicalContext,
        summary: {
          currentLevel: this.getProficiencyLevel(realTimeAccuracy.accuracy.overall || 0),
          trend: 'stable',
          confidence: 0.5,
          messageCount: 0,
        },
        recommendations: this.generateQuickRecommendations(realTimeAccuracy.accuracy, null),
      };

      return res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      console.error('Error getting accuracy insights:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get accuracy insights'
      });
    }
  }
  /**
   * Get proficiency level based on overall accuracy
   */
  private getProficiencyLevel(overallAccuracy: number): string {
    if (overallAccuracy >= 90) return 'Expert';
    if (overallAccuracy >= 80) return 'Advanced';
    if (overallAccuracy >= 70) return 'Intermediate';
    if (overallAccuracy >= 60) return 'Beginner';
    return 'Novice';
  }

  /**
   * Generate quick recommendations for insights endpoint
   */
  private generateQuickRecommendations(accuracy: any, historicalContext: any): string[] {
    const recommendations: string[] = [];
    const overall = accuracy.overall || 0;
    
    if (overall < 70) {
      recommendations.push('Focus on fundamentals to build a strong foundation');
    }
    
    if (accuracy.grammar < 70) {
      recommendations.push('Practice grammar exercises daily');
    }
    
    if (accuracy.vocabulary < 70) {
      recommendations.push('Learn 5 new words every day');
    }
    
    if (historicalContext?.trendData?.direction === 'declining') {
      recommendations.push('Review previous lessons to reinforce learning');
    } else if (historicalContext?.trendData?.direction === 'improving') {
      recommendations.push('Great progress! Challenge yourself with advanced topics');
    }
    
    return recommendations.slice(0, 3);
  }

  /**
   * Get message analysis history (placeholder)
   */
  async getAnalysisHistory(req: Request, res: Response) {
    try {
      // TODO: Implement analysis history from database
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      console.error('Error getting analysis history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get analysis history'
      });
    }
  }
}

export const accuracyController = new AccuracyController();
