import { Queue } from 'bullmq';
import { sharedBullmqConnection } from '../config/sharedBullmqConnection.js';

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
  connection: sharedBullmqConnection,
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
    console.log('✅ Speech analysis queue shut down');
  } catch (error) {
    console.error('❌ Error shutting down speech analysis queue', error);
  }
}
