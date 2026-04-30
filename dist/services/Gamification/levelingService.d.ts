/**
 * 📊 LEVEL PROGRESSION CALCULATOR
 * Level calculations, proficiency tiers, and progress tracking
 */
import { ProficiencyLevel } from './type/index.js';
export declare const getProficiencyLevel: (level: number) => ProficiencyLevel;
export declare const getTierWithinProficiency: (level: number) => number;
export declare const getProficiencyProgress: (level: number) => number;
export declare const isMilestoneLevel: (level: number) => boolean;
/**
 * Get next milestone level
 */
export declare const getNextMilestoneLevel: (currentLevel: number) => number;
/**
 * Calculate progress to next level (0-100%)
 */
export declare const calculateLevelProgress: (currentXP: number, currentLevel: number, prestigeLevel?: number) => number;
/**
 * Calculate XP remaining to next level
 */
export declare const getXPToNextLevel: (currentXP: number, currentLevel: number, prestigeLevel?: number) => number;
/**
 * Check if user can level up
 */
export declare const canLevelUp: (currentXP: number, currentLevel: number, prestigeLevel?: number) => boolean;
/**
 * Process level up and return new level
 */
export declare const processLevelUp: (currentXP: number, currentLevel: number, prestigeLevel?: number) => {
    newLevel: number;
    levelsGained: number;
};
/**
 * Calculate level velocity (levels per day)
 */
export declare const calculateLevelVelocity: (levelsGained: number, daysActive: number) => number;
/**
 * Estimate days to reach target level
 */
export declare const estimateDaysToLevel: (currentLevel: number, targetLevel: number, avgLevelsPerDay: number) => number;
/**
 * Get level difficulty rating (1-10)
 * Higher levels = harder to progress
 */
export declare const getLevelDifficulty: (level: number) => number;
/**
 * Compare two levels and return difference summary
 */
export declare const compareLevels: (level1: number, level2: number) => {
    levelDifference: number;
    proficiencyDifference: number;
    description: string;
};
/**
 * Calculate percentile rank (simplified version)
 */
export declare const calculatePercentile: (userLevel: number, allUserLevels: number[]) => number;
/**
 * Get level badge/title
 */
export declare const getLevelBadge: (level: number) => string;
/**
 * Get next badge milestone
 */
export declare const getNextBadgeMilestone: (currentLevel: number) => {
    level: number;
    badge: string;
    levelsRemaining: number;
};
/**
 * Check if level unlocks special features
 */
export declare const getUnlockedFeatures: (level: number) => string[];
/**
 * Get newly unlocked features at level
 */
export declare const getNewlyUnlockedFeatures: (newLevel: number, previousLevel: number) => string[];
export declare const LevelCalculator: {
    getProficiencyLevel: (level: number) => ProficiencyLevel;
    getTierWithinProficiency: (level: number) => number;
    getProficiencyProgress: (level: number) => number;
    isMilestoneLevel: (level: number) => boolean;
    getNextMilestoneLevel: (currentLevel: number) => number;
    calculateLevelProgress: (currentXP: number, currentLevel: number, prestigeLevel?: number) => number;
    getXPToNextLevel: (currentXP: number, currentLevel: number, prestigeLevel?: number) => number;
    canLevelUp: (currentXP: number, currentLevel: number, prestigeLevel?: number) => boolean;
    processLevelUp: (currentXP: number, currentLevel: number, prestigeLevel?: number) => {
        newLevel: number;
        levelsGained: number;
    };
    calculateLevelVelocity: (levelsGained: number, daysActive: number) => number;
    estimateDaysToLevel: (currentLevel: number, targetLevel: number, avgLevelsPerDay: number) => number;
    getLevelDifficulty: (level: number) => number;
    compareLevels: (level1: number, level2: number) => {
        levelDifference: number;
        proficiencyDifference: number;
        description: string;
    };
    calculatePercentile: (userLevel: number, allUserLevels: number[]) => number;
    getLevelBadge: (level: number) => string;
    getNextBadgeMilestone: (currentLevel: number) => {
        level: number;
        badge: string;
        levelsRemaining: number;
    };
    getUnlockedFeatures: (level: number) => string[];
    getNewlyUnlockedFeatures: (newLevel: number, previousLevel: number) => string[];
};
export default LevelCalculator;
//# sourceMappingURL=levelingService.d.ts.map