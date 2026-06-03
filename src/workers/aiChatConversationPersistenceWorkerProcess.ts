import dotenv from 'dotenv';
import { database } from '../config/database.js';
import { redisCache } from '../config/redis.js';
import {
  createAIChatConversationPersistenceWorker,
  shutdownAIChatConversationPersistenceWorker,
} from './aiChatConversationPersistenceWorker.js';
import { shutdownAIChatConversationQueue } from '../queues/aiChatConversationQueue.js';

dotenv.config();

async function bootstrap() {
  try {
    await database.connect();
    await redisCache.connect();

    if (!redisCache.isConnected()) {
      throw new Error('Redis is required for standalone AI chat conversation persistence worker');
    }

    createAIChatConversationPersistenceWorker();
    console.log('💬 Standalone AI chat conversation persistence worker process started');
  } catch (error) {
    console.error('❌ Failed to start standalone AI chat conversation persistence worker', error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`🛑 Received ${signal}. Shutting down AI chat persistence worker...`);

  try {
    await shutdownAIChatConversationPersistenceWorker();
    await shutdownAIChatConversationQueue();
    await redisCache.disconnect();
    await database.disconnect();
  } catch (error) {
    console.error('❌ Error during AI chat persistence worker shutdown', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
