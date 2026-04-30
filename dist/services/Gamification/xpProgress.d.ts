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
export declare const calculateXpForLevel: (level: number, prestigeLevel?: number) => number;
export declare const calculateCumulativeXp: (level: number, prestigeLevel?: number) => number;
export declare const getLevelFromXp: (totalXp: number, prestigeLevel?: number) => number;
export declare const normalizeXpSnapshot: (raw: RawXpSnapshot) => NormalizedXpSnapshot;
export declare const computeLevelSnapshot: (totalXp: number, prestigeLevel?: number, levelHint?: number) => NormalizedXpSnapshot;
//# sourceMappingURL=xpProgress.d.ts.map