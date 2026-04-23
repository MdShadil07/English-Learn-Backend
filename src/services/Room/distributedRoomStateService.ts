import { Types } from 'mongoose';
import { redisCache } from '../../config/redis.js';
import { Room } from '../../models/index.js';
import { logSocketError } from '../WebSocket/utils/errorHandler.js';

class DistributedRoomStateService {
  private localRoomUsers: Map<string, Set<string>> = new Map();
  private localCallUsers: Map<string, Set<string>> = new Map();
  private readonly roomStateTTLSeconds = Number(process.env.ROOM_STATE_TTL_SECONDS || 6 * 60 * 60);

  private getRedisRoomUsersKey(roomId: string): string {
    return `rooms:state:${roomId}:users`;
  }

  private getRedisCallUsersKey(roomId: string): string {
    return `rooms:state:${roomId}:call-users`;
  }

  async validateRoomExists(roomId: string): Promise<boolean> {
    try {
      const room = await Room.findOne({ roomId, status: 'active' }).select('_id');
      return Boolean(room);
    } catch (error) {
      logSocketError('validateRoomExists failed', error, { roomId });
      return false;
    }
  }

  async validateUserCanJoinRoom(roomId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;

    try {
      const room = await Room.findOne({ roomId, status: 'active' }).select('hostId participants');
      if (!room) return false;

      const userObjectId = new Types.ObjectId(userId);
      return room.hostId.equals(userObjectId) || room.participants.some((id: Types.ObjectId) => id.equals(userObjectId));
    } catch (error) {
      logSocketError('validateUserCanJoinRoom failed', error, { roomId, userId });
      return false;
    }
  }

  async addUserToRoom(roomId: string, userId: string): Promise<void> {
    const redisKey = this.getRedisRoomUsersKey(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        await client.sadd(redisKey, userId);
        await client.expire(redisKey, this.roomStateTTLSeconds);
        return;
      } catch (error) {
        logSocketError('redis addUserToRoom failed; using local fallback', error, { roomId, userId });
      }
    }

    const users = this.localRoomUsers.get(roomId) || new Set<string>();
    users.add(userId);
    this.localRoomUsers.set(roomId, users);
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    const redisKey = this.getRedisRoomUsersKey(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        await client.srem(redisKey, userId);
        return;
      } catch (error) {
        logSocketError('redis removeUserFromRoom failed; using local fallback', error, { roomId, userId });
      }
    }

    const users = this.localRoomUsers.get(roomId);
    if (!users) return;
    users.delete(userId);
    if (users.size === 0) {
      this.localRoomUsers.delete(roomId);
    }
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    const redisKey = this.getRedisRoomUsersKey(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        return await client.smembers(redisKey);
      } catch (error) {
        logSocketError('redis getRoomUsers failed; using local fallback', error, { roomId });
      }
    }

    return Array.from(this.localRoomUsers.get(roomId) || []);
  }

  async addUserToCall(roomId: string, userId: string): Promise<void> {
    const redisKey = this.getRedisCallUsersKey(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        await client.sadd(redisKey, userId);
        await client.expire(redisKey, this.roomStateTTLSeconds);
        return;
      } catch (error) {
        logSocketError('redis addUserToCall failed; using local fallback', error, { roomId, userId });
      }
    }

    const users = this.localCallUsers.get(roomId) || new Set<string>();
    users.add(userId);
    this.localCallUsers.set(roomId, users);
  }

  async removeUserFromCall(roomId: string, userId: string): Promise<void> {
    const redisKey = this.getRedisCallUsersKey(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        await client.srem(redisKey, userId);
        return;
      } catch (error) {
        logSocketError('redis removeUserFromCall failed; using local fallback', error, { roomId, userId });
      }
    }

    const users = this.localCallUsers.get(roomId);
    if (!users) return;
    users.delete(userId);
    if (users.size === 0) {
      this.localCallUsers.delete(roomId);
    }
  }

  async getCallUsers(roomId: string): Promise<string[]> {
    const redisKey = this.getRedisCallUsersKey(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        return await client.smembers(redisKey);
      } catch (error) {
        logSocketError('redis getCallUsers failed; using local fallback', error, { roomId });
      }
    }

    return Array.from(this.localCallUsers.get(roomId) || []);
  }
}

export const distributedRoomStateService = new DistributedRoomStateService();
export default distributedRoomStateService;
