/**
 * 🎮 GAMIFICATION SERVICES INDEX
 * User engagement and progression systems
 * - Leveling: XP calculation, level progression, prestige system
 * - Streaks: Daily activity tracking, streak rewards, consistency scoring
 */
// Leveling Service exports (from xpCalculator for XP calculations)
export { calculateXPForLevel, calculateCumulativeXP, calculateCumulativeXP as calculateTotalXPForLevel, getLevelFromXP, getLevelFromXP as calculateLevelFromXP, calculateTotalXP, } from './xpCalculator.js';
// Leveling Service exports (level progression helpers)
export * from './levelingService.js';
// Make sure levelingService.ts exists in this folder
// Unified Streak Service exports (Combines core + premium features)
export * from './unifiedStreakService.js';
import { calculateCumulativeXP, calculateXPForLevel } from './xpCalculator.js';
import { getXPToNextLevel, getProficiencyLevel, getTierWithinProficiency, getProficiencyProgress, isMilestoneLevel, getLevelBadge, getLevelDifficulty } from './levelingService.js';
/**
 * Calculate XP for next level
 */
export const calculateXPForNextLevel = (currentLevel, prestigeLevel = 0) => {
    return calculateXPForLevel(currentLevel + 1, prestigeLevel);
};
/**
 * Calculate current level's XP progress
 */
export const calculateCurrentLevelXP = (totalXP, currentLevel, prestigeLevel = 0) => {
    const cumulativeXP = calculateCumulativeXP(currentLevel, prestigeLevel);
    return totalXP - cumulativeXP;
};
/**
 * Calculate XP remaining to next level
 */
export const calculateXPToNextLevel = (totalXP, currentLevel, prestigeLevel = 0) => {
    return getXPToNextLevel(totalXP, currentLevel, prestigeLevel);
};
/**
 * Get detailed level information
 */
export const getLevelInfo = (level, prestigeLevel = 0) => {
    return {
        level,
        proficiency: getProficiencyLevel(level),
        tier: getTierWithinProficiency(level),
        proficiencyProgress: getProficiencyProgress(level),
        isMilestone: isMilestoneLevel(level),
        badge: getLevelBadge(level),
        difficulty: getLevelDifficulty(level),
    };
};
//# sourceMappingURL=index.js.map