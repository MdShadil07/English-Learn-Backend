/**
 * 📊 LEVEL PROGRESSION CALCULATOR
 * Level calculations, proficiency tiers, and progress tracking
 */

import { ProficiencyLevel } from './type/index.js';
import { PROFICIENCY_THRESHOLDS } from './config.js';
import { calculateXPForLevel, getLevelFromXP } from './xpCalculator.js';

// Add this type assertion if PROFICIENCY_THRESHOLDS is imported as an object
const PROFICIENCY_THRESHOLDS_TYPED = PROFICIENCY_THRESHOLDS as unknown as Record<ProficiencyLevel, { min: number; max: number }>;

// ========================================
// PROFICIENCY LEVEL CALCULATIONS
// ========================================

export const getProficiencyLevel = (level: number): ProficiencyLevel => {
  if (level >= PROFICIENCY_THRESHOLDS_TYPED[ProficiencyLevel.MASTER].min) return ProficiencyLevel.MASTER;
  if (level >= PROFICIENCY_THRESHOLDS_TYPED[ProficiencyLevel.EXPERT].min) return ProficiencyLevel.EXPERT;
  if (level >= PROFICIENCY_THRESHOLDS_TYPED[ProficiencyLevel.ADVANCED].min) return ProficiencyLevel.ADVANCED;
  if (level >= PROFICIENCY_THRESHOLDS_TYPED[ProficiencyLevel.INTERMEDIATE].min) return ProficiencyLevel.INTERMEDIATE;
  return ProficiencyLevel.BEGINNER;
};

export const getTierWithinProficiency = (level: number): number => {
  const proficiency = getProficiencyLevel(level);
  const threshold = PROFICIENCY_THRESHOLDS_TYPED[proficiency];
  
  const levelsInProficiency = threshold.max - threshold.min + 1;
  const tierSize = Math.ceil(levelsInProficiency / 10);
  const levelInProficiency = level - threshold.min;
  
  return Math.min(10, Math.ceil((levelInProficiency + 1) / tierSize));
};

export const getProficiencyProgress = (level: number): number => {
  const proficiency = getProficiencyLevel(level);
  const threshold = PROFICIENCY_THRESHOLDS_TYPED[proficiency];
  
  const levelsInProficiency = threshold.max - threshold.min + 1;
  const levelInProficiency = level - threshold.min;
  
  return Math.min(100, (levelInProficiency / levelsInProficiency) * 100);
};

export const isMilestoneLevel = (level: number): boolean => {
  return level % 10 === 0;
};

/**
 * Get next milestone level
 */
export const getNextMilestoneLevel = (currentLevel: number): number => {
  return Math.ceil(currentLevel / 10) * 10;
};

// ========================================
// PROGRESS CALCULATIONS
// ========================================

/**
 * Calculate progress to next level (0-100%)
 */
export const calculateLevelProgress = (
  currentXP: number,
  currentLevel: number,
  prestigeLevel: number = 0
): number => {
  const xpForNextLevel = calculateXPForLevel(currentLevel + 1, prestigeLevel);
  const xpForCurrentLevel = calculateXPForLevel(currentLevel, prestigeLevel);
  const xpInCurrentLevel = currentXP - xpForCurrentLevel;
  
  if (xpForNextLevel === 0) return 0;
  
  return Math.min(100, (xpInCurrentLevel / xpForNextLevel) * 100);
};

/**
 * Calculate XP remaining to next level
 */
export const getXPToNextLevel = (
  currentXP: number,
  currentLevel: number,
  prestigeLevel: number = 0
): number => {
  const xpForNextLevel = calculateXPForLevel(currentLevel + 1, prestigeLevel);
  const xpGained = currentXP - calculateXPForLevel(currentLevel, prestigeLevel);
  
  return Math.max(0, xpForNextLevel - xpGained);
};

/**
 * Check if user can level up
 */
export const canLevelUp = (
  currentXP: number,
  currentLevel: number,
  prestigeLevel: number = 0
): boolean => {
  return getXPToNextLevel(currentXP, currentLevel, prestigeLevel) <= 0;
};

/**
 * Process level up and return new level
 */
export const processLevelUp = (
  currentXP: number,
  currentLevel: number,
  prestigeLevel: number = 0
): { newLevel: number; levelsGained: number } => {
  const newLevel = getLevelFromXP(currentXP, prestigeLevel);
  const levelsGained = newLevel - currentLevel;
  
  return {
    newLevel,
    levelsGained,
  };
};

// ========================================
// LEVEL ANALYTICS
// ========================================

/**
 * Calculate level velocity (levels per day)
 */
export const calculateLevelVelocity = (
  levelsGained: number,
  daysActive: number
): number => {
  if (daysActive <= 0) return 0;
  return levelsGained / daysActive;
};

/**
 * Estimate days to reach target level
 */
export const estimateDaysToLevel = (
  currentLevel: number,
  targetLevel: number,
  avgLevelsPerDay: number
): number => {
  if (avgLevelsPerDay <= 0) return Infinity;
  
  const levelsRemaining = targetLevel - currentLevel;
  return Math.ceil(levelsRemaining / avgLevelsPerDay);
};

/**
 * Get level difficulty rating (1-10)
 * Higher levels = harder to progress
 */
export const getLevelDifficulty = (level: number): number => {
  if (level <= 10) return 1;
  if (level <= 30) return 2;
  if (level <= 50) return 3;
  if (level <= 75) return 4;
  if (level <= 100) return 5;
  if (level <= 150) return 6;
  if (level <= 200) return 7;
  if (level <= 300) return 8;
  if (level <= 400) return 9;
  return 10;
};

// ========================================
// LEVEL COMPARISON
// ========================================

/**
 * Compare two levels and return difference summary
 */
export const compareLevels = (
  level1: number,
  level2: number
): {
  levelDifference: number;
  proficiencyDifference: number;
  description: string;
} => {
  const diff = level2 - level1;
  const prof1 = getProficiencyLevel(level1);
  const prof2 = getProficiencyLevel(level2);
  
  const proficiencyLevels: ProficiencyLevel[] = [
    ProficiencyLevel.BEGINNER,
    ProficiencyLevel.INTERMEDIATE,
    ProficiencyLevel.ADVANCED,
    ProficiencyLevel.EXPERT,
    ProficiencyLevel.MASTER
  ];
  const profDiff = proficiencyLevels.indexOf(prof2) - proficiencyLevels.indexOf(prof1);
  
  let description = '';
  if (diff > 0) {
    description = `${diff} level${diff > 1 ? 's' : ''} ahead`;
  } else if (diff < 0) {
    description = `${Math.abs(diff)} level${Math.abs(diff) > 1 ? 's' : ''} behind`;
  } else {
    description = 'Same level';
  }
  
  if (profDiff !== 0) {
    description += ` (${Math.abs(profDiff)} proficiency tier${Math.abs(profDiff) > 1 ? 's' : ''} ${profDiff > 0 ? 'higher' : 'lower'})`;
  }
  
  return {
    levelDifference: diff,
    proficiencyDifference: profDiff,
    description,
  };
};

/**
 * Calculate percentile rank (simplified version)
 */
export const calculatePercentile = (
  userLevel: number,
  allUserLevels: number[]
): number => {
  if (allUserLevels.length === 0) return 0;
  
  const lowerCount = allUserLevels.filter(level => level < userLevel).length;
  return (lowerCount / allUserLevels.length) * 100;
};

// ========================================
// LEVEL BADGES & TITLES
// ========================================

/**
 * Get level badge/title
 */
export const getLevelBadge = (level: number): string => {
  if (level >= 500) return '🏆 Grandmaster';
  if (level >= 400) return '👑 Legend';
  if (level >= 300) return '⭐ Elite';
  if (level >= 200) return '💎 Master';
  if (level >= 150) return '🥇 Expert';
  if (level >= 100) return '🥈 Advanced';
  if (level >= 50) return '🥉 Intermediate';
  if (level >= 20) return '🎖️ Apprentice';
  return '🌱 Novice';
};

/**
 * Get next badge milestone
 */
export const getNextBadgeMilestone = (currentLevel: number): {
  level: number;
  badge: string;
  levelsRemaining: number;
} => {
  const milestones = [20, 50, 100, 150, 200, 300, 400, 500];
  const nextMilestone = milestones.find(m => m > currentLevel) || 500;
  
  return {
    level: nextMilestone,
    badge: getLevelBadge(nextMilestone),
    levelsRemaining: nextMilestone - currentLevel,
  };
};

// ========================================
// LEVEL REWARDS
// ========================================

/**
 * Check if level unlocks special features
 */
export const getUnlockedFeatures = (level: number): string[] => {
  const features: string[] = [];
  
  if (level >= 5) features.push('Progress Chart');
  if (level >= 10) features.push('Streak Tracker');
  if (level >= 20) features.push('Advanced Analytics');
  if (level >= 30) features.push('Custom Goals');
  if (level >= 50) features.push('AI Insights Plus');
  if (level >= 75) features.push('Leaderboards');
  if (level >= 100) features.push('Master Class Access');
  if (level >= 150) features.push('Mentor Mode');
  if (level >= 200) features.push('Prestige System');
  if (level >= 300) features.push('Legacy Rewards');
  
  return features;
};

/**
 * Get newly unlocked features at level
 */
export const getNewlyUnlockedFeatures = (newLevel: number, previousLevel: number): string[] => {
  const allUnlocked = getUnlockedFeatures(newLevel);
  const previouslyUnlocked = getUnlockedFeatures(previousLevel);
  
  return allUnlocked.filter(f => !previouslyUnlocked.includes(f));
};

// ========================================
// EXPORTS
// ========================================

export const LevelCalculator = {
  getProficiencyLevel,
  getTierWithinProficiency,
  getProficiencyProgress,
  isMilestoneLevel,
  getNextMilestoneLevel,
  calculateLevelProgress,
  getXPToNextLevel,
  canLevelUp,
  processLevelUp,
  calculateLevelVelocity,
  estimateDaysToLevel,
  getLevelDifficulty,
  compareLevels,
  calculatePercentile,
  getLevelBadge,
  getNextBadgeMilestone,
  getUnlockedFeatures,
  getNewlyUnlockedFeatures,
};

export default LevelCalculator;
