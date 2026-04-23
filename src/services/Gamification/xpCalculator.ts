/**
 * 🧮 CORE XP CALCULATION ENGINE
 * Advanced XP calculation with multiple factors and adaptive difficulty
 */

import type {
  XPCalculationResult,
  XPSource,
  AdaptiveDifficulty,
  MomentumSystem,
  PrestigeSystem,
} from './type/index.js';
import {
  XP_CURVE_CONFIG,
  ACCURACY_MULTIPLIERS,
  STREAK_BONUSES,
  LEVEL_DIFFICULTY_MODIFIERS,
  XP_PENALTY_RULES,
} from './config.js';

// ========================================
// CORE XP CURVE FUNCTIONS
// ========================================

/**
 * Calculate XP required for a specific level
 * Uses exponential growth with milestone bonuses
 */
export const calculateXPForLevel = (level: number, prestigeLevel: number = 0): number => {
  if (level <= 1) return 0;
  
  const { BASE_XP, MULTIPLIER, EXPONENT, MILESTONE_BONUS, PRESTIGE_SCALING } = XP_CURVE_CONFIG;
  
  // Base exponential calculation
  let xp = BASE_XP * Math.pow(MULTIPLIER, level - 1) * Math.pow(level, EXPONENT);
  
  // Ensure first level-up requires at least 500 XP
  if (level === 2) {
    xp = Math.max(500, xp);
  }
  
  // Milestone bonus every 10 levels
  if (level % 10 === 0) {
    xp *= MILESTONE_BONUS;
  }
  
  // Prestige scaling (makes it harder after each prestige)
  if (prestigeLevel > 0) {
    xp *= Math.pow(PRESTIGE_SCALING, prestigeLevel);
  }
  
  return Math.floor(xp);
};

/**
 * Calculate cumulative XP for a specific level
 */
export const calculateCumulativeXP = (level: number, prestigeLevel: number = 0): number => {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += calculateXPForLevel(i, prestigeLevel);
  }
  return total;
};

/**
 * Get level from total XP
 */
export const getLevelFromXP = (totalXP: number, prestigeLevel: number = 0): number => {
  let level = 1;
  let cumulativeXP = 0;
  
  while (cumulativeXP <= totalXP) {
    level++;
    cumulativeXP += calculateXPForLevel(level, prestigeLevel);
    
    // Safety check to prevent infinite loop
    if (level > 999) break;
  }
  
  return level - 1;
};

// ========================================
// MULTIPLIER CALCULATIONS
// ========================================

/**
 * Get accuracy-based multiplier
 */
export const getAccuracyMultiplier = (accuracy: number): number => {
  for (const tier of ACCURACY_MULTIPLIERS) {
    if (accuracy >= tier.threshold) {
      return tier.multiplier;
    }
  }
  return 0.8; // Fallback
};

/**
 * Get streak-based multiplier
 */
export const getStreakMultiplier = (streakDays: number): number => {
  for (const tier of STREAK_BONUSES) {
    if (streakDays >= tier.days) {
      return tier.multiplier;
    }
  }
  return 1.0; // No bonus
};

/**
 * Calculate momentum multiplier
 */
export const calculateMomentumMultiplier = (momentumSystem: MomentumSystem): number => {
  if (!momentumSystem.bonusActive) return 1.0;
  
  // Check if momentum expired
  if (momentumSystem.expiresAt && new Date() > momentumSystem.expiresAt) {
    return 1.0;
  }
  
  return momentumSystem.multiplier;
};

/**
 * Calculate prestige bonus multiplier
 */
export const getPrestigeMultiplier = (prestigeSystem: PrestigeSystem): number => {
  return prestigeSystem.prestigeXPBonus;
};

const getLevelDifficultyModifier = (currentLevel?: number): number => {
  if (!currentLevel || currentLevel <= 1) {
    return 1.0;
  }

  let modifier = 1.0;
  for (const step of LEVEL_DIFFICULTY_MODIFIERS) {
    if (currentLevel >= step.minLevel) {
      modifier = step.modifier;
      continue;
    }
    break;
  }

  return modifier;
};

const calculateErrorPenalty = (
  baseAmount: number,
  errorCount: number = 0,
  criticalErrorCount: number = 0,
  accuracy: number = 100
): number => {
  if (baseAmount <= 0) {
    return 0;
  }

  const weightedErrors = (errorCount * XP_PENALTY_RULES.ERROR_WEIGHT) + (criticalErrorCount * XP_PENALTY_RULES.CRITICAL_ERROR_WEIGHT);
  let penalty = baseAmount * weightedErrors;

  if (accuracy < XP_PENALTY_RULES.LOW_ACCURACY_THRESHOLD) {
    const accuracyGap = XP_PENALTY_RULES.LOW_ACCURACY_THRESHOLD - accuracy;
    penalty += baseAmount * accuracyGap * XP_PENALTY_RULES.LOW_ACCURACY_WEIGHT;
  }

  return Math.max(0, Math.floor(penalty));
};

const calculateAccuracyBonus = (baseAmount: number, accuracy: number = 0): number => {
  if (accuracy >= 99) {
    return Math.floor(baseAmount * 0.5);
  }
  if (accuracy >= 95) {
    return Math.floor(baseAmount * 0.3);
  }
  if (accuracy >= 90) {
    return Math.floor(baseAmount * 0.15);
  }
  return 0;
};

// ========================================
// ADAPTIVE DIFFICULTY
// ========================================

/**
 * Calculate adaptive difficulty multiplier
 * Adjusts XP based on recent performance trends
 */
export const calculateAdaptiveDifficulty = (
  recentAccuracyTrend: number,
  consistencyScore: number,
  improvementRate: number
): number => {
  // Base multiplier
  let multiplier = 1.0;
  
  // Adjust based on accuracy trend (-20% to +20%)
  const trendAdjustment = (recentAccuracyTrend / 100) * 0.5;
  multiplier += Math.max(-0.2, Math.min(0.2, trendAdjustment));
  
  // Bonus for high consistency (0 to +15%)
  const consistencyBonus = (consistencyScore / 100) * 0.15;
  multiplier += consistencyBonus;
  
  // Bonus for improvement (+0% to +20%)
  const improvementBonus = Math.max(0, Math.min(0.2, improvementRate / 50));
  multiplier += improvementBonus;
  
  // Clamp to reasonable range (0.5x to 2.0x)
  return Math.max(0.5, Math.min(2.0, multiplier));
};

// ========================================
// DECAY CALCULATION
// ========================================

/**
 * Calculate XP decay from inactivity
 */
export const calculateDecay = (
  lastActiveDate: Date,
  decayConfig: {
    gracePeriodDays: number;
    decayRatePerDay: number;
    maxDecayPercentage: number;
  }
): number => {
  const daysInactive = Math.floor(
    (Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // No decay during grace period
  if (daysInactive <= decayConfig.gracePeriodDays) {
    return 1.0; // No decay
  }
  
  // Calculate decay after grace period
  const decayDays = daysInactive - decayConfig.gracePeriodDays;
  const decayAmount = decayDays * decayConfig.decayRatePerDay;
  
  // Cap at max decay percentage
  const totalDecay = Math.min(decayAmount, decayConfig.maxDecayPercentage / 100);
  
  return 1.0 - totalDecay;
};

// ========================================
// COMPREHENSIVE XP CALCULATION
// ========================================

export interface XPCalculationParams {
  baseAmount: number;
  accuracy?: number;
  streakDays?: number;
  tierMultiplier?: number;
  adaptiveDifficulty?: AdaptiveDifficulty;
  momentumSystem?: MomentumSystem;
  prestigeSystem?: PrestigeSystem;
  eventMultiplier?: number;
  isPerfectMessage?: boolean;
  errorCount?: number;
  criticalErrorCount?: number;
  currentLevel?: number;
  applyLevelScaling?: boolean;
  grammarHeuristicFailed?: boolean;
}

/**
 * Calculate total XP with all multipliers
 * This is the main XP calculation function
 */
export const calculateTotalXP = (params: XPCalculationParams): XPCalculationResult => {
  const {
    baseAmount,
    accuracy = 100,
    streakDays = 0,
    tierMultiplier = 1.0,
    adaptiveDifficulty,
    momentumSystem,
    prestigeSystem,
    eventMultiplier = 1.0,
    isPerfectMessage = false,
  } = params;

  const grammarHeuristicFailed = Boolean(params.grammarHeuristicFailed);

  console.log('🧮 [XP] Starting calculation', {
    baseAmount,
    accuracy,
    streakDays,
    tierMultiplier,
    adaptiveTrend: adaptiveDifficulty?.trendMultiplier,
    adaptiveDecay: adaptiveDifficulty?.decayFactor,
    momentumActive: momentumSystem?.bonusActive,
    prestigeBonus: prestigeSystem?.prestigeXPBonus,
    eventMultiplier,
    isPerfectMessage,
  grammarHeuristicFailed,
    errors: {
      total: params.errorCount ?? 0,
      critical: params.criticalErrorCount ?? 0,
    },
    currentLevel: params.currentLevel,
  });
  
  const sources: XPSource[] = [];
  const timestamp = new Date();
  let totalXP = baseAmount;
  let penaltyXP = 0;
  
  const pushSource = (type: XPSource['type'], amount: number, description: string, multiplier: number) => {
    if (amount === 0) {
      return;
    }
    sources.push({
      type,
      amount,
      multiplier,
      description,
      timestamp,
    });
    if (amount < 0) {
      penaltyXP += Math.abs(amount);
    }
  };
  
  const applyMultiplier = (
    multiplier: number,
    positiveType: XPSource['type'],
    description: string
  ) => {
    if (Math.abs(multiplier - 1.0) < 0.001) {
      return;
    }
    const delta = Math.round(totalXP * (multiplier - 1.0));
    totalXP += delta;
    pushSource(delta >= 0 ? positiveType : 'penalty', delta, description, multiplier);
  };
  
  // Base XP source
  pushSource('accuracy', baseAmount, 'Base XP', 1.0);
  
  // Sequentially apply multipliers to capture compounding effects
  const accuracyMult = accuracy ? getAccuracyMultiplier(accuracy) : 1.0;
  applyMultiplier(accuracyMult, 'accuracy', `Accuracy adjustment (${accuracy.toFixed(1)}%)`);
  
  const streakMult = getStreakMultiplier(streakDays);
  applyMultiplier(streakMult, 'streak', `${streakDays}-day streak multiplier`);
  
  applyMultiplier(tierMultiplier, 'bonus', `Tier multiplier (${tierMultiplier.toFixed(2)}x)`);
  
  const adaptiveMult = adaptiveDifficulty?.trendMultiplier || 1.0;
  applyMultiplier(adaptiveMult, 'bonus', 'Adaptive difficulty adjustment');
  
  const decayMult = adaptiveDifficulty?.decayFactor || 1.0;
  applyMultiplier(decayMult, 'penalty', 'Inactivity decay');
  
  const momentumMult = momentumSystem ? calculateMomentumMultiplier(momentumSystem) : 1.0;
  applyMultiplier(momentumMult, 'bonus', 'Momentum bonus');
  
  const prestigeMult = prestigeSystem ? getPrestigeMultiplier(prestigeSystem) : 1.0;
  applyMultiplier(prestigeMult, 'bonus', 'Prestige bonus');
  
  applyMultiplier(eventMultiplier, 'event', 'Event multiplier');
  
  if (isPerfectMessage) {
    const perfectBonusAmount = Math.round(baseAmount * 0.5);
    totalXP += perfectBonusAmount;
    pushSource('bonus', perfectBonusAmount, 'Perfect message bonus 🎯', 1.5);
  }
  
  const difficultyModifier = params.applyLevelScaling === false
    ? 1.0
    : getLevelDifficultyModifier(params.currentLevel);
  applyMultiplier(difficultyModifier, 'bonus', `Level scaling (Lv ${params.currentLevel ?? 1})`);
  
  const accuracyBonus = calculateAccuracyBonus(baseAmount, accuracy);
  if (accuracyBonus > 0) {
    totalXP += accuracyBonus;
    pushSource('bonus', accuracyBonus, `High accuracy bonus (${accuracy.toFixed(1)}%)`, 1.0);
  }
  
  const effectiveBaseForPenalty = Math.max(baseAmount, Math.abs(totalXP));
  const errorPenalty = calculateErrorPenalty(
    effectiveBaseForPenalty,
    params.errorCount,
    params.criticalErrorCount,
    accuracy
  );
  if (errorPenalty > 0) {
    totalXP -= errorPenalty;
    pushSource('penalty', -errorPenalty, `Error penalty (${params.errorCount || 0} issues)`, 1.0);
  }
  
  if (accuracy < 60) {
    const lowAccuracyPenalty = Math.round(
      baseAmount * ((60 - accuracy) / 100) * 0.6
    );
    if (lowAccuracyPenalty > 0) {
      totalXP -= lowAccuracyPenalty;
      pushSource('penalty', -lowAccuracyPenalty, 'Low accuracy penalty', 1.0);
    }
  }
  
  const minXP = -Math.round(baseAmount * XP_PENALTY_RULES.MAX_NEGATIVE_MULTIPLIER);
  if (totalXP < minXP) {
    const clampRecovery = minXP - totalXP;
    totalXP = minXP;
    penaltyXP = Math.max(0, penaltyXP - clampRecovery);
  }

  totalXP = Math.round(totalXP);

  if (grammarHeuristicFailed && totalXP > 20) {
    const deduction = totalXP - 20;
    totalXP = 20;
    pushSource('penalty', -deduction, 'Grammar heuristic cap applied', 1.0);
    console.log('🛑 [XP] Grammar heuristic cap enforced', { deduction, cappedXP: totalXP });
  }
  
  const bonusXP = sources
    .slice(1)
    .filter((source) => source.amount > 0)
    .reduce((sum, source) => sum + source.amount, 0);
  const totalPenaltyXP = sources
    .filter((source) => source.amount < 0)
    .reduce((sum, source) => sum + Math.abs(source.amount), 0);
  penaltyXP = Math.max(penaltyXP, totalPenaltyXP);
  
  const totalMultiplier =
    accuracyMult *
    streakMult *
    tierMultiplier *
    adaptiveMult *
    decayMult *
    momentumMult *
    prestigeMult *
    eventMultiplier *
    (params.applyLevelScaling === false ? 1.0 : difficultyModifier);

  let clampedTotalXP = totalXP;
  if (totalXP < 0) {
    console.log('⚠️ [XP] Negative total XP detected, clamping to zero', {
      totalXP,
      penaltyXP,
      baseAmount,
    });
    clampedTotalXP = 0;
  }

  console.log('✅ [XP] Calculation complete', {
    totalXP: clampedTotalXP,
    bonusXP,
    penaltyXP,
    totalMultiplier: Number(totalMultiplier.toFixed(3)),
    sources: sources.map((source) => ({
      type: source.type,
      amount: source.amount,
      multiplier: source.multiplier,
      description: source.description,
    })),
  });
  
  return {
    baseXP: baseAmount,
    bonusXP,
    penaltyXP,
    totalXP: clampedTotalXP,
    multipliers: {
      accuracy: accuracyMult,
      streak: streakMult,
      tier: tierMultiplier,
      adaptive: adaptiveMult,
      event: eventMultiplier,
      momentum: momentumMult,
      prestige: prestigeMult,
      difficulty: difficultyModifier,
      penalty: penaltyXP / Math.max(1, baseAmount),
      total: totalMultiplier,
    },
    breakdown: sources,
  };
};

// ========================================
// SKILL-SPECIFIC XP DISTRIBUTION
// ========================================

/**
 * Distribute XP across skill categories
 */
export const distributeSkillXP = (
  totalXP: number,
  skillBreakdown?: Partial<Record<string, number>>
): Record<string, number> => {
  if (!skillBreakdown) {
    // Equal distribution if no breakdown provided
    const categories = ['grammar', 'vocabulary', 'spelling', 'fluency'];
    const xpPerSkill = Math.floor(totalXP / categories.length);
    
    return categories.reduce((acc, skill) => {
      acc[skill] = xpPerSkill;
      return acc;
    }, {} as Record<string, number>);
  }
  
  // Distribute based on provided breakdown
  const result: Record<string, number> = {};
  const total = Object.values(skillBreakdown).reduce((sum, val) => (sum || 0) + (val || 0), 0);
  
  for (const [skill, weight] of Object.entries(skillBreakdown)) {
    if (weight && total && total > 0) {
      result[skill] = Math.floor((weight / total) * totalXP);
    }
  }
  
  return result;
};

// ========================================
// FORECAST & ANALYTICS
// ========================================

/**
 * Forecast when user will reach next level
 */
export const forecastLevelUp = (
  currentXP: number,
  xpToNextLevel: number,
  avgXPPerDay: number
): Date | null => {
  if (avgXPPerDay <= 0) return null;
  
  const daysToLevelUp = Math.ceil(xpToNextLevel / avgXPPerDay);
  const forecastDate = new Date();
  forecastDate.setDate(forecastDate.getDate() + daysToLevelUp);
  
  return forecastDate;
};

/**
 * Calculate average XP per day
 */
export const calculateAverageXPPerDay = (
  totalXP: number,
  activeDays: number
): number => {
  if (activeDays <= 0) return 0;
  return totalXP / activeDays;
};

/**
 * Calculate XP velocity (XP gain rate)
 */
export const calculateXPVelocity = (
  recentXP: number[],
  windowDays: number = 7
): number => {
  if (recentXP.length < 2) return 0;
  
  const recent = recentXP.slice(-windowDays);
  const sum = recent.reduce((acc, val) => acc + val, 0);
  
  return sum / recent.length;
};

// ========================================
// EXPORTS
// ========================================

export const XPCalculator = {
  calculateXPForLevel,
  calculateCumulativeXP,
  getLevelFromXP,
  getAccuracyMultiplier,
  getStreakMultiplier,
  calculateMomentumMultiplier,
  getPrestigeMultiplier,
  calculateAdaptiveDifficulty,
  calculateDecay,
  calculateTotalXP,
  distributeSkillXP,
  forecastLevelUp,
  calculateAverageXPPerDay,
  calculateXPVelocity,
};

export default XPCalculator;
