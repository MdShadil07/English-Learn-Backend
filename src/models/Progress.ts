/**
 * 🎯 PROGRESS MODEL - COMPREHENSIVE ANALYTICS & LEADERBOARD SCHEMA
 * Full-fledged progress tracking for analytical dashboard and leaderboards
 * Tracks XP, levels, accuracy, skills, categories, sessions, and achievements
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { calculateCumulativeXP, calculateXPForLevel, getLevelFromXP } from '../services/Gamification/xpCalculator.js';

// ========================================
// INTERFACES & TYPES
// ========================================

/**
 * Category-wise performance tracking
 */
export interface ICategoryProgress {
  name: string; // 'vocabulary', 'grammar', 'pronunciation', etc.
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0-100
  xpEarned: number;
  level: number;
  lastPracticed: Date;
  timeSpent: number; // in minutes
  streak: number;
  bestStreak: number;
}

/**
 * FREE NLP Detector Contributions (Typo.js, CEFR, LanguageTool, OpenRouter)
 */
export interface INLPDetectorContributions {
  languageTool?: {
    errors: number;
    confidence: number;
    source: string;
    processingTime?: number;
  };
  spelling?: {
    accuracy: number;
    errorsFound: number;
    confidence: number;
    source: string; // 'typo-js'
    processingTime?: number;
  };
  vocabulary?: {
    level: string; // A1, A2, B1, B2, C1, C2
    score: number;
    uniqueWords?: number;
    totalWords?: number;
    lexicalDiversity?: number;
    unknownWordPercentage?: number;
    source: string; // 'cefr-wordlists'
    processingTime?: number;
  };
  fluency?: {
    score: number;
    method: string; // 'rule-based' | 'openrouter-mistral'
    confidence?: number;
    source: string; // 'heuristics' | 'openrouter-mistral'
    processingTime?: number;
  };
}

/**
 * Performance metrics for analytics
 */
export interface IPerformanceMetrics {
  totalProcessingTime: number; // Total analysis time in ms
  detectorBreakdown: {
    spelling?: { time: number; accuracy: number };
    vocabulary?: { time: number; score: number; level: string };
    fluency?: { time: number; score: number; method: string };
    languageTool?: { time: number; errors: number };
  };
  cacheHits?: number; // Redis cache hits
  cacheMisses?: number; // Redis cache misses
}

/**
 * Detailed accuracy data from EnhancedAccuracyResult with NLP analytics
 */
export interface IAccuracyData {
  overall: number; // 0-100
  adjustedOverall: number; // 0-100
  grammar: number; // 0-100
  vocabulary: number; // 0-100
  spelling: number; // 0-100
  fluency: number; // 0-100
  punctuation: number; // 0-100
  capitalization: number; // 0-100
  syntax: number; // 0-100 (Pro/Premium)
  coherence: number; // 0-100 (Premium)
  overallAccuracySummary?: {
    overallAccuracy: number;
    overallGrammar: number;
    overallVocabulary: number;
    overallSpelling: number;
    overallFluency: number;
    overallPunctuation: number;
    overallCapitalization: number;
    overallSyntax: number;
    overallCoherence: number;
    calculationCount: number;
    lastCalculated: Date;
  };
  latestSnapshot?: {
    overall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    punctuation: number;
    capitalization: number;
    syntax: number;
    coherence: number;
    recordedAt: Date;
  };
  cache?: {
    messageCount: number;
    lastUpdated: Date | null;
  };
  
  // Error tracking
  totalErrors: number;
  criticalErrors: number;
  errorsByType: {
    grammar: number;
    vocabulary: number;
    spelling: number;
    punctuation: number;
    capitalization: number;
    syntax: number;
    style: number;
    coherence: number;
  };
  
  // Advanced metrics (Pro/Premium)
  readabilityScore?: number;
  toneScore?: number;
  styleScore?: number;
  
  // FREE NLP Enhancement Data
  freeNLPEnhanced?: boolean; // Flag indicating FREE NLP was used
  nlpCost?: string; // '$0/month' for free NLP
  detectorContributions?: INLPDetectorContributions; // Individual detector results
  performanceMetrics?: IPerformanceMetrics; // Processing time breakdown
  vocabularyLevel?: string; // CEFR level: A1-C2
  
  // Timestamps
  lastCalculated: Date;
  calculationCount: number;
}

/**
 * Accuracy history entry for trend analysis
 */
export interface IAccuracyHistoryEntry {
  date: Date;
  overall: number;
  grammar: number;
  vocabulary: number;
  spelling: number;
  fluency: number;
  messageId?: string;
  sessionId?: string;
}

/**
 * Level-up event tracking
 */
export interface ILevelUpEvent {
  fromLevel: number;
  toLevel: number;
  timestamp: Date;
  xpAtLevelUp: number;
  prestigeLevel: number;
  rewards?: {
    badges?: string[];
    achievements?: string[];
    unlocks?: string[];
  };
}

/**
 * XP event tracking for analytics
 */
export interface IXPEvent {
  amount: number;
  source: 'accuracy' | 'streak' | 'bonus' | 'premium' | 'prestige' | 'achievement' | 'daily' | 'ai_chat' | 'conversation' | 'penalty';
  category?: string;
  timestamp: Date;
  multiplier: number;
  details?: string;
}

/**
 * Skill-wise metrics (accuracy, fluency, etc.)
 */
export interface ISkillMetrics {
  accuracy: number; // 0-100
  vocabulary: number; // 0-100
  grammar: number; // 0-100
  pronunciation: number; // 0-100
  fluency: number; // 0-100
  comprehension: number; // 0-100
  listening: number; // 0-100
  speaking: number; // 0-100
  reading: number; // 0-100
  writing: number; // 0-100
}

/**
 * Session history for detailed analytics
 */
export interface ISessionHistory {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  xpGained: number;
  accuracyRate: number;
  activitiesCompleted: number;
  category: string;
  performanceRating: 'excellent' | 'good' | 'average' | 'needs-improvement';
}

/**
 * Daily activity requirement tracking for streak
 */
export interface IDailyActivity {
  date: Date;
  minutesPracticed: number; // Total minutes
  messagesCount: number; // AI chat messages
  accuracyAverage: number; // Average accuracy
  activitiesCompleted: string[]; // ['ai_chat', 'lesson', 'quiz']
  goalMet: boolean; // Whether daily goal was achieved
  xpEarned: number; // XP from this day's activities
}

/**
 * Streak freeze/save feature (Premium)
 */
export interface IStreakFreeze {
  available: number; // Number of freezes available
  used: number; // Number of freezes used this month
  lastUsed: Date | null; // Last time freeze was used
  expiresAt: Date | null; // When current freeze expires
}

/**
 * Streak milestone rewards
 */
export interface IStreakMilestone {
  days: number; // Milestone day (7, 14, 30, 60, 100, etc.)
  reachedAt: Date;
  rewards: {
    xpBonus: number;
    badgeId?: string;
    freezeToken?: number; // Premium users get freeze tokens
    title?: string;
  };
}

/**
 * Comprehensive streak tracking with detailed history and premium features
 */
export interface IStreakData {
  // Basic streak data
  current: number; // Current active streak (days)
  longest: number; // All-time longest streak
  lastActivityDate: Date | null; // Last activity timestamp
  streakStartDate: Date | null; // When current streak started
  totalStreakDays: number; // Lifetime streak days accumulated
  
  // Streak requirements (tier-based)
  dailyGoal: {
    minutesRequired: number; // Minutes required per day (10 for all tiers)
    messagesRequired: number; // AI chat messages required (5 for all, bonus for premium)
    activitiesRequired: string[]; // Required activity types
  };
  
  // Today's progress
  todayProgress: {
    minutesPracticed: number;
    messagesCount: number;
    activitiesCompleted: string[];
    goalMet: boolean;
    lastUpdated: Date | null;
  };
  
  // Grace period (tier-based)
  gracePeriod: {
    hours: number; // 0 for free, 3 for pro, 6 for premium
    isActive: boolean;
    expiresAt: Date | null;
  };
  
  // Streak freeze (Premium feature)
  freeze: IStreakFreeze;
  
  // Streak history
  streakHistory: Array<{
    startDate: Date;
    endDate: Date;
    length: number;
    reason: 'completed' | 'broken' | 'freeze_used'; // Why streak ended
  }>;
  
  // Daily activity logs (last 30 days)
  dailyActivities: IDailyActivity[];
  
  // Milestones achieved
  milestones: IStreakMilestone[];
  
  // Statistics
  stats: {
    totalActiveDays: number; // Total days with activity
    averageMinutesPerDay: number;
    bestWeek: number; // Highest streak in a week
    totalStreaksBroken: number;
    totalFreezeUsed: number;
  };
}

/**
 * XP breakdown for analytics
 */
export interface IXPBreakdown {
  fromAccuracy: number;
  fromStreak: number;
  fromBonus: number;
  fromPremium: number;
  fromPrestige: number;
  fromPenalty: number;
  total: number;
}

/**
 * Leaderboard metrics
 */
export interface ILeaderboardMetrics {
  globalRank: number;
  categoryRanks: Map<string, number>;
  weeklyXP: number;
  monthlyXP: number;
  lastRankUpdate: Date;
}

/**
 * Main Progress Interface
 */
export interface IProgress extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  
  // ========== LEVELING & XP ==========
  totalXP: number;
  currentLevel: number;
  currentLevelXP: number; // XP within current level
  xpToNextLevel: number;
  prestigeLevel: number; // Prestige system (level 100+)
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  tier: number; // 1-6 based on level ranges
  
  // ========== XP ANALYTICS ==========
  xpBreakdown: IXPBreakdown;
  dailyXP: number;
  weeklyXP: number;
  monthlyXP: number;
  yearlyXP: number;
  xpHistory: Array<{ date: Date; xp: number }>; // Last 30 days
  xpEvents: IXPEvent[]; // Detailed XP event history (last 100 events)
  
  // ========== ACCURACY DATA ==========
  accuracyData: IAccuracyData; // Current detailed accuracy metrics
  accuracyHistory: IAccuracyHistoryEntry[]; // Last 30 entries for trends
  
  // ========== SKILLS & ACCURACY ==========
  skills: ISkillMetrics;
  overallAccuracy: number; // 0-100 (weighted average of all skills)
  
  // ========== LEVEL-UP TRACKING ==========
  levelUpHistory: ILevelUpEvent[]; // All level-up events
  lastLevelUp: Date | null;
  
  // ========== CATEGORY TRACKING ==========
  categories: ICategoryProgress[]; // Per-category progress
  
  // ========== STREAK SYSTEM ==========
  streak: IStreakData;
  
  // ========== SESSION STATS ==========
  stats: {
    totalSessions: number;
    totalTimeSpent: number; // in minutes
    averageSessionTime: number; // in minutes
    lessonsCompleted: number;
    exercisesCompleted: number;
    quizzesTaken: number;
    conversationsPracticed: number;
    wordsLearned: number;
    perfectScores: number; // 100% accuracy sessions
  };
  
  // ========== SESSION HISTORY ==========
  sessionHistory: ISessionHistory[]; // Last 50 sessions
  
  // ========== ACHIEVEMENTS & BADGES ==========
  achievements: mongoose.Types.ObjectId[];
  badges: Array<{
    badgeId: string;
    name: string;
    earnedAt: Date;
    category: string;
  }>;
  
  // ========== LEADERBOARD DATA ==========
  leaderboard: ILeaderboardMetrics;
  
  // ========== ANALYTICS & INSIGHTS ==========
  analytics: {
    learningVelocity: number; // XP per hour
    consistencyScore: number; // 0-100 based on activity patterns
    improvementRate: number; // Week-over-week accuracy improvement
    strongestSkill: string;
    weakestSkill: string;
    recommendedFocus: string[];
  };
  
  // ========== MILESTONES ==========
  milestones: Array<{
    type: 'level' | 'xp' | 'accuracy' | 'streak' | 'category';
    value: number;
    achievedAt: Date;
    description: string;
  }>;
  
  // ========== TIMESTAMPS ==========
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;
  
  // ========== METHODS ==========
  addXP(xpAmount: number, category?: string, source?: string): Promise<{ leveledUp: boolean; newLevel: number; rewards?: any }>;
  updateSkillMetrics(skill: keyof ISkillMetrics, value: number): Promise<void>;
  updateAccuracyData(accuracyResult: any): Promise<void>;
  updateCategoryProgress(category: string, data: Partial<ICategoryProgress>): Promise<void>;
  recordSession(sessionData: Partial<ISessionHistory>): Promise<void>;
  updateStreak(): Promise<void>;
  calculateRank(): Promise<number>;
  getWeeklyReport(): Promise<any>;
  getMonthlyReport(): Promise<any>;
  getAccuracyTrends(days?: number): Promise<any>;
  getLevelUpStats(): Promise<any>;
}

// ========================================
// SCHEMA DEFINITION
// ========================================

const progressSchema = new Schema<IProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    
    // ========== LEVELING & XP ==========
    totalXP: {
      type: Number,
      default: 0,
      min: [0, 'Total XP cannot be negative'],
      index: true,
    },
    currentLevel: {
      type: Number,
      default: 1,
      min: [1, 'Level must be at least 1'],
      index: true,
    },
    currentLevelXP: {
      type: Number,
      default: 0,
      min: [0, 'Current level XP cannot be negative'],
    },
    xpToNextLevel: {
      type: Number,
      default: 500,
      min: [0, 'XP to next level cannot be negative'],
    },
    prestigeLevel: {
      type: Number,
      default: 0,
      min: [0, 'Prestige level cannot be negative'],
    },
    proficiencyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert', 'master'],
      default: 'beginner',
      index: true,
    },
    tier: {
      type: Number,
      default: 1,
      min: [1, 'Tier must be at least 1'],
      max: [6, 'Tier cannot exceed 6'],
    },
    
    // ========== XP ANALYTICS ==========
    xpBreakdown: {
      fromAccuracy: { type: Number, default: 0 },
      fromStreak: { type: Number, default: 0 },
      fromBonus: { type: Number, default: 0 },
      fromPremium: { type: Number, default: 0 },
      fromPrestige: { type: Number, default: 0 },
      fromPenalty: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    dailyXP: { type: Number, default: 0 },
    weeklyXP: { type: Number, default: 0, index: true },
    monthlyXP: { type: Number, default: 0, index: true },
    yearlyXP: { type: Number, default: 0 },
    xpHistory: [{
      date: { type: Date, required: true },
      xp: { type: Number, required: true },
    }],
    xpEvents: [{
      amount: { type: Number, required: true },
      source: { 
        type: String, 
        enum: ['accuracy', 'streak', 'bonus', 'premium', 'prestige', 'achievement', 'daily', 'ai_chat', 'conversation', 'penalty'],
        required: true 
      },
      category: { type: String },
      timestamp: { type: Date, default: Date.now },
      multiplier: { type: Number, default: 1.0 },
      details: { type: String },
    }],
    
    // ========== ACCURACY DATA ==========
    accuracyData: {
  // ⚠️ DEPRECATED: Use overallAccuracySummary.* instead (kept for backward compatibility)
      overall: { type: Number, default: 0, min: 0, max: 100, index: true },
      adjustedOverall: { type: Number, default: 0, min: 0, max: 100 },
      grammar: { type: Number, default: 0, min: 0, max: 100, index: true },
      vocabulary: { type: Number, default: 0, min: 0, max: 100, index: true },
      spelling: { type: Number, default: 0, min: 0, max: 100, index: true },
      fluency: { type: Number, default: 0, min: 0, max: 100, index: true },
      punctuation: { type: Number, default: 0, min: 0, max: 100 },
      capitalization: { type: Number, default: 0, min: 0, max: 100 },
      syntax: { type: Number, default: 0, min: 0, max: 100 },
      coherence: { type: Number, default: 0, min: 0, max: 100 },
      totalErrors: { type: Number, default: 0, min: 0 },
      criticalErrors: { type: Number, default: 0, min: 0 },
      errorsByType: {
        grammar: { type: Number, default: 0 },
        vocabulary: { type: Number, default: 0 },
        spelling: { type: Number, default: 0 },
        punctuation: { type: Number, default: 0 },
        capitalization: { type: Number, default: 0 },
        syntax: { type: Number, default: 0 },
        style: { type: Number, default: 0 },
        coherence: { type: Number, default: 0 },
      },
      readabilityScore: { type: Number, default: 0 },
      toneScore: { type: Number, default: 0 },
      styleScore: { type: Number, default: 0 },
      
      // FREE NLP Enhancement Data
      freeNLPEnhanced: { type: Boolean, default: false },
      nlpCost: { type: String, default: '$0/month' },
      vocabularyLevel: { type: String, default: 'A1', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], index: true }, // CEFR level for analytics
      
      // Detector Contributions (nested object for analytics)
      detectorContributions: {
        languageTool: {
          errors: { type: Number, default: 0 },
          confidence: { type: Number, default: 0 },
          source: { type: String, default: 'self-hosted' },
          processingTime: { type: Number, default: 0 }, // ms
        },
        spelling: {
          accuracy: { type: Number, default: 0 },
          errorsFound: { type: Number, default: 0 },
          confidence: { type: Number, default: 0 },
          source: { type: String, default: 'typo-js' },
          processingTime: { type: Number, default: 0 }, // ms
        },
        vocabulary: {
          level: { type: String, default: 'A1' },
          score: { type: Number, default: 0 },
          uniqueWords: { type: Number, default: 0 },
          totalWords: { type: Number, default: 0 },
          lexicalDiversity: { type: Number, default: 0 },
          unknownWordPercentage: { type: Number, default: 0 },
          source: { type: String, default: 'cefr-wordlists' },
          processingTime: { type: Number, default: 0 }, // ms
        },
        fluency: {
          score: { type: Number, default: 0 },
          method: { type: String, default: 'rule-based' },
          confidence: { type: Number, default: 0 },
          source: { type: String, default: 'heuristics' },
          processingTime: { type: Number, default: 0 }, // ms
        },
      },
      
      // Performance Metrics for optimization analytics
      performanceMetrics: {
        totalProcessingTime: { type: Number, default: 0 }, // Total time in ms
        detectorBreakdown: {
          spelling: {
            time: { type: Number, default: 0 },
            accuracy: { type: Number, default: 0 },
          },
          vocabulary: {
            time: { type: Number, default: 0 },
            score: { type: Number, default: 0 },
            level: { type: String, default: 'A1' },
          },
          fluency: {
            time: { type: Number, default: 0 },
            score: { type: Number, default: 0 },
            method: { type: String, default: 'rule-based' },
          },
          languageTool: {
            time: { type: Number, default: 0 },
            errors: { type: Number, default: 0 },
          },
        },
        cacheHits: { type: Number, default: 0 },
        cacheMisses: { type: Number, default: 0 },
      },

      // Rolling category-level averages (computed via weighted smoothing)
      overallAccuracySummary: {
        overallAccuracy: { type: Number, default: 0, min: 0, max: 100 },
        overallGrammar: { type: Number, default: 0, min: 0, max: 100 },
        overallVocabulary: { type: Number, default: 0, min: 0, max: 100 },
        overallSpelling: { type: Number, default: 0, min: 0, max: 100 },
        overallFluency: { type: Number, default: 0, min: 0, max: 100 },
        overallPunctuation: { type: Number, default: 0, min: 0, max: 100 },
        overallCapitalization: { type: Number, default: 0, min: 0, max: 100 },
        overallSyntax: { type: Number, default: 0, min: 0, max: 100 },
        overallCoherence: { type: Number, default: 0, min: 0, max: 100 },
        calculationCount: { type: Number, default: 0 },
        lastCalculated: { type: Date, default: Date.now },
      },

      // Latest raw snapshot (single message) retained for analytics recompute
      latestSnapshot: {
        overall: { type: Number, default: 0, min: 0, max: 100 },
        grammar: { type: Number, default: 0, min: 0, max: 100 },
        vocabulary: { type: Number, default: 0, min: 0, max: 100 },
        spelling: { type: Number, default: 0, min: 0, max: 100 },
        fluency: { type: Number, default: 0, min: 0, max: 100 },
        punctuation: { type: Number, default: 0, min: 0, max: 100 },
        capitalization: { type: Number, default: 0, min: 0, max: 100 },
        syntax: { type: Number, default: 0, min: 0, max: 100 },
        coherence: { type: Number, default: 0, min: 0, max: 100 },
        recordedAt: { type: Date, default: Date.now },
      },

      cache: {
        messageCount: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: null },
      },
      
      lastCalculated: { type: Date, default: Date.now, index: true }, // Index for recent activity queries
      calculationCount: { type: Number, default: 0 },
    },
    accuracyHistory: [{
      date: { type: Date, required: true },
      overall: { type: Number, required: true, min: 0, max: 100 },
      grammar: { type: Number, required: true, min: 0, max: 100 },
      vocabulary: { type: Number, required: true, min: 0, max: 100 },
      spelling: { type: Number, required: true, min: 0, max: 100 },
      fluency: { type: Number, required: true, min: 0, max: 100 },
      messageId: { type: String },
      sessionId: { type: String },
    }],
    
    // ========== SKILLS & ACCURACY ==========
    skills: {
      accuracy: { type: Number, default: 0, min: 0, max: 100 },
      vocabulary: { type: Number, default: 0, min: 0, max: 100 },
      grammar: { type: Number, default: 0, min: 0, max: 100 },
      pronunciation: { type: Number, default: 0, min: 0, max: 100 },
      fluency: { type: Number, default: 0, min: 0, max: 100 },
      comprehension: { type: Number, default: 0, min: 0, max: 100 },
      listening: { type: Number, default: 0, min: 0, max: 100 },
      speaking: { type: Number, default: 0, min: 0, max: 100 },
      reading: { type: Number, default: 0, min: 0, max: 100 },
      writing: { type: Number, default: 0, min: 0, max: 100 },
    },
    overallAccuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    
    // ========== LEVEL-UP TRACKING ==========
    levelUpHistory: [{
      fromLevel: { type: Number, required: true },
      toLevel: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
      xpAtLevelUp: { type: Number, required: true },
      prestigeLevel: { type: Number, default: 0 },
      rewards: {
        badges: [{ type: String }],
        achievements: [{ type: String }],
        unlocks: [{ type: String }],
      },
    }],
    lastLevelUp: {
      type: Date,
      default: null,
    },
    
    // ========== CATEGORY TRACKING ==========
    categories: [{
      name: { type: String, required: true },
      totalAttempts: { type: Number, default: 0 },
      correctAttempts: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0, min: 0, max: 100 },
      xpEarned: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      lastPracticed: { type: Date, default: Date.now },
      timeSpent: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
    }],
    
    // ========== ADVANCED STREAK SYSTEM ==========
    streak: {
      // Basic streak data
      current: { type: Number, default: 0, min: 0, index: true },
      longest: { type: Number, default: 0, min: 0 },
      lastActivityDate: { type: Date, default: null },
      streakStartDate: { type: Date, default: null },
      totalStreakDays: { type: Number, default: 0 },
      
      // Streak requirements (tier-based)
      dailyGoal: {
        minutesRequired: { type: Number, default: 10 }, // 10 minutes minimum
        messagesRequired: { type: Number, default: 5 }, // 5 AI chat messages
        activitiesRequired: [{ type: String }], // ['ai_chat', 'lesson', 'quiz']
      },
      
      // Today's progress tracking
      todayProgress: {
        minutesPracticed: { type: Number, default: 0 },
        messagesCount: { type: Number, default: 0 },
        activitiesCompleted: [{ type: String }],
        goalMet: { type: Boolean, default: false },
        lastUpdated: { type: Date, default: null },
      },
      
      // Grace period (tier-based: free=0h, pro=3h, premium=6h)
      gracePeriod: {
        hours: { type: Number, default: 0 },
        isActive: { type: Boolean, default: false },
        expiresAt: { type: Date, default: null },
      },
      
      // Streak freeze (Premium feature)
      freeze: {
        available: { type: Number, default: 0 }, // Premium users get 2/month
        used: { type: Number, default: 0 },
        lastUsed: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
      },
      
      // Streak history with reason
      streakHistory: [{
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        length: { type: Number, required: true },
        reason: { 
          type: String, 
          enum: ['completed', 'broken', 'freeze_used'],
          default: 'completed'
        },
      }],
      
      // Daily activity logs (last 30 days)
      dailyActivities: [{
        date: { type: Date, required: true },
        minutesPracticed: { type: Number, default: 0 },
        messagesCount: { type: Number, default: 0 },
        accuracyAverage: { type: Number, default: 0 },
        activitiesCompleted: [{ type: String }],
        goalMet: { type: Boolean, default: false },
        xpEarned: { type: Number, default: 0 },
      }],
      
      // Milestones achieved
      milestones: [{
        days: { type: Number, required: true },
        reachedAt: { type: Date, required: true },
        rewards: {
          xpBonus: { type: Number, default: 0 },
          badgeId: { type: String },
          freezeToken: { type: Number, default: 0 },
          title: { type: String },
        },
      }],
      
      // Statistics
      stats: {
        totalActiveDays: { type: Number, default: 0 },
        averageMinutesPerDay: { type: Number, default: 0 },
        bestWeek: { type: Number, default: 0 },
        totalStreaksBroken: { type: Number, default: 0 },
        totalFreezeUsed: { type: Number, default: 0 },
      },
    },
    
    // ========== SESSION STATS ==========
    stats: {
      totalSessions: { type: Number, default: 0, min: 0 },
      totalTimeSpent: { type: Number, default: 0, min: 0 },
      averageSessionTime: { type: Number, default: 0, min: 0 },
      lessonsCompleted: { type: Number, default: 0, min: 0 },
      exercisesCompleted: { type: Number, default: 0, min: 0 },
      quizzesTaken: { type: Number, default: 0, min: 0 },
      conversationsPracticed: { type: Number, default: 0, min: 0 },
      wordsLearned: { type: Number, default: 0, min: 0 },
      perfectScores: { type: Number, default: 0, min: 0 },
    },
    
    // ========== SESSION HISTORY ==========
    sessionHistory: [{
      sessionId: { type: String, required: true },
      startTime: { type: Date, required: true },
      endTime: { type: Date, required: true },
      duration: { type: Number, required: true },
      xpGained: { type: Number, default: 0 },
      accuracyRate: { type: Number, default: 0 },
      activitiesCompleted: { type: Number, default: 0 },
      category: { type: String, default: 'general' },
      performanceRating: {
        type: String,
        enum: ['excellent', 'good', 'average', 'needs-improvement'],
        default: 'average',
      },
    }],
    
    // ========== ACHIEVEMENTS & BADGES ==========
    achievements: [{
      type: Schema.Types.ObjectId,
      ref: 'Achievement',
    }],
    badges: [{
      badgeId: { type: String, required: true },
      name: { type: String, required: true },
      earnedAt: { type: Date, default: Date.now },
      category: { type: String, required: true },
    }],
    
    // ========== LEADERBOARD DATA ==========
    leaderboard: {
      globalRank: { type: Number, default: 0 },
      categoryRanks: { type: Map, of: Number, default: new Map() },
      weeklyXP: { type: Number, default: 0 },
      monthlyXP: { type: Number, default: 0 },
      lastRankUpdate: { type: Date, default: Date.now },
    },
    
    // ========== ANALYTICS & INSIGHTS ==========
    analytics: {
      learningVelocity: { type: Number, default: 0 }, // XP per hour
      consistencyScore: { type: Number, default: 0, min: 0, max: 100 },
      improvementRate: { type: Number, default: 0 }, // Percentage
      strongestSkill: { type: String, default: '' },
      weakestSkill: { type: String, default: '' },
      recommendedFocus: [{ type: String }],
    },
    
    // ========== MILESTONES ==========
    milestones: [{
      type: {
        type: String,
        enum: ['level', 'xp', 'accuracy', 'streak', 'category'],
        required: true,
      },
      value: { type: Number, required: true },
      achievedAt: { type: Date, default: Date.now },
      description: { type: String, required: true },
    }],
    
    // ========== TIMESTAMPS ==========
    lastActive: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // Auto-creates createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========================================
// INDEXES FOR PERFORMANCE & ANALYTICS
// ========================================

// ===== LEADERBOARD QUERIES =====
// Global leaderboard (by XP and level)
progressSchema.index({ totalXP: -1, currentLevel: -1 });
// Weekly leaderboard
progressSchema.index({ weeklyXP: -1, lastActive: -1 });
// Monthly leaderboard
progressSchema.index({ monthlyXP: -1, lastActive: -1 });
// Streak leaderboard
progressSchema.index({ 'streak.current': -1, lastActive: -1 });
// Accuracy leaderboard
progressSchema.index({ overallAccuracy: -1, 'accuracyData.calculationCount': -1 });

// ===== SKILL-BASED LEADERBOARDS =====
// Grammar masters leaderboard
progressSchema.index({ 'accuracyData.grammar': -1, 'accuracyData.calculationCount': -1 });
// Vocabulary champions leaderboard
progressSchema.index({ 'accuracyData.vocabulary': -1, 'accuracyData.vocabularyLevel': -1 });
// Spelling experts leaderboard
progressSchema.index({ 'accuracyData.spelling': -1, 'accuracyData.calculationCount': -1 });
// Fluency masters leaderboard
progressSchema.index({ 'accuracyData.fluency': -1, 'accuracyData.calculationCount': -1 });

// ===== CEFR LEVEL ANALYTICS =====
// Vocabulary level distribution
progressSchema.index({ 'accuracyData.vocabularyLevel': 1, overallAccuracy: -1 });
// Level-based progression tracking
progressSchema.index({ 'accuracyData.vocabularyLevel': 1, currentLevel: -1, totalXP: -1 });

// ===== USER LOOKUP =====
progressSchema.index({ userId: 1 }, { unique: true });

// ===== ANALYTICS QUERIES =====
// Proficiency-based cohorts
progressSchema.index({ proficiencyLevel: 1, currentLevel: -1, overallAccuracy: -1 });
// Recent activity tracking
progressSchema.index({ lastActive: -1, totalXP: -1 });
// Active users in last 7 days
progressSchema.index({ lastActive: -1, 'streak.current': -1 });
// Calculation history for trends
progressSchema.index({ 'accuracyData.lastCalculated': -1, userId: 1 });

// ===== CATEGORY-SPECIFIC QUERIES =====
progressSchema.index({ 'categories.name': 1, 'categories.accuracy': -1 });
progressSchema.index({ 'categories.name': 1, 'categories.xpEarned': -1 });

// ===== NLP PERFORMANCE ANALYTICS =====
// Processing time optimization
progressSchema.index({ 'accuracyData.performanceMetrics.totalProcessingTime': 1 });
// Free NLP users
progressSchema.index({ 'accuracyData.freeNLPEnhanced': 1, lastActive: -1 });
// Cache efficiency tracking
progressSchema.index({ 'accuracyData.performanceMetrics.cacheHits': -1 });

// ===== IMPROVEMENT TRACKING =====
// Users showing improvement
progressSchema.index({ 'analytics.improvementRate': -1, lastActive: -1 });
// Consistency leaders
progressSchema.index({ 'analytics.consistencyScore': -1, 'streak.current': -1 });

// ===== TIER & LEVEL SEGMENTATION =====
// Premium users analytics
progressSchema.index({ tier: 1, totalXP: -1, overallAccuracy: -1 });
// Prestige system
progressSchema.index({ prestigeLevel: -1, totalXP: -1 });

// ========================================
// VIRTUAL PROPERTIES
// ========================================

// Level progress percentage
progressSchema.virtual('levelProgress').get(function (this: IProgress) {
  if (this.xpToNextLevel === 0) return 100;
  return Math.round((this.currentLevelXP / (this.currentLevelXP + this.xpToNextLevel)) * 100);
});

// Average skill score
progressSchema.virtual('averageSkillScore').get(function (this: IProgress) {
  const skills = this.skills;
  const total = skills.accuracy + skills.vocabulary + skills.grammar + 
                skills.pronunciation + skills.fluency + skills.comprehension +
                skills.listening + skills.speaking + skills.reading + skills.writing;
  return Math.round(total / 10);
});

// ========================================
// BACKWARD COMPATIBILITY VIRTUALS
// ========================================
// These virtuals redirect reads of deprecated top-level accuracy fields
// to the new overallAccuracySummary structure (single source of truth)

// Note: We can't override actual schema fields with virtuals, so these won't work
// for direct field access. Instead, we sync the deprecated fields in the service layer.
// This section is kept for documentation and potential future migration strategies.

// ========================================
// MIDDLEWARE
// ========================================

// Pre-save: Update calculated fields
progressSchema.pre('save', async function (next) {
  // Update overall accuracy (weighted average)
  const skills = this.skills;
  const weights = {
    accuracy: 1.2,
    vocabulary: 1.0,
    grammar: 1.0,
    pronunciation: 1.0,
    fluency: 1.0,
    comprehension: 1.0,
    listening: 0.8,
    speaking: 0.8,
    reading: 0.8,
    writing: 0.8,
  };
  
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const weightedSum = Object.entries(skills).reduce((sum, [skill, value]) => {
    return sum + (value * (weights[skill as keyof typeof weights] || 1));
  }, 0);
  
  this.overallAccuracy = Math.round(weightedSum / totalWeight);
  
  // Update analytics - strongest and weakest skills
  const skillEntries = Object.entries(skills) as [keyof ISkillMetrics, number][];
  const sortedSkills = skillEntries.sort((a, b) => b[1] - a[1]);
  this.analytics.strongestSkill = sortedSkills[0][0];
  this.analytics.weakestSkill = sortedSkills[sortedSkills.length - 1][0];
  
  // Calculate learning velocity (XP per hour)
  if (this.stats.totalTimeSpent > 0) {
    this.analytics.learningVelocity = Math.round(
      (this.totalXP / this.stats.totalTimeSpent) * 60
    );
  }
  
  // Update XP breakdown total
  this.xpBreakdown.total = 
    this.xpBreakdown.fromAccuracy +
    this.xpBreakdown.fromStreak +
    this.xpBreakdown.fromBonus +
    this.xpBreakdown.fromPremium +
    this.xpBreakdown.fromPrestige -
    this.xpBreakdown.fromPenalty;
  
  // Limit session history to last 50 sessions
  if (this.sessionHistory.length > 50) {
    this.sessionHistory = this.sessionHistory.slice(-50);
  }
  
  // Limit XP history to last 30 days
  if (this.xpHistory.length > 30) {
    this.xpHistory = this.xpHistory.slice(-30);
  }
  
  // Limit accuracy history to last 30 entries
  if (this.accuracyHistory.length > 30) {
    this.accuracyHistory = this.accuracyHistory.slice(-30);
  }
  
  // Limit XP events to last 100 events
  if (this.xpEvents.length > 100) {
    this.xpEvents = this.xpEvents.slice(-100);
  }
  
  // Limit level-up history to last 50 events
  if (this.levelUpHistory.length > 50) {
    this.levelUpHistory = this.levelUpHistory.slice(-50);
  }
  
  next();
});

// ========================================
// INSTANCE METHODS
// ========================================

/**
 * Add XP and handle level ups
 */
progressSchema.methods.addXP = async function (
  xpAmount: number,
  category?: string,
  source: string = 'accuracy'
): Promise<{ leveledUp: boolean; newLevel: number; rewards?: any }> {
  const oldLevel = this.currentLevel;
  
  this.totalXP += xpAmount;
  this.currentLevelXP += xpAmount;
  this.dailyXP += xpAmount;
  this.weeklyXP += xpAmount;
  this.monthlyXP += xpAmount;
  this.yearlyXP += xpAmount;
  
  // 🎯 Update XP breakdown by source (NEW: Track XP contribution)
  if (!this.xpBreakdown) {
    this.xpBreakdown = {
      fromAccuracy: 0,
      fromStreak: 0,
      fromBonus: 0,
      fromPremium: 0,
      fromPrestige: 0,
      fromPenalty: 0,
      total: 0,
    };
  }
  
  // Map source to breakdown field
  switch (source.toLowerCase()) {
    case 'accuracy':
    case 'message':
    case 'conversation':
      this.xpBreakdown.fromAccuracy += xpAmount;
      break;
    case 'streak':
    case 'daily_streak':
      this.xpBreakdown.fromStreak += xpAmount;
      break;
    case 'bonus':
    case 'achievement':
    case 'milestone':
      this.xpBreakdown.fromBonus += xpAmount;
      break;
    case 'premium':
    case 'premium_boost':
      this.xpBreakdown.fromPremium += xpAmount;
      break;
    case 'prestige':
      this.xpBreakdown.fromPrestige += xpAmount;
      break;
    case 'penalty':
      this.xpBreakdown.fromPenalty += Math.abs(xpAmount);
      break;
    default:
      // Unknown source, add to bonus
      this.xpBreakdown.fromBonus += xpAmount;
  }
  this.xpBreakdown.total += xpAmount;
  
  // Track XP event
  this.xpEvents.push({
    amount: xpAmount,
    source: source as any,
    category: category,
    timestamp: new Date(),
    multiplier: this.tier || 1.0,
    details: xpAmount >= 0
      ? (category ? `Earned ${xpAmount} XP from ${category}` : `Earned ${xpAmount} XP`)
      : (category ? `Lost ${Math.abs(xpAmount)} XP from ${category}` : `Lost ${Math.abs(xpAmount)} XP`),
  });
  
  // Update category XP if provided
  if (category) {
    const categoryIndex = this.categories.findIndex((c: ICategoryProgress) => c.name === category);
    if (categoryIndex !== -1) {
      this.categories[categoryIndex].xpEarned += xpAmount;
    }
  }
  
  // ✅ Use Gamification service to calculate level from total XP (single source of truth)
  const newLevel = getLevelFromXP(this.totalXP, this.prestigeLevel);
  let leveledUp = newLevel > oldLevel;
  
  const rewards: any = {
    badges: [],
    achievements: [],
    unlocks: [],
  };
  
  if (leveledUp) {
    // Track level-up events for all levels gained
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      this.levelUpHistory.push({
        fromLevel: level - 1,
        toLevel: level,
        timestamp: new Date(),
        xpAtLevelUp: this.totalXP,
        prestigeLevel: this.prestigeLevel,
        rewards: { ...rewards },
      });
      
      // Add milestone
      this.milestones.push({
        type: 'level',
        value: level,
        achievedAt: new Date(),
        description: `Reached level ${level}`,
      });
      
      // Determine rewards based on level milestones
      if (level % 10 === 0) {
        rewards.badges.push(`level-${level}`);
        rewards.unlocks.push(`tier-${Math.floor(level / 10)}`);
      }
    }
    
    this.lastLevelUp = new Date();
  }
  
  // ✅ Update current level and XP to next level using Gamification service
  this.currentLevel = newLevel;
  
  // Calculate XP for current and next level using Gamification service
  const xpFloorForLevel = calculateCumulativeXP(this.currentLevel, this.prestigeLevel);
  const xpCeilingForNextLevel = calculateCumulativeXP(this.currentLevel + 1, this.prestigeLevel);
  const xpRequiredForLevel = Math.max(xpCeilingForNextLevel - xpFloorForLevel, 0);
  const xpIntoCurrentLevel = Math.max(this.totalXP - xpFloorForLevel, 0);
  const xpRemainingForNextLevel = Math.max(xpCeilingForNextLevel - this.totalXP, 0);

  // Calculate XP within current level using cumulative thresholds
  this.currentLevelXP = xpIntoCurrentLevel;
  this.xpToNextLevel = xpRemainingForNextLevel;

  // Ensure xpToNextLevel never exceeds the requirement for the level (guard against negatives)
  if (this.xpToNextLevel > xpRequiredForLevel) {
    this.xpToNextLevel = xpRequiredForLevel;
  }
  
  await this.save();
  
  return { 
    leveledUp, 
    newLevel: this.currentLevel,
    rewards: leveledUp ? rewards : undefined
  };
};

/**
 * Update skill metrics
 */
progressSchema.methods.updateSkillMetrics = async function (
  skill: keyof ISkillMetrics,
  value: number
): Promise<void> {
  this.skills[skill] = Math.max(0, Math.min(100, value));
  await this.save();
};

/**
 * Update accuracy data from EnhancedAccuracyResult with NLP analytics
 */
progressSchema.methods.updateAccuracyData = async function (
  accuracyResult: any
): Promise<void> {
  // ⚠️ DEPRECATED: This method directly overwrites accuracy data
  // Use progressOptimizationService.updateAccuracyData() for cumulative calculations
  console.warn('⚠️ DEPRECATED: Progress.updateAccuracyData() called - use progressOptimizationService instead');
  console.warn('  This method overwrites accuracy instead of calculating cumulative average');
  console.warn('  Caller:', new Error().stack?.split('\n')[2]?.trim());
  
  // Update current accuracy data with comprehensive NLP metrics
  this.accuracyData = {
    overall: accuracyResult.overall || 0,
    adjustedOverall: accuracyResult.adjustedOverall || 0,
    grammar: accuracyResult.grammar || 0,
    vocabulary: accuracyResult.vocabulary || 0,
    spelling: accuracyResult.spelling || 0,
    fluency: accuracyResult.fluency || 0,
    punctuation: accuracyResult.punctuation || 0,
    capitalization: accuracyResult.capitalization || 0,
    syntax: accuracyResult.syntax || 0,
    coherence: accuracyResult.coherence || 0,
    totalErrors: accuracyResult.statistics?.errorCount || accuracyResult.errors?.total || 0,
    criticalErrors: accuracyResult.statistics?.criticalErrorCount || 0,
    errorsByType: {
      grammar: accuracyResult.statistics?.errorsByCategory?.grammar || accuracyResult.errors?.grammar || 0,
      vocabulary: accuracyResult.statistics?.errorsByCategory?.vocabulary || accuracyResult.errors?.vocabulary || 0,
      spelling: accuracyResult.statistics?.errorsByCategory?.spelling || accuracyResult.errors?.spelling || 0,
      punctuation: accuracyResult.statistics?.errorsByCategory?.punctuation || accuracyResult.errors?.punctuation || 0,
      capitalization: accuracyResult.statistics?.errorsByCategory?.capitalization || accuracyResult.errors?.capitalization || 0,
      syntax: accuracyResult.statistics?.errorsByCategory?.syntax || accuracyResult.errors?.syntax || 0,
      style: accuracyResult.statistics?.errorsByCategory?.style || accuracyResult.errors?.style || 0,
      coherence: accuracyResult.statistics?.errorsByCategory?.coherence || accuracyResult.errors?.coherence || 0,
    },
    readabilityScore: accuracyResult.readability?.fleschReadingEase || 0,
    toneScore: accuracyResult.tone?.confidence || 0,
    styleScore: accuracyResult.styleAnalysis?.engagement || 0,
    
    // FREE NLP Enhancement Data
    freeNLPEnhanced: accuracyResult.freeNLPEnhanced || false,
    nlpCost: accuracyResult.nlpCost || '$0/month',
    vocabularyLevel: accuracyResult.vocabularyLevel || accuracyResult.detectorContributions?.vocabulary?.level || 'A1',
    
    // Detector Contributions (individual NLP service results)
    detectorContributions: accuracyResult.detectorContributions ? {
      languageTool: accuracyResult.detectorContributions.languageTool ? {
        errors: accuracyResult.detectorContributions.languageTool.errors || 0,
        confidence: accuracyResult.detectorContributions.languageTool.confidence || 0,
        source: accuracyResult.detectorContributions.languageTool.source || 'self-hosted',
        processingTime: accuracyResult.detectorContributions.languageTool.processingTime || 0,
      } : undefined,
      spelling: accuracyResult.detectorContributions.spelling ? {
        accuracy: accuracyResult.detectorContributions.spelling.accuracy || 0,
        errorsFound: accuracyResult.detectorContributions.spelling.errorsFound || 0,
        confidence: accuracyResult.detectorContributions.spelling.confidence || 0,
        source: accuracyResult.detectorContributions.spelling.source || 'typo-js',
        processingTime: accuracyResult.detectorContributions.spelling.processingTime || 0,
      } : undefined,
      vocabulary: accuracyResult.detectorContributions.vocabulary ? {
        level: accuracyResult.detectorContributions.vocabulary.level || 'A1',
        score: accuracyResult.detectorContributions.vocabulary.score || 0,
        uniqueWords: accuracyResult.detectorContributions.vocabulary.uniqueWords || 0,
        totalWords: accuracyResult.detectorContributions.vocabulary.totalWords || 0,
        lexicalDiversity: accuracyResult.detectorContributions.vocabulary.lexicalDiversity || 0,
        unknownWordPercentage: accuracyResult.detectorContributions.vocabulary.unknownWordPercentage || 0,
        source: accuracyResult.detectorContributions.vocabulary.source || 'cefr-wordlists',
        processingTime: accuracyResult.detectorContributions.vocabulary.processingTime || 0,
      } : undefined,
      fluency: accuracyResult.detectorContributions.fluency ? {
        score: accuracyResult.detectorContributions.fluency.score || 0,
        method: accuracyResult.detectorContributions.fluency.method || 'rule-based',
        confidence: accuracyResult.detectorContributions.fluency.confidence || 0,
        source: accuracyResult.detectorContributions.fluency.source || 'heuristics',
        processingTime: accuracyResult.detectorContributions.fluency.processingTime || 0,
      } : undefined,
    } : undefined,
    
    // Performance Metrics (processing times for optimization)
    performanceMetrics: accuracyResult.performanceMetrics ? {
      totalProcessingTime: accuracyResult.performanceMetrics.totalProcessingTime || 0,
      detectorBreakdown: {
        spelling: accuracyResult.performanceMetrics.detectorBreakdown?.spelling || { time: 0, accuracy: 0 },
        vocabulary: accuracyResult.performanceMetrics.detectorBreakdown?.vocabulary || { time: 0, score: 0, level: 'A1' },
        fluency: accuracyResult.performanceMetrics.detectorBreakdown?.fluency || { time: 0, score: 0, method: 'rule-based' },
        languageTool: accuracyResult.performanceMetrics.detectorBreakdown?.languageTool || { time: 0, errors: 0 },
      },
      cacheHits: accuracyResult.performanceMetrics.cacheHits || 0,
      cacheMisses: accuracyResult.performanceMetrics.cacheMisses || 0,
    } : undefined,
    
    lastCalculated: new Date(),
    calculationCount: (this.accuracyData?.calculationCount || 0) + 1,
  };
  
  // Add to accuracy history
  this.accuracyHistory.push({
    date: new Date(),
    overall: accuracyResult.overall || 0,
    grammar: accuracyResult.grammar || 0,
    vocabulary: accuracyResult.vocabulary || 0,
    spelling: accuracyResult.spelling || 0,
    fluency: accuracyResult.fluency || 0,
    messageId: accuracyResult.messageId,
    sessionId: accuracyResult.sessionId,
  });
  
  // Update skills based on accuracy data
  this.skills.accuracy = accuracyResult.overall || 0;
  this.skills.grammar = accuracyResult.grammar || 0;
  this.skills.vocabulary = accuracyResult.vocabulary || 0;
  this.skills.fluency = accuracyResult.fluency || 0;
  
  await this.save();
};

/**
 * Update category progress
 */
progressSchema.methods.updateCategoryProgress = async function (
  category: string,
  data: Partial<ICategoryProgress>
): Promise<void> {
  const categoryIndex = this.categories.findIndex((c: ICategoryProgress) => c.name === category);
  
  if (categoryIndex === -1) {
    // Create new category
    this.categories.push({
      name: category,
      totalAttempts: data.totalAttempts || 0,
      correctAttempts: data.correctAttempts || 0,
      accuracy: data.accuracy || 0,
      xpEarned: data.xpEarned || 0,
      level: data.level || 1,
      lastPracticed: new Date(),
      timeSpent: data.timeSpent || 0,
      streak: data.streak || 0,
      bestStreak: data.bestStreak || 0,
    });
  } else {
    // Update existing category
    Object.assign(this.categories[categoryIndex], data);
    this.categories[categoryIndex].lastPracticed = new Date();
  }
  
  await this.save();
};

/**
 * Record a session
 */
progressSchema.methods.recordSession = async function (
  sessionData: Partial<ISessionHistory>
): Promise<void> {
  this.sessionHistory.push({
    sessionId: sessionData.sessionId || new mongoose.Types.ObjectId().toString(),
    startTime: sessionData.startTime || new Date(),
    endTime: sessionData.endTime || new Date(),
    duration: sessionData.duration || 0,
    xpGained: sessionData.xpGained || 0,
    accuracyRate: sessionData.accuracyRate || 0,
    activitiesCompleted: sessionData.activitiesCompleted || 0,
    category: sessionData.category || 'general',
    performanceRating: sessionData.performanceRating || 'average',
  });
  
  this.stats.totalSessions++;
  this.stats.totalTimeSpent += sessionData.duration || 0;
  this.stats.averageSessionTime = Math.round(this.stats.totalTimeSpent / this.stats.totalSessions);
  
  await this.save();
};

/**
 * Update streak
 */
progressSchema.methods.updateStreak = async function (): Promise<void> {
  const now = new Date();
  const lastActivity = this.streak.lastActivityDate;
  
  if (!lastActivity) {
    // First activity
    this.streak.current = 1;
    this.streak.streakStartDate = now;
  } else {
    const diffDays = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      this.streak.current++;
    } else if (diffDays > 1) {
      // Streak broken - save to history
      if (this.streak.current > 0) {
        this.streak.streakHistory.push({
          startDate: this.streak.streakStartDate!,
          endDate: lastActivity,
          length: this.streak.current,
        });
      }
      this.streak.current = 1;
      this.streak.streakStartDate = now;
    }
    // If diffDays === 0, same day - don't update streak
  }
  
  // Update longest streak
  if (this.streak.current > this.streak.longest) {
    this.streak.longest = this.streak.current;
  }
  
  this.streak.totalStreakDays++;
  this.streak.lastActivityDate = now;
  
  await this.save();
};

/**
 * Calculate global rank
 */
progressSchema.methods.calculateRank = async function (): Promise<number> {
  const rank = await mongoose.model('Progress').countDocuments({
    totalXP: { $gt: this.totalXP },
  });
  
  this.leaderboard.globalRank = rank + 1;
  this.leaderboard.lastRankUpdate = new Date();
  await this.save();
  
  return this.leaderboard.globalRank;
};

/**
 * Get weekly report
 */
progressSchema.methods.getWeeklyReport = async function (): Promise<any> {
  const lastWeek = this.sessionHistory.filter((session: ISessionHistory) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return session.startTime >= weekAgo;
  });
  
  return {
    sessionsCompleted: lastWeek.length,
    totalXP: this.weeklyXP,
    averageAccuracy: lastWeek.reduce((sum: number, s: ISessionHistory) => sum + s.accuracyRate, 0) / lastWeek.length || 0,
    totalTime: lastWeek.reduce((sum: number, s: ISessionHistory) => sum + s.duration, 0),
    categoriesPracticed: [...new Set(lastWeek.map((s: ISessionHistory) => s.category))],
  };
};

/**
 * Get monthly report
 */
progressSchema.methods.getMonthlyReport = async function (): Promise<any> {
  const lastMonth = this.sessionHistory.filter((session: ISessionHistory) => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return session.startTime >= monthAgo;
  });
  
  return {
    sessionsCompleted: lastMonth.length,
    totalXP: this.monthlyXP,
    averageAccuracy: lastMonth.reduce((sum: number, s: ISessionHistory) => sum + s.accuracyRate, 0) / lastMonth.length || 0,
    totalTime: lastMonth.reduce((sum: number, s: ISessionHistory) => sum + s.duration, 0),
    categoriesPracticed: [...new Set(lastMonth.map((s: ISessionHistory) => s.category))],
    levelProgress: this.currentLevel,
  };
};

/**
 * Get accuracy trends
 */
progressSchema.methods.getAccuracyTrends = async function (days: number = 7): Promise<any> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentHistory = this.accuracyHistory.filter((entry: IAccuracyHistoryEntry) => 
    entry.date >= cutoffDate
  );
  
  if (recentHistory.length === 0) {
    return {
      trend: 'stable',
      improvement: 0,
      currentAverage: this.accuracyData?.overall || 0,
      history: [],
    };
  }
  
  // Calculate averages
  const avgOverall = recentHistory.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.overall, 0) / recentHistory.length;
  const avgGrammar = recentHistory.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.grammar, 0) / recentHistory.length;
  const avgVocabulary = recentHistory.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.vocabulary, 0) / recentHistory.length;
  const avgSpelling = recentHistory.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.spelling, 0) / recentHistory.length;
  const avgFluency = recentHistory.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.fluency, 0) / recentHistory.length;
  
  // Compare first half vs second half to determine trend
  const midpoint = Math.floor(recentHistory.length / 2);
  const firstHalf = recentHistory.slice(0, midpoint);
  const secondHalf = recentHistory.slice(midpoint);
  
  const firstHalfAvg = firstHalf.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.overall, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum: number, e: IAccuracyHistoryEntry) => sum + e.overall, 0) / secondHalf.length;
  
  const improvement = secondHalfAvg - firstHalfAvg;
  const trend = improvement > 5 ? 'improving' : improvement < -5 ? 'declining' : 'stable';
  
  return {
    trend,
    improvement: Math.round(improvement * 100) / 100,
    currentAverage: avgOverall,
    breakdown: {
      grammar: Math.round(avgGrammar * 100) / 100,
      vocabulary: Math.round(avgVocabulary * 100) / 100,
      spelling: Math.round(avgSpelling * 100) / 100,
      fluency: Math.round(avgFluency * 100) / 100,
    },
    history: recentHistory.map((e: IAccuracyHistoryEntry) => ({
      date: e.date,
      overall: e.overall,
      grammar: e.grammar,
      vocabulary: e.vocabulary,
    })),
  };
};

/**
 * Get level-up statistics
 */
progressSchema.methods.getLevelUpStats = async function (): Promise<any> {
  const recentLevelUps = this.levelUpHistory.slice(-10); // Last 10 level-ups
  
  if (recentLevelUps.length === 0) {
    return {
      totalLevelUps: 0,
      averageTimePerLevel: 0,
      fastestLevelUp: null,
      recentLevelUps: [],
    };
  }
  
  // Calculate time between level-ups
  const timeBetweenLevels = recentLevelUps.map((levelUp: ILevelUpEvent, index: number) => {
    if (index === 0) return null;
    const timeDiff = levelUp.timestamp.getTime() - recentLevelUps[index - 1].timestamp.getTime();
    return {
      fromLevel: levelUp.fromLevel,
      toLevel: levelUp.toLevel,
      timeTaken: timeDiff,
      xpEarned: levelUp.xpAtLevelUp - recentLevelUps[index - 1].xpAtLevelUp,
    };
  }).filter(Boolean);
  
  const avgTime = timeBetweenLevels.length > 0 
    ? timeBetweenLevels.reduce((sum: number, l: any) => sum + l.timeTaken, 0) / timeBetweenLevels.length 
    : 0;
  
  const fastestLevelUp = timeBetweenLevels.length > 0
    ? timeBetweenLevels.reduce((fastest: any, current: any) => 
        !fastest || current.timeTaken < fastest.timeTaken ? current : fastest
      , null)
    : null;
  
  return {
    totalLevelUps: this.levelUpHistory.length,
    currentLevel: this.currentLevel,
    xpToNextLevel: this.xpToNextLevel,
    levelProgress: Math.round((this.currentLevelXP / (this.currentLevelXP + this.xpToNextLevel)) * 100),
    averageTimePerLevel: Math.round(avgTime / (1000 * 60 * 60)), // hours
    fastestLevelUp: fastestLevelUp ? {
      ...fastestLevelUp,
      timeTaken: Math.round(fastestLevelUp.timeTaken / (1000 * 60 * 60)), // hours
    } : null,
    recentLevelUps: recentLevelUps.map((l: ILevelUpEvent) => ({
      fromLevel: l.fromLevel,
      toLevel: l.toLevel,
      timestamp: l.timestamp,
      rewards: l.rewards,
    })),
    lastLevelUp: this.lastLevelUp,
  };
};

// ========================================
// STATIC METHODS (for leaderboards)
// ========================================

/**
 * Get global leaderboard
 */
progressSchema.statics.getGlobalLeaderboard = async function (limit: number = 100) {
  return await this.find()
    .sort({ totalXP: -1, currentLevel: -1 })
    .limit(limit)
    .populate('userId', 'username fullName avatar')
    .select('userId totalXP currentLevel proficiencyLevel overallAccuracy streak.current')
    .lean();
};

/**
 * Get weekly leaderboard
 */
progressSchema.statics.getWeeklyLeaderboard = async function (limit: number = 100) {
  return await this.find()
    .sort({ weeklyXP: -1 })
    .limit(limit)
    .populate('userId', 'username fullName avatar')
    .select('userId weeklyXP currentLevel overallAccuracy streak.current')
    .lean();
};

/**
 * Get category leaderboard
 */
progressSchema.statics.getCategoryLeaderboard = async function (category: string, limit: number = 100) {
  return await this.find({ 'categories.name': category })
    .sort({ 'categories.accuracy': -1, 'categories.xpEarned': -1 })
    .limit(limit)
    .populate('userId', 'username fullName avatar')
    .select('userId categories')
    .lean();
};

// ========================================
// MODEL EXPORT
// ========================================

const Progress: Model<IProgress> = mongoose.model<IProgress>('Progress', progressSchema);

export default Progress;
