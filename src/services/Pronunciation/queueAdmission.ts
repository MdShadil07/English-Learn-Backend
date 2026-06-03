import { speechAnalysisQueue } from '../../queues/speechAnalysisQueue.js';

export class QueueBackpressureError extends Error {
  code = 'QUEUE_BACKPRESSURE';
  statusCode = 429;
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'QueueBackpressureError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Scale for 20k concurrent: 100 concurrent per worker × 200 workers = 20k active
// Allow extra buffer for peak spikes
const DEFAULT_MAX_WAITING = parseInt(process.env.SPEECH_QUEUE_MAX_WAITING || '22000', 10);
const DEFAULT_MAX_ACTIVE = parseInt(process.env.SPEECH_QUEUE_MAX_ACTIVE || '20000', 10);
const DEFAULT_MAX_BACKLOG = parseInt(process.env.SPEECH_QUEUE_MAX_BACKLOG || '25000', 10);

export async function getSpeechQueueSnapshot() {
  const counts = await speechAnalysisQueue.getJobCounts('waiting', 'active', 'delayed', 'paused', 'completed', 'failed');
  const waiting = counts.waiting || 0;
  const active = counts.active || 0;
  const delayed = counts.delayed || 0;
  const backlog = waiting + active + delayed;

  return {
    waiting,
    active,
    delayed,
    backlog,
    estimatedWaitSeconds: Math.max(5, Math.ceil(backlog / Math.max(1, DEFAULT_MAX_ACTIVE)) * 15),
  };
}

export async function ensureSpeechQueueCapacity() {
  const snapshot = await getSpeechQueueSnapshot();

  if (snapshot.waiting >= DEFAULT_MAX_WAITING || snapshot.backlog >= DEFAULT_MAX_BACKLOG || snapshot.active >= DEFAULT_MAX_ACTIVE) {
    throw new QueueBackpressureError(
      `Speech analysis queue is overloaded. Estimated wait is about ${snapshot.estimatedWaitSeconds} seconds. Please retry shortly.`,
      snapshot.estimatedWaitSeconds
    );
  }

  return snapshot;
}
