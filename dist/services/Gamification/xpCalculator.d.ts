/**
 * 🧮 CORE XP CALCULATION ENGINE
 * Advanced XP calculation with multiple factors and adaptive difficulty
 */
import type { XPCalculationResult, AdaptiveDifficulty, MomentumSystem, PrestigeSystem } from './type/index.js';
/**
 * Calculate XP required for a specific level
 * Uses exponential growth with milestone bonuses
 */
export declare const calculateXPForLevel: (level: number, prestigeLevel?: number) => number;
/**
 * Calculate cumulative XP for a specific level
 */
export declare const calculateCumulativeXP: (level: number, prestigeLevel?: number) => number;
/**
 * Get level from total XP
 */
export declare const getLevelFromXP: (totalXP: number, prestigeLevel?: number) => number;
/**
 * Get accuracy-based multiplier
 */
export declare const getAccuracyMultiplier: (accuracy: number) => number;
/**
 * Get streak-based multiplier
 */
export declare const getStreakMultiplier: (streakDays: number) => number;
/**
 * Calculate momentum multiplier
 */
export declare const calculateMomentumMultiplier: (momentumSystem: MomentumSystem) => number;
/**
 * Calculate prestige bonus multiplier
 */
export declare const getPrestigeMultiplier: (prestigeSystem: PrestigeSystem) => number;
/**
 * Calculate adaptive difficulty multiplier
 * Adjusts XP based on recent performance trends
 */
export declare const calculateAdaptiveDifficulty: (recentAccuracyTrend: number, consistencyScore: number, improvementRate: number) => number;
/**
 * Calculate XP decay from inactivity
 */
export declare const calculateDecay: (lastActiveDate: Date, decayConfig: {
    gracePeriodDays: number;
    decayRatePerDay: number;
    maxDecayPercentage: number;
}) => number;
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
export declare const calculateTotalXP: (params: XPCalculationParams) => XPCalculationResult;
/**
 * Distribute XP across skill categories
 */
export declare const distributeSkillXP: (totalXP: number, skillBreakdown?: Partial<Record<string, number>>) => Record<string, number>;
/**
 * Forecast when user will reach next level
 */
export declare const forecastLevelUp: (currentXP: number, xpToNextLevel: number, avgXPPerDay: number) => Date | null;
/**
 * Calculate average XP per day
 */
export declare const calculateAverageXPPerDay: (totalXP: number, activeDays: number) => number;
/**
 * Calculate XP velocity (XP gain rate)
 */
export declare const calculateXPVelocity: (recentXP: number[], windowDays?: number) => number;
export declare const XPCalculator: {
    calculateXPForLevel: (level: number, prestigeLevel?: number) => number;
    calculateCumulativeXP: (level: number, prestigeLevel?: number) => number;
    getLevelFromXP: (totalXP: number, prestigeLevel?: number) => number;
    getAccuracyMultiplier: (accuracy: number) => number;
    getStreakMultiplier: (streakDays: number) => number;
    calculateMomentumMultiplier: (momentumSystem: MomentumSystem) => number;
    getPrestigeMultiplier: (prestigeSystem: PrestigeSystem) => number;
    calculateAdaptiveDifficulty: (recentAccuracyTrend: number, consistencyScore: number, improvementRate: number) => number;
    calculateDecay: (lastActiveDate: Date, decayConfig: {
        gracePeriodDays: number;
        decayRatePerDay: number;
        maxDecayPercentage: number;
    }) => number;
    calculateTotalXP: (params: XPCalculationParams) => XPCalculationResult;
    distributeSkillXP: (totalXP: number, skillBreakdown?: Partial<Record<string, number>>) => Record<string, number>;
    forecastLevelUp: (currentXP: number, xpToNextLevel: number, avgXPPerDay: number) => Date | null;
    calculateAverageXPPerDay: (totalXP: number, activeDays: number) => number;
    calculateXPVelocity: (recentXP: number[], windowDays?: number) => number;
};
export default XPCalculator;
//# sourceMappingURL=xpCalculator.d.ts.map