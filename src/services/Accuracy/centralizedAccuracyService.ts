/**
 * 🎯 CENTRALIZED ACCURACY SERVICE
 * Industry-level accuracy management with optimized performance
 * 
 * Features:
 * - Single entry point for all accuracy calculations
 * - Intelligent caching and batching for millions of requests
 * - Historical context management
 * - Real-time accuracy tracking
 * - Performance monitoring and optimization
 */

import { enhancedWeightedAccuracyService } from '../../utils/calculators/enhancedWeightedAccuracy.js';
import optimizedAccuracyTracker from './internal/optimizedAccuracyTracker.js';
import { redisCache } from '../../config/redis.js';
import { IAccuracyData } from '../../models/Progress.js';

// ============================================
// HELPER TYPES & FUNCTIONS (Shared Exports)
// ============================================

export interface AccuracyCalculationResult {
  cumulativeAccuracy: Partial<IAccuracyData>;
  skillsUpdate: {
    accuracy?: number;
    overallAccuracy?: number;
    grammar?: number;
    vocabulary?: number;
    fluency?: number;
  };
  calculationCount: number;
  lastCalculated: Date;
}

export interface CurrentAccuracyData {
  overall?: number;
  grammar?: number;
  vocabulary?: number;
  spelling?: number;
  fluency?: number;
  punctuation?: number;
  capitalization?: number;
  syntax?: number;
  coherence?: number;
  calculationCount?: number;
}

function calculateWeightedAverage(oldValue: number, newValue: number, count: number): number {
  if (count === 1) {
    return Math.round(newValue);
  }

  const oldWeight = count - 1;
  const cumulativeValue = (oldValue * oldWeight + newValue) / count;
  return Math.round(cumulativeValue);
}

export function calculateCumulativeAccuracy(
  currentAccuracy: CurrentAccuracyData | null | undefined,
  newAccuracy: Partial<IAccuracyData>
): AccuracyCalculationResult {
  const current: CurrentAccuracyData = currentAccuracy || {};
  const calculationCount = (current.calculationCount || 0) + 1;

  const cumulativeAccuracy: Partial<IAccuracyData> = {};
  const skillsUpdate: Record<string, number> = {};

  if (newAccuracy.overall !== undefined) {
    cumulativeAccuracy.overall = calculateWeightedAverage(
      current.overall || 0,
      newAccuracy.overall,
      calculationCount
    );
    skillsUpdate.accuracy = cumulativeAccuracy.overall;
    skillsUpdate.overallAccuracy = cumulativeAccuracy.overall;
  }

  if (newAccuracy.grammar !== undefined) {
    cumulativeAccuracy.grammar = calculateWeightedAverage(
      current.grammar || 0,
      newAccuracy.grammar,
      calculationCount
    );
    skillsUpdate.grammar = cumulativeAccuracy.grammar;
  }

  if (newAccuracy.vocabulary !== undefined) {
    cumulativeAccuracy.vocabulary = calculateWeightedAverage(
      current.vocabulary || 0,
      newAccuracy.vocabulary,
      calculationCount
    );
    skillsUpdate.vocabulary = cumulativeAccuracy.vocabulary;
  }

  if (newAccuracy.spelling !== undefined) {
    cumulativeAccuracy.spelling = calculateWeightedAverage(
      current.spelling || 0,
      newAccuracy.spelling,
      calculationCount
    );
  }

  if (newAccuracy.fluency !== undefined) {
    cumulativeAccuracy.fluency = calculateWeightedAverage(
      current.fluency || 0,
      newAccuracy.fluency,
      calculationCount
    );
    skillsUpdate.fluency = cumulativeAccuracy.fluency;
  }

  if (newAccuracy.punctuation !== undefined) {
    cumulativeAccuracy.punctuation = calculateWeightedAverage(
      current.punctuation || 0,
      newAccuracy.punctuation,
      calculationCount
    );
  }

  if (newAccuracy.capitalization !== undefined) {
    cumulativeAccuracy.capitalization = calculateWeightedAverage(
      current.capitalization || 0,
      newAccuracy.capitalization,
      calculationCount
    );
  }

  if (newAccuracy.syntax !== undefined) {
    cumulativeAccuracy.syntax = calculateWeightedAverage(
      current.syntax || 0,
      newAccuracy.syntax,
      calculationCount
    );
  }

  if (newAccuracy.coherence !== undefined) {
    cumulativeAccuracy.coherence = calculateWeightedAverage(
      current.coherence || 0,
      newAccuracy.coherence,
      calculationCount
    );
  }

  cumulativeAccuracy.calculationCount = calculationCount;
  cumulativeAccuracy.lastCalculated = new Date();

  return {
    cumulativeAccuracy,
    skillsUpdate,
    calculationCount,
    lastCalculated: new Date(),
  };
}

