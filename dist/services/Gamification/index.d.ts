/**
 * 🎮 GAMIFICATION SERVICES INDEX
 * User engagement and progression systems
 * - Leveling: XP calculation, level progression, prestige system
 * - Streaks: Daily activity tracking, streak rewards, consistency scoring
 */
export { calculateXPForLevel, calculateCumulativeXP, calculateCumulativeXP as calculateTotalXPForLevel, getLevelFromXP, getLevelFromXP as calculateLevelFromXP, calculateTotalXP, type XPCalculationParams, } from './xpCalculator.js';
export type { XPCalculationResult } from './type/index.js';
export * from './levelingService.js';
export * from './unifiedStreakService.js';
/**
 * Calculate XP for next level
 */
export declare const calculateXPForNextLevel: (currentLevel: number, prestigeLevel?: number) => number;
/**
 * Calculate current level's XP progress
 */
export declare const calculateCurrentLevelXP: (totalXP: number, currentLevel: number, prestigeLevel?: number) => number;
/**
 * Calculate XP remaining to next level
 */
export declare const calculateXPToNextLevel: (totalXP: number, currentLevel: number, prestigeLevel?: number) => number;
/**
 * Get detailed level information
 */
export declare const getLevelInfo: (level: number, prestigeLevel?: number) => {
    level: number;
    proficiency: import("./type/index.js").ProficiencyLevel;
    tier: number;
    proficiencyProgress: number;
    isMilestone: boolean;
    badge: string;
    difficulty: number;
};
//# sourceMappingURL=index.d.ts.map