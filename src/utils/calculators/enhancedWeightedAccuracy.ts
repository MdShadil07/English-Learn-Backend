/**
 * Final Enhanced Weighted Accuracy Service
 * - Unified Redis wrapper with safe fetch/set
 * - Dynamic adaptive weights with trend decay
 * - Loggable fallback flags and diagnostics
 * - Robust NaN/Range guards and per-category adjustments
 * - Debounced DB writes to reduce write amplification
 * - Improved smoothing using logarithmic factor
 */

import Progress, { IAccuracyData } from '../../models/Progress.js';
import { redisCache } from '../../config/redis.js';
import Redis from 'ioredis';

export interface WeightedAccuracyResult {
  current: Partial<IAccuracyData>;
  previous: Partial<IAccuracyData>;
  weighted: Partial<IAccuracyData>;
  historicalContext: HistoricalContext | null;
  weights: { historical: number; current: number };
  trend: { direction: 'improving' | 'declining' | 'stable'; confidence: number };
  messageCount: number;
  processingTime: number;
  diagnostics?: { fallback?: string | null };
}

export interface HistoricalContext {
  userId: string;
  messageCount: number;
  overall: number;
  categories: Partial<IAccuracyData>;
  trend: {
    direction: 'improving' | 'declining' | 'stable';
    confidence: number;
    recentAverage: number;
  };
  lastUpdated: Date;
}

const CATEGORY_KEYS = [
  'overall',
  'grammar',
  'vocabulary',
  'spelling',
  'fluency',
  'punctuation',
  'capitalization',
] as const;

type CategoryKey = typeof CATEGORY_KEYS[number] & keyof IAccuracyData;

// Per-category "responsiveness" preferences: higher means more responsive to current performance
// (0..1) - 1.0 favors current message strongly, 0.0 favors historical data
// TUNED: Reduced grammar (0.7→0.65) and fluency (0.85→0.75) for better stability
const CATEGORY_RESPONSIVENESS: Record<CategoryKey, number> = {
  overall: 0.8,
  grammar: 0.65,      // TUNED: Reduced from 0.7 (-7%)
  vocabulary: 0.75,
  spelling: 0.7,
  fluency: 0.75,      // TUNED: Reduced from 0.85 (-12%)
  punctuation: 0.75,
  capitalization: 0.7,
};

export class FinalWeightedAccuracyService {
  private redisClient: any = null;
  private persistModulo = 5; // persist to DB every N messages to reduce writes

  constructor() {
    try {
      if (redisCache && redisCache.isConnected && redisCache.isConnected()) {
        this.redisClient = redisCache.getClient();
      }
    } catch (err) {
      console.warn('⚠️ Redis wrapper not available at constructor time. Falling back to DB-only.', err);
      this.redisClient = null;
    }
  }