export function logAccuracyUpdate(
  calculationCount: number,
  currentAccuracy: CurrentAccuracyData | null | undefined,
  newAccuracy: Partial<IAccuracyData>,
  cumulativeAccuracy: Partial<IAccuracyData>
): void {
  const current = currentAccuracy || {};

  console.log(`📊 Cumulative Accuracy Update (Calc #${calculationCount}):`);

  if (newAccuracy.overall !== undefined) {
    console.log(
      `  Overall: ${current.overall || 0}% → ${cumulativeAccuracy.overall || 0}% (new: ${Math.round(
        newAccuracy.overall
      )}%)`
    );
  }

  if (newAccuracy.grammar !== undefined) {
    console.log(
      `  Grammar: ${current.grammar || 0}% → ${cumulativeAccuracy.grammar || 0}% (new: ${Math.round(
        newAccuracy.grammar
      )}%)`
    );
  }

  if (newAccuracy.vocabulary !== undefined) {
    console.log(
      `  Vocabulary: ${current.vocabulary || 0}% → ${cumulativeAccuracy.vocabulary || 0}% (new: ${Math.round(
        newAccuracy.vocabulary
      )}%)`
    );
  }

  if (newAccuracy.spelling !== undefined) {
    console.log(
      `  Spelling: ${current.spelling || 0}% → ${cumulativeAccuracy.spelling || 0}% (new: ${Math.round(
        newAccuracy.spelling
      )}%)`
    );
  }

  if (newAccuracy.fluency !== undefined) {
    console.log(
      `  Fluency: ${current.fluency || 0}% → ${cumulativeAccuracy.fluency || 0}% (new: ${Math.round(
        newAccuracy.fluency
      )}%)`
    );
  }
}

export function extractCurrentAccuracy(accuracyData: any): CurrentAccuracyData {
  if (!accuracyData) return {};

  return {
    overall: accuracyData.overall,
    grammar: accuracyData.grammar,
    vocabulary: accuracyData.vocabulary,
    spelling: accuracyData.spelling,
    fluency: accuracyData.fluency,
    punctuation: accuracyData.punctuation,
    capitalization: accuracyData.capitalization,
    syntax: accuracyData.syntax,
    coherence: accuracyData.coherence,
    calculationCount: accuracyData.calculationCount || 0,
  };
}

export async function calculateAccuracy(
  currentAccuracy: Partial<IAccuracyData>,
  previousAccuracy?: Partial<IAccuracyData> | null,
  userId?: string
): Promise<{
  currentAccuracy: Partial<IAccuracyData>;
  updatedOverallAccuracy: Partial<IAccuracyData>;
}> {
  if (userId) {
    try {
      const result = await enhancedWeightedAccuracyService.calculateEnhancedWeightedAccuracy(
        userId,
        currentAccuracy
      );

      return {
        currentAccuracy: result.current,
        updatedOverallAccuracy: result.weighted,
      };
    } catch (error) {
      console.error('⚠️ Advanced weighted calculation failed, falling back to simple calculation:', error);
    }
  }

  const weightOld = 0.4;
  const weightNew = 0.6;

  const norm = (value?: number) =>
    typeof value === 'number' && !Number.isNaN(value) ? Math.round(value) : undefined;

  const curr: Partial<IAccuracyData> = {
    overall: norm(currentAccuracy.overall),
    grammar: norm(currentAccuracy.grammar),
    vocabulary: norm(currentAccuracy.vocabulary),
    spelling: norm(currentAccuracy.spelling),
    fluency: norm(currentAccuracy.fluency),
    punctuation: norm(currentAccuracy.punctuation),
    capitalization: norm(currentAccuracy.capitalization),
  };

  if (!previousAccuracy) {
    return { currentAccuracy: curr, updatedOverallAccuracy: { ...curr } };
  }

  const prev = previousAccuracy || {};

  const merge = (p?: number, c?: number): number | undefined => {
    if (typeof c !== 'number' && typeof p !== 'number') return undefined;
    if (typeof c !== 'number') return typeof p === 'number' ? Math.round(p) : undefined;
    if (typeof p !== 'number') return Math.round(c);
    return Math.round(p * weightOld + c * weightNew);
  };

  const merged: Partial<IAccuracyData> = {
    overall: merge(prev.overall as any, curr.overall as any),
    grammar: merge(prev.grammar as any, curr.grammar as any),
    vocabulary: merge(prev.vocabulary as any, curr.vocabulary as any),
    spelling: merge(prev.spelling as any, curr.spelling as any),
    fluency: merge(prev.fluency as any, curr.fluency as any),
    punctuation: merge(prev.punctuation as any, curr.punctuation as any),
    capitalization: merge(prev.capitalization as any, curr.capitalization as any),
  };

  return {
    currentAccuracy: curr,
    updatedOverallAccuracy: merged,
  };
}

