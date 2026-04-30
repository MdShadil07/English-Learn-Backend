/**
 * Backend Progress Calculator
 * Handles XP calculations, level progression, and skill tracking
 */
export interface LevelInfo {
    level: number;
    currentXP: number;
    xpToNextLevel: number;
    progressPercentage: number;
}
export interface XPReward {
    totalXP: number;
    reason: string;
    baseXP: number;
    multiplier: number;
}
export interface SkillUpdate {
    accuracy?: number;
    vocabulary?: number;
    grammar?: number;
    pronunciation?: number;
    fluency?: number;
}
/**
 * Calculate XP required for a specific level
 */
export declare const calculateXPForLevel: (level: number) => number;
/**
 * Calculate total XP required to reach a level
 */
export declare const calculateTotalXPForLevel: (targetLevel: number) => number;
/**
 * Calculate current level from total XP
 */
export declare const calculateLevelFromXP: (totalXP: number) => number;
/**
 * Calculate XP for next level
 */
export declare const calculateXPForNextLevel: (currentLevel: number) => number;
/**
 * Calculate current XP within current level
 */
export declare const calculateCurrentLevelXP: (totalXP: number, currentLevel: number) => number;
/**
 * Calculate XP needed to reach next level
 */
export declare const calculateXPToNextLevel: (totalXP: number, currentLevel: number) => number;
/**
 * Get comprehensive level information
 */
export declare const getLevelInfo: (totalXP: number) => LevelInfo;
/**
 * Calculate XP reward for an action
 */
export declare const calculateXPReward: (action: string, multiplier?: number, customXP?: number) => XPReward;
/**
 * Check if user leveled up
 */
export declare const checkLevelUp: (oldXP: number, newXP: number) => boolean;
/**
 * Calculate average skill level
 */
export declare const calculateAverageSkillLevel: (skills: SkillUpdate) => number;
/**
 * Generate progress summary
 */
export declare const generateProgressSummary: (totalXP: number, skills: SkillUpdate) => {
    level: number;
    currentXP: number;
    xpToNext: number;
    progress: string;
    progressPercentage: number;
    averageSkill: number;
    totalXP: number;
    nextLevelXP: number;
    skills: SkillUpdate;
};
//# sourceMappingURL=progressCalculator.d.ts.map