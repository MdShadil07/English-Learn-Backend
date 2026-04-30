/**
 * 🕐 STREAK BACKGROUND JOBS
 * Automated tasks for streak management:
 * 1. Daily midnight validation - reset expired streaks
 * 2. Hourly streak health check - warn users at risk
 * 3. Weekly streak analytics - generate reports
 */
declare class StreakJobScheduler {
    private jobs;
    /**
     * Initialize all streak-related cron jobs
     */
    start(): void;
    /**
     * Check for users at risk of losing their streak
     */
    private checkStreaksAtRisk;
    /**
     * Generate weekly streak analytics report
     */
    private generateWeeklyStreakReport;
    /**
     * Stop all cron jobs
     */
    stop(): void;
}
export declare const streakJobScheduler: StreakJobScheduler;
export default streakJobScheduler;
//# sourceMappingURL=streakJobs.d.ts.map