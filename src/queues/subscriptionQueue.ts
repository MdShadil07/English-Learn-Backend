import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 5000,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (_err: any) => true,
};

const connection = new (IORedis as any)(redisUrl, redisOptions);

connection.on('error', (err: any) => {
  console.error('[Redis:subscriptionQueue] error', err);
});
connection.on('connect', () => console.log('[Redis:subscriptionQueue] connect'));
connection.on('close', () => console.log('[Redis:subscriptionQueue] connection closed'));

export const subscriptionQueue = new Queue('subscription-tasks', { connection } );

export async function addExpireJob(subscriptionId: string, delayMs: number) {
  return subscriptionQueue.add('expire-subscription', { subscriptionId }, { delay: delayMs, attempts: 3, removeOnComplete: true, removeOnFail: false });
}

export async function addRetryJob(subscriptionId: string, attempt: number, delayMs: number) {
  return subscriptionQueue.add('retry-payment', { subscriptionId, attempt }, { delay: delayMs, attempts: 1, removeOnComplete: true, removeOnFail: false });
}

export default subscriptionQueue;
