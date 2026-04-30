/**
 * Gamification Validators
 * Validation utilities for streak, XP, and level systems
 */
export declare const isValidUserTier: (tier: any) => tier is "free" | "pro" | "premium";
export declare const isValidMinutesPracticed: (minutes: any) => minutes is number;
export declare const isValidStreakCount: (count: any) => count is number;
export declare const isValidXPAmount: (xp: any) => xp is number;
export declare const isValidLevelNumber: (level: any) => level is number;
export declare class Validators {
    static isValidTier: (tier: any) => tier is "free" | "pro" | "premium";
    static isValidMinutes: (minutes: any) => minutes is number;
    static isValidStreak: (count: any) => count is number;
    static isValidXP: (xp: any) => xp is number;
    static isValidLevel: (level: any) => level is number;
}
export default Validators;
//# sourceMappingURL=validators.d.ts.map