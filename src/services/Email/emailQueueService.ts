import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { sendEmail } from '../../utils/emailService.js';
import redisCache from '../../config/redis.js';

// Email job interface
interface EmailJobData {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
}

// Email queue configuration
const EMAIL_QUEUE_NAME = 'email-queue';

import { sharedBullmqConnection } from '../../config/sharedBullmqConnection.js';

// Create email queue
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: sharedBullmqConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
      age: 24 * 3600, // Remove jobs older than 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs for debugging
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
});

// Priority levels
export const EMAIL_PRIORITY = {
  HIGH: 1,    // Welcome emails, password resets
  NORMAL: 5,  // Regular notifications
  LOW: 10,    // Marketing emails, newsletters
};

// Check if Redis is available
const isRedisAvailable = () => redisCache.isConnected();

/**
 * Add email to queue with priority
 * Falls back to synchronous sending if Redis is not available
 */
export async function queueEmail(data: EmailJobData): Promise<Job<EmailJobData> | null> {
  // If Redis is not available, send email in background (fire-and-forget) to avoid blocking
  if (!isRedisAvailable() || !redisCache.getClient()) {
    console.log(`⚠️ Redis not available, sending email in background to: ${data.to}`);
    
    // Fire and forget
    sendEmail(data)
      .then(() => {
        console.log(`✅ Email sent in background to: ${data.to}`);
      })
      .catch((error) => {
        console.error(`❌ Failed to send email in background to: ${data.to}`, error);
      });
      
    return null;
  }

  const priority = data.priority === 'high' ? EMAIL_PRIORITY.HIGH :
                  data.priority === 'low' ? EMAIL_PRIORITY.LOW :
                  EMAIL_PRIORITY.NORMAL;

  const job = await emailQueue.add('send-email', data, {
    priority,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });

  console.log(`📧 Email queued: ${data.to} - Job ID: ${job.id} - Priority: ${data.priority || 'normal'}`);
  return job;
}

/**
 * Add bulk emails to queue for batch processing
 * Falls back to synchronous sending if Redis is not available
 */
export async function queueBulkEmails(emails: EmailJobData[]): Promise<(Job<EmailJobData> | null)[]> {
  // If Redis is not available, send emails in background (fire-and-forget) to avoid blocking
  if (!isRedisAvailable() || !emailQueue) {
    console.log(`⚠️ Redis not available, sending ${emails.length} emails in background`);
    
    for (const email of emails) {
      sendEmail(email)
        .then(() => {
          console.log(`✅ Email sent in background to: ${email.to}`);
        })
        .catch((error) => {
          console.error(`❌ Failed to send email in background to: ${email.to}`, error);
        });
    }
    
    return Array(emails.length).fill(null);
  }

  const jobs = await emailQueue.addBulk(
    emails.map((email, index) => ({
      name: 'send-email',
      data: email,
      opts: {
        priority: email.priority === 'high' ? EMAIL_PRIORITY.HIGH :
                email.priority === 'low' ? EMAIL_PRIORITY.LOW :
                EMAIL_PRIORITY.NORMAL,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000 + (index * 100), // Stagger delays for bulk emails
        },
      },
    }))
  );

  console.log(`📧 ${jobs.length} emails queued in bulk`);
  return jobs;
}

/**
 * Get queue statistics
 */
export async function getEmailQueueStats() {
  if (!isRedisAvailable() || !emailQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      redisAvailable: false,
    };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    emailQueue.getWaiting(),
    emailQueue.getActive(),
    emailQueue.getCompleted(),
    emailQueue.getFailed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    redisAvailable: true,
  };
}

/**
 * Email queue worker - processes emails in background
 * Only creates worker if Redis is available
 */
let activeWorker: Worker | null = null;
let activeWorkerRedis: any | null = null;

export async function createEmailWorker() {
  if (!isRedisAvailable()) {
    console.log('⚠️ Redis not available, email worker not started. Emails will be sent synchronously.');
    return null;
  }

  const workerRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  activeWorkerRedis = new (Redis as any)(workerRedisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  activeWorkerRedis.on('error', (error: any) => {
    console.error('Email Worker Redis connection error:', error?.message || error);
  });

  activeWorker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { to, subject, template, data, html, text } = job.data;

      try {
        console.log(`📧 Processing email job ${job.id}: ${to}`);

        await sendEmail({
          to,
          subject,
          template,
          data,
          html,
          text,
        });

        console.log(`✅ Email sent successfully: ${to} - Job ID: ${job.id}`);
      } catch (error) {
        console.error(`❌ Email send failed: ${to} - Job ID: ${job.id} - Attempt: ${job.attemptsMade + 1}`);
        throw error; // BullMQ will retry based on job options
      }
    },
    {
      connection: activeWorkerRedis,
      concurrency: 50, // Process 50 emails concurrently for high throughput
      limiter: {
        max: 5000, // Max 5000 emails per second
        duration: 1000, // 1 second
      },
    }
  );

  activeWorker.on('completed', (job) => {
    console.log(`✅ Email job completed: ${job.id}`);
  });

  activeWorker.on('failed', (job, error) => {
    console.error(`❌ Email job failed: ${job?.id} - ${error.message}`);
  });

  activeWorker.on('error', (error) => {
    console.error('Email worker error:', error);
  });

  console.log('🚀 Email queue worker started');
  return activeWorker;
}

/**
 * Graceful shutdown
 */
export async function shutdownEmailWorker() {
  if (activeWorker) {
    await activeWorker.close();
    activeWorker = null;
    console.log('Email worker shut down');
  }
  if (activeWorkerRedis) {
    await activeWorkerRedis.quit();
    activeWorkerRedis = null;
  }
}

export async function shutdownEmailQueue() {
  if (emailQueue) {
    await emailQueue.close();
    console.log('Email queue shut down');
  }
}

export default {
  queueEmail,
  queueBulkEmails,
  getEmailQueueStats,
  createEmailWorker,
  shutdownEmailQueue,
  shutdownEmailWorker,
};