// ============================================
// TYPES & INTERFACES
// ============================================

export interface AccuracyCalculationRequest {
  userId: string;
  userMessage: string;
  currentAccuracy: Partial<IAccuracyData>;
  previousAccuracy?: Partial<IAccuracyData> | null;
  userTier?: 'free' | 'pro' | 'premium';
  userLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  sessionId?: string;
  timestamp?: Date;
}

export interface AccuracyCalculationResponse {
  // Weighted accuracy results
  weightedAccuracy: Partial<IAccuracyData>;
  currentAccuracy: Partial<IAccuracyData>;
  
  // Historical context
  historicalContext: any;
  
  // Performance metrics
  performance: {
    totalProcessingTime: number;
    cacheHit: boolean;
    strategy: string;
    weightsUsed: {
      historical: number;
      current: number;
    };
  };
  
  // User insights
  insights: {
    trendDirection: 'improving' | 'declining' | 'stable';
    confidenceLevel: number;
    recommendations: string[];
    nextMilestone?: {
      type: string;
      target: number;
      current: number;
      progress: number;
    };
  };
}

export interface RealTimeAccuracyUpdate {
  userId: string;
  accuracy: Partial<IAccuracyData>;
  timestamp: Date;
  source: 'realtime' | 'batched' | 'historical';
  metadata?: any;
}

// ============================================
// SERVICE CLASS
// ============================================

