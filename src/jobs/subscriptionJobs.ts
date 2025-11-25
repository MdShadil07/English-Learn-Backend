import cron from 'node-cron';
import subscriptionService from '../services/Subscription/subscriptionService.js';

/**
 * Schedule subscription expiration check
 * Runs every hour to check and revoke expired subscriptions
 */
export function scheduleSubscriptionExpirationCheck(): void {
  try {
    // Run every hour at the start of the hour
    cron.schedule('0 * * * *', async () => {
      console.log('[Cron] Running subscription expiration check...');
      try {
        const revokedUsers = await subscriptionService.revokeExpiredSubscriptions();
        if (revokedUsers.length > 0) {
          console.log(`[Cron] Revoked subscriptions for ${revokedUsers.length} users`);
        }
      } catch (error) {
        console.error('[Cron] Error in subscription expiration check:', error);
      }
    });

    console.log('✅ Subscription expiration check scheduled (every hour)');
  } catch (error) {
    console.error('Error scheduling subscription expiration check:', error);
  }
}

/**
 * Initialize all scheduled tasks
 */
export function initializeScheduledTasks(): void {
  scheduleSubscriptionExpirationCheck();
}
