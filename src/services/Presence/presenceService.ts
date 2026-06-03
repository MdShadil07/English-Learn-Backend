import { redisCache } from '../../config/redis.js';
import User from '../../models/User.js';

class PresenceService {
  private readonly ONLINE_SET_KEY = 'presence:online_users';
  private readonly SOCKET_COUNT_KEY = 'presence:socket_counts';
  
  // Fallback for when Redis is unavailable
  private fallbackMemoryMap = new Map<string, number>();

  /**
   * Called when a user's WebSocket connects.
   */
  public async userConnected(userId: string): Promise<void> {
    try {
      if (redisCache && redisCache.isConnected()) {
        const client = redisCache.getClient();
        if (client) {
          // Increment the number of active socket connections for this user
          const count = await client.hincrby(this.SOCKET_COUNT_KEY, userId, 1);
          
          if (count === 1) {
            // First device connected, mark as online
            await client.sadd(this.ONLINE_SET_KEY, userId);
            
            // Optionally: broadcast global "online" event here if needed
          }
        } else {
          this.fallbackMemoryMap.set(userId, (this.fallbackMemoryMap.get(userId) || 0) + 1);
        }
      } else {
        this.fallbackMemoryMap.set(userId, (this.fallbackMemoryMap.get(userId) || 0) + 1);
      }
    } catch (err) {
      console.warn('[PresenceService] Failed to record user connection in Redis', err);
      this.fallbackMemoryMap.set(userId, (this.fallbackMemoryMap.get(userId) || 0) + 1);
    }
  }

  /**
   * Called when a user's WebSocket disconnects.
   */
  public async userDisconnected(userId: string): Promise<void> {
    try {
      if (redisCache && redisCache.isConnected()) {
        const client = redisCache.getClient();
        if (client) {
          const count = await client.hincrby(this.SOCKET_COUNT_KEY, userId, -1);
          
          if (count <= 0) {
            // All devices disconnected, mark as offline
            await client.hdel(this.SOCKET_COUNT_KEY, userId);
            await client.srem(this.ONLINE_SET_KEY, userId);
            
            // Save "last seen" to DB
            this.updateLastSeen(userId);
          }
        } else {
          this.fallbackHandleDisconnect(userId);
        }
      } else {
        this.fallbackHandleDisconnect(userId);
      }
    } catch (err) {
      console.warn('[PresenceService] Failed to record user disconnection in Redis', err);
      this.fallbackHandleDisconnect(userId);
    }
  }
  
  private fallbackHandleDisconnect(userId: string) {
    const current = (this.fallbackMemoryMap.get(userId) || 0) - 1;
    if (current <= 0) {
      this.fallbackMemoryMap.delete(userId);
      this.updateLastSeen(userId);
    } else {
      this.fallbackMemoryMap.set(userId, current);
    }
  }

  /**
   * Update the user's lastActiveAt field in the database (Last Seen).
   */
  private updateLastSeen(userId: string): void {
    User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } })
      .catch(err => console.warn('[PresenceService] Failed to update User.lastActiveAt in MongoDB', err));
  }

  /**
   * Get the exact count of currently connected users.
   */
  public async getOnlineUsersCount(): Promise<number> {
    try {
      if (redisCache && redisCache.isConnected()) {
        const client = redisCache.getClient();
        if (client) {
          return await client.scard(this.ONLINE_SET_KEY);
        }
      }
    } catch (err) {
      console.warn('[PresenceService] Failed to query Redis for online users count', err);
    }

    // Fallback to memory map
    return this.fallbackMemoryMap.size;
  }
}

export const presenceService = new PresenceService();