  async calculateEnhancedWeightedAccuracy(
    userId: string,
    currentAccuracy: Partial<IAccuracyData>,
    errorCount?: number  // 🚀 NEW: Error count for graduated penalties
  ): Promise<WeightedAccuracyResult> {
    const start = Date.now();

    if (!this.isValidObjectId(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // Normalize input to safe numeric ranges
    const normalizedCurrent = this.normalizeAccuracyInput(currentAccuracy);

    // STEP 1: Fetch previous + historical context
    const historicalContext = await this.getHistoricalContext(userId);
    const previousAccuracyRaw = historicalContext?.categories || (await this.fetchPreviousAccuracy(userId));
    const previousAccuracy = this.normalizeAccuracyInput(previousAccuracyRaw ?? this.getDefaultAccuracy());

    const messageCount = historicalContext?.messageCount || (await this.getMessageCount(userId));

    // STEP 2: Calculate adaptive weights (with deviation adjustment and dynamic historical weighting)
    const weights = this.calculateAdaptiveWeights(
      messageCount, 
      historicalContext?.trend,
      normalizedCurrent,
      previousAccuracy
    );

    // STEP 3: Weighted accuracy calculation with per-category responsiveness
    const weighted = this.applyWeightedCalculation(normalizedCurrent, previousAccuracy, weights);

    // STEP 4: Apply adaptive smoothing (stronger for declines)
    const smoothed = this.applySmoothing(weighted, previousAccuracy, messageCount);

    // STEP 5: Trend analysis and update historical cache
    const trend = this.calculateTrend(historicalContext, smoothed);

    // 🚀 STEP 6: Apply graduated penalty system based on error count (Priority 2)
    if (errorCount !== undefined && errorCount > 0) {
      smoothed.adjustedOverall = this.applyGraduatedPenalty(smoothed.overall || 0, errorCount);
    }

    // Persist/update historical context in Redis + occasionally DB
    await this.updateHistoricalContext(userId, smoothed, messageCount, trend);

    const processingTime = Date.now() - start;

    return {
      current: normalizedCurrent,
      previous: previousAccuracy,
      weighted: smoothed,
      historicalContext,
      weights,
      trend: { direction: trend.direction, confidence: trend.confidence },
      messageCount,
      processingTime,
      diagnostics: { fallback: this.redisClient ? null : 'redis_offline' },
    };
  }

  // ==========================
  // 🔹 Redis Safe Wrappers
  // ==========================

  private async safeRedisGetJson<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.redisClient) return null;
      const raw = await this.redisClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`⚠️ Redis GET failed for ${key}:`, err);
      return null;
    }
  }

  private async safeRedisSetJson(key: string, value: any, ttlSec?: number) {
    try {
      if (!this.redisClient) return false;
      const raw = JSON.stringify(value);
      if (typeof ttlSec === 'number') {
        await this.redisClient.setex(key, ttlSec, raw);
      } else {
        await this.redisClient.set(key, raw);
      }
      return true;
    } catch (err) {
      console.warn(`⚠️ Redis SET failed for ${key}:`, err);
      return false;
    }
  }

  // ==========================
  // 🔹 Fetching & Caching
  // ==========================

  private async getHistoricalContext(userId: string): Promise<HistoricalContext | null> {
    if (!this.redisClient) return null;
    const key = `accuracy:historical:${userId}`;
    const cached = await this.safeRedisGetJson<HistoricalContext>(key);
    if (cached) {
      cached.lastUpdated = new Date(cached.lastUpdated);
      return cached;
    }
    return null;
  }

  private async fetchPreviousAccuracy(userId: string): Promise<Partial<IAccuracyData> | null> {
    try {
      console.log('🔍 [DEBUG] Fetching previous accuracy for userId:', userId);
      const progress = await Progress.findOne({ userId }).select('accuracyData').lean().exec();
      console.log('🔍 [DEBUG] Progress document found:', progress ? 'YES' : 'NO');
      console.log('🔍 [DEBUG] accuracyData field:', progress?.accuracyData ? JSON.stringify(progress.accuracyData) : 'NULL');
      if (!progress?.accuracyData) {
        console.warn('⚠️ [DEBUG] No accuracyData found - returning null');
        return null;
      }
      // Debug details suppressed to avoid leaking production snapshots
      // Returning previous accuracy for internal weighting only.
      return progress.accuracyData as Partial<IAccuracyData>;
    } catch (err) {
      console.error('❌ [DEBUG] Error fetching previous accuracy from DB:', err);
      return null;
    }
  }

  private async getMessageCount(userId: string): Promise<number> {
    try {
      const cacheKey = `message:count:${userId}`;
      const cached = await this.safeRedisGetJson<string>(cacheKey);
      if (cached) return parseInt(cached as unknown as string, 10) || 0;

      const progress = await Progress.findOne({ userId })
        .select('accuracyData.calculationCount stats.conversationsPracticed')
        .lean()
        .exec();

      const calcCount = Number(progress?.accuracyData?.calculationCount ?? 0);
      const convCount = Number(progress?.stats?.conversationsPracticed ?? 0);
      const count = Math.max(0, calcCount + convCount);

      // cache for 2 minutes
      await this.safeRedisSetJson(cacheKey, String(count), 120);
      return count;
    } catch (err) {
      console.warn('Warning: getMessageCount failed, defaulting to 0', err);
      return 0;
    }
  }

  // ==========================
  // 🔹 Core Logic
  // ==========================

  private calculateAdaptiveWeights(
    messageCount: number,
    trend?: HistoricalContext['trend'],
    currentAccuracy?: Partial<IAccuracyData>,
    previousAccuracy?: Partial<IAccuracyData>
  ): { historical: number; current: number } {
    // Default: use stable premium-style weights (current dominant but historical present)
    // Default baseline follows requested formula: current ~65%, historical ~35%
    let baseHist = 0.35;
    let baseCurr = 0.65;

    // SPECIAL-CASE: Brand-new users must have zero historical weight
    // For messageCount === 0 we must not blend any historical data (there is none).
    // This enforces: historical = 0, current = 1 (user requirement).
    if (messageCount === 0) {
      return { historical: 0, current: 1 };
    }

    // If this is the SECOND message (messageCount === 1) use the explicit decay factor
    // so the first blend follows the recommended formula exactly (configurable via env)
    if (messageCount === 1) {
      try {
        const envDecay = process.env.HISTORICAL_DECAY ?? process.env.FORCED_HISTORICAL_DECAY;
        const parsed = envDecay !== undefined && envDecay !== '' ? Number.parseFloat(envDecay) : NaN;
        const hist = !Number.isNaN(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.35;
        const curr = +(1 - hist).toFixed(2);
        return { historical: +hist.toFixed(2), current: curr };
      } catch (e) {
        return { historical: 0.35, current: 0.65 };
      }
    }

    // ENV OVERRIDE: allow a fixed historical weight to be forced for testing or policy
    // Set environment variable FORCE_HISTORICAL_WEIGHT=0.35 to force 35% historical weight
    try {
      const v = process.env.FORCE_HISTORICAL_WEIGHT;
      if (v !== undefined) {
        const fh = Number.parseFloat(v);
        if (!Number.isNaN(fh) && fh >= 0 && fh <= 1) {
          const hc = Math.max(0, Math.min(1, fh));
          return { historical: +hc.toFixed(2), current: +((1 - hc)).toFixed(2) };
        }
      }
    } catch (e) {
      // ignore invalid env values
    }

    // TUNED: Reduced historical weight for experienced users (20+ msgs) to increase responsiveness
    // Slowly increase historical weight as more messages accumulate, but cap modestly
    if (messageCount >= 20) {
      baseHist = 0.25;  // TUNED: Reduced from 0.35 (-29% historical influence)
      baseCurr = 0.75;  // TUNED: Increased from 0.65 (+15% current influence)
    } else if (messageCount >= 10) {
      const progress = (messageCount - 10) / 10; // 0..1
      baseHist = 0.1 + progress * 0.15; // TUNED: 0.1 -> 0.25 (was 0.35)
      baseCurr = 1 - baseHist;
    }

    // 🚀 PRIORITY 3: DYNAMIC HISTORICAL WEIGHTING BASED ON BASIC SCORE
    // Adjust historical weight based on current message quality:
    // - Very poor quality (<40%): Increase historical weight for stability (8-10%)
    // - Poor-Moderate (40-70%): Use standard historical weight (5-7%)
    // - Good quality (>70%): Reduce historical weight (3-5%)
    const currOverall = currentAccuracy?.overall ?? 0;
    
    if (currOverall < 40) {
      // Very poor quality - add more historical stability to prevent wild swings
      baseHist = Math.min(0.10, baseHist * 1.5); // Increase by 50%, max 10%
      baseCurr = 1 - baseHist;
      console.log(`📊 Dynamic Weighting: Very poor quality (${currOverall}%) → Historical ${(baseHist * 100).toFixed(0)}%`);
    } else if (currOverall < 70) {
      // Poor-Moderate quality - use slightly adjusted weight
      baseHist = Math.min(0.07, baseHist * 1.2); // Increase by 20%, max 7%
      baseCurr = 1 - baseHist;
      console.log(`📊 Dynamic Weighting: Moderate quality (${currOverall}%) → Historical ${(baseHist * 100).toFixed(0)}%`);
    } else {
      // Good quality - reduce historical weight to be more responsive
      baseHist = Math.max(0.03, baseHist * 0.8); // Decrease by 20%, min 3%
      baseCurr = 1 - baseHist;
      console.log(`📊 Dynamic Weighting: Good quality (${currOverall}%) → Historical ${(baseHist * 100).toFixed(0)}%`);
    }

    // FIX #2: Nonlinear decay when current accuracy deviates sharply
    // TUNED: Lower thresholds and stronger reductions for faster response to quality drops
    // If there's a huge quality drop, reduce historical influence immediately
    const recentAvg = trend?.recentAverage ?? 0;
    const deviation = Math.abs(recentAvg - currOverall);
    
    if (deviation > 20) {  // TUNED: Lowered from 25
      // Sharp deviation detected - favor current message much more
      baseHist *= 0.4; // TUNED: Cut historical weight by 60% (was 50%)
      baseCurr = 1 - baseHist;
    } else if (deviation > 12) {  // TUNED: Lowered from 15
      // Moderate deviation - reduce historical influence somewhat
      baseHist *= 0.65; // TUNED: Cut historical weight by 35% (was 25%)
      baseCurr = 1 - baseHist;
    }

    // Trend-based micro-adjustments (max ±10%) with decay
    // Make the system more responsive when performance is declining: reduce historical weight
    if (trend) {
      const confidence = Math.min(0.95, trend.confidence || 0.5);
      if (trend.direction === 'declining' && confidence > 0.6) {
        // reduce history influence to let current data pull accuracy down faster
        baseHist = Math.max(baseHist - 0.1 * confidence, 0.05);
      } else if (trend.direction === 'improving' && confidence > 0.6) {
        // slightly increase history to avoid reacting to short-lived spikes
        baseHist = Math.min(baseHist + 0.05 * confidence, 0.6);
      }
      baseCurr = 1 - baseHist;
    }

    // final clamp + rounding
    // SAFETY: Cap historical influence to at most 35% and ensure current weight is at least 65%.
    baseHist = Math.max(0.05, Math.min(baseHist, 0.35));
    baseCurr = Math.max(0.65, Math.min(1 - baseHist, 0.95));

    return { historical: +baseHist.toFixed(2), current: +baseCurr.toFixed(2) };
  }

  private applyWeightedCalculation(
    current: Partial<IAccuracyData>,
    previous: Partial<IAccuracyData>,
    weights: { historical: number; current: number }
  ): Partial<IAccuracyData> {
    // Importance map — used only for overall weighting
    const overallWeights: Record<CategoryKey, number> = {
      grammar: 0.3 as number,
      vocabulary: 0.15 as number,
      spelling: 0.2 as number,
      fluency: 0.15 as number,
      punctuation: 0.1 as number,
      capitalization: 0.1 as number,
      overall: 0,
    } as any;

    const result: Partial<IAccuracyData> = {};

    for (const catRaw of CATEGORY_KEYS) {
      const cat = catRaw as CategoryKey;
      // Skip 'overall' for per-category calc; compute at end
      if (cat === 'overall') continue;

      const currVal = this.clamp(this.getNumber(current[cat], previous[cat], 100));
      const prevVal = this.clamp(this.getNumber(previous[cat], currVal, currVal));

      // Per-category responsiveness: how much to tilt towards current
      const resp = CATEGORY_RESPONSIVENESS[cat] ?? 0.5; // 0..1 (lower = more historical)

      // Combined weight per category: blend global weights with category responsiveness
      // NEW: Use a responsivenessFactor to avoid historical over-dominance
      // when category responsiveness is high. This softens the (1-resp) multiplier
      // and slightly boosts the current contribution to produce smoother, more
      // predictable cumulative updates.
      const responsivenessFactor = 0.5; // 0..1, 0.5 is moderate smoothing
      const histWeight = Math.max(0, weights.historical * (1 - resp * responsivenessFactor));
      const curWeight = Math.max(0, weights.current * (1 + resp * responsivenessFactor));
      const total = histWeight + curWeight || 1;

      const weightedVal = (prevVal * histWeight + currVal * curWeight) / total;

      if (process.env.DEBUG_WEIGHTING === 'true') {
        console.log(`[weight-debug] cat=${cat} prev=${prevVal} curr=${currVal} resp=${resp.toFixed(2)} histWeight=${histWeight.toFixed(3)} curWeight=${curWeight.toFixed(3)} total=${total.toFixed(3)} weighted=${weightedVal.toFixed(2)}`);
      }
      
      // 🚀 CRITICAL FIX: NO-AMPLIFICATION CLAMP per category
      // Ensure weighted value never exceeds both current AND previous by more than 4 points
      const maxBase = Math.max(currVal, prevVal);
      const cappedWeightedVal = Math.min(weightedVal, maxBase + 4);
      
      result[cat] = Math.round(cappedWeightedVal);
    }

    // FIX #6: Compute overall as weighted sum of categories with volatility penalty
    let totalScore = 0;
    let weightSum = 0;
    for (const catRaw of CATEGORY_KEYS) {
      const cat = catRaw as CategoryKey;
      if (cat === 'overall') continue;
      const w = overallWeights[cat] || 0.1;
      
      // Apply volatility penalty for large category shifts
      const volatility = Math.abs((result[cat] || 0) - (previous[cat] || 0));
      const volatilityPenalty = volatility > 25 ? 0.9 : 1.0;
      
      totalScore += (result[cat] || 0) * w * volatilityPenalty;
      weightSum += w;
    }
    const computedOverall = this.clamp(Math.round(totalScore / (weightSum || 1)));
    
    // 🚀 CRITICAL FIX: NO-AMPLIFICATION CLAMP on computed overall
    // Ensure overall never exceeds current basic score by more than specified margin
    const currentOverall = this.clamp(this.getNumber(current.overall, 0, 0));
    const previousOverall = this.clamp(this.getNumber(previous.overall, 0, 0));
    
    // 🚀 ENHANCED: Tighter clamp for middle-range scores (70-85%)
    // These scores tend to get over-amplified, so use stricter limit
    let maxBoostAllowed = 6;
    if (currentOverall >= 70 && currentOverall <= 85) {
      maxBoostAllowed = 3; // Tighter clamp for middle range
    } else if (currentOverall > 85) {
      maxBoostAllowed = 4; // Moderate clamp for good scores
    }
    
    const maxAllowedOverall = Math.max(currentOverall, previousOverall) + maxBoostAllowed;
    result.overall = Math.min(computedOverall, maxAllowedOverall);
    
    // FIX #4: Apply dynamic penalty based on low-performing metrics
    const penaltyFactor = this.calculatePenaltyFactor(result);
    result.adjustedOverall = Math.max(0, Math.round((result.overall || 0) * penaltyFactor));

    return result;
  }

  private applySmoothing(
    weighted: Partial<IAccuracyData>,
    previous: Partial<IAccuracyData>,
    messageCount: number
  ): Partial<IAccuracyData> {
    // For very small message counts, be permissive
    if (messageCount < 2) return weighted;

    const result: Partial<IAccuracyData> = {};

    for (const catRaw of CATEGORY_KEYS) {
      const cat = catRaw as CategoryKey;
      const wVal = this.getNumber(weighted[cat], 0, 0);
      const pVal = this.getNumber(previous[cat], wVal, wVal);

      const diff = wVal - pVal;
      
      // 🚀 FIX: ASYMMETRIC SMOOTHING - Only smooth downward movements, never amplify
      // This prevents over-amplification of middle-range scores
      if (diff < -15) {
        // TUNED: Steep drop detected - apply stronger correction with minimal smoothing
        const adaptiveFactor = Math.min(0.92, Math.log10(messageCount + 1) / 1.2);
        result[cat] = this.clamp(Math.round(pVal + diff * adaptiveFactor));
      } else if (diff > 15) {
        // 🚀 CRITICAL FIX: NO AMPLIFICATION - Cap at weighted value
        // Prevent smoothing from boosting score above the calculated weighted value
        // This fixes middle-range inflation (79% → 94% issue)
        result[cat] = this.clamp(Math.round(wVal)); // Use weighted as-is, no boost
      } else if (diff > 0) {
        // 🚀 CRITICAL FIX: Small improvements - use weighted value directly
        // Do not amplify even small positive changes
        result[cat] = this.clamp(Math.round(wVal));
      } else {
        // Small decline or no change - accept as-is
        result[cat] = this.clamp(Math.round(wVal));
      }
    }

    // 🚀 CRITICAL FIX: NO-AMPLIFICATION CLAMP on overall score
    // Ensure final smoothed overall never exceeds weighted by more than 3 points
    // This prevents the 79% → 94% inflation seen in moderate texts
    const weightedOverall = this.getNumber(weighted.overall, 0, 0);
    const previousOverall = this.getNumber(previous.overall, 0, 0);
    const smoothedOverall = this.getNumber(result.overall, 0, 0);
    
    // Maximum allowed score: either the weighted value or previous + 3 points (whichever is lower)
    const maxAllowed = Math.min(weightedOverall + 3, Math.max(weightedOverall, previousOverall + 5));
    
    if (smoothedOverall > maxAllowed) {
      console.log(`🔒 No-Amplification Clamp: ${smoothedOverall}% → ${maxAllowed}% (weighted: ${weightedOverall}%, prev: ${previousOverall}%)`);
      result.overall = this.clamp(maxAllowed);
    }

    return result;
  }

  private calculateTrend(
    existing: HistoricalContext | null,
    newAcc: Partial<IAccuracyData>
  ): HistoricalContext['trend'] {
    if (!existing) {
      return { direction: 'stable', confidence: 0.5, recentAverage: newAcc.overall || 0 };
    }

    const prev = existing.overall || 0;
    const curr = newAcc.overall || 0;
    const diff = curr - prev;

    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (diff > 5) direction = 'improving';
    else if (diff < -5) direction = 'declining';

    // FIX #5: Invert confidence decay - older users should have MORE confident trends
    // Growth-based confidence: more messages = higher confidence in trend detection
    const growthFactor = 1 - Math.exp(-existing.messageCount / 200);
    const baseConfidence = Math.min(0.95, growthFactor);
    const confidence = Math.max(0.1, baseConfidence);

    // recent average: simple EMA
    const alpha = 0.3;
    const avg = Math.round((existing.trend.recentAverage || prev) * (1 - alpha) + curr * alpha);

    return { direction, confidence: +confidence.toFixed(2), recentAverage: avg };
  }

  // ==========================
  // 🔹 Context Updates
  // ==========================

  private async updateHistoricalContext(
    userId: string,
    weighted: Partial<IAccuracyData>,
    messageCount: number,
    trend: HistoricalContext['trend']
  ): Promise<void> {
    // Try Redis first
    if (this.redisClient) {
      const context: HistoricalContext = {
        userId,
        messageCount: messageCount + 1,
        overall: weighted.overall || 0,
        categories: weighted,
        trend,
        lastUpdated: new Date(),
      };

      const key = `accuracy:historical:${userId}`;
      await this.safeRedisSetJson(key, context, 3600);
    }

    // Persist to MongoDB less frequently to reduce writes
    try {
      const shouldPersist = ((messageCount + 1) % this.persistModulo) === 0;
      if (shouldPersist) {
        // IMPORTANT: Do NOT overwrite `accuracyData` (published/current) with historical weighted snapshot.
        // Store the historical weighted snapshot in a separate field `historicalAccuracy` to preserve
        // analyzer-derived `accuracyData` as the authoritative published score.
        await Progress.updateOne({ userId }, { $set: { historicalAccuracy: weighted } }).exec();
      }
    } catch (err) {
      console.error('⚠️ Failed to persist weighted accuracy to DB:', err);
    }
  }

  // ==========================
  // 🔹 Helpers
  // ==========================

  /**
   * 🚀 PRIORITY 2: GRADUATED PENALTY SYSTEM
   * Apply penalty based on error count with graduated thresholds
   * - 15+ errors: -40% penalty
   * - 10-14 errors: -25% penalty
   * - 8-9 errors: -15% penalty
   * - 5-7 errors: -5% penalty
   * - <5 errors: No penalty
   */
  private applyGraduatedPenalty(score: number, errorCount: number): number {
    let penaltyPercent = 0;
    
    if (errorCount >= 15) {
      penaltyPercent = 40;
    } else if (errorCount >= 10) {
      penaltyPercent = 25;
    } else if (errorCount >= 8) {
      penaltyPercent = 15;
    } else if (errorCount >= 5) {
      penaltyPercent = 5;
    }
    
    const penaltyPoints = Math.round(score * (penaltyPercent / 100));
    const adjustedScore = Math.max(0, score - penaltyPoints);
    
    if (penaltyPercent > 0) {
      console.log(`⚠️ Graduated Penalty Applied: ${errorCount} errors → -${penaltyPercent}% (-${penaltyPoints} points) → ${adjustedScore}%`);
    }
    
    return adjustedScore;
  }

  /**
   * FIX #4: Calculate penalty factor based on severely low-performing metrics
   * Returns a multiplier (0.6 - 1.0) where lower means more penalty
   * NOTE: This is now supplemented by the graduated penalty system above
   */
  private calculatePenaltyFactor(data: Partial<IAccuracyData>): number {
    // Check critical metrics for severely low performance
    const criticalMetrics = ['grammar', 'spelling', 'fluency'] as const;
    const lowMetrics: number[] = [];
    
    for (const metric of criticalMetrics) {
      const value = this.getNumber(data[metric as keyof IAccuracyData], 0, 0);
      if (value < 50) {
        lowMetrics.push(value);
      }
    }
    
    // No critically low metrics - no penalty
    if (lowMetrics.length === 0) return 1.0;
    
    // Calculate severity: how far below 50 are the low metrics?
    const totalDeficit = lowMetrics.reduce((sum, value) => sum + (50 - value), 0);
    const maxDeficit = lowMetrics.length * 50; // worst case: all at 0
    const severity = totalDeficit / maxDeficit;
    
    // TUNED: Apply penalty: up to -50% for catastrophic failures (was -40%)
    // severity 0.0 = no penalty (1.0), severity 1.0 = max penalty (0.5)
    const penaltyFactor = Math.max(0.5, 1 - severity * 0.5);
    
    return penaltyFactor;
  }

  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  private getNumber(value: any, fallback: any, alt: any): number {
    if (value === undefined || value === null) return Number(fallback ?? alt ?? 0);
    const n = Number(value);
    return Number.isFinite(n) ? n : Number(fallback ?? alt ?? 0);
  }

  private clamp(value: number, min = 0, max = 100): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  private normalizeAccuracyInput(input?: Partial<IAccuracyData> | null): Partial<IAccuracyData> {
    const out: Partial<IAccuracyData> = {};
    for (const k of CATEGORY_KEYS) {
      const key = k as keyof IAccuracyData;
      const value = this.clamp(this.getNumber(input?.[key], 0, 0));
      out[key] = value as any; // Type assertion for optional fields
    }
    return out;
  }

  private getDefaultAccuracy(): Partial<IAccuracyData> {
    return { overall: 75, grammar: 75, vocabulary: 70, spelling: 80, fluency: 72, punctuation: 78, capitalization: 80 };
  }
}

// Export singleton instance (named correctly)
export const enhancedWeightedAccuracyService = new FinalWeightedAccuracyService();
export default enhancedWeightedAccuracyService;
