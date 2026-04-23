/**
 * Gamification Validators
 * Validation utilities for streak, XP, and level systems
 */

export const isValidUserTier = (tier: any): tier is 'free' | 'pro' | 'premium' => {
  return tier === 'free' || tier === 'pro' || tier === 'premium';
};

export const isValidMinutesPracticed = (minutes: any): minutes is number => {
  return typeof minutes === 'number' && minutes > 0 && minutes <= 1440; // Max 24 hours
};

export const isValidStreakCount = (count: any): count is number => {
  return typeof count === 'number' && count >= 0;
};

export const isValidXPAmount = (xp: any): xp is number => {
  return typeof xp === 'number' && xp >= 0;
};

export const isValidLevelNumber = (level: any): level is number => {
  return typeof level === 'number' && level > 0 && level <= 999;
};

export class Validators {
  static isValidTier = isValidUserTier;
  static isValidMinutes = isValidMinutesPracticed;
  static isValidStreak = isValidStreakCount;
  static isValidXP = isValidXPAmount;
  static isValidLevel = isValidLevelNumber;
}

export default Validators;
