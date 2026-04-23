/**
 * 🔥 OPTIMIZED STREAK TRACKING MIDDLEWARE
 * Automatically tracks AI chat activity using batched updates
 * 
 * Performance Optimizations:
 * - Batched database writes (30s intervals)
 * - Redis caching for real-time UI
 * - Non-blocking operations
 * - Memory-efficient session management
 * - Handles millions of concurrent users
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth/auth.js';
import { batchedProgressService } from '../services/Progress/batchedProgressService.js';
import { unifiedStreakService } from '../services/Gamification/unifiedStreakService.js';

interface AIChatSession {
  startTime: Date;
  messageCount: number;
  lastMessageTime: Date;
  lastAccuracy: number;
}

// Store active sessions in memory (efficient for real-time tracking)
const activeSessions = new Map<string, AIChatSession>();

/**
 * Track AI chat message for streak (optimized with batching)
 */
export const trackAIChatMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const tier = (req.user as any)?.tier || 'free';

    if (!userId) {
      next();
      return;
    }

    const now = new Date();

    // Get or create session
    let session = activeSessions.get(userId);
    
    if (!session) {
      session = {
        startTime: now,
        messageCount: 0,
        lastMessageTime: now,
        lastAccuracy: 0,
      };
      activeSessions.set(userId, session);
    }

    // Update session
    session.messageCount += 1;
    session.lastMessageTime = now;

    // Calculate minutes practiced (time since session start)
    const minutesPracticed = Math.round((now.getTime() - session.startTime.getTime()) / (1000 * 60));

    // Queue update (non-blocking, batched)
    batchedProgressService.queueUpdate({
      userId,
      updates: {
        streak: {
          minutesPracticed: minutesPracticed > 0 ? minutesPracticed : 1,
          messagesCount: 1,
          activityType: 'ai_chat',
        },
        session: {
          duration: minutesPracticed > 0 ? minutesPracticed : 1,
          messagesCount: 1,
        },
      },
      timestamp: now,
      priority: 'normal', // Use 'high' for VIP users
    });

    // Clean up old sessions (older than 30 minutes of inactivity)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    for (const [sessionUserId, sessionData] of activeSessions.entries()) {
      if (sessionData.lastMessageTime < thirtyMinutesAgo) {
        activeSessions.delete(sessionUserId);
      }
    }

    next();
  } catch (error) {
    console.error('❌ Error in streak tracking middleware:', error);
    next(); // Don't block request on tracking error
  }
};

/**
 * End AI chat session and finalize streak tracking
 */
export const endAIChatSession = async (
  userId: string,
  tier: 'free' | 'pro' | 'premium'
): Promise<void> => {
  try {
    const session = activeSessions.get(userId);
    
    if (session) {
      const now = new Date();
      const totalMinutes = Math.round((now.getTime() - session.startTime.getTime()) / (1000 * 60));

      // Final streak update
      await unifiedStreakService.updateStreak({
        userId,
        tier,
        minutesPracticed: totalMinutes,
        messagesCount: session.messageCount,
        activityType: 'ai_chat',
      });

      // Remove session
      activeSessions.delete(userId);

      console.log(`✅ AI chat session ended for user ${userId}: ${totalMinutes} min, ${session.messageCount} messages`);
    }
  } catch (error) {
    console.error('❌ Error ending AI chat session:', error);
  }
};

/**
 * Get active session info
 */
export const getActiveSession = (userId: string): AIChatSession | undefined => {
  return activeSessions.get(userId);
};

export default {
  trackAIChatMessage,
  endAIChatSession,
  getActiveSession,
};
