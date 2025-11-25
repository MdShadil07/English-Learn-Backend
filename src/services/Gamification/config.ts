/**
 * 🎯 LEVELING SYSTEM CONFIGURATION
 * Centralized configuration for all leveling features
 */

import type {
    LevelingSystemConfig,
    XPCurveConfig,
    DecayConfig,
    MomentumConfig,
    PrestigeConfig,
    LevelingStorageKeys,
} from './type/index.js';
import { ProficiencyLevel } from './type/index.js';

// ========================================
// XP CURVE CONFIGURATION
// ========================================

export const XP_CURVE_CONFIG: XPCurveConfig = {
  BASE_XP: 220,
  EXPONENT: 1.1,
  MULTIPLIER: 1.08,
  MILESTONE_BONUS: 1.25,
  PRESTIGE_SCALING: 1.15,
};

export const LEVEL_DIFFICULTY_MODIFIERS = [
  { minLevel: 1, modifier: 1.0 },
  { minLevel: 11, modifier: 0.95 },
  { minLevel: 21, modifier: 0.92 },
  { minLevel: 31, modifier: 0.88 },
  { minLevel: 51, modifier: 0.82 },
  { minLevel: 76, modifier: 0.78 },
  { minLevel: 101, modifier: 0.75 },
];

export const XP_PENALTY_RULES = {
  // Reduced penalty weights to avoid excessive negative XP for common errors
  ERROR_WEIGHT: 0.02,
  CRITICAL_ERROR_WEIGHT: 0.06,
  LOW_ACCURACY_THRESHOLD: 70,
  LOW_ACCURACY_WEIGHT: 0.01,
  // Limit the multiplier for negative XP so simple mistakes cannot produce large negative values
  MAX_NEGATIVE_MULTIPLIER: 1,
};

// ========================================
// DECAY SYSTEM CONFIGURATION
// ========================================

export const DECAY_CONFIG: DecayConfig = {
  ENABLED: true,
  GRACE_PERIOD_DAYS: 3,
  DECAY_RATE_PER_DAY: 0.02, // 2% per day after grace period
  MAX_DECAY_PERCENTAGE: 20, // Max 20% total decay
  RECOVERY_RATE: 0.5, // 50% recovery per active day
};

// ========================================
// MOMENTUM SYSTEM CONFIGURATION
// ========================================

export const MOMENTUM_CONFIG: MomentumConfig = {
  STREAK_THRESHOLD: 5, // Activate momentum after 5-day streak
  ACCURACY_THRESHOLD: 90, // Need 90%+ accuracy to maintain
  MAX_MULTIPLIER: 2.0, // Maximum 2x XP from momentum
  DURATION_HOURS: 24, // Momentum lasts 24 hours
  COMBO_INCREMENT: 0.05, // +5% per combo
};

// ========================================
// PRESTIGE SYSTEM CONFIGURATION
// ========================================

export const PRESTIGE_CONFIG: PrestigeConfig = {
  MIN_LEVEL: 200,
  XP_BONUS_PER_PRESTIGE: 0.1, // +10% XP per prestige
  MAX_PRESTIGE_LEVEL: 10,
  RESET_SKILLS: false, // Keep skill progress on prestige
};

// ========================================
// FEATURE FLAGS
// ========================================

export const FEATURE_FLAGS = {
  SKILL_BRANCHING: true,
  ADAPTIVE_DIFFICULTY: true,
  PRESTIGE_SYSTEM: true,
  EVENT_SYSTEM: true,
  ANALYTICS: true,
  DECAY_SYSTEM: true,
  MOMENTUM_SYSTEM: true,
  LEADERBOARD: false, // Future feature
  SOCIAL_FEATURES: false, // Future feature
};

// ========================================
// COMPLETE SYSTEM CONFIGURATION
// ========================================