class CentralizedAccuracyService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly BATCH_SIZE = 100;
  private readonly MAX_CONCURRENT_CALCULATIONS = 1000;
  
  private activeCalculations: Map<string, Promise<AccuracyCalculationResponse>> = new Map();
  private calculationQueue: AccuracyCalculationRequest[] = [];
  
  /**
   * Main entry point for accuracy calculation
   * Optimized for high concurrency and performance
   */
  async calculateAccuracy(
    request: AccuracyCalculationRequest
  ): Promise<AccuracyCalculationResponse> {
    const startTime = Date.now();
    const { userId, currentAccuracy, previousAccuracy } = request;
    
    try {
      // Check for ongoing calculation for the same user (deduplication)
      const existingCalculation = this.activeCalculations.get(userId);
      if (existingCalculation) {
        console.log(`📊 Using existing calculation for user ${userId}`);
        return await existingCalculation;
      }
      
      // Create new calculation promise
      const calculationPromise = this.performAccuracyCalculation(request);
      this.activeCalculations.set(userId, calculationPromise);
      
      try {
        const result = await calculationPromise;
        return result;
      } finally {
        // Clean up active calculations
        this.activeCalculations.delete(userId);
      }
    } catch (error) {
      console.error(`❌ Accuracy calculation failed for user ${userId}:`, error);
      throw error;
    } finally {
      const totalTime = Date.now() - startTime;
      console.log(`⏱️ Total accuracy calculation time for user ${userId}: ${totalTime}ms`);
    }
  }

  /**
   * Perform the actual accuracy calculation with all optimizations
   */
  private async performAccuracyCalculation(
    request: AccuracyCalculationRequest
  ): Promise<AccuracyCalculationResponse> {
    const startTime = Date.now();
    const { userId, currentAccuracy, previousAccuracy } = request;
    
    // Step 1: Try to get cached result for identical request
    const cacheKey = this.generateCacheKey(request);
    const cachedResult = await this.getCachedResult(cacheKey);
    
    if (cachedResult) {
      console.log(`🎯 Cache hit for user ${userId} - returning cached result`);
      return {
        ...cachedResult,
        performance: {
          ...cachedResult.performance,
          cacheHit: true,
          totalProcessingTime: Date.now() - startTime,
        },
      };
    }
    
    // Step 2: Perform weighted accuracy calculation (enhanced service returns both current & weighted)
    const weightedResult = await enhancedWeightedAccuracyService.calculateEnhancedWeightedAccuracy(
      userId,
      currentAccuracy
    );

    // Published accuracy MUST be the analyzer-derived current snapshot. Keep weighted snapshot only
    // for insights/trend calculation and long-term aggregates.
    const publishedAccuracy = weightedResult.current;

    // Step 3: Generate user insights (can still use weighted result for trends)
    const insights = await this.generateUserInsights(userId, weightedResult);

    // Step 4: Update real-time tracking using the published/current analyzer snapshot
    await this.updateRealTimeTracking(userId, publishedAccuracy);

    // Step 5: Cache the result — store a response shaped object that keeps publishedAccuracy as primary
    const totalProcessingTime = Date.now() - startTime;

    const responseObj = {
      weightedAccuracy: weightedResult.weighted,
      currentAccuracy: weightedResult.current,
      publishedAccuracy: publishedAccuracy,
      historicalContext: weightedResult.historicalContext,
      performance: {
        totalProcessingTime,
        cacheHit: false,
        strategy: 'adaptive-weighting',
        weightsUsed: weightedResult.weights,
      },
      insights,
    };

    await this.cacheResult(cacheKey, responseObj);

    return responseObj;
  }

  /**
   * Generate user insights based on accuracy data
   */
  private async generateUserInsights(
    userId: string,
    weightedResult: any
  ): Promise<AccuracyCalculationResponse['insights']> {
    const { weightedAccuracy, historicalContext } = weightedResult;
    
    // Determine trend direction
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    let confidenceLevel = 0.5;
    
    if (historicalContext?.trendData) {
      trendDirection = historicalContext.trendData.direction;
      confidenceLevel = historicalContext.trendData.confidence;
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(weightedAccuracy, trendDirection);
    
    // Calculate next milestone
    const nextMilestone = this.calculateNextMilestone(weightedAccuracy, historicalContext);
    
    return {
      trendDirection,
      confidenceLevel,
      recommendations,
      nextMilestone,
    };
  }

  /**
   * Generate personalized recommendations based on accuracy
   */
  private generateRecommendations(
    accuracy: Partial<IAccuracyData>,
    trend: 'improving' | 'declining' | 'stable'
  ): string[] {
    const recommendations: string[] = [];
    
    // Category-specific recommendations
    if (accuracy.grammar !== undefined && accuracy.grammar < 70) {
      recommendations.push('Focus on grammar fundamentals - try practicing sentence structures');
    }
    
    if (accuracy.vocabulary !== undefined && accuracy.vocabulary < 70) {
      recommendations.push('Expand your vocabulary - learn 5 new words daily');
    }
    
    if (accuracy.spelling !== undefined && accuracy.spelling < 70) {
      recommendations.push('Practice spelling - use the spell checker and review common mistakes');
    }
    
    if (accuracy.fluency !== undefined && accuracy.fluency < 70) {
      recommendations.push('Improve fluency - practice speaking and reading aloud');
    }
    
    // Trend-based recommendations
    if (trend === 'declining') {
      recommendations.push('Take a short break and review previous lessons');
      recommendations.push('Consider revisiting fundamentals you\'ve already mastered');
    } else if (trend === 'improving') {
      recommendations.push('Great progress! Try more challenging exercises');
      recommendations.push('Share your success with the community');
    }
    
    // Overall accuracy recommendations
    if (accuracy.overall !== undefined) {
      if (accuracy.overall >= 90) {
        recommendations.push('Excellent work! You\'re ready for advanced topics');
      } else if (accuracy.overall >= 80) {
        recommendations.push('Good progress! Keep practicing consistently');
      } else if (accuracy.overall < 50) {
        recommendations.push('Focus on basics - practice makes perfect');
      }
    }
    
    return recommendations.slice(0, 3); // Return top 3 recommendations
  }

  /**
   * Calculate next milestone for user
   */
  private calculateNextMilestone(
    accuracy: Partial<IAccuracyData>,
    historicalContext: any
  ): AccuracyCalculationResponse['insights']['nextMilestone'] {
    const currentOverall = accuracy.overall || 0;
    
    // Define milestones
    const milestones = [
      { threshold: 60, name: 'Competent' },
      { threshold: 75, name: 'Proficient' },
      { threshold: 85, name: 'Advanced' },
      { threshold: 95, name: 'Expert' },
    ];
    
    const nextMilestone = milestones.find(m => m.threshold > currentOverall);
    
    if (!nextMilestone) {
      return undefined; // Already at highest level
    }
    
    const progress = ((currentOverall - (milestones.find(m => m.threshold <= currentOverall)?.threshold || 0)) / 
                     (nextMilestone.threshold - (milestones.find(m => m.threshold <= currentOverall)?.threshold || 0))) * 100;
    
    return {
      type: nextMilestone.name,
      target: nextMilestone.threshold,
      current: currentOverall,
      progress: Math.round(progress),
    };
  }

  /**
   * Update real-time accuracy tracking
   */
  private async updateRealTimeTracking(
    userId: string,
    accuracy: Partial<IAccuracyData>
  ): Promise<void> {
    try {
      await optimizedAccuracyTracker.trackAccuracy({
        userId,
        messageText: '', // Will be filled by caller
        overallScore: accuracy.overall,
        grammarScore: accuracy.grammar,
        vocabularyScore: accuracy.vocabulary,
        spellingScore: accuracy.spelling,
        fluencyScore: accuracy.fluency,
      });
    } catch (error) {
      console.error('Error updating real-time tracking:', error);
      // Don't fail the main calculation if tracking fails
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: AccuracyCalculationRequest): string {
    const keyData = {
      userId: request.userId,
      accuracyHash: this.hashAccuracy(request.currentAccuracy),
      timestamp: Math.floor((request.timestamp?.getTime() || Date.now()) / 60000), // 1-minute buckets
    };
    
    return `accuracy:calc:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Simple hash for accuracy data
   */
  private hashAccuracy(accuracy: Partial<IAccuracyData>): string {
    const sorted = Object.keys(accuracy)
      .sort()
      .reduce((result, key) => {
        result[key] = accuracy[key as keyof IAccuracyData];
        return result;
      }, {} as any);
    
    return Buffer.from(JSON.stringify(sorted)).toString('base64').substring(0, 16);
  }

  /**
   * Get cached result
   */
  private async getCachedResult(cacheKey: string): Promise<any | null> {
    try {
      const cached = await redisCache.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached result:', error);
      return null;
    }
  }

  /**
   * Cache result
   */
  private async cacheResult(cacheKey: string, result: any): Promise<void> {
    try {
      await redisCache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      console.error('Error caching result:', error);
      // Don't fail if caching fails
    }
  }

  /**
   * Get real-time accuracy for user
   */
  async getRealTimeAccuracy(userId: string): Promise<RealTimeAccuracyUpdate | null> {
    try {
      const cached = await optimizedAccuracyTracker.getCachedAccuracy(userId);
      
      if (!cached) {
        return null;
      }
      
      return {
        userId,
        accuracy: {
          overall: cached.overall ?? 0,
          grammar: cached.grammar ?? 0,
          vocabulary: cached.vocabulary ?? 0,
          spelling: cached.spelling ?? 0,
          fluency: cached.fluency ?? 0,
        },
        timestamp: new Date(cached.timestamp),
        source: 'realtime',
        metadata: {
          lastMessage: cached.lastMessage,
        },
      };
    } catch (error) {
      console.error('Error getting real-time accuracy:', error);
      return null;
    }
  }

  /**
   * Batch accuracy calculations for multiple users
   */
  async batchCalculateAccuracy(
    requests: AccuracyCalculationRequest[]
  ): Promise<AccuracyCalculationResponse[]> {
    const results: AccuracyCalculationResponse[] = [];
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < requests.length; i += this.BATCH_SIZE) {
      const batch = requests.slice(i, i + this.BATCH_SIZE);
      
      const batchPromises = batch.map(request => 
        this.calculateAccuracy(request).catch(error => {
          console.error(`Batch calculation failed for user ${request.userId}:`, error);
          return null;
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
      
      // Small delay between batches to prevent overload
      if (i + this.BATCH_SIZE < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  /**
   * Get service statistics for monitoring
   */
  getStats(): {
    activeCalculations: number;
    queuedRequests: number;
    cacheEnabled: boolean;
    maxConcurrent: number;
  } {
    return {
      activeCalculations: this.activeCalculations.size,
      queuedRequests: this.calculationQueue.length,
      cacheEnabled: redisCache.isConnected(),
      maxConcurrent: this.MAX_CONCURRENT_CALCULATIONS,
    };
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const centralizedAccuracyService = new CentralizedAccuracyService();
export default centralizedAccuracyService;
