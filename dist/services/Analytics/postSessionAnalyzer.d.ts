/**
 * 📊 POST-SESSION ANALYTICS ANALYZER
 * Computes deep analytics metrics for Progress dashboard
 *
 * Features:
 * - Improvement rate calculation (weekly/monthly trends)
 * - Streak health scoring (consistency analysis)
 * - Learning velocity tracking (XP/hour, accuracy gains)
 * - Consistency score (session regularity)
 * - Performance predictions
 *
 * Runs as background job to avoid blocking real-time endpoints
 */
interface AnalyticsResult {
    userId: string;
    improvementRate: {
        weekly: number;
        monthly: number;
        trend: 'improving' | 'declining' | 'stable';
    };
    streakHealth: {
        score: number;
        consistency: number;
        averageDailyMinutes: number;
        riskLevel: 'low' | 'medium' | 'high';
    };
    learningVelocity: {
        xpPerHour: number;
        accuracyGainPerWeek: number;
        sessionsPerWeek: number;
        efficiency: number;
    };
    consistencyScore: number;
    predictions: {
        nextLevelETA: Date | null;
        projectedAccuracy30Days: number;
        streakSurvivalRate: number;
    };
    lastAnalyzed: Date;
}
declare class PostSessionAnalyzer {
    /**
     * Analyze user's performance and compute deep metrics
     */
    analyzeUser(userId: string): Promise<AnalyticsResult>;
    /**
     * Calculate improvement rate (weekly/monthly)
     */
    private calculateImprovementRate;
    /**
     * Calculate streak health and risk level
     */
    private calculateStreakHealth;
    /**
     * Calculate learning velocity (XP/hour, accuracy gains)
     */
    private calculateLearningVelocity;
    /**
     * Calculate consistency score (session regularity)
     */
    private calculateConsistencyScore;
    /**
     * Generate predictions based on historical data
     */
    private generatePredictions;
    /**
     * Store analytics in Progress document (embedded or separate collection)
     */
    private storeAnalytics;
    /**
     * Batch analyze multiple users (for scheduled jobs)
     */
    batchAnalyze(userIds: string[]): Promise<AnalyticsResult[]>;
    /**
     * Schedule weekly analyzer job (called from cron/scheduler)
     */
    runWeeklyAnalysis(): Promise<void>;
}
export declare const postSessionAnalyzer: PostSessionAnalyzer;
export default postSessionAnalyzer;
//# sourceMappingURL=postSessionAnalyzer.d.ts.map