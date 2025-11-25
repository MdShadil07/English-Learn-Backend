/**
 * Core interfaces for pluggable NLP architecture
 */

import {
  ErrorDetail,
  AccuracyResult,
  AnalysisConfig,
  CategoryScores,
  CategoryWeights,
  PenaltyModifiers,
  UserTier,
  StreakData,
  XPCalculation,
  LevelProgression,
  ErrorType,
  ErrorSeverity,
} from './types.js';

// Error Detection Interface
export interface IErrorDetector {
  name: string;
  priority: number; // Lower = higher priority
  detect(text: string, config: AnalysisConfig): Promise<ErrorDetail[]>;
  isAvailable(): Promise<boolean>;
  getConfidence(): number;
}

// Score Calculation Interface
export interface IScoreCalculator {
  calculateCategoryScores(
    text: string,
    errors: ErrorDetail[],
    config: AnalysisConfig
  ): Promise<CategoryScores>;
  
  calculateOverallScore(
    categoryScores: CategoryScores,
    weights: CategoryWeights,
    modifiers: PenaltyModifiers
  ): number;
  
  applyTierAdjustments(
    score: number,
    tier: UserTier,
    errors: ErrorDetail[]
  ): number;
}

// XP Engine Interface
export interface IXPEngine {
  calculateBaseXP(accuracy: number, wordCount: number): number;
  
  applyPenaltyCurve(
    baseXP: number,
    errors: ErrorDetail[]
  ): number;
  
  applyBonuses(
    xp: number,
    streak: StreakData,
    tier: UserTier
  ): XPCalculation;
  
  enforceFloor(xp: number): number;
}

// Level Progression Interface
export interface ILevelManager {
  getXPRequired(level: number): number;
  checkLevelUp(currentXP: number, currentLevel: number): LevelProgression;
  awardLevelUpReward(newLevel: number): Promise<void>;
}

// Cache Interface
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Re-export types for convenience
export type {
  ErrorDetail,
  AccuracyResult,
  AnalysisConfig,
  CategoryScores,
  CategoryWeights,
  PenaltyModifiers,
  UserTier,
  StreakData,
  XPCalculation,
  LevelProgression,
  ErrorType,
  ErrorSeverity,
};
