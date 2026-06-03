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
    retryStrategy: (times) => Math.min(times * 50, 2000),
    reconnectOnError: (_err) => true,
};
const connection = new IORedis(redisUrl, redisOptions);
connection.on('error', (err) => {
    console.error('[Redis:subscriptionQueue] error', err);
});
connection.on('connect', () => console.log('[Redis:subscriptionQueue] connect'));
connection.on('close', () => console.log('[Redis:subscriptionQueue] connection closed'));
export const subscriptionQueue = new Queue('subscription-tasks', { connection });
export async function addExpireJob(subscriptionId, delayMs) {
    return subscriptionQueue.add('expire-subscription', { subscriptionId }, { delay: delayMs, attempts: 3, removeOnComplete: true, removeOnFail: false });
}
export async function addRetryJob(subscriptionId, attempt, delayMs) {
    return subscriptionQueue.add('retry-payment', { subscriptionId, attempt }, { delay: delayMs, attempts: 1, removeOnComplete: true, removeOnFail: false });
}
export default subscriptionQueue;
//# sourceMappingURL=subscriptionQueue.js.map