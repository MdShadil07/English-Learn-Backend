import { Types } from 'mongoose';
import { redisCache } from '../../config/redis.js';
import { Room } from '../../models/index.js';
import { logSocketError } from '../WebSocket/utils/errorHandler.js';
class DistributedRoomStateService {
    localRoomUsers = new Map();
    localCallUsers = new Map();
    localRoomMessages = new Map();
    roomStateTTLSeconds = Number(process.env.ROOM_STATE_TTL_SECONDS || 6 * 60 * 60);
    getRedisRoomUsersKey(roomId) {
        return `rooms:state:${roomId}:users`;
    }
    getRedisCallUsersKey(roomId) {
        return `rooms:state:${roomId}:call-users`;
    }
    getRedisRoomMessagesKey(roomId) {
        return `rooms:state:${roomId}:messages`;
    }
    getRedisRoomMetadataKey(roomId) {
        return `rooms:state:${roomId}:metadata`;
    }
    async getRoomMetadata(roomId) {
        const redisKey = this.getRedisRoomMetadataKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                const cached = await client.get(redisKey);
                if (cached)
                    return JSON.parse(cached);
            }
            catch (error) {
                logSocketError('redis getRoomMetadata failed', error, { roomId });
            }
        }
        // Fallback to MongoDB if cache miss
        try {
            const room = await Room.findOne({ roomId, status: 'active' }).select('hostId moderators');
            if (!room)
                return null;
            const metadata = {
                hostId: room.hostId.toString(),
                moderators: room.moderators.map((id) => id.toString())
            };
            if (redisCache.isConnected()) {
                try {
                    const client = redisCache.getClient();
                    await client.set(redisKey, JSON.stringify(metadata), 'EX', 300); // 5 min TTL
                }
                catch (error) {
                    logSocketError('redis setRoomMetadata failed', error, { roomId });
                }
            }
            return metadata;
        }
        catch (error) {
            logSocketError('mongodb getRoomMetadata failed', error, { roomId });
            return null;
        }
    }
    async invalidateRoomMetadata(roomId) {
        const redisKey = this.getRedisRoomMetadataKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.del(redisKey);
            }
            catch (error) {
                logSocketError('redis invalidateRoomMetadata failed', error, { roomId });
            }
        }
    }
    async validateRoomExists(roomId) {
        try {
            const room = await Room.findOne({ roomId, status: 'active' }).select('_id');
            return Boolean(room);
        }
        catch (error) {
            logSocketError('validateRoomExists failed', error, { roomId });
            return false;
        }
    }
    async validateUserCanJoinRoom(roomId, userId) {
        if (!Types.ObjectId.isValid(userId))
            return false;
        try {
            // Allow if they are host
            const metadata = await this.getRoomMetadata(roomId);
            if (metadata && metadata.hostId === userId)
                return true;
            // Import here to avoid circular dependency
            const { RoomParticipant } = await import('../../models/RoomParticipant.js');
            const isParticipant = await RoomParticipant.exists({ roomId, userId: new Types.ObjectId(userId) });
            return Boolean(isParticipant);
        }
        catch (error) {
            logSocketError('validateUserCanJoinRoom failed', error, { roomId, userId });
            return false;
        }
    }
    async isRoomHost(roomId, userId) {
        if (!Types.ObjectId.isValid(userId))
            return false;
        const metadata = await this.getRoomMetadata(roomId);
        return metadata ? metadata.hostId === userId : false;
    }
    async isRoomModerator(roomId, userId) {
        if (!Types.ObjectId.isValid(userId))
            return false;
        const metadata = await this.getRoomMetadata(roomId);
        if (!metadata)
            return false;
        return metadata.hostId === userId || metadata.moderators.includes(userId);
    }
    async addUserToRoom(roomId, userId) {
        const redisKey = this.getRedisRoomUsersKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.sadd(redisKey, userId);
                await client.expire(redisKey, this.roomStateTTLSeconds);
                return;
            }
            catch (error) {
                logSocketError('redis addUserToRoom failed; using local fallback', error, { roomId, userId });
            }
        }
        const users = this.localRoomUsers.get(roomId) || new Set();
        users.add(userId);
        this.localRoomUsers.set(roomId, users);
    }
    async removeUserFromRoom(roomId, userId) {
        const redisKey = this.getRedisRoomUsersKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.srem(redisKey, userId);
                return;
            }
            catch (error) {
                logSocketError('redis removeUserFromRoom failed; using local fallback', error, { roomId, userId });
            }
        }
        const users = this.localRoomUsers.get(roomId);
        if (!users)
            return;
        users.delete(userId);
        if (users.size === 0) {
            this.localRoomUsers.delete(roomId);
        }
    }
    async getRoomUsers(roomId) {
        const redisKey = this.getRedisRoomUsersKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                return await client.smembers(redisKey);
            }
            catch (error) {
                logSocketError('redis getRoomUsers failed; using local fallback', error, { roomId });
            }
        }
        return Array.from(this.localRoomUsers.get(roomId) || []);
    }
    async addUserToCall(roomId, userId) {
        const redisKey = this.getRedisCallUsersKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.sadd(redisKey, userId);
                await client.expire(redisKey, this.roomStateTTLSeconds);
                return;
            }
            catch (error) {
                logSocketError('redis addUserToCall failed; using local fallback', error, { roomId, userId });
            }
        }
        const users = this.localCallUsers.get(roomId) || new Set();
        users.add(userId);
        this.localCallUsers.set(roomId, users);
    }
    async removeUserFromCall(roomId, userId) {
        const redisKey = this.getRedisCallUsersKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.srem(redisKey, userId);
                return;
            }
            catch (error) {
                logSocketError('redis removeUserFromCall failed; using local fallback', error, { roomId, userId });
            }
        }
        const users = this.localCallUsers.get(roomId);
        if (!users)
            return;
        users.delete(userId);
        if (users.size === 0) {
            this.localCallUsers.delete(roomId);
        }
    }
    async getCallUsers(roomId) {
        const redisKey = this.getRedisCallUsersKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                return await client.smembers(redisKey);
            }
            catch (error) {
                logSocketError('redis getCallUsers failed; using local fallback', error, { roomId });
            }
        }
        return Array.from(this.localCallUsers.get(roomId) || []);
    }
    async saveRoomMessage(roomId, message) {
        const redisKey = this.getRedisRoomMessagesKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.rpush(redisKey, JSON.stringify(message));
                await client.ltrim(redisKey, -100, -1);
                await client.expire(redisKey, this.roomStateTTLSeconds);
                return;
            }
            catch (error) {
                logSocketError('redis saveRoomMessage failed', error, { roomId });
            }
        }
        const messages = this.localRoomMessages.get(roomId) || [];
        messages.push(message);
        if (messages.length > 100)
            messages.shift();
        this.localRoomMessages.set(roomId, messages);
    }
    async getRoomMessages(roomId) {
        const redisKey = this.getRedisRoomMessagesKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                const data = await client.lrange(redisKey, 0, -1);
                return data.map((d) => JSON.parse(d));
            }
            catch (error) {
                logSocketError('redis getRoomMessages failed', error, { roomId });
            }
        }
        return this.localRoomMessages.get(roomId) || [];
    }
    async clearRoomMessages(roomId) {
        const redisKey = this.getRedisRoomMessagesKey(roomId);
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.del(redisKey);
            }
            catch (error) {
                logSocketError('redis clearRoomMessages failed', error, { roomId });
            }
        }
        this.localRoomMessages.delete(roomId);
    }
    async clearRoomData(roomId) {
        if (redisCache.isConnected()) {
            try {
                const client = redisCache.getClient();
                await client.del(this.getRedisRoomUsersKey(roomId));
                await client.del(this.getRedisCallUsersKey(roomId));
                await client.del(this.getRedisRoomMessagesKey(roomId));
            }
            catch (error) {
                logSocketError('redis clearRoomData failed', error, { roomId });
            }
        }
        this.localRoomUsers.delete(roomId);
        this.localCallUsers.delete(roomId);
        this.localRoomMessages.delete(roomId);
    }
}
export const distributedRoomStateService = new DistributedRoomStateService();
export default distributedRoomStateService;
//# sourceMappingURL=distributedRoomStateService.js.map