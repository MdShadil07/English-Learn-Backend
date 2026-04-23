/**
 * 🎯 LEVELING SYSTEM - COMPREHENSIVE TYPE DEFINITIONS
 * Industry-standard type architecture for scalable leveling system
 */

// ========================================
// CORE ENUMS
// ========================================

export enum ProficiencyLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
  EXPERT = 'Expert',
  MASTER = 'Master',
}

export enum SkillCategory {
  GRAMMAR = 'grammar',
  VOCABULARY = 'vocabulary',
  SPELLING = 'spelling',
  FLUENCY = 'fluency',
  LISTENING = 'listening',
  SPEAKING = 'speaking',
  PRONUNCIATION = 'pronunciation',
  COMPREHENSION = 'comprehension',
}

export enum RewardRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum MilestoneType {
  LEVEL = 'level',
  ACCURACY = 'accuracy',
  STREAK = 'streak',
  SKILL = 'skill',
  PRESTIGE = 'prestige',
  SPECIAL = 'special',
}

export enum EventType {
  WEEKEND_BOOST = 'weekend_boost',
  CONSISTENCY_WEEK = 'consistency_week',
  MILESTONE_MADNESS = 'milestone_madness',
  DOUBLE_XP = 'double_xp',
  SEASONAL = 'seasonal',
}

// ========================================
// SKILL-SPECIFIC TYPES
// ========================================

export interface SkillXP {
  [SkillCategory.GRAMMAR]: number;
  [SkillCategory.VOCABULARY]: number;
  [SkillCategory.SPELLING]: number;
  [SkillCategory.FLUENCY]: number;
  [SkillCategory.LISTENING]: number;
  [SkillCategory.SPEAKING]: number;
  [SkillCategory.PRONUNCIATION]: number;
  [SkillCategory.COMPREHENSION]: number;
}

export interface SkillLevel {
  category: SkillCategory;
  level: number;
  xp: number;
  xpForNext: number;
  proficiency: ProficiencyLevel;
  rank: number; // Percentile ranking
}

export interface SkillProgress {
  skills: Record<SkillCategory, SkillLevel>;
  overallLevel: number;
  balanceScore: number; // How balanced skills are (0-100)
  specialization: SkillCategory | null; // Strongest skill
}

// ========================================
// XP SYSTEM TYPES
// ========================================

export interface XPSource {
  type: 'accuracy' | 'streak' | 'challenge' | 'milestone' | 'event' | 'bonus' | 'penalty';
  amount: number;
  multiplier: number;
  description: string;
  timestamp: Date;
}

export interface XPTransaction {
  id: string;
  amount: number;
  sources: XPSource[];
  totalMultiplier: number;
  skillCategory?: SkillCategory;
  timestamp: Date;
}

export interface XPCalculationResult {
  baseXP: number;
  bonusXP: number;
  penaltyXP: number;
  totalXP: number;
  multipliers: {
    accuracy: number;
    streak: number;
    tier: number;
    adaptive: number;
    event: number;
    momentum: number;
    prestige: number;
    difficulty: number;
    penalty: number;
    total: number;
  };
  breakdown: XPSource[];
}

// ========================================
// ADAPTIVE DIFFICULTY TYPES
// ========================================

export interface AdaptiveDifficulty {
  currentDifficulty: number; // 0.5 to 2.0
  trendMultiplier: number; // Based on recent performance
  decayFactor: number; // Inactivity penalty
  momentumBonus: number; // Streak bonus
  adjustmentHistory: DifficultyAdjustment[];
}

export interface DifficultyAdjustment {
  timestamp: Date;
  previousDifficulty: number;
  newDifficulty: number;
  reason: string;
  performanceMetrics: {
    accuracy: number;
    consistency: number;
    improvement: number;
  };
}

// ========================================
// DECAY & MOMENTUM TYPES
// ========================================

export interface DecaySystem {
  enabled: boolean;
  lastActiveDate: Date;
  daysInactive: number;
  decayRate: number; // % per day
  totalDecay: number; // Accumulated decay
  canRecover: boolean;
}

export interface MomentumSystem {
  currentStreak: number;
  momentumLevel: number; // 0 to 5
  multiplier: number;
  comboCount: number; // Consecutive high scores
  bonusActive: boolean;
  expiresAt: Date | null;
}

// ========================================
// PRESTIGE SYSTEM TYPES
// ========================================

export interface PrestigeSystem {
  prestigeLevel: number;
  totalPrestiges: number;
  prestigeXPBonus: number; // Permanent bonus
  prestigeRewards: PrestigeReward[];
  canPrestige: boolean;
  nextPrestigeRequirement: number;
}

export interface PrestigeReward {
  prestigeLevel: number;
  rewards: string[];
  bonusMultiplier: number;
  unlockedAt: Date;
}

// ========================================
// MILESTONE & REWARD TYPES
// ========================================

export interface Milestone {
  id: string;
  level: number;
  type: MilestoneType;
  name: string;
  description: string;
  rewards: Reward[];
  requirements?: MilestoneRequirement[];
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // 0-100
}

export interface MilestoneRequirement {
  type: 'level' | 'xp' | 'accuracy' | 'streak' | 'skill';
  value: number;
  current: number;
  description: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  rarity: RewardRarity;
  type: 'badge' | 'multiplier' | 'feature' | 'cosmetic' | 'token';
  value?: number | string;
  icon: string;
  claimed: boolean;
  claimedAt?: Date;
}

// ========================================
// EVENT SYSTEM TYPES
// ========================================

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  multiplier: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  participationCount: number;
  rewards?: Reward[];
}

export interface EventSchedule {
  events: GameEvent[];
  activeEvent: GameEvent | null;
  upcomingEvents: GameEvent[];
  pastEvents: GameEvent[];
}

// ========================================
// ANALYTICS & TRACKING TYPES
// ========================================

export interface PerformanceMetrics {
  dailyXP: number[];
  weeklyXP: number[];
  monthlyXP: number[];
  averageXPPerSession: number;
  averageAccuracy: number;
  accuracyTrend: number; // % change
  consistencyScore: number;
  improvementRate: number; // % per day
  retentionRate7d: number;
  retentionRate30d: number;
  streakRetention: number;
}

export interface LevelAnalytics {
  currentLevel: number;
  levelUpVelocity: number; // Days per level
  forecastedLevelUp: Date;
  daysToNextLevel: number;
  percentileRank: number; // Top X% of users
  skillBalance: number;
  strengthSkills: SkillCategory[];
  weaknessSkills: SkillCategory[];
  recommendedFocus: SkillCategory[];
}

export interface UserBehaviorProfile {
  playStyle: 'consistent' | 'burst' | 'casual' | 'competitive';
  preferredSkills: SkillCategory[];
  activityPattern: {
    peakHours: number[];
    peakDays: string[];
    averageSessionLength: number;
  };
  motivationFactors: {
    achievementDriven: number; // 0-100
    competitionDriven: number;
    progressDriven: number;
    socialDriven: number;
  };
}

// ========================================
// MAIN LEVELING STATE TYPES
// ========================================

export interface LevelProgress {
  currentLevel: number;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  progressPercentage: number;
  proficiencyLevel: ProficiencyLevel;
  tier: number; // 1-10 within proficiency level
  totalXP: number;
}

export interface LevelStats {
  totalXP: number;
  totalMessages: number;
  totalAccuracyPoints: number;
  averageAccuracy: number;
  perfectMessages: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  joinedDate: Date;
  activeDays: number;
}

export interface ComprehensiveLevelingState {
  // Core Progress
  levelProgress: LevelProgress;
  levelStats: LevelStats;
  
  // Skill System
  skillProgress: SkillProgress;
  
  // Advanced Systems
  adaptiveDifficulty: AdaptiveDifficulty;
  decaySystem: DecaySystem;
  momentumSystem: MomentumSystem;
  prestigeSystem: PrestigeSystem;
  
  // Milestones & Rewards
  milestones: Milestone[];
  unlockedRewards: Reward[];
  
  // Events
  eventSchedule: EventSchedule;
  
  // Analytics
  performanceMetrics: PerformanceMetrics;
  levelAnalytics: LevelAnalytics;
  behaviorProfile: UserBehaviorProfile;
  
  // Meta
  lastUpdated: Date;
  version: string;
}

// ========================================
// CONFIGURATION TYPES
// ========================================

export interface XPCurveConfig {
  BASE_XP: number;
  EXPONENT: number;
  MULTIPLIER: number;
  MILESTONE_BONUS: number;
  PRESTIGE_SCALING: number;
}

export interface DecayConfig {
  ENABLED: boolean;
  GRACE_PERIOD_DAYS: number;
  DECAY_RATE_PER_DAY: number;
  MAX_DECAY_PERCENTAGE: number;
  RECOVERY_RATE: number;
}

export interface MomentumConfig {
  STREAK_THRESHOLD: number;
  ACCURACY_THRESHOLD: number;
  MAX_MULTIPLIER: number;
  DURATION_HOURS: number;
  COMBO_INCREMENT: number;
}

export interface PrestigeConfig {
  MIN_LEVEL: number;
  XP_BONUS_PER_PRESTIGE: number;
  MAX_PRESTIGE_LEVEL: number;
  RESET_SKILLS: boolean;
}

export interface LevelingSystemConfig {
  xpCurve: XPCurveConfig;
  decay: DecayConfig;
  momentum: MomentumConfig;
  prestige: PrestigeConfig;
  features: {
    skillBranching: boolean;
    adaptiveDifficulty: boolean;
    prestigeSystem: boolean;
    eventSystem: boolean;
    analytics: boolean;
  };
}

// ========================================
// ACTION TYPES
// ========================================

export interface MessageData {
  accuracy: number;
  isPerfect: boolean;
  skillBreakdown?: Partial<Record<SkillCategory, number>>;
  timestamp: Date;
}

export interface XPGainData {
  amount: number;
  accuracy?: number;
  skillCategory?: SkillCategory;
  source: string;
}

// ========================================
// STORAGE TYPES
// ========================================

export interface LevelingStorageKeys {
  PROGRESS: string;
  STATS: string;
  SKILLS: string;
  MILESTONES: string;
  ADAPTIVE: string;
  PRESTIGE: string;
  ANALYTICS: string;
  CONFIG: string;
}

// Ensure this file is treated as a module
export {};
