import { Types } from 'mongoose';
import { Room, User, UserProfile } from '../../models/index.js';
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
  maxParticipants?: number;
  isPrivate?: boolean;
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
  hostId: string;
  participants: RoomParticipant[];
  maxParticipants: number;
  isPrivate: boolean;
  status: 'active' | 'closed';
  createdAt: Date;
  participantCount: number;
  isFull: boolean;
  sfuUrl?: string;
}

export class RoomService {
  /**
   * Create a new practice room
   */
  async createRoom(data: CreateRoomData): Promise<RoomDetails> {
    const { hostId, topic, description, maxParticipants = 500, isPrivate = false } = data;

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
      hostId: new Types.ObjectId(hostId),
      participants: [new Types.ObjectId(hostId)],
      maxParticipants,
      isPrivate,
      status: 'active',
    });

    await room.save();
    await sfuMappingService.assignRoomToSFUServer(roomId);
    await webSocketService.notifyRoomCreated(roomId, hostId);

    return await this.formatRoomDetails(room, hostId);
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
    if (room.isFull()) throw new Error('Room is full');

    // Private room gate: validate room code
    if (room.isPrivate) {
      const userObjectId = new Types.ObjectId(userId);
      const isHost = room.hostId.equals(userObjectId);
      const isAlreadyParticipant = room.hasParticipant(userObjectId);

      if (!isHost && !isAlreadyParticipant) {
        if (!roomCode) {
          throw new Error('PRIVATE_ROOM_CODE_REQUIRED');
        }
        if (room.roomCode && room.roomCode.toUpperCase() !== roomCode.trim().toUpperCase()) {
          throw new Error('INVALID_ROOM_CODE');
        }
      }
    }

    const userObjectId = new Types.ObjectId(userId);

    if (room.hasParticipant(userObjectId)) {
      const existingRoom = await this.formatRoomDetails(room, userId);
      await sfuMappingService.assignUserToRoom(userId, roomId);
      return existingRoom;
    }

    room.addParticipant(userObjectId);
    await room.save();
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
    if (!room.hasParticipant(userObjectId)) {
      // User already gone — return gracefully
      return await this.formatRoomDetails(room, userId);
    }

    room.removeParticipant(userObjectId);

    // If host leaves and there are remaining participants, reassign host
    if (room.hostId.equals(userObjectId) && room.participants.length > 0) {
      room.hostId = room.participants[0];
    }

    // Auto-close empty room
    if (room.participants.length === 0) {
      room.status = 'closed';
    }

    await room.save();
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
    const rooms = await Room.find({
      $or: [{ hostId: userObjectId }, { participants: userObjectId }],
      status: 'active'
    }).sort({ createdAt: -1 });
    return await Promise.all(rooms.map(room => this.formatRoomDetails(room, userId)));
  }

  async getActiveRooms(): Promise<RoomDetails[]> {
    const rooms = await Room.find({ status: 'active', isPrivate: false }).sort({ createdAt: -1 });
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
    const isParticipant = room.participants.some((id: Types.ObjectId) => id.equals(new Types.ObjectId(userId)));
    if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId))) throw new Error('User is not a participant');
    await webSocketService.notifyWebRTCCallStarted(roomId, userId);
  }

  async endCall(roomId: string, userId: string): Promise<void> {
    if (!validateRoomId(roomId)) throw new Error('Invalid roomId');
    if (!validateUserId(userId)) throw new Error('Invalid userId');
    const room = await Room.findByRoomId(roomId);
    if (!room) throw new Error('Room not found');
    const isParticipant = room.participants.some((id: Types.ObjectId) => id.equals(new Types.ObjectId(userId)));
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
    const participantIds = room.participants.map((id: Types.ObjectId) => id);
    const users = await User.find({ _id: { $in: participantIds } }).select('_id username firstName lastName');
    const profiles = await UserProfile.find({ userId: { $in: participantIds } }).select('userId avatar_url');

    const userMap = new Map();
    const profileMap = new Map();

    users.forEach((u: any) => {
      userMap.set(u._id.toString(), {
        username: u.username,
        fullName: `${u.firstName} ${u.lastName || ''}`.trim()
      });
    });
    profiles.forEach((p: any) => { profileMap.set(p.userId.toString(), p.avatar_url); });

    const participants: RoomParticipant[] = room.participants.map((id: Types.ObjectId) => {
      const idStr = id.toString();
      const u = userMap.get(idStr);
      return { userId: idStr, username: u?.username, fullName: u?.fullName, avatar: profileMap.get(idStr) };
    });

    const sfuUrl = await sfuMappingService.getSFUServerForRoom(room.roomId);
    const isHost = requestingUserId && room.hostId.equals(new Types.ObjectId(requestingUserId));

    return {
      roomId: room.roomId,
      // Only expose roomCode to the host
      ...(isHost && room.roomCode ? { roomCode: room.roomCode } : {}),
      topic: room.topic,
      description: room.description,
      hostId: room.hostId.toString(),
      participants,
      maxParticipants: room.maxParticipants,
      isPrivate: room.isPrivate,
      status: room.status,
      createdAt: room.createdAt,
      participantCount: room.participants.length,
      isFull: room.isFull(),
      sfuUrl,
    };
  }
}

export const roomService = new RoomService();
export default roomService;