export const LEVELING_SYSTEM_CONFIG: LevelingSystemConfig = {
  xpCurve: XP_CURVE_CONFIG,
  decay: DECAY_CONFIG,
  momentum: MOMENTUM_CONFIG,
  prestige: PRESTIGE_CONFIG,
  features: {
    skillBranching: FEATURE_FLAGS.SKILL_BRANCHING,
    adaptiveDifficulty: FEATURE_FLAGS.ADAPTIVE_DIFFICULTY,
    prestigeSystem: FEATURE_FLAGS.PRESTIGE_SYSTEM,
    eventSystem: FEATURE_FLAGS.EVENT_SYSTEM,
    analytics: FEATURE_FLAGS.ANALYTICS,
  },
};

// ========================================
// STORAGE KEYS
// ========================================

export const STORAGE_KEYS: LevelingStorageKeys = {
  PROGRESS: 'leveling_v2_progress',
  STATS: 'leveling_v2_stats',
  SKILLS: 'leveling_v2_skills',
  MILESTONES: 'leveling_v2_milestones',
  ADAPTIVE: 'leveling_v2_adaptive',
  PRESTIGE: 'leveling_v2_prestige',
  ANALYTICS: 'leveling_v2_analytics',
  CONFIG: 'leveling_v2_config',
};

// ========================================
// PROFICIENCY LEVEL THRESHOLDS
// ========================================

export const PROFICIENCY_THRESHOLDS = {
  [ProficiencyLevel.BEGINNER]: { min: 1, max: 20 },
  [ProficiencyLevel.INTERMEDIATE]: { min: 21, max: 50 },
  [ProficiencyLevel.ADVANCED]: { min: 51, max: 100 },
  [ProficiencyLevel.EXPERT]: { min: 101, max: 200 },
  [ProficiencyLevel.MASTER]: { min: 201, max: Infinity },
};

// ========================================
// ACCURACY MULTIPLIERS
// ========================================

export const ACCURACY_MULTIPLIERS = [
  { threshold: 98, multiplier: 1.6, label: 'Masterful!' },
  { threshold: 95, multiplier: 1.5, label: 'Excellent!' },
  { threshold: 85, multiplier: 1.2, label: 'Good' },
  { threshold: 75, multiplier: 1.0, label: 'Normal' },
  { threshold: 60, multiplier: 0.8, label: 'Needs Improvement' },
  { threshold: 40, multiplier: 0.4, label: 'Very Low' },
  { threshold: 20, multiplier: 0.0, label: 'Critical' },
  { threshold: 0, multiplier: -0.5, label: 'Severe Penalty' },
];

// ========================================
// STREAK BONUSES
// ========================================


export const STREAK_BONUSES = [
  { days: 30, multiplier: 1.5, label: 'Legendary!' },
  { days: 14, multiplier: 1.2, label: 'Amazing!' },
  { days: 7, multiplier: 1.1, label: 'Great!' },
  { days: 3, multiplier: 1.05, label: 'Good!' },
];

// ========================================
// MILESTONE DEFINITIONS
// ========================================

export const MILESTONE_LEVELS = [
  5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 
  100, 125, 150, 175, 200, 250, 300, 400, 500
];

export const MILESTONE_REWARDS: Record<number, string[]> = {
  5: ['🎯 First Steps Badge', '📊 Progress Chart Unlocked'],
  10: ['🔥 Streak Tracker', '⭐ Bronze Star Badge'],
  20: ['🎓 Intermediate Badge', '📈 Advanced Analytics'],
  30: ['💎 Premium Preview', '🏆 Achievement Board'],
  50: ['🎖️ Advanced Badge', '🔮 AI Insights Plus'],
  75: ['🌟 Gold Star', '📚 Custom Learning Path'],
  100: ['👑 Expert Badge', '🚀 Master Class Access'],
  150: ['💫 Platinum Badge', '🎁 Exclusive Rewards'],
  200: ['🏅 Master Badge', '👨‍🏫 Mentor Status', '🔄 Prestige Unlock'],
  250: ['💎 Diamond Badge', '⚡ Super Boost'],
  300: ['🌈 Rainbow Master', '🎭 Custom Themes'],
  400: ['🔥 Legendary Status', '🏛️ Hall of Fame'],
  500: ['👑 Ultimate Master', '🌟 Eternal Glory'],
};

// ========================================
// REWARD RARITY WEIGHTS
// ========================================

export const REWARD_RARITY_WEIGHTS = {
  common: 0.60,
  uncommon: 0.25,
  rare: 0.10,
  epic: 0.04,
  legendary: 0.01,
};

// ========================================
// EVENT SCHEDULES
// ========================================

export const EVENT_TEMPLATES = {
  WEEKEND_BOOST: {
    name: 'Weekend XP Boost',
    multiplier: 1.5,
    description: 'Earn 50% more XP on weekends!',
  },
  CONSISTENCY_WEEK: {
    name: 'Consistency Challenge',
    multiplier: 1.3,
    description: 'Bonus XP for practicing every day this week!',
  },
  MILESTONE_MADNESS: {
    name: 'Milestone Madness',
    multiplier: 2.0,
    description: 'Double XP for milestone levels!',
  },
  DOUBLE_XP: {
    name: 'Double XP Hour',
    multiplier: 2.0,
    description: 'Limited time: Double XP for all activities!',
  },
};

// ========================================
// ANALYTICS CONFIGURATION
// ========================================

export const ANALYTICS_CONFIG = {
  HISTORY_RETENTION_DAYS: 90,
  DAILY_XP_SAMPLES: 30,
  PERFORMANCE_METRICS_COUNT: 10,
  FORECAST_DAYS: 30,
};

// ========================================
// UI CONFIGURATION
// ========================================

export const UI_CONFIG = {
  XP_ANIMATION_DURATION: 1000, // ms
  LEVEL_UP_CELEBRATION_DURATION: 3000, // ms
  PROGRESS_BAR_UPDATE_INTERVAL: 50, // ms
  NOTIFICATION_DISPLAY_TIME: 5000, // ms
};

// ========================================
// DEVELOPMENT/DEBUG CONFIGURATION
// ========================================

export const DEBUG_CONFIG = {
  ENABLE_CONSOLE_LOGS: process.env.NODE_ENV === 'development',
  ENABLE_XP_COMMANDS: process.env.NODE_ENV === 'development',
  FAST_LEVEL_UP: false, // Set to true for testing
  SKIP_DECAY: false, // Set to true to disable decay in dev
};

// ========================================
// VALIDATION RULES
// ========================================

export const VALIDATION_RULES = {
  MIN_XP_GAIN: 1,
  MAX_XP_GAIN: 10000,
  MIN_ACCURACY: 0,
  MAX_ACCURACY: 100,
  MAX_STREAK: 365,
  MIN_LEVEL: 1,
  MAX_LEVEL: 999,
};

// ========================================
// EXPORT ALL
// ========================================

export const CONFIG = {
  SYSTEM: LEVELING_SYSTEM_CONFIG,
  XP_CURVE: XP_CURVE_CONFIG,
  LEVEL_DIFFICULTY: LEVEL_DIFFICULTY_MODIFIERS,
  XP_PENALTY: XP_PENALTY_RULES,
  DECAY: DECAY_CONFIG,
  MOMENTUM: MOMENTUM_CONFIG,
  PRESTIGE: PRESTIGE_CONFIG,
  STORAGE: STORAGE_KEYS,
  FEATURES: FEATURE_FLAGS,
  PROFICIENCY: PROFICIENCY_THRESHOLDS,
  ACCURACY_MULTS: ACCURACY_MULTIPLIERS,
  STREAK_BONUS: STREAK_BONUSES,
  MILESTONES: MILESTONE_REWARDS,
  EVENTS: EVENT_TEMPLATES,
  ANALYTICS: ANALYTICS_CONFIG,
  UI: UI_CONFIG,
  DEBUG: DEBUG_CONFIG,
  VALIDATION: VALIDATION_RULES,
} as const;

export default CONFIG;
