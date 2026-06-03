import { redisCache } from '../../config/redis.js';
import { Queue } from 'bullmq';

interface JoinResult {
  allowed: boolean;
  queued?: boolean;
  retryAfterMs?: number;
  reason?: string;
  position?: number;
}

export class HotRoomProtectionService {
  private readonly RATE_LIMIT_WINDOW = 10; // seconds
  private readonly MAX_JOINS_PER_WINDOW = 50; // max 50 joins per 10s per room
  public joinQueue: Queue | null = null;

  /**
   * Evaluates if a user is allowed to join the room based on current traffic.
   * Uses Redis to track join rates per room.
   */
  public async canJoinRoom(roomId: string, userId: string): Promise<JoinResult> {
    const key = `room_joins:${roomId}`;
    
    try {
      const client = redisCache.getClient();
      if (!client) {
        // If Redis is down, allow join but maybe log a warning
        console.warn('Redis is unavailable, bypassing hot room protection.');
        return { allowed: true };
      }

      // Initialize queue lazily to ensure redis connection is established
      if (!this.joinQueue) {
        this.joinQueue = new Queue('room-join-queue', { 
          connection: redisCache.createBullMQClient() 
        });
      }

      const currentCount = await client.incr(key);
      
      // Set expiry on the first increment
      if (currentCount === 1) {
        await client.expire(key, this.RATE_LIMIT_WINDOW);
      }

      if (currentCount > this.MAX_JOINS_PER_WINDOW) {
        console.warn(`[Hot Room Protection] Join storm detected in room ${roomId}. Queuing join for user ${userId}.`);
        
        const job = await this.joinQueue.add('room-join', { roomId, userId }, {
          removeOnComplete: true,
          removeOnFail: true,
        });

        // Get approximate queue position based on waiting jobs
        const waitingCount = await this.joinQueue.getWaitingCount();

        return { 
          allowed: false, 
          queued: true,
          position: waitingCount,
          retryAfterMs: this.RATE_LIMIT_WINDOW * 1000,
          reason: 'Room is currently experiencing heavy traffic. You have been placed in the join queue.'
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error in HotRoomProtectionService:', error);
      // Failsafe: allow join if error occurs
      return { allowed: true };
    }
  }

  /**
   * Staggers subscriptions by returning a recommended delay before subscribing to a consumer.
   */
  public getSubscriptionDelay(currentRoomOccupancy: number): number {
    // If room is small, no delay
    if (currentRoomOccupancy < 20) return 0;
    
    // If room is large, introduce a random jitter delay to prevent thundering herd
    // Delay between 500ms to 2500ms
    return Math.floor(Math.random() * 2000) + 500;
  }
}

export const hotRoomProtectionService = new HotRoomProtectionService();
export default hotRoomProtectionService;
