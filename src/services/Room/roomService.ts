import { Types } from 'mongoose';
import { Room, User, UserProfile } from '../../models/index.js';
import { webSocketService } from '../../services/WebSocket/socketService.js';
import { generateRoomId } from '../WebSocket/utils/generateRoomId.js';
import { validateRoomId, validateUserId } from '../WebSocket/utils/validateRoom.js';

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
}

export class RoomService {
  /**
   * Create a new practice room
   */
  async createRoom(data: CreateRoomData): Promise<RoomDetails> {
    const { hostId, topic, description, maxParticipants = 500, isPrivate = false } = data;

    // Validate maxParticipants
    if (maxParticipants < 1 || maxParticipants > 500) {
      throw new Error('Maximum participants must be between 1 and 500');
    }

    // Generate unique room ID
    const roomId = generateRoomId();

    // Create room
    const room = new Room({
      roomId,
      topic,
      description,
      hostId: new Types.ObjectId(hostId),
      participants: [new Types.ObjectId(hostId)], // Host is automatically a participant
      maxParticipants,
      isPrivate,
      status: 'active',
    });

    await room.save();

    // Notify via WebSocket
    await webSocketService.notifyRoomCreated(roomId, hostId);

    return await this.formatRoomDetails(room);
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string, userId: string): Promise<RoomDetails> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId');
    }

    const room = await Room.findByRoomId(roomId);

    if (!room) {
      throw new Error('Room not found or inactive');
    }

    if (room.status !== 'active') {
      throw new Error('Room is not active');
    }

    if (room.isFull()) {
      throw new Error('Room is full');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (room.hasParticipant(userObjectId)) {
      return await this.formatRoomDetails(room);
    }

    // Add participant
    room.addParticipant(userObjectId);
    await room.save();

    // Notify via WebSocket
    await webSocketService.notifyRoomJoined(roomId, userId);

    return await this.formatRoomDetails(room);
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string, userId: string): Promise<RoomDetails> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId');
    }

    const room = await Room.findByRoomId(roomId);

    if (!room) {
      throw new Error('Room not found or inactive');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (!room.hasParticipant(userObjectId)) {
      throw new Error('User is not in the room');
    }

    // Remove participant
    room.removeParticipant(userObjectId);

    // If host leaves and there are other participants, assign new host
    if (room.hostId.equals(userObjectId) && room.participants.length > 0) {
      room.hostId = room.participants[0];
    }

    // If no participants left, close the room
    if (room.participants.length === 0) {
      room.status = 'closed';
    }

    await room.save();

    // Notify via WebSocket
    await webSocketService.notifyRoomLeft(roomId, userId);

    // If room was closed, notify all participants
    if (room.status === 'closed') {
      await webSocketService.notifyRoomClosed(roomId);
    }

    return await this.formatRoomDetails(room);
  }

  /**
   * Get room details
   */
  async getRoomDetails(roomId: string): Promise<RoomDetails | null> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }

    const room = await Room.findByRoomId(roomId);

    if (!room) {
      return null;
    }

    return await this.formatRoomDetails(room);
  }

  /**
   * Get all active rooms for a user (as host or participant)
   */
  async getUserRooms(userId: string): Promise<RoomDetails[]> {
    const userObjectId = new Types.ObjectId(userId);

    const rooms = await Room.find({
      $or: [
        { hostId: userObjectId },
        { participants: userObjectId }
      ],
      status: 'active'
    }).sort({ createdAt: -1 });

    return await Promise.all(rooms.map(room => this.formatRoomDetails(room)));
  }

  /**
   * Get all active non-private rooms
   */
  async getActiveRooms(): Promise<RoomDetails[]> {
    const rooms = await Room.find({
      status: 'active',
      isPrivate: false
    }).sort({ createdAt: -1 });

    return await Promise.all(rooms.map(room => this.formatRoomDetails(room)));
  }

  async closeRoom(roomId: string, userId: string): Promise<RoomDetails> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId');
    }

    const room = await Room.findByRoomId(roomId);

    if (!room) {
      throw new Error('Room not found or inactive');
    }

    if (!room.hostId.equals(new Types.ObjectId(userId))) {
      throw new Error('Only room host can close the room');
    }

    room.status = 'closed';
    await room.save();

    // Notify via WebSocket
    await webSocketService.notifyRoomClosed(roomId);

    return await this.formatRoomDetails(room);
  }

  /**
   * Start WebRTC call in room
   */
  async startCall(roomId: string, userId: string): Promise<void> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId');
    }

    const room = await Room.findByRoomId(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'active') {
      throw new Error('Room is not active');
    }

    // Check if user is a participant
    const isParticipant = room.participants.some((id: Types.ObjectId) => id.equals(new Types.ObjectId(userId)));
    if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId))) {
      throw new Error('User is not a participant in this room');
    }

    // Notify all room participants that call has started
    await webSocketService.notifyWebRTCCallStarted(roomId, userId);
  }

  /**
   * End WebRTC call in room
   */
  async endCall(roomId: string, userId: string): Promise<void> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId');
    }

    const room = await Room.findByRoomId(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    // Check if user is a participant or host
    const isParticipant = room.participants.some((id: Types.ObjectId) => id.equals(new Types.ObjectId(userId)));
    if (!isParticipant && !room.hostId.equals(new Types.ObjectId(userId))) {
      throw new Error('User is not a participant in this room');
    }

    // Notify all room participants that call has ended
    await webSocketService.notifyWebRTCCallEnded(roomId, userId);
  }

  /**
   * Get room call participants
   */
  async getCallParticipants(roomId: string): Promise<string[]> {
    if (!validateRoomId(roomId)) {
      throw new Error('Invalid roomId');
    }

    return await webSocketService.getRoomCallParticipants(roomId);
  }

  /**
   * Format room details for API response
   */
  private async formatRoomDetails(room: any): Promise<RoomDetails> {
    // Get participant user details
    const participantIds = room.participants.map((id: Types.ObjectId) => id);
    const users = await User.find({ _id: { $in: participantIds } }).select('_id username firstName lastName');
    const profiles = await UserProfile.find({ userId: { $in: participantIds } }).select('userId avatar_url');

    // Create a map for quick lookup
    const userMap = new Map();
    const profileMap = new Map();

    users.forEach(user => {
      userMap.set(user._id.toString(), {
        username: user.username,
        fullName: `${user.firstName} ${user.lastName || ''}`.trim()
      });
    });

    profiles.forEach(profile => {
      profileMap.set(profile.userId.toString(), profile.avatar_url);
    });

    // Format participants
    const participants: RoomParticipant[] = room.participants.map((id: Types.ObjectId) => {
      const idStr = id.toString();
      const user = userMap.get(idStr);
      return {
        userId: idStr,
        username: user?.username,
        fullName: user?.fullName,
        avatar: profileMap.get(idStr)
      };
    });

    return {
      roomId: room.roomId,
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
    };
  }
}

export const roomService = new RoomService();
export default roomService;
