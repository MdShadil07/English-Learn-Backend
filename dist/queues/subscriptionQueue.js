import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
export const subscriptionQueue = new Queue('subscription-tasks', { connection });
export async function addExpireJob(subscriptionId, delayMs) {
    return subscriptionQueue.add('expire-subscription', { subscriptionId }, { delay: delayMs, attempts: 3, removeOnComplete: true, removeOnFail: false });
}
export async function addRetryJob(subscriptionId, attempt, delayMs) {
    return subscriptionQueue.add('retry-payment', { subscriptionId, attempt }, { delay: delayMs, attempts: 1, removeOnComplete: true, removeOnFail: false });
}
export default subscriptionQueue;
//# sourceMappingURL=subscriptionQueue.js.map