/**
 * 🎯 LEVELING SYSTEM - COMPREHENSIVE TYPE DEFINITIONS
 * Industry-standard type architecture for scalable leveling system
 */
export declare enum ProficiencyLevel {
    BEGINNER = "Beginner",
    INTERMEDIATE = "Intermediate",
    ADVANCED = "Advanced",
    EXPERT = "Expert",
    MASTER = "Master"
}
export declare enum SkillCategory {
    GRAMMAR = "grammar",
    VOCABULARY = "vocabulary",
    SPELLING = "spelling",
    FLUENCY = "fluency",
    LISTENING = "listening",
    SPEAKING = "speaking",
    PRONUNCIATION = "pronunciation",
    COMPREHENSION = "comprehension"
}
export declare enum RewardRarity {
    COMMON = "common",
    UNCOMMON = "uncommon",
    RARE = "rare",
    EPIC = "epic",
    LEGENDARY = "legendary"
}
export declare enum MilestoneType {
    LEVEL = "level",
    ACCURACY = "accuracy",
    STREAK = "streak",
    SKILL = "skill",
    PRESTIGE = "prestige",
    SPECIAL = "special"
}
export declare enum EventType {
    WEEKEND_BOOST = "weekend_boost",
    CONSISTENCY_WEEK = "consistency_week",
    MILESTONE_MADNESS = "milestone_madness",
    DOUBLE_XP = "double_xp",
    SEASONAL = "seasonal"
}
export interface SkillXP {
    [SkillCategory.GRAMMAR]: number;
    [SkillCategory.VOCABULARY]: number;
    [SkillCategory.SPELLING]: number;
    [SkillCategory.FLUENCY]: number;
    [SkillCategory.LISTENING]: number;
    [SkillCategory.SPEAKING]: number;
    [SkillCategory.PRONUNCIATION]: number;
    [SkillCategory.COMPREHENSION]: number;
}
export interface SkillLevel {
    category: SkillCategory;
    level: number;
    xp: number;
    xpForNext: number;
    proficiency: ProficiencyLevel;
    rank: number;
}
export interface SkillProgress {
    skills: Record<SkillCategory, SkillLevel>;
    overallLevel: number;
    balanceScore: number;
    specialization: SkillCategory | null;
}
export interface XPSource {
    type: 'accuracy' | 'streak' | 'challenge' | 'milestone' | 'event' | 'bonus' | 'penalty';
    amount: number;
    multiplier: number;
    description: string;
    timestamp: Date;
}
export interface XPTransaction {
    id: string;
    amount: number;
    sources: XPSource[];
    totalMultiplier: number;
    skillCategory?: SkillCategory;
    timestamp: Date;
}
export interface XPCalculationResult {
    baseXP: number;
    bonusXP: number;
    penaltyXP: number;
    totalXP: number;
    multipliers: {
        accuracy: number;
        streak: number;
        tier: number;
        adaptive: number;
        event: number;
        momentum: number;
        prestige: number;
        difficulty: number;
        penalty: number;
        total: number;
    };
    breakdown: XPSource[];
}
export interface AdaptiveDifficulty {
    currentDifficulty: number;
    trendMultiplier: number;
    decayFactor: number;
    momentumBonus: number;
    adjustmentHistory: DifficultyAdjustment[];
}
export interface DifficultyAdjustment {
    timestamp: Date;
    previousDifficulty: number;
    newDifficulty: number;
    reason: string;
    performanceMetrics: {
        accuracy: number;
        consistency: number;
        improvement: number;
    };
}
export interface DecaySystem {
    enabled: boolean;
    lastActiveDate: Date;
    daysInactive: number;
    decayRate: number;
    totalDecay: number;
    canRecover: boolean;
}
export interface MomentumSystem {
    currentStreak: number;
    momentumLevel: number;
    multiplier: number;
    comboCount: number;
    bonusActive: boolean;
    expiresAt: Date | null;
}
export interface PrestigeSystem {
    prestigeLevel: number;
    totalPrestiges: number;
    prestigeXPBonus: number;
    prestigeRewards: PrestigeReward[];
    canPrestige: boolean;
    nextPrestigeRequirement: number;
}
export interface PrestigeReward {
    prestigeLevel: number;
    rewards: string[];
    bonusMultiplier: number;
    unlockedAt: Date;
}
export interface Milestone {
    id: string;
    level: number;
    type: MilestoneType;
    name: string;
    description: string;
    rewards: Reward[];
    requirements?: MilestoneRequirement[];
    unlocked: boolean;
    unlockedAt?: Date;
    progress?: number;
}
export interface MilestoneRequirement {
    type: 'level' | 'xp' | 'accuracy' | 'streak' | 'skill';
    value: number;
    current: number;
    description: string;
}
export interface Reward {
    id: string;
    name: string;
    description: string;
    rarity: RewardRarity;
    type: 'badge' | 'multiplier' | 'feature' | 'cosmetic' | 'token';
    value?: number | string;
    icon: string;
    claimed: boolean;
    claimedAt?: Date;
}
export interface GameEvent {
    id: string;
    type: EventType;
    name: string;
    description: string;
    multiplier: number;
    startDate: Date;
    endDate: Date;
    active: boolean;
    participationCount: number;
    rewards?: Reward[];
}
export interface EventSchedule {
    events: GameEvent[];
    activeEvent: GameEvent | null;
    upcomingEvents: GameEvent[];
    pastEvents: GameEvent[];
}
export interface PerformanceMetrics {
    dailyXP: number[];
    weeklyXP: number[];
    monthlyXP: number[];
    averageXPPerSession: number;
    averageAccuracy: number;
    accuracyTrend: number;
    consistencyScore: number;
    improvementRate: number;
    retentionRate7d: number;
    retentionRate30d: number;
    streakRetention: number;
}
export interface LevelAnalytics {
    currentLevel: number;
    levelUpVelocity: number;
    forecastedLevelUp: Date;
    daysToNextLevel: number;
    percentileRank: number;
    skillBalance: number;
    strengthSkills: SkillCategory[];
    weaknessSkills: SkillCategory[];
    recommendedFocus: SkillCategory[];
}
export interface UserBehaviorProfile {
    playStyle: 'consistent' | 'burst' | 'casual' | 'competitive';
    preferredSkills: SkillCategory[];
    activityPattern: {
        peakHours: number[];
        peakDays: string[];
        averageSessionLength: number;
    };
    motivationFactors: {
        achievementDriven: number;
        competitionDriven: number;
        progressDriven: number;
        socialDriven: number;
    };
}
export interface LevelProgress {
    currentLevel: number;
    currentXP: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    xpToNextLevel: number;
    progressPercentage: number;
    proficiencyLevel: ProficiencyLevel;
    tier: number;
    totalXP: number;
}
export interface LevelStats {
    totalXP: number;
    totalMessages: number;
    totalAccuracyPoints: number;
    averageAccuracy: number;
    perfectMessages: number;
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: Date;
    joinedDate: Date;
    activeDays: number;
}
export interface ComprehensiveLevelingState {
    levelProgress: LevelProgress;
    levelStats: LevelStats;
    skillProgress: SkillProgress;
    adaptiveDifficulty: AdaptiveDifficulty;
    decaySystem: DecaySystem;
    momentumSystem: MomentumSystem;
    prestigeSystem: PrestigeSystem;
    milestones: Milestone[];
    unlockedRewards: Reward[];
    eventSchedule: EventSchedule;
    performanceMetrics: PerformanceMetrics;
    levelAnalytics: LevelAnalytics;
    behaviorProfile: UserBehaviorProfile;
    lastUpdated: Date;
    version: string;
}
export interface XPCurveConfig {
    BASE_XP: number;
    EXPONENT: number;
    MULTIPLIER: number;
    MILESTONE_BONUS: number;
    PRESTIGE_SCALING: number;
}
export interface DecayConfig {
    ENABLED: boolean;
    GRACE_PERIOD_DAYS: number;
    DECAY_RATE_PER_DAY: number;
    MAX_DECAY_PERCENTAGE: number;
    RECOVERY_RATE: number;
}
export interface MomentumConfig {
    STREAK_THRESHOLD: number;
    ACCURACY_THRESHOLD: number;
    MAX_MULTIPLIER: number;
    DURATION_HOURS: number;
    COMBO_INCREMENT: number;
}
export interface PrestigeConfig {
    MIN_LEVEL: number;
    XP_BONUS_PER_PRESTIGE: number;
    MAX_PRESTIGE_LEVEL: number;
    RESET_SKILLS: boolean;
}
export interface LevelingSystemConfig {
    xpCurve: XPCurveConfig;
    decay: DecayConfig;
    momentum: MomentumConfig;
    prestige: PrestigeConfig;
    features: {
        skillBranching: boolean;
        adaptiveDifficulty: boolean;
        prestigeSystem: boolean;
        eventSystem: boolean;
        analytics: boolean;
    };
}
export interface MessageData {
    accuracy: number;
    isPerfect: boolean;
    skillBreakdown?: Partial<Record<SkillCategory, number>>;
    timestamp: Date;
}
export interface XPGainData {
    amount: number;
    accuracy?: number;
    skillCategory?: SkillCategory;
    source: string;
}
export interface LevelingStorageKeys {
    PROGRESS: string;
    STATS: string;
    SKILLS: string;
    MILESTONES: string;
    ADAPTIVE: string;
    PRESTIGE: string;
    ANALYTICS: string;
    CONFIG: string;
}
export {};
//# sourceMappingURL=index.d.ts.map