import { Job, Worker } from 'bullmq';
import {
  AI_CHAT_CONVERSATION_QUEUE,
  AIChatConversationTurnJobData,
  aiChatConversationQueueConnection,
} from '../queues/aiChatConversationQueue.js';
import { conversationPersistenceService } from '../services/Ai Chat/conversationPersistenceService.js';

let aiChatConversationWorker: Worker<AIChatConversationTurnJobData> | null = null;

export function createAIChatConversationPersistenceWorker(): Worker<AIChatConversationTurnJobData> {
  if (aiChatConversationWorker) {
    return aiChatConversationWorker;
  }

  aiChatConversationWorker = new Worker<AIChatConversationTurnJobData>(
    AI_CHAT_CONVERSATION_QUEUE,
    async (job: Job<AIChatConversationTurnJobData>) => {
      const start = Date.now();
      const writtenMessages = await conversationPersistenceService.persistTurn(job.data);
      const duration = Date.now() - start;

      return {
        success: true,
        writtenMessages,
        duration,
      };
    },
    {
      connection: aiChatConversationQueueConnection,
      concurrency: Number(process.env.AI_CHAT_PERSISTENCE_WORKER_CONCURRENCY || 25),
      limiter: {
        max: Number(process.env.AI_CHAT_PERSISTENCE_WORKER_MAX_PER_SECOND || 500),
        duration: 1000,
      },
    }
  );

  aiChatConversationWorker.on('completed', (job) => {
    console.log(`✅ AI chat persistence job completed: ${job.id}`);
  });

  aiChatConversationWorker.on('failed', (job, error) => {
    console.error(`❌ AI chat persistence job failed: ${job?.id} attempt=${job?.attemptsMade}`, error);
  });

  aiChatConversationWorker.on('error', (error) => {
    console.error('❌ AI chat persistence worker error:', error);
  });

  console.log('✅ AI chat conversation persistence worker initialized');
  return aiChatConversationWorker;
}

export async function shutdownAIChatConversationPersistenceWorker(): Promise<void> {
  if (aiChatConversationWorker) {
    await aiChatConversationWorker.close();
    aiChatConversationWorker = null;
  }
}
