import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import redisCache from '../config/redis.js';
import { IAIChatStoredMessage } from '../models/AIChatMessageBatch.js';

export interface AIChatConversationTurnJobData {
  userId: string;
  conversationId: string;
  personalityId: string;
  title: string;
  messages: IAIChatStoredMessage[];
  queuedAt: number;
}

export const AI_CHAT_CONVERSATION_QUEUE = 'ai-chat-conversation-persistence';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 5000,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (_err: any) => true,
};

export const aiChatConversationQueueConnection = new (Redis as any)(redisUrl, redisOptions);

// Attach safe event handlers to avoid unhandled 'error' events
aiChatConversationQueueConnection.on('error', (err: any) => {
  console.error('[Redis:aiChatConversationQueue] error', err);
});
aiChatConversationQueueConnection.on('connect', () => {
  console.log('[Redis:aiChatConversationQueue] connect');
});
aiChatConversationQueueConnection.on('close', () => {
  console.log('[Redis:aiChatConversationQueue] connection closed');
});

export const aiChatConversationQueue = new Queue<AIChatConversationTurnJobData>(AI_CHAT_CONVERSATION_QUEUE, {
  connection: aiChatConversationQueueConnection,
  defaultJobOptions: {
    attempts: Number(process.env.AI_CHAT_PERSISTENCE_ATTEMPTS || 5),
    backoff: {
      type: 'exponential',
      delay: Number(process.env.AI_CHAT_PERSISTENCE_BACKOFF_MS || 2000),
    },
    removeOnComplete: {
      count: Number(process.env.AI_CHAT_PERSISTENCE_COMPLETED_KEEP || 1000),
      age: Number(process.env.AI_CHAT_PERSISTENCE_COMPLETED_AGE_SECONDS || 24 * 3600),
    },
    removeOnFail: {
      count: Number(process.env.AI_CHAT_PERSISTENCE_FAILED_KEEP || 5000),
      age: Number(process.env.AI_CHAT_PERSISTENCE_FAILED_AGE_SECONDS || 7 * 24 * 3600),
    },
  },
});

export const isAIChatQueueAvailable = () => redisCache.isConnected() && Boolean(redisCache.getClient());

export async function queueAIChatConversationTurn(data: AIChatConversationTurnJobData): Promise<Job<AIChatConversationTurnJobData>> {
  const jobId = `${data.userId}-${data.conversationId}-${data.messages.map((message) => message.messageId).join('-')}`;

  return aiChatConversationQueue.add('persist-turn', data, {
    jobId,
  });
}

export async function getAIChatConversationQueueStats() {
  if (!isAIChatQueueAvailable()) {
    return {
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      redisAvailable: false,
    };
  }

  const [waiting, active, delayed, completed, failed] = await Promise.all([
    aiChatConversationQueue.getWaitingCount(),
    aiChatConversationQueue.getActiveCount(),
    aiChatConversationQueue.getDelayedCount(),
    aiChatConversationQueue.getCompletedCount(),
    aiChatConversationQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
    redisAvailable: true,
  };
}

export async function shutdownAIChatConversationQueue(): Promise<void> {
  await aiChatConversationQueue.close();
  await aiChatConversationQueueConnection.quit();
}
