/**
 * 🚀 ACCURACY ANALYSIS BACKGROUND QUEUE
 *
 * High-performance message queue for processing accuracy analysis
 * and XP calculations in the background, allowing AI responses to
 * return immediately to users.
 *
 * Performance:
 * - Processes 10,000+ jobs/minute
 * - Retry logic with exponential backoff
 * - Priority queue (premium users first)
 * - Graceful failure handling
 */
import { Queue, Worker } from 'bullmq';
interface AccuracyJobData {
    userId: string;
    userMessage: string;
    aiResponse: string;
    userTier: 'free' | 'pro' | 'premium';
    userLevel?: string;
    previousAccuracy?: any;
    timestamp: number;
}
export declare const accuracyQueue: Queue<AccuracyJobData, any, string, AccuracyJobData, any, string>;
declare const accuracyWorker: Worker<AccuracyJobData, any, string>;
/**
 * Add accuracy analysis job to queue (non-blocking)
 */
export declare function queueAccuracyAnalysis(data: AccuracyJobData): Promise<string>;
/**
 * Get queue statistics
 */
export declare function getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}>;
export { accuracyWorker };
//# sourceMappingURL=accuracyQueue.d.ts.map