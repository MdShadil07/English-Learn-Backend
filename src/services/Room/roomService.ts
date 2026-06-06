import { Types } from 'mongoose';
import { Room, User, UserProfile, RoomParticipant as RoomParticipantModel } from '../../models/index.js';
import { webSocketService } from '../../services/WebSocket/socketService.js';
import { generateRoomId } from '../WebSocket/utils/generateRoomId.js';
import { validateRoomId, validateUserId } from '../WebSocket/utils/validateRoom.js';
import { sfuMappingService } from './sfuMappingService.js';

/** Generate a cryptographically-random 6-character uppercase room code */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O/1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface CreateRoomData {
  hostId: string;
  topic: string;
  description?: string;
  banner?: string;
  bannerText?: string;
  bannerFontFamily?: string;
  bannerIsBold?: boolean;
  bannerIsItalic?: boolean;
  bannerFontSize?: number;
  maxParticipants?: number;
  isPrivate?: boolean;
  mode?: 'smallGroup' | 'classroom' | 'webinar';
}

export interface RoomParticipant {
  userId: string;
  username?: string;
  fullName?: string;
  avatar?: string;
}

export interface RoomDetails {
  roomId: string;
  roomCode?: string;      // Only present for private rooms (visible to host)
  topic: string;
  description?: string;
  banner?: string;
  bannerText?: string;
  bannerFontFamily?: string;
  bannerIsBold?: boolean;
  bannerIsItalic?: boolean;
  bannerFontSize?: number;
  hostId: string;
  hostName?: string;
  hostAvatar?: string;
  moderators: string[];
  participants: RoomParticipant[];
  maxParticipants: number;
  isPrivate: boolean;
  isLocked: boolean;
  status: 'active' | 'closed';
  createdAt: Date;
  participantCount: number;
  isFull: boolean;
  sfuUrl?: string;
  mode?: 'smallGroup' | 'classroom' | 'webinar';
}

export class RoomService {
  /**
   * Create a new practice room
   */
  async createRoom(data: CreateRoomData): Promise<RoomDetails> {
    try {
      const { 
        hostId, topic, description, banner, 
        bannerText, bannerFontFamily, bannerIsBold, bannerIsItalic, bannerFontSize,
        maxParticipants = 500, isPrivate = false, mode = 'classroom'
      } = data;

      if (maxParticipants < 1 || maxParticipants > 500) {
        throw new Error('Maximum participants must be between 1 and 500');
      }

      const roomId = generateRoomId();
      // Generate a unique 6-char code for private rooms
      const roomCode = isPrivate ? generateRoomCode() : undefined;

      const room = new Room({
        roomId,
        roomCode,
        topic: topic?.substring(0, 100) || 'English Practice Room',
        description: description?.substring(0, 500),
        banner,
        bannerText,
        bannerFontFamily,
        bannerIsBold,
        bannerIsItalic,
        bannerFontSize,
        hostId: new Types.ObjectId(hostId),
        maxParticipants,
        isPrivate,
        mode,
        status: 'active',
      });

      await room.save();
      await RoomParticipantModel.create({ roomId, userId: new Types.ObjectId(hostId) });
      
      try {
        await sfuMappingService.assignRoomToSFUServer(roomId);
      } catch (sfuError) {
        console.warn(`[RoomService] Failed to assign SFU to room ${roomId}:`, sfuError);
        // Do not throw, allow room creation to succeed
      }

      try {
        await webSocketService.notifyRoomCreated(roomId, hostId);
      } catch (wsError) {
        console.warn(`[RoomService] Failed to notify websocket for room ${roomId}:`, wsError);
      }

      return await this.formatRoomDetails(room, hostId);
    } catch (error) {
      console.error('[RoomService] createRoom error:', error);
      throw error;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string, userId: string, roomCode?: string): Promise<RoomDetails> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    if (!validateUserId(userId)) throw new Error('Invalid userId');

    const room = await Room.findByRoomId(roomId);
    if (!room) throw new Error('Room not found or inactive');
    if (room.status !== 'active') throw new Error('Room is not active');

    const userObjectId = new Types.ObjectId(userId);
    const isHost = room.hostId.equals(userObjectId);

    // ── Block Check ──
    if (!isHost && room.isBlocked && room.isBlocked(userObjectId)) {
      throw new Error('You have been blocked from this room by the host');
    }

    const participantCount = await RoomParticipantModel.countDocuments({ roomId });
    if (participantCount >= room.maxParticipants) throw new Error('Room is full');

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
        if (!roomCode) throw new Error('PRIVATE_ROOM_CODE_REQUIRED');
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
  async leaveRoom(roomId: string, userId: string): Promise<RoomDetails> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    if (!validateUserId(userId)) throw new Error('Invalid userId');

    const room = await Room.findByRoomId(roomId);
    if (!room) throw new Error('Room not found or inactive');

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

  async getRoomDetails(roomId: string, userId?: string): Promise<RoomDetails | null> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    const room = await Room.findByRoomId(roomId);
    if (!room) return null;
    return await this.formatRoomDetails(room, userId);
  }

  async getUserRooms(userId: string): Promise<RoomDetails[]> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Find all rooms this user is a participant of
    const userParticipantRecords = await RoomParticipantModel.find({ userId: userObjectId }).select('roomId').lean();
    const roomIds = userParticipantRecords.map(p => p.roomId);
    
    const rooms = await Room.find({
      $or: [{ hostId: userObjectId }, { roomId: { $in: roomIds } }],
      status: 'active'
    }).sort({ createdAt: -1 }).lean();
    return await Promise.all(rooms.map(room => this.formatRoomDetails(room, userId)));
  }

  async getActiveRooms(): Promise<RoomDetails[]> {
    const rooms = await Room.find({ status: 'active', isPrivate: false }).sort({ createdAt: -1 }).lean();
    return await Promise.all(rooms.map(room => this.formatRoomDetails(room)));
  }

  async closeRoom(roomId: string, userId: string): Promise<RoomDetails> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    if (!validateUserId(userId)) throw new Error('Invalid userId');
    const room = await Room.findByRoomId(roomId);
    if (!room) throw new Error('Room not found or inactive');
    if (!room.hostId.equals(new Types.ObjectId(userId))) throw new Error('Only host can close the room');
    room.status = 'closed';
    await room.save();
    await webSocketService.notifyRoomClosed(roomId);
    return await this.formatRoomDetails(room, userId);
  }

  async startCall(roomId: string, userId: string): Promise<void> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    if (!validateUserId(userId)) throw new Error('Invalid userId');
    const room = await Room.findByRoomId(roomId);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'active') throw new Error('Room is not active');
    const isParticipant = await RoomParticipantModel.exists({ roomId, userId: new Types.ObjectId(userId) });
    if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId))) throw new Error('User is not a participant');
    await webSocketService.notifyWebRTCCallStarted(roomId, userId);
  }

  async endCall(roomId: string, userId: string): Promise<void> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    if (!validateUserId(userId)) throw new Error('Invalid userId');
    const room = await Room.findByRoomId(roomId);
    if (!room) throw new Error('Room not found');
    const isParticipant = await RoomParticipantModel.exists({ roomId, userId: new Types.ObjectId(userId) });
    if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId))) throw new Error('User is not a participant');
    await webSocketService.notifyWebRTCCallEnded(roomId, userId);
  }

  async getCallParticipants(roomId: string): Promise<string[]> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    return await webSocketService.getRoomCallParticipants(roomId);
  }

  /**
   * Format room details.
   * roomCode is only exposed to the host (privacy guarantee).
   */
  private async formatRoomDetails(room: any, requestingUserId?: string): Promise<RoomDetails> {
    const participantRecords = await RoomParticipantModel.find({ roomId: room.roomId }).sort({ joinedAt: 1 }).lean();
    const participantIdsStr = participantRecords.map(p => p.userId.toString());
    const hostIdStr = room.hostId.toString();
    const allUserIdsStr = [...new Set([...participantIdsStr, hostIdStr])];
    const allUserIds = allUserIdsStr.map(id => new Types.ObjectId(id));
    
    const users = await User.find({ _id: { $in: allUserIds } }).select('_id username firstName lastName').lean();
    const profiles = await UserProfile.find({ userId: { $in: allUserIds } }).select('userId avatar_url').lean();

    const userMap = new Map();
    const profileMap = new Map();

    users.forEach((u: any) => {
      userMap.set(u._id.toString(), {
        username: u.username,
        fullName: `${u.firstName} ${u.lastName || ''}`.trim()
      });
    });
    profiles.forEach((p: any) => { profileMap.set(p.userId.toString(), p.avatar_url); });

    const participants: RoomParticipant[] = participantRecords.map(p => p.userId).map((id: Types.ObjectId) => {
      const idStr = id.toString();
      const u = userMap.get(idStr);
      return { userId: idStr, username: u?.username, fullName: u?.fullName, avatar: profileMap.get(idStr) };
    });

    const sfuUrl = await sfuMappingService.getSFUServerForRoom(room.roomId);
    const isHost = requestingUserId && room.hostId.equals(new Types.ObjectId(requestingUserId));

    // Handle blocked users list for host management
    let blockedUsersList: RoomParticipant[] = [];
    if (isHost && room.blockedUsers?.length > 0) {
      const bIds = room.blockedUsers.map((id: Types.ObjectId) => id);
      const bUsers = await User.find({ _id: { $in: bIds } }).select('_id username firstName lastName').lean();
      const bProfiles = await UserProfile.find({ userId: { $in: bIds } }).select('userId avatar_url').lean();
      
      const bUserMap = new Map();
      const bProfileMap = new Map();
      bUsers.forEach((u: any) => bUserMap.set(u._id.toString(), { username: u.username, fullName: `${u.firstName} ${u.lastName || ''}`.trim() }));
      bProfiles.forEach((p: any) => bProfileMap.set(p.userId.toString(), p.avatar_url));

      blockedUsersList = bIds.map((id: Types.ObjectId) => {
        const idStr = id.toString();
        const u = bUserMap.get(idStr);
        return { userId: idStr, username: u?.username, fullName: u?.fullName, avatar: bProfileMap.get(idStr) };
      });
    }

    const hostUser = userMap.get(hostIdStr);
    const hostAvatar = profileMap.get(hostIdStr);
    const hostName = hostUser?.fullName || hostUser?.username || 'Host';

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
      hostId: hostIdStr,
      hostName,
      hostAvatar,
      moderators: (room.moderators || []).map((id: Types.ObjectId) => id.toString()),
      participants,
      maxParticipants: room.maxParticipants,
      isPrivate: room.isPrivate,
      isLocked: room.isLocked || false,
      status: room.status,
      createdAt: room.createdAt,
      participantCount: participantRecords.length,
      isFull: participantRecords.length >= room.maxParticipants,
      sfuUrl,
      mode: room.mode || 'classroom',
    };
  }
}

export const roomService = new RoomService();
export default roomService;
