/**
 * 🎯 PROGRESS MODEL - COMPREHENSIVE ANALYTICS & LEADERBOARD SCHEMA
 * Full-fledged progress tracking for analytical dashboard and leaderboards
 * Tracks XP, levels, accuracy, skills, categories, sessions, and achievements
 */
import mongoose, { Document, Model } from 'mongoose';
/**
 * Category-wise performance tracking
 */
export interface ICategoryProgress {
    name: string;
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    xpEarned: number;
    level: number;
    lastPracticed: Date;
    timeSpent: number;
    streak: number;
    bestStreak: number;
}
/**
 * FREE NLP Detector Contributions (Typo.js, CEFR, LanguageTool, OpenRouter)
 */
export interface INLPDetectorContributions {
    languageTool?: {
        errors: number;
        confidence: number;
        source: string;
        processingTime?: number;
    };
    spelling?: {
        accuracy: number;
        errorsFound: number;
        confidence: number;
        source: string;
        processingTime?: number;
    };
    vocabulary?: {
        level: string;
        score: number;
        uniqueWords?: number;
        totalWords?: number;
        lexicalDiversity?: number;
        unknownWordPercentage?: number;
        source: string;
        processingTime?: number;
    };
    fluency?: {
        score: number;
        method: string;
        confidence?: number;
        source: string;
        processingTime?: number;
    };
}
/**
 * Performance metrics for analytics
 */
export interface IPerformanceMetrics {
    totalProcessingTime: number;
    detectorBreakdown: {
        spelling?: {
            time: number;
            accuracy: number;
        };
        vocabulary?: {
            time: number;
            score: number;
            level: string;
        };
        fluency?: {
            time: number;
            score: number;
            method: string;
        };
        languageTool?: {
            time: number;
            errors: number;
        };
    };
    cacheHits?: number;
    cacheMisses?: number;
}
/**
 * Detailed accuracy data from EnhancedAccuracyResult with NLP analytics
 */
export interface IAccuracyData {
    overall: number;
    adjustedOverall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    punctuation: number;
    capitalization: number;
    syntax: number;
    coherence: number;
    overallAccuracySummary?: {
        overallAccuracy: number;
        overallGrammar: number;
        overallVocabulary: number;
        overallSpelling: number;
        overallFluency: number;
        overallPunctuation: number;
        overallCapitalization: number;
        overallSyntax: number;
        overallCoherence: number;
        calculationCount: number;
        lastCalculated: Date;
    };
    latestSnapshot?: {
        overall: number;
        grammar: number;
        vocabulary: number;
        spelling: number;
        fluency: number;
        punctuation: number;
        capitalization: number;
        syntax: number;
        coherence: number;
        recordedAt: Date;
    };
    cache?: {
        messageCount: number;
        lastUpdated: Date | null;
    };
    totalErrors: number;
    criticalErrors: number;
    errorsByType: {
        grammar: number;
        vocabulary: number;
        spelling: number;
        punctuation: number;
        capitalization: number;
        syntax: number;
        style: number;
        coherence: number;
    };
    readabilityScore?: number;
    toneScore?: number;
    styleScore?: number;
    freeNLPEnhanced?: boolean;
    nlpCost?: string;
    detectorContributions?: INLPDetectorContributions;
    performanceMetrics?: IPerformanceMetrics;
    vocabularyLevel?: string;
    lastCalculated: Date;
    calculationCount: number;
}
/**
 * Accuracy history entry for trend analysis
 */
export interface IAccuracyHistoryEntry {
    date: Date;
    overall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    messageId?: string;
    sessionId?: string;
}
/**
 * Level-up event tracking
 */
export interface ILevelUpEvent {
    fromLevel: number;
    toLevel: number;
    timestamp: Date;
    xpAtLevelUp: number;
    prestigeLevel: number;
    rewards?: {
        badges?: string[];
        achievements?: string[];
        unlocks?: string[];
    };
}
/**
 * XP event tracking for analytics
 */
export interface IXPEvent {
    amount: number;
    source: 'accuracy' | 'streak' | 'bonus' | 'premium' | 'prestige' | 'achievement' | 'daily' | 'ai_chat' | 'conversation' | 'penalty';
    category?: string;
    timestamp: Date;
    multiplier: number;
    details?: string;
}
/**
 * Skill-wise metrics (accuracy, fluency, etc.)
 */
export interface ISkillMetrics {
    accuracy: number;
    vocabulary: number;
    grammar: number;
    pronunciation: number;
    fluency: number;
    comprehension: number;
    listening: number;
    speaking: number;
    reading: number;
    writing: number;
}
/**
 * Session history for detailed analytics
 */
export interface ISessionHistory {
    sessionId: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    xpGained: number;
    accuracyRate: number;
    activitiesCompleted: number;
    category: string;
    performanceRating: 'excellent' | 'good' | 'average' | 'needs-improvement';
}
/**
 * Daily activity requirement tracking for streak
 */
export interface IDailyActivity {
    date: Date;
    minutesPracticed: number;
    messagesCount: number;
    accuracyAverage: number;
    activitiesCompleted: string[];
    goalMet: boolean;
    xpEarned: number;
}
/**
 * Streak freeze/save feature (Premium)
 */
export interface IStreakFreeze {
    available: number;
    used: number;
    lastUsed: Date | null;
    expiresAt: Date | null;
}
/**
 * Streak milestone rewards
 */
export interface IStreakMilestone {
    days: number;
    reachedAt: Date;
    rewards: {
        xpBonus: number;
        badgeId?: string;
        freezeToken?: number;
        title?: string;
    };
}
/**
 * Comprehensive streak tracking with detailed history and premium features
 */
export interface IStreakData {
    current: number;
    longest: number;
    lastActivityDate: Date | null;
    streakStartDate: Date | null;
    totalStreakDays: number;
    dailyGoal: {
        minutesRequired: number;
        messagesRequired: number;
        activitiesRequired: string[];
    };
    todayProgress: {
        minutesPracticed: number;
        messagesCount: number;
        activitiesCompleted: string[];
        goalMet: boolean;
        lastUpdated: Date | null;
    };
    gracePeriod: {
        hours: number;
        isActive: boolean;
        expiresAt: Date | null;
    };
    freeze: IStreakFreeze;
    streakHistory: Array<{
        startDate: Date;
        endDate: Date;
        length: number;
        reason: 'completed' | 'broken' | 'freeze_used';
    }>;
    dailyActivities: IDailyActivity[];
    milestones: IStreakMilestone[];
    stats: {
        totalActiveDays: number;
        averageMinutesPerDay: number;
        bestWeek: number;
        totalStreaksBroken: number;
        totalFreezeUsed: number;
    };
}
/**
 * XP breakdown for analytics
 */
export interface IXPBreakdown {
    fromAccuracy: number;
    fromStreak: number;
    fromBonus: number;
    fromPremium: number;
    fromPrestige: number;
    fromPenalty: number;
    total: number;
}
/**
 * Leaderboard metrics
 */
export interface ILeaderboardMetrics {
    globalRank: number;
    categoryRanks: Map<string, number>;
    weeklyXP: number;
    monthlyXP: number;
    lastRankUpdate: Date;
}
/**
 * Main Progress Interface
 */
export interface IProgress extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    totalXP: number;
    currentLevel: number;
    currentLevelXP: number;
    xpToNextLevel: number;
    prestigeLevel: number;
    proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
    tier: number;
    xpBreakdown: IXPBreakdown;
    dailyXP: number;
    weeklyXP: number;
    monthlyXP: number;
    yearlyXP: number;
    xpHistory: Array<{
        date: Date;
        xp: number;
    }>;
    xpEvents: IXPEvent[];
    accuracyData: IAccuracyData;
    accuracyHistory: IAccuracyHistoryEntry[];
    skills: ISkillMetrics;
    overallAccuracy: number;
    levelUpHistory: ILevelUpEvent[];
    lastLevelUp: Date | null;
    categories: ICategoryProgress[];
    streak: IStreakData;
    stats: {
        totalSessions: number;
        totalTimeSpent: number;
        averageSessionTime: number;
        lessonsCompleted: number;
        exercisesCompleted: number;
        quizzesTaken: number;
        conversationsPracticed: number;
        wordsLearned: number;
        perfectScores: number;
    };
    sessionHistory: ISessionHistory[];
    achievements: mongoose.Types.ObjectId[];
    badges: Array<{
        badgeId: string;
        name: string;
        earnedAt: Date;
        category: string;
    }>;
    leaderboard: ILeaderboardMetrics;
    analytics: {
        learningVelocity: number;
        consistencyScore: number;
        improvementRate: number;
        strongestSkill: string;
        weakestSkill: string;
        recommendedFocus: string[];
    };
    milestones: Array<{
        type: 'level' | 'xp' | 'accuracy' | 'streak' | 'category';
        value: number;
        achievedAt: Date;
        description: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
    lastActive: Date;
    addXP(xpAmount: number, category?: string, source?: string): Promise<{
        leveledUp: boolean;
        newLevel: number;
        rewards?: any;
    }>;
    updateSkillMetrics(skill: keyof ISkillMetrics, value: number): Promise<void>;
    updateAccuracyData(accuracyResult: any): Promise<void>;
    updateCategoryProgress(category: string, data: Partial<ICategoryProgress>): Promise<void>;
    recordSession(sessionData: Partial<ISessionHistory>): Promise<void>;
    updateStreak(): Promise<void>;
    calculateRank(): Promise<number>;
    getWeeklyReport(): Promise<any>;
    getMonthlyReport(): Promise<any>;
    getAccuracyTrends(days?: number): Promise<any>;
    getLevelUpStats(): Promise<any>;
}
declare const Progress: Model<IProgress>;
export default Progress;
//# sourceMappingURL=Progress.d.ts.map