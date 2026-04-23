const XP_CURVE_CONFIG = {
  BASE_XP: 220,
  EXPONENT: 1.1,
  MULTIPLIER: 1.08,
  MILESTONE_BONUS: 1.25,
  PRESTIGE_SCALING: 1.15,
} as const;

export interface NormalizedXpSnapshot {
  level: number;
  prestigeLevel: number;
  totalXp: number;
  xpIntoLevel: number;
  xpRemainingToNextLevel: number;
  xpRequiredForLevel: number;
  progressPercentage: number;
  cumulativeXpForCurrentLevel: number;
  cumulativeXpForNextLevel: number;
}

export interface RawXpSnapshot {
  totalXp: number;
  currentLevel?: number;
  prestigeLevel?: number;
  currentLevelXP?: number;
  xpToNextLevel?: number;
  xpRequiredForLevel?: number;
  progressPercentage?: number;
  cumulativeXPForCurrentLevel?: number;
  cumulativeXPForNextLevel?: number;
}

export const calculateXpForLevel = (level: number, prestigeLevel = 0): number => {
  if (level <= 1) {
    return 0;
  }

  const { BASE_XP, MULTIPLIER, EXPONENT, MILESTONE_BONUS, PRESTIGE_SCALING } = XP_CURVE_CONFIG;

  let xp = BASE_XP * Math.pow(MULTIPLIER, level - 1) * Math.pow(level, EXPONENT);

  if (level === 2) {
    xp = Math.max(500, xp);
  }

  if (level % 10 === 0) {
    xp *= MILESTONE_BONUS;
  }

  if (prestigeLevel > 0) {
    xp *= Math.pow(PRESTIGE_SCALING, prestigeLevel);
  }

  return Math.floor(xp);
};

export const calculateCumulativeXp = (level: number, prestigeLevel = 0): number => {
  let total = 0;
  for (let i = 2; i <= level; i += 1) {
    total += calculateXpForLevel(i, prestigeLevel);
  }
  return total;
};

export const getLevelFromXp = (totalXp: number, prestigeLevel = 0): number => {
  if (!Number.isFinite(totalXp) || totalXp <= 0) {
    return 1;
  }

  let level = 1;
  let cumulativeXp = 0;

  while (cumulativeXp <= totalXp) {
    level += 1;
    cumulativeXp += calculateXpForLevel(level, prestigeLevel);

    if (level > 999) {
      break;
    }
  }

  return Math.max(1, level - 1);
};

export const normalizeXpSnapshot = (raw: RawXpSnapshot): NormalizedXpSnapshot => {
  const totalXp = Math.max(0, Math.floor(raw.totalXp ?? 0));
  const prestigeLevel = Math.max(0, raw.prestigeLevel ?? 0);
  const levelHint = raw.currentLevel && raw.currentLevel > 0 ? Math.floor(raw.currentLevel) : undefined;
  const level = levelHint ?? getLevelFromXp(totalXp, prestigeLevel);

  const cumulativeCurrent =
    typeof raw.cumulativeXPForCurrentLevel === 'number'
      ? Math.max(0, Math.floor(raw.cumulativeXPForCurrentLevel))
      : calculateCumulativeXp(level, prestigeLevel);
  const cumulativeNext =
    typeof raw.cumulativeXPForNextLevel === 'number'
      ? Math.max(cumulativeCurrent, Math.floor(raw.cumulativeXPForNextLevel))
      : calculateCumulativeXp(level + 1, prestigeLevel);

  const xpRequired = Math.max(1, raw.xpRequiredForLevel ?? (cumulativeNext - cumulativeCurrent));

  let xpIntoLevel =
    typeof raw.currentLevelXP === 'number'
      ? Math.max(0, Math.floor(raw.currentLevelXP))
      : Math.max(0, totalXp - cumulativeCurrent);
  xpIntoLevel = Math.min(xpIntoLevel, xpRequired);

  let xpRemaining =
    typeof raw.xpToNextLevel === 'number'
      ? Math.max(0, Math.floor(raw.xpToNextLevel))
      : Math.max(0, cumulativeNext - totalXp);
  xpRemaining = Math.min(xpRemaining, xpRequired);

  if (xpIntoLevel + xpRemaining !== xpRequired) {
    xpRemaining = Math.max(0, xpRequired - xpIntoLevel);
  }

  const progressPercentage =
    typeof raw.progressPercentage === 'number'
      ? raw.progressPercentage
      : (xpIntoLevel / xpRequired) * 100;

  return {
    level,
    prestigeLevel,
    totalXp,
    xpIntoLevel,
    xpRemainingToNextLevel: xpRemaining,
    xpRequiredForLevel: xpRequired,
    progressPercentage: Math.max(0, Math.min(100, Math.round(progressPercentage))),
    cumulativeXpForCurrentLevel: cumulativeCurrent,
    cumulativeXpForNextLevel: cumulativeNext,
  };
};

export const computeLevelSnapshot = (
  totalXp: number,
  prestigeLevel = 0,
  levelHint?: number,
): NormalizedXpSnapshot =>
  normalizeXpSnapshot({
    totalXp,
    prestigeLevel,
    currentLevel: levelHint,
  });
