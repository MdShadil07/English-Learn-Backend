/**
 * Core interfaces for pluggable NLP architecture
 */
import { ErrorDetail, AccuracyResult, AnalysisConfig, CategoryScores, CategoryWeights, PenaltyModifiers, UserTier, StreakData, XPCalculation, LevelProgression, ErrorType, ErrorSeverity } from './types.js';
export interface IErrorDetector {
    name: string;
    priority: number;
    detect(text: string, config: AnalysisConfig): Promise<ErrorDetail[]>;
    isAvailable(): Promise<boolean>;
    getConfidence(): number;
}
export interface IScoreCalculator {
    calculateCategoryScores(text: string, errors: ErrorDetail[], config: AnalysisConfig): Promise<CategoryScores>;
    calculateOverallScore(categoryScores: CategoryScores, weights: CategoryWeights, modifiers: PenaltyModifiers): number;
    applyTierAdjustments(score: number, tier: UserTier, errors: ErrorDetail[]): number;
}
export interface IXPEngine {
    calculateBaseXP(accuracy: number, wordCount: number): number;
    applyPenaltyCurve(baseXP: number, errors: ErrorDetail[]): number;
    applyBonuses(xp: number, streak: StreakData, tier: UserTier): XPCalculation;
    enforceFloor(xp: number): number;
}
export interface ILevelManager {
    getXPRequired(level: number): number;
    checkLevelUp(currentXP: number, currentLevel: number): LevelProgression;
    awardLevelUpReward(newLevel: number): Promise<void>;
}
export interface ICache {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    invalidate(pattern: string): Promise<void>;
}
export type { ErrorDetail, AccuracyResult, AnalysisConfig, CategoryScores, CategoryWeights, PenaltyModifiers, UserTier, StreakData, XPCalculation, LevelProgression, ErrorType, ErrorSeverity, };
//# sourceMappingURL=interface.d.ts.map