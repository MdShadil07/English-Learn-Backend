/**
 * 🕐 CRON SERVICE
 * Scheduled tasks for automatic streak resets, maintenance, and monthly refreshes
 */

import cron from 'node-cron';
import StreakService from './../Gamification/advancedStreakService.js';
import AdvancedStreakService from './../Gamification/advancedStreakService.js';

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs(): void {
  console.log('🕐 Initializing cron jobs...');

  // Daily streak reset check - runs at midnight UTC every day
  cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Running daily streak reset check at', new Date().toISOString());
    try {
      // Use Advanced Streak Service for comprehensive reset
      const result = await AdvancedStreakService.resetExpiredStreaks();
      console.log(`✅ Advanced streak reset complete:`, result);

      // Log to monitoring service if needed
      if (result.totalReset > 0) {
        console.warn(`⚠️ ${result.totalReset} streaks were reset today`);
        
        // Could send notifications to users whose streaks were reset
        // await notificationService.sendStreakResetNotifications(result.resetUsers);
      }
    } catch (error) {
      console.error('❌ Failed to reset expired streaks:', error);
      
      // Fallback to legacy streak service
      try {
        console.log('⚠️ Attempting fallback to legacy streak service...');
        const fallbackResult = await StreakService.resetExpiredStreaks();
        console.log(`✅ Fallback streak reset complete:`, fallbackResult);
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
    }
  });

  // Monthly streak freeze refresh - runs at 00:01 on 1st of every month
  cron.schedule('1 0 1 * *', async () => {
    console.log('� Running monthly streak freeze refresh at', new Date().toISOString());
    try {
      const result = await AdvancedStreakService.refreshMonthlyFreezes();
      console.log(`✅ Monthly freezes refreshed for ${result.totalRefreshed} premium users`);
    } catch (error) {
      console.error('❌ Failed to refresh monthly freezes:', error);
    }
  });

  // Health check every hour
  cron.schedule('0 * * * *', () => {
    const now = new Date().toISOString();
    console.log(`💚 Cron health check: ${now}`);
    
    // Could add more health metrics here
    // - Check database connection
    // - Check Redis connection
    // - Check API response times
  });

  console.log('✅ Cron jobs initialized:');
  console.log('  - Daily streak reset: 0 0 * * * (midnight UTC)');
  console.log('  - Monthly freeze refresh: 1 0 1 * * (00:01 on 1st of month)');
  console.log('  - Health check: 0 * * * * (every hour)');
}

export default {
  initializeCronJobs,
};
