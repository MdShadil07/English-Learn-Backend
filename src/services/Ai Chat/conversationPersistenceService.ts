import mongoose from 'mongoose';
import AIChatConversation from '../../models/AIChatConversation.js';
import AIChatMessageBatch, { IAIChatStoredMessage } from '../../models/AIChatMessageBatch.js';
import {
  AIChatConversationTurnJobData,
  isAIChatQueueAvailable,
  queueAIChatConversationTurn,
} from '../../queues/aiChatConversationQueue.js';

interface QueueTurnInput {
  userId: string;
  conversationId: string;
  personalityId: string;
  title: string;
  messages: IAIChatStoredMessage[];
}

const MAX_MESSAGES_PER_BATCH = Number(process.env.AI_CHAT_BATCH_MAX_MESSAGES || 20);

class ConversationPersistenceService {
  async queueTurn(input: QueueTurnInput): Promise<{ queued: boolean; fallbackPersisted: boolean; writtenMessages?: number }> {
    const sanitizedMessages = this.sanitizeMessages(input.messages, input.personalityId);
    if (!sanitizedMessages.length) {
      return { queued: false, fallbackPersisted: false, writtenMessages: 0 };
    }

    const jobData: AIChatConversationTurnJobData = {
      userId: input.userId,
      conversationId: input.conversationId,
      personalityId: input.personalityId,
      title: input.title,
      messages: sanitizedMessages,
      queuedAt: Date.now(),
    };

    if (isAIChatQueueAvailable()) {
      await queueAIChatConversationTurn(jobData);
      return { queued: true, fallbackPersisted: false };
    }

    console.warn('⚠️ Redis unavailable; persisting AI chat turn synchronously as a no-loss fallback');
    const writtenMessages = await this.persistTurn(jobData);
    return { queued: false, fallbackPersisted: true, writtenMessages };
  }

  async listConversations(userId: string, limit = 50) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = await AIChatConversation.find({
      userId: userObjectId,
      status: 'active',
    })
      .sort({ lastMessageAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean();

    return Promise.all(
      conversations.map(async (conversation) => {
        const recentMessages = await this.getMessages(userId, conversation.conversationId, 40);
        return {
          conversationId: conversation.conversationId,
          personalityId: conversation.personalityId,
          title: conversation.title,
          messageCount: conversation.messageCount,
          lastMessagePreview: conversation.lastMessagePreview,
          lastMessageAt: conversation.lastMessageAt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: recentMessages,
        };
      })
    );
  }

  async getMessages(userId: string, conversationId: string, limit = 500): Promise<IAIChatStoredMessage[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const batches = await AIChatMessageBatch.find({
      userId: userObjectId,
      conversationId,
    })
      .sort({ sequenceStart: 1 })
      .lean();

    const messages = batches.flatMap((batch) => batch.messages);
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    return messages.slice(Math.max(messages.length - safeLimit, 0));
  }

  async persistTurn(input: AIChatConversationTurnJobData): Promise<number> {
    const userObjectId = new mongoose.Types.ObjectId(input.userId);
    const messages = this.sanitizeMessages(input.messages, input.personalityId);
    if (!messages.length) return 0;

    const chunks = this.chunkMessages(messages, MAX_MESSAGES_PER_BATCH);
    const existing = await AIChatConversation.findOne({
      userId: userObjectId,
      conversationId: input.conversationId,
    })
      .select('messageCount')
      .lean();

    let sequence = existing?.messageCount || 0;
    const batchDocs = chunks.map((chunk) => {
      const sequenceStart = sequence;
      sequence += chunk.length;

      return {
        userId: userObjectId,
        conversationId: input.conversationId,
        personalityId: input.personalityId,
        sequenceStart,
        sequenceEnd: sequence - 1,
        messages: chunk,
      };
    });

    if (batchDocs.length) {
      await AIChatMessageBatch.insertMany(batchDocs, { ordered: true });
    }

    const lastMessage = messages[messages.length - 1];
    await AIChatConversation.updateOne(
      {
        userId: userObjectId,
        conversationId: input.conversationId,
      },
      {
        $setOnInsert: {
          userId: userObjectId,
          conversationId: input.conversationId,
          createdAt: new Date(),
        },
        $set: {
          personalityId: input.personalityId,
          title: input.title || this.buildFallbackTitle(lastMessage?.content),
          status: 'active',
          lastMessagePreview: this.preview(lastMessage?.content || ''),
          lastMessageAt: lastMessage?.timestamp || new Date(),
        },
        $inc: {
          messageCount: messages.length,
        },
      },
      { upsert: true }
    );

    return messages.length;
  }

  private sanitizeMessages(messages: IAIChatStoredMessage[], fallbackPersonalityId: string): IAIChatStoredMessage[] {
    return messages
      .filter((message) => message.content?.trim())
      .map((message) => ({
        messageId: message.messageId,
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp),
        personalityId: message.personalityId || fallbackPersonalityId,
      }));
  }

  private chunkMessages(messages: IAIChatStoredMessage[], chunkSize: number): IAIChatStoredMessage[][] {
    const chunks: IAIChatStoredMessage[][] = [];
    for (let index = 0; index < messages.length; index += chunkSize) {
      chunks.push(messages.slice(index, index + chunkSize));
    }
    return chunks;
  }

  private preview(content: string): string {
    return content.replace(/\s+/g, ' ').trim().slice(0, 220);
  }

  private buildFallbackTitle(content?: string): string {
    const preview = this.preview(content || '');
    return preview ? preview.slice(0, 80) : 'AI Chat';
  }
}

export const conversationPersistenceService = new ConversationPersistenceService();
