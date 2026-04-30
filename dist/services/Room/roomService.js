import { Types } from 'mongoose';
import { Room, User, UserProfile, RoomParticipant as RoomParticipantModel } from '../../models/index.js';
import { webSocketService } from '../../services/WebSocket/socketService.js';
import { generateRoomId } from '../WebSocket/utils/generateRoomId.js';
import { validateRoomId, validateUserId } from '../WebSocket/utils/validateRoom.js';
import { sfuMappingService } from './sfuMappingService.js';
/** Generate a cryptographically-random 6-character uppercase room code */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O/1/I)
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
export class RoomService {
    /**
     * Create a new practice room
     */
    async createRoom(data) {
        const { hostId, topic, description, banner, bannerText, bannerFontFamily, bannerIsBold, bannerIsItalic, bannerFontSize, maxParticipants = 500, isPrivate = false } = data;
        if (maxParticipants < 1 || maxParticipants > 500) {
            throw new Error('Maximum participants must be between 1 and 500');
        }
        const roomId = generateRoomId();
        // Generate a unique 6-char code for private rooms
        const roomCode = isPrivate ? generateRoomCode() : undefined;
        const room = new Room({
            roomId,
            roomCode,
            topic,
            description,
            banner,
            bannerText,
            bannerFontFamily,
            bannerIsBold,
            bannerIsItalic,
            bannerFontSize,
            hostId: new Types.ObjectId(hostId),
            maxParticipants,
            isPrivate,
            status: 'active',
        });
        await room.save();
        await RoomParticipantModel.create({ roomId, userId: new Types.ObjectId(hostId) });
        await sfuMappingService.assignRoomToSFUServer(roomId);
        await webSocketService.notifyRoomCreated(roomId, hostId);
        return await this.formatRoomDetails(room, hostId);
    }
    /**
     * Join an existing room
     */
    async joinRoom(roomId, userId, roomCode) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        if (!validateUserId(userId))
            throw new Error('Invalid userId');
        const room = await Room.findByRoomId(roomId);
        if (!room)
            throw new Error('Room not found or inactive');
        if (room.status !== 'active')
            throw new Error('Room is not active');
        const userObjectId = new Types.ObjectId(userId);
        const isHost = room.hostId.equals(userObjectId);
        // ── Block Check ──
        if (!isHost && room.isBlocked && room.isBlocked(userObjectId)) {
            throw new Error('You have been blocked from this room by the host');
        }
        const participantCount = await RoomParticipantModel.countDocuments({ roomId });
        if (participantCount >= room.maxParticipants)
            throw new Error('Room is full');
        const isAlreadyParticipant = await RoomParticipantModel.exists({ roomId, userId: userObjectId });
        // ── Lock Check ──
        if (room.isLocked) {
            if (!isHost && !isAlreadyParticipant) {
                throw new Error('This room is currently locked by the host');
            }
        }
        // ── Private room gate ──
        if (room.isPrivate) {
            if (!isHost && !isAlreadyParticipant) {
                if (!roomCode)
                    throw new Error('PRIVATE_ROOM_CODE_REQUIRED');
                if (room.roomCode && room.roomCode.toUpperCase() !== roomCode.trim().toUpperCase()) {
                    throw new Error('INVALID_ROOM_CODE');
                }
            }
        }
        if (isAlreadyParticipant) {
            const existingRoom = await this.formatRoomDetails(room, userId);
            await sfuMappingService.assignUserToRoom(userId, roomId);
            return existingRoom;
        }
        await RoomParticipantModel.create({ roomId, userId: userObjectId });
        await sfuMappingService.assignUserToRoom(userId, roomId);
        await webSocketService.notifyRoomJoined(roomId, userId);
        return await this.formatRoomDetails(room, userId);
    }
    /**
     * Leave a room
     */
    async leaveRoom(roomId, userId) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        if (!validateUserId(userId))
            throw new Error('Invalid userId');
        const room = await Room.findByRoomId(roomId);
        if (!room)
            throw new Error('Room not found or inactive');
        const userObjectId = new Types.ObjectId(userId);
        const isParticipant = await RoomParticipantModel.exists({ roomId, userId: userObjectId });
        if (!isParticipant) {
            // User already gone — return gracefully
            return await this.formatRoomDetails(room, userId);
        }
        await RoomParticipantModel.deleteOne({ roomId, userId: userObjectId });
        // Auto-close room only if empty and the person leaving is NOT the host
        // (This allows hosts to refresh without destroying the room)
        const remainingParticipants = await RoomParticipantModel.countDocuments({ roomId });
        if (remainingParticipants === 0 && !room.hostId.equals(userObjectId)) {
            room.status = 'closed';
            await room.save();
        }
        await sfuMappingService.removeUserRoomMapping(userId);
        await webSocketService.notifyRoomLeft(roomId, userId);
        if (room.status === 'closed') {
            await sfuMappingService.clearRoomSFUMapping(roomId);
            await webSocketService.notifyRoomClosed(roomId);
        }
        return await this.formatRoomDetails(room, userId);
    }
    async getRoomDetails(roomId, userId) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        const room = await Room.findByRoomId(roomId);
        if (!room)
            return null;
        return await this.formatRoomDetails(room, userId);
    }
    async getUserRooms(userId) {
        const userObjectId = new Types.ObjectId(userId);
        // Find all rooms this user is a participant of
        const userParticipantRecords = await RoomParticipantModel.find({ userId: userObjectId }).select('roomId');
        const roomIds = userParticipantRecords.map(p => p.roomId);
        const rooms = await Room.find({
            $or: [{ hostId: userObjectId }, { roomId: { $in: roomIds } }],
            status: 'active'
        }).sort({ createdAt: -1 });
        return await Promise.all(rooms.map(room => this.formatRoomDetails(room, userId)));
    }
    async getActiveRooms() {
        const rooms = await Room.find({ status: 'active', isPrivate: false }).sort({ createdAt: -1 });
        return await Promise.all(rooms.map(room => this.formatRoomDetails(room)));
    }
    async closeRoom(roomId, userId) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        if (!validateUserId(userId))
            throw new Error('Invalid userId');
        const room = await Room.findByRoomId(roomId);
        if (!room)
            throw new Error('Room not found or inactive');
        if (!room.hostId.equals(new Types.ObjectId(userId)))
            throw new Error('Only host can close the room');
        room.status = 'closed';
        await room.save();
        await webSocketService.notifyRoomClosed(roomId);
        return await this.formatRoomDetails(room, userId);
    }
    async startCall(roomId, userId) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        if (!validateUserId(userId))
            throw new Error('Invalid userId');
        const room = await Room.findByRoomId(roomId);
        if (!room)
            throw new Error('Room not found');
        if (room.status !== 'active')
            throw new Error('Room is not active');
        const isParticipant = await RoomParticipantModel.exists({ roomId, userId: new Types.ObjectId(userId) });
        if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId)))
            throw new Error('User is not a participant');
        await webSocketService.notifyWebRTCCallStarted(roomId, userId);
    }
    async endCall(roomId, userId) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        if (!validateUserId(userId))
            throw new Error('Invalid userId');
        const room = await Room.findByRoomId(roomId);
        if (!room)
            throw new Error('Room not found');
        const isParticipant = await RoomParticipantModel.exists({ roomId, userId: new Types.ObjectId(userId) });
        if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId)))
            throw new Error('User is not a participant');
        await webSocketService.notifyWebRTCCallEnded(roomId, userId);
    }
    async getCallParticipants(roomId) {
        if (!validateRoomId(roomId))
            throw new Error('Invalid roomId');
        return await webSocketService.getRoomCallParticipants(roomId);
    }
    /**
     * Format room details.
     * roomCode is only exposed to the host (privacy guarantee).
     */
    async formatRoomDetails(room, requestingUserId) {
        const participantRecords = await RoomParticipantModel.find({ roomId: room.roomId }).sort({ joinedAt: 1 });
        const participantIds = participantRecords.map(p => p.userId);
        const users = await User.find({ _id: { $in: participantIds } }).select('_id username firstName lastName');
        const profiles = await UserProfile.find({ userId: { $in: participantIds } }).select('userId avatar_url');
        const userMap = new Map();
        const profileMap = new Map();
        users.forEach((u) => {
            userMap.set(u._id.toString(), {
                username: u.username,
                fullName: `${u.firstName} ${u.lastName || ''}`.trim()
            });
        });
        profiles.forEach((p) => { profileMap.set(p.userId.toString(), p.avatar_url); });
        const participants = participantIds.map((id) => {
            const idStr = id.toString();
            const u = userMap.get(idStr);
            return { userId: idStr, username: u?.username, fullName: u?.fullName, avatar: profileMap.get(idStr) };
        });
        const sfuUrl = await sfuMappingService.getSFUServerForRoom(room.roomId);
        const isHost = requestingUserId && room.hostId.equals(new Types.ObjectId(requestingUserId));
        // Handle blocked users list for host management
        let blockedUsersList = [];
        if (isHost && room.blockedUsers?.length > 0) {
            const bIds = room.blockedUsers.map((id) => id);
            const bUsers = await User.find({ _id: { $in: bIds } }).select('_id username firstName lastName');
            const bProfiles = await UserProfile.find({ userId: { $in: bIds } }).select('userId avatar_url');
            const bUserMap = new Map();
            const bProfileMap = new Map();
            bUsers.forEach((u) => bUserMap.set(u._id.toString(), { username: u.username, fullName: `${u.firstName} ${u.lastName || ''}`.trim() }));
            bProfiles.forEach((p) => bProfileMap.set(p.userId.toString(), p.avatar_url));
            blockedUsersList = bIds.map((id) => {
                const idStr = id.toString();
                const u = bUserMap.get(idStr);
                return { userId: idStr, username: u?.username, fullName: u?.fullName, avatar: bProfileMap.get(idStr) };
            });
        }
        return {
            roomId: room.roomId,
            // Only expose roomCode and blockedUsers to the host
            ...(isHost && room.roomCode ? { roomCode: room.roomCode } : {}),
            ...(isHost ? { blockedUsers: blockedUsersList } : {}),
            topic: room.topic,
            description: room.description,
            banner: room.banner,
            bannerText: room.bannerText,
            bannerFontFamily: room.bannerFontFamily,
            bannerIsBold: room.bannerIsBold,
            bannerIsItalic: room.bannerIsItalic,
            bannerFontSize: room.bannerFontSize,
            hostId: room.hostId.toString(),
            moderators: (room.moderators || []).map((id) => id.toString()),
            participants,
            maxParticipants: room.maxParticipants,
            isPrivate: room.isPrivate,
            isLocked: room.isLocked || false,
            status: room.status,
            createdAt: room.createdAt,
            participantCount: participantIds.length,
            isFull: participantIds.length >= room.maxParticipants,
            sfuUrl,
        };
    }
}
export const roomService = new RoomService();
export default roomService;
//# sourceMappingURL=roomService.js.map