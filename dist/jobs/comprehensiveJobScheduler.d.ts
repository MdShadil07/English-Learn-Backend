/**
 * 🕐 COMPREHENSIVE BACKGROUND JOBS SCHEDULER
 * Manages all automated tasks for the application:
 *
 * STREAK MANAGEMENT:
 * - Daily midnight: Validate & reset expired streaks
 * - Every 6 hours: Health check for at-risk users
 * - Weekly Sunday: Generate streak analytics
 *
 * ACCURACY & PROGRESS:
 * - Hourly: Update accuracy trending data
 * - Daily 2 AM: Run weekly analytics for all users
 * - Every 30 min: Flush batched progress updates
 *
 * CACHE & OPTIMIZATION:
 * - Every 15 min: Clear stale Redis cache entries
 * - Every hour: Update leaderboard cache
 * - Daily 3 AM: Rebuild indexes and optimize queries
 */
interface AccuracyJobData {
    userId: string;
    userMessage: string;
    aiResponse: string;
    userTier: 'free' | 'pro' | 'premium';
    userLevel?: string;
    previousAccuracy?: any;
    timestamp: number;
}
export declare class ComprehensiveJobScheduler {
    private jobs;
    private accuracyQueue;
    private accuracyWorker;
    private stats;
    private isStarted;
    /**
     * Initialize all background jobs
     */
    start(): void;
    /**
     * Initialize accuracy queue and worker
     */
    private initializeAccuracyQueue;
    private handleAccuracyJob;
    /**
     * Queue accuracy analysis job (public API)
     */
    queueAccuracyAnalysis(data: AccuracyJobData): Promise<string>;
    /**
     * Get queue statistics
     */
    getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        processed: number;
    }>;
    getStats(): {
        streakValidations: number;
        accuracyUpdates: number;
        cacheFlushes: number;
        analyticsRuns: number;
        accuracyJobsProcessed: number;
        errors: number;
    };
    /**
     * Check for users at risk of losing their streak
     */
    private checkStreaksAtRisk;
    /**
     * Generate weekly streak report
     */
    private generateWeeklyStreakReport;
    /**
     * Update accuracy trending data
     */
    private updateAccuracyTrends;
    /**
     * Run weekly analytics for all users
     */
    private runWeeklyAnalyticsForAllUsers;
    /**
     * Flush batched progress updates
     */
    private flushBatchedUpdates;
    /**
     * Clean stale cache entries
     */
    private cleanStaleCache;
    /**
     * Update leaderboard cache
     */
    private updateLeaderboardCache;
    /**
     * Optimize database (rebuild indexes, compact collections)
     */
    private optimizeDatabase;
}
export declare const comprehensiveJobScheduler: ComprehensiveJobScheduler;
export default comprehensiveJobScheduler;
//# sourceMappingURL=comprehensiveJobScheduler.d.ts.map