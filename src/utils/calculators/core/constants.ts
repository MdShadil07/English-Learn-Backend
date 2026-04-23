import { CategoryWeights, WeightProfile } from './types.js';

// Default weight profiles
export const DEFAULT_WEIGHTS: CategoryWeights = {
  grammar: 0.25,
  vocabulary: 0.20,
  spelling: 0.15,
  fluency: 0.15,
  punctuation: 0.10,
  capitalization: 0.10,
  syntax: 0.03,
  coherence: 0.02,
};

export const WEIGHT_PROFILES: Record<string, WeightProfile> = {
  default: {
    baseWeights: DEFAULT_WEIGHTS,
    contextModifiers: {
      shortMessage: 0.90, // 10% reduction for <10 words
      mediumMessage: 1.00, // No change
      longMessage: 1.05, // 5% bonus for >50 words
      questionType: 1.02,
      statementType: 1.00,
    },
  },
  beginner: {
    baseWeights: {
      ...DEFAULT_WEIGHTS,
      grammar: 0.30, // More weight on basics
      spelling: 0.20,
      vocabulary: 0.15,
      fluency: 0.15,
      punctuation: 0.10,
      capitalization: 0.08,
      syntax: 0.01,
      coherence: 0.01,
    },
    contextModifiers: {
      shortMessage: 0.95, // Less harsh
      mediumMessage: 1.00,
      longMessage: 1.03,
      questionType: 1.00,
      statementType: 1.00,
    },
  },
  advanced: {
    baseWeights: {
      ...DEFAULT_WEIGHTS,
      coherence: 0.10, // More weight on advanced
      syntax: 0.08,
      vocabulary: 0.22,
      grammar: 0.20, // Slightly reduced for advanced users
      fluency: 0.18,
    },
    contextModifiers: {
      shortMessage: 0.85,
      mediumMessage: 1.00,
      longMessage: 1.10,
      questionType: 1.05,
      statementType: 1.00,
    },
  },
};

// XP Constants
export const XP_CONFIG = {
  BASE_XP_PER_ACCURACY_POINT: 0.5, // 50 XP for 100% accuracy
  WORD_BONUS: 0.5, // 0.5 XP per word
  MIN_XP: 5, // Floor
  MAX_XP: 500, // Ceiling
  
  // Tier multipliers
  TIER_MULTIPLIERS: {
    free: 1.0,
    pro: 1.25,
    premium: 1.5,
  },
  
  // Streak bonuses
  STREAK_BONUS_PER_DAY: 0.05, // 5% per day
  PRECISION_STREAK_BONUS: 0.10, // 10% for 95%+ accuracy
  MAX_STREAK_BONUS: 0.50, // Cap at 50%
  
  // Penalty curve parameters
  PENALTY_SIGMOID_K: 0.15, // Steepness
  PENALTY_SIGMOID_X0: 5, // Midpoint (5 errors)
};

// Level Progression
export const LEVEL_CONFIG = {
  BASE_XP: 100,
  EXPONENT: 1.3, // XP_required = BASE_XP * (level ^ EXPONENT)
  MAX_LEVEL: 100,
};

// NLP Timeouts
export const NLP_TIMEOUTS = {
  LANGUAGETOOL: 5000, // 5s
  GPT: 10000, // 10s
  SPACY: 3000, // 3s
  TOTAL: 15000, // 15s max
};

// Cache TTLs (seconds)
export const CACHE_TTL = {
  NLP_RESPONSE: 3600, // 1 hour
  USER_PROFILE: 300, // 5 minutes
  WEIGHT_PROFILE: 1800, // 30 minutes
};

// Error severity weights (for penalty calculation)
export const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 6,
  medium: 3,
  low: 1,
  suggestion: 0,
};

// Export all constants as default for module resolution
export default {
  DEFAULT_WEIGHTS,
  WEIGHT_PROFILES,
  XP_CONFIG,
  LEVEL_CONFIG,
  NLP_TIMEOUTS,
  CACHE_TTL,
  SEVERITY_WEIGHTS,
};