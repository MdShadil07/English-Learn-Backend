import { Queue } from 'bullmq';
export declare const subscriptionQueue: Queue<any, any, string, any, any, string>;
export declare function addExpireJob(subscriptionId: string, delayMs: number): Promise<import("bullmq").Job<any, any, string>>;
export declare function addRetryJob(subscriptionId: string, attempt: number, delayMs: number): Promise<import("bullmq").Job<any, any, string>>;
export default subscriptionQueue;
//# sourceMappingURL=subscriptionQueue.d.ts.map