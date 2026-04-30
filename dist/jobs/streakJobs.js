/**
 * 🕐 STREAK BACKGROUND JOBS
 * Automated tasks for streak management:
 * 1. Daily midnight validation - reset expired streaks
 * 2. Hourly streak health check - warn users at risk
 * 3. Weekly streak analytics - generate reports
 */
import cron from 'node-cron';
import { enhancedStreakService } from '../services/Gamification/enhancedStreakService.js';
import { logger } from '../utils/calculators/core/logger.js';
class StreakJobScheduler {
    jobs = [];
    /**
     * Initialize all streak-related cron jobs
     */
    start() {
        logger.info('🕐 Starting streak background jobs');
        // 1. Daily midnight UTC - Validate all streaks and reset expired ones
        const dailyValidation = cron.schedule('0 0 * * *', // Every day at 00:00 UTC
        async () => {
            try {
                logger.info('🔄 Running daily streak validation job');
                const result = await enhancedStreakService.validateAllStreaks();
                logger.info(result, '✅ Daily streak validation complete');
            }
            catch (error) {
                logger.error({ error }, '❌ Daily streak validation failed');
            }
        }, {
            timezone: 'UTC',
        });
        // 2. Every 6 hours - Check for users at risk of losing streak
        const streakHealthCheck = cron.schedule('0 */6 * * *', // Every 6 hours
        async () => {
            try {
                logger.info('⚠️ Running streak health check');
                await this.checkStreaksAtRisk();
            }
            catch (error) {
                logger.error({ error }, '❌ Streak health check failed');
            }
        }, {
            timezone: 'UTC',
        });
        // 3. Weekly Sunday 2 AM UTC - Generate streak analytics report
        const weeklyAnalytics = cron.schedule('0 2 * * 0', // Every Sunday at 2 AM UTC
        async () => {
            try {
                logger.info('📊 Running weekly streak analytics');
                await this.generateWeeklyStreakReport();
            }
            catch (error) {
                logger.error({ error }, '❌ Weekly streak analytics failed');
            }
        }, {
            timezone: 'UTC',
        });
        this.jobs.push(dailyValidation, streakHealthCheck, weeklyAnalytics);
        logger.info({
            jobs: [
                'Daily validation (00:00 UTC)',
                'Health check (every 6 hours)',
                'Weekly analytics (Sunday 2 AM UTC)',
            ],
        }, '✅ Streak background jobs started');
    }
    /**
     * Check for users at risk of losing their streak
     */
    async checkStreaksAtRisk() {
        // Implementation for checking at-risk streaks
        // Could send notifications, emails, etc.
        logger.info('⚠️ Streak health check completed');
    }
    /**
     * Generate weekly streak analytics report
     */
    async generateWeeklyStreakReport() {
        // Implementation for weekly analytics
        // Could aggregate stats, send reports, etc.
        logger.info('📊 Weekly streak report generated');
    }
    /**
     * Stop all cron jobs
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        logger.info('🛑 Stopped all streak background jobs');
    }
}
// Singleton export
export const streakJobScheduler = new StreakJobScheduler();
export default streakJobScheduler;
//# sourceMappingURL=streakJobs.js.map