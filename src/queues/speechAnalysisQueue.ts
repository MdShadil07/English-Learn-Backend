import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 5000,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (_err: any) => true,
};

const redisConnection = new (Redis as any)(redisUrl, redisOptions);

redisConnection.on('error', (err: any) => console.error('[Redis:speechAnalysisQueue] error', err));
redisConnection.on('connect', () => console.log('[Redis:speechAnalysisQueue] connect'));
redisConnection.on('close', () => console.log('[Redis:speechAnalysisQueue] connection closed'));

export interface SpeechAnalysisJobData {
  attemptId: string;
  userId: string;
  sessionId: string;
  passageId: string;
  audioUrl: string;
  audioObjectKey?: string;
  audioMimeType?: string;
  transcript: string;
  metadata?: Record<string, unknown>;
  submittedAt: number;
}

export const speechAnalysisQueue = new Queue<SpeechAnalysisJobData>('speech-analysis', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 200,
      age: 3600,
    },
    removeOnFail: {
      count: 200,
      age: 86400,
    },
  },
});

export async function queueSpeechAnalysis(data: SpeechAnalysisJobData) {
  const job = await speechAnalysisQueue.add('analyze', data, {
    jobId: data.attemptId,
    priority: 2,
  });

  console.log(`📥 Speech analysis queued for attempt ${data.attemptId}`);
  return job.id;
}

export async function shutdownSpeechAnalysisQueue() {
  try {
    await speechAnalysisQueue.close();
    await redisConnection.quit();
    console.log('✅ Speech analysis queue shut down');
  } catch (error) {
    console.error('❌ Error shutting down speech analysis queue', error);
  }
}
