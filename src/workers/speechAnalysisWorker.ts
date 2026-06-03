import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PronunciationService, SpeechAnalysisJobData } from '../services/Pronunciation/pronunciationService.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new (Redis as any)(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

let speechAnalysisWorker: Worker | null = null;

// Singleton service instance shared across all jobs to avoid:
// 1. Re-reading the CMU dictionary (5MB) from disk on every job
// 2. Re-initializing the lexicon service on every job
// 3. Excessive memory allocation from duplicate service instances
const sharedService = new PronunciationService();

export async function createSpeechAnalysisWorker() {
  if (speechAnalysisWorker) {
    return speechAnalysisWorker;
  }

  // Scale for 20k concurrent: 100 concurrent per worker requires 200 workers
  // For lower-scale deployments, this can be reduced to 5-20
  const concurrency = parseInt(process.env.PRONUNCIATION_WORKER_CONCURRENCY || '100', 10);
  const jobTimeoutMs = parseInt(process.env.PRONUNCIATION_JOB_TIMEOUT_MS || '90000', 10);

  speechAnalysisWorker = new Worker<SpeechAnalysisJobData>(
    'speech-analysis',
    async (job: Job<SpeechAnalysisJobData>) => {
      console.log(`🔄 [SpeechWorker ${job.id}] Starting analysis for attempt ${job.data.attemptId}`);
      const abortController = new AbortController();
      const workerId = `speech-worker:${process.pid}`;
      const timeoutHandle = setTimeout(() => {
        abortController.abort(new Error(`Pronunciation analysis timed out after ${jobTimeoutMs / 1000}s`));
      }, jobTimeoutMs);

      try {
        return await sharedService.processSpeechAnalysisJob(job.data.attemptId, job.data, {
          signal: abortController.signal,
          workerId,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
    {
      connection: redisConnection,
      concurrency,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  speechAnalysisWorker.on('completed', (job) => {
    console.log(`✅ Speech analysis job ${job.id} completed`);
  });

  speechAnalysisWorker.on('failed', (job, err) => {
    console.error(`❌ Speech analysis job ${job?.id} failed:`, err?.message || err);
  });

  speechAnalysisWorker.on('error', (err) => {
    console.error('❌ Speech analysis worker error:', err);
  });

  console.log(`🎙️ Speech analysis worker started (concurrency: ${concurrency}, timeout: ${jobTimeoutMs / 1000}s)`);
  return speechAnalysisWorker;
}

export async function shutdownSpeechAnalysisWorker() {
  try {
    if (speechAnalysisWorker) {
      await speechAnalysisWorker.close();
    }
    await redisConnection.quit();
    console.log('✅ Speech analysis worker shut down');
  } catch (error) {
    console.error('❌ Error shutting down speech analysis worker', error);
  }
}
