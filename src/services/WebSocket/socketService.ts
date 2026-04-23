import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { User } from '../../models/index.js';
import { redisCache } from '../../config/redis.js';
import { createSocketRedisClients, closeSocketRedisClients, SocketRedisClients } from '../../config/socketRedis.js';
import { verifyToken } from '../../middleware/auth/auth.js';
import authConfig from '../../config/auth.js';
import {
  emitSocketError,
  emitSocketSuccess,
  profileChannel,
  roomChannel,
  userChannel,
} from './utils/socketHelpers.js';
import { logSocketError, logSocketInfo } from './utils/errorHandler.js';
import { validateRoomJoinPayload, validateRoomMessagePayload, validateUserId } from './utils/validateRoom.js';
import { distributedRoomStateService } from '../Room/distributedRoomStateService.js';
import { sfuService } from '../Room/sfuService.js';

interface SocketUser {
  userId: string;
  socketId: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private redisAdapterClients: SocketRedisClients | null = null;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupEventHandlers();
    this.setupRedisAdapter().catch((error) => {
      logSocketError('failed to setup socket redis adapter', error);
    });
    console.log('🚀 WebSocket server initialized');
  }

  private async setupRedisAdapter(): Promise<void> {
    if (!this.io) return;

    this.redisAdapterClients = await createSocketRedisClients();

    if (!this.redisAdapterClients) {
      logSocketInfo('socket redis adapter disabled, continuing in single-node mode');
      return;
    }

    this.io.adapter(createAdapter(this.redisAdapterClients.pubClient, this.redisAdapterClients.subClient));
    logSocketInfo('socket redis adapter enabled');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log(`🔗 User connected: ${socket.id}`);

      // Authentication middleware
      socket.use(async (packet: any, next: (err?: Error) => void) => {
        try {
          const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

          if (!token) {
            return next(new Error('Authentication required'));
          }

          // Verify token and get user info (placeholder for now)
          const user = await this.verifyToken(token);
          if (!user) {
            return next(new Error('Invalid token'));
          }

          // Store user connection
          this.connectedUsers.set(socket.id, {
            userId: user._id.toString(),
            socketId: socket.id,
          });

          this.userSockets.set(user._id.toString(), socket.id);

          // Join user to their personal room
          socket.join(userChannel(user._id.toString()));

          // Send connection confirmation
          emitSocketSuccess(socket, 'connected', {
            userId: user._id,
          });

          next();
        } catch (error) {
          logSocketError('WebSocket authentication error', error);
          next(new Error('Authentication failed'));
        }
      });

      // Handle profile subscription
      socket.on('profile:subscribe', (data: any) => {
        this.handleProfileSubscription(socket, data);
      });

      // Handle real-time profile updates
      socket.on('profile:update', (data: any) => {
        this.handleProfileUpdate(socket, data);
      });

      // Handle typing indicators
      socket.on('typing:start', (data: any) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing:stop', (data: any) => {
        this.handleTypingStop(socket, data);
      });

      // Handle presence updates
      socket.on('presence:update', (data: any) => {
        this.handlePresenceUpdate(socket, data);
      });

      // Room event handlers
      this.setupRoomEventHandlers(socket);

      // SFU Mediasoup signaling handlers
      this.setupSFUHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        void this.handleDisconnection(socket, reason);
      });

      // Handle connection errors
      socket.on('error', (error: Error) => {
        console.error('Socket error:', error);
        void this.handleDisconnection(socket, 'error');
      });
    });
  }

  /**
   * Verify JWT token and get user
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      // Verify the JWT token
      const decoded = await verifyToken(token, authConfig.jwtSecret);

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Find user in database
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      console.error('WebSocket token verification error:', error);
      return null;
    }
  }

  /**
   * Handle profile subscription
   */
  private handleProfileSubscription(socket: Socket, data: any): void {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    // Subscribe to profile changes for this user
    socket.join(profileChannel(userInfo.userId));
    emitSocketSuccess(socket, 'profile:subscribed', { userId: userInfo.userId });
  }

  /**
   * Handle real-time profile updates
   */
  private handleProfileUpdate(socket: Socket, data: any): void {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    // Broadcast profile update to all connected clients for this user
    this.io?.to(profileChannel(userInfo.userId)).emit('profile:updated', {
      userId: userInfo.userId,
      data: data.profileData,
      timestamp: new Date().toISOString(),
    });

    // Invalidate cache
    this.invalidateProfileCache(userInfo.userId);
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: Socket, data: any): void {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    // Broadcast typing start to relevant users
    socket.to(profileChannel(data.targetUserId || userInfo.userId)).emit('typing:start', {
      userId: userInfo.userId,
      field: data.field,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: Socket, data: any): void {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    // Broadcast typing stop to relevant users
    socket.to(profileChannel(data.targetUserId || userInfo.userId)).emit('typing:stop', {
      userId: userInfo.userId,
      field: data.field,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle presence updates
   */
  private handlePresenceUpdate(socket: Socket, data: any): void {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    // Update user presence
    socket.to(profileChannel(userInfo.userId)).emit('presence:updated', {
      userId: userInfo.userId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle user disconnection
   */
  private async handleDisconnection(socket: Socket, reason: string): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);

    if (userInfo) {
      console.log(`📴 User disconnected: ${socket.id} (${userInfo.userId}) - Reason: ${reason}`);

      // Notify rooms that user left calls
      for (const room of socket.rooms) {
        if (room.startsWith('room:')) {
          const roomId = room.replace('room:', '');
          await distributedRoomStateService.removeUserFromRoom(roomId, userInfo.userId);
          await distributedRoomStateService.removeUserFromCall(roomId, userInfo.userId);
          // Notify other participants that user left the call due to disconnection
          socket.to(room).emit('webrtc:user-left-call', {
            roomId,
            userId: userInfo.userId,
            reason: 'disconnected',
            timestamp: new Date().toISOString(),
          });

          // Cleanup SFU resources
          sfuService.removeUser(roomId, userInfo.userId);
        }
      }

      // Remove from connected users
      this.connectedUsers.delete(socket.id);
      this.userSockets.delete(userInfo.userId);

      // Notify other clients about disconnection
      socket.to(profileChannel(userInfo.userId)).emit('presence:updated', {
        userId: userInfo.userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });

      // Leave user's personal room
      socket.leave(userChannel(userInfo.userId));
      socket.leave(profileChannel(userInfo.userId));
    }
  }

  /**
   * Send profile update notification to specific user
   */
  async notifyProfileUpdate(userId: string, profileData: any): Promise<void> {
    if (!this.io) return;

    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('profile:updated', {
        success: true,
        data: profileData,
        timestamp: new Date().toISOString(),
      });
    }
    this.io.to(userChannel(userId)).emit('profile:updated', {
      success: true,
      data: profileData,
      timestamp: new Date().toISOString(),
    });

    // Also broadcast to profile room
    this.io.to(profileChannel(userId)).emit('profile:updated', {
      userId,
      data: profileData,
      timestamp: new Date().toISOString(),
    });

    // Invalidate cache
    await this.invalidateProfileCache(userId);
  }

  /**
   * Send notification to user
   */
  async notifyUser(userId: string, event: string, data: any): Promise<void> {
    if (!this.io) return;
    this.io.to(userChannel(userId)).emit(event, {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Invalidate profile cache
   */
  private async invalidateProfileCache(userId: string): Promise<void> {
    try {
      if (redisCache && redisCache.isConnected()) {
        const keys = await redisCache.keys(`profile:*${userId}*`);
        if (keys.length > 0) {
          await redisCache.del(...keys);
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // ========================================
  // ROOM MANAGEMENT METHODS
  // ========================================

  /**
   * Notify when a room is created
   */
  async notifyRoomCreated(roomId: string, hostId: string): Promise<void> {
    if (!this.io) return;

    // Notify host
    await this.notifyUser(hostId, 'room:created', { roomId });

    // Broadcast to all users that a new room is available
    this.io.emit('room:new', {
      roomId,
      hostId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify when a user joins a room
   */
  async notifyRoomJoined(roomId: string, userId: string): Promise<void> {
    if (!this.io) return;

    // Join user to room socket channel
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(roomChannel(roomId));
      }
    }
    await distributedRoomStateService.addUserToRoom(roomId, userId);

    // Notify room participants
    this.io.to(roomChannel(roomId)).emit('room:user-joined', {
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Notify user
    await this.notifyUser(userId, 'room:joined', { roomId });
  }

  /**
   * Notify when a user leaves a room
   */
  async notifyRoomLeft(roomId: string, userId: string): Promise<void> {
    if (!this.io) return;

    // Leave room socket channel
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(roomChannel(roomId));
      }
    }
    await distributedRoomStateService.removeUserFromRoom(roomId, userId);

    // Notify room participants
    this.io.to(roomChannel(roomId)).emit('room:user-left', {
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Notify user
    await this.notifyUser(userId, 'room:left', { roomId });
  }

  /**
   * Notify when a room is closed
   */
  async notifyRoomClosed(roomId: string): Promise<void> {
    if (!this.io) return;

    // Notify all room participants
    this.io.to(roomChannel(roomId)).emit('room:closed', {
      roomId,
      timestamp: new Date().toISOString(),
    });

    // Clean up room channel (disconnect all users from room)
    const roomSockets = await this.io.in(roomChannel(roomId)).fetchSockets();
    roomSockets.forEach(socket => {
      socket.leave(roomChannel(roomId));
    });
  }

  /**
   * Send message to room participants
   */
  async sendRoomMessage(roomId: string, userId: string, message: any): Promise<void> {
    if (!this.io) return;

    this.io.to(roomChannel(roomId)).emit('room:message', {
      roomId,
      userId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify WebRTC call started in room
   */
  async notifyWebRTCCallStarted(roomId: string, initiatorUserId: string): Promise<void> {
    if (!this.io) return;

    this.io.to(roomChannel(roomId)).emit('webrtc:call-started', {
      roomId,
      initiatorUserId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify WebRTC call ended in room
   */
  async notifyWebRTCCallEnded(roomId: string, endedByUserId: string): Promise<void> {
    if (!this.io) return;

    this.io.to(roomChannel(roomId)).emit('webrtc:call-ended', {
      roomId,
      endedByUserId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get room participants currently in call
   */
  async getRoomCallParticipants(roomId: string): Promise<string[]> {
    return distributedRoomStateService.getCallUsers(roomId);
  }

  /**
   * Handle room-specific socket events
   */
  private setupRoomEventHandlers(socket: Socket): void {
    // Join room
    socket.on('room:join', (data: { roomId: string }) => {
      this.handleRoomJoin(socket, data);
    });

    // Leave room
    socket.on('room:leave', (data: { roomId: string }) => {
      this.handleRoomLeave(socket, data);
    });

    // Send message to room
    socket.on('room:message', (data: { roomId: string; message: any }) => {
      this.handleRoomMessage(socket, data);
    });

    // WebRTC signaling events
    socket.on('webrtc:offer', (data: { roomId: string; targetUserId: string; offer: any }) => {
      this.handleWebRTCOffer(socket, data);
    });

    socket.on('webrtc:answer', (data: { roomId: string; targetUserId: string; answer: any }) => {
      this.handleWebRTCAnswer(socket, data);
    });

    socket.on('webrtc:ice-candidate', (data: { roomId: string; targetUserId: string; candidate: any }) => {
      this.handleWebRTCIceCandidate(socket, data);
    });

    socket.on('webrtc:join-call', (data: { roomId: string }) => {
      this.handleWebRTCJoinCall(socket, data);
    });

    socket.on('webrtc:leave-call', (data: { roomId: string }) => {
      this.handleWebRTCLeaveCall(socket, data);
    });

    socket.on('webrtc:ping', (data: { roomId: string }) => {
      this.handleWebRTCPing(socket, data);
    });

    socket.on('webrtc:connection-quality', (data: { roomId: string; quality: string }) => {
      this.handleWebRTCConnectionQuality(socket, data);
    });
  }

  /**
   * Setup Mediasoup SFU signaling handlers
   */
  private setupSFUHandlers(socket: Socket): void {
    const getSocketUser = () => this.connectedUsers.get(socket.id);
    const respond = (callback: any, payload: any): void => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };

    socket.on('sfu:getRouterRtpCapabilities', async (data: { roomId: string }, callback: any) => {
      try {
        const userInfo = getSocketUser();
        if (!userInfo) {
          respond(callback, { error: 'Authentication required' });
          return;
        }
        const router = await sfuService.getOrCreateRouter(data.roomId);
        respond(callback, {
          rtpCapabilities: JSON.parse(JSON.stringify(router.rtpCapabilities)),
        });
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });

    socket.on('sfu:createWebRtcTransport', async (data: { roomId: string }, callback: any) => {
      try {
        const userInfo = getSocketUser();
        if (!userInfo) {
          respond(callback, { error: 'Authentication required' });
          return;
        }
        const transportData = await sfuService.createWebRtcTransport(data.roomId, userInfo.userId);
        respond(callback, transportData);
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });

    socket.on('sfu:connectWebRtcTransport', async (data: { roomId: string, transportId: string, dtlsParameters: any }, callback: any) => {
      try {
        await sfuService.connectTransport(data.roomId, data.transportId, data.dtlsParameters);
        respond(callback, { success: true });
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });

    socket.on('sfu:produce', async (data: { roomId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: any }, callback: any) => {
      try {
        const userInfo = getSocketUser();
        if (!userInfo) {
          respond(callback, { error: 'Authentication required' });
          return;
        }
        const producerId = await sfuService.createProducer(data.roomId, data.transportId, data.kind, data.rtpParameters, userInfo.userId);
        respond(callback, { id: producerId });

        socket.to(roomChannel(data.roomId)).emit('sfu:new-producer', {
          producerId,
          producerUserId: userInfo.userId,
          kind: data.kind,
        });
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });

    socket.on('sfu:getProducers', (data: { roomId: string }, callback: any) => {
      try {
        const producers = sfuService.getProducers(data.roomId);
        respond(callback, { producers });
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });

    socket.on('sfu:consume', async (data: { roomId: string, transportId: string, producerId: string, rtpCapabilities: any }, callback: any) => {
      try {
        const consumerData = await sfuService.createConsumer(data.roomId, data.transportId, data.producerId, data.rtpCapabilities);
        respond(callback, consumerData);
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });

    socket.on('sfu:resumeConsumer', async (data: { roomId: string, consumerId: string }, callback: any) => {
      try {
        await sfuService.resumeConsumer(data.roomId, data.consumerId);
        respond(callback, { success: true });
      } catch (error: any) {
        respond(callback, { error: error.message });
      }
    });
  }


  /**
   * Handle room join via socket
   */
  private async handleRoomJoin(socket: Socket, data: { roomId: string }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    try {
      const validation = validateRoomJoinPayload(data);
      if (!validation.valid || !validation.roomId) {
        emitSocketError(socket, 'room:error', validation.error || 'Invalid room join payload');
        return;
      }

      const { roomId } = validation;

      if (!validateUserId(userInfo.userId)) {
        emitSocketError(socket, 'room:error', 'Invalid userId', { roomId });
        return;
      }

      const roomExists = await distributedRoomStateService.validateRoomExists(roomId);
      if (!roomExists) {
        emitSocketError(socket, 'room:error', 'Room not found or inactive', { roomId });
        return;
      }

      const canJoin = await distributedRoomStateService.validateUserCanJoinRoom(roomId, userInfo.userId);
      if (!canJoin) {
        emitSocketError(socket, 'room:error', 'User is not allowed to join this room', { roomId });
        return;
      }

      socket.join(roomChannel(roomId));
      await distributedRoomStateService.addUserToRoom(roomId, userInfo.userId);

      emitSocketSuccess(socket, 'room:joined', {
        roomId,
        userId: userInfo.userId,
      });
    } catch (error) {
      logSocketError('handleRoomJoin failed', error, { userId: userInfo.userId, roomId: data?.roomId });
      emitSocketError(socket, 'room:error', 'Failed to join room', { roomId: data?.roomId });
    }
  }

  /**
   * Handle room leave via socket
   */
  private async handleRoomLeave(socket: Socket, data: { roomId: string }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'room:error', validation.error || 'Invalid room leave payload');
      return;
    }

    const { roomId } = validation;

    socket.leave(roomChannel(roomId));
    await distributedRoomStateService.removeUserFromRoom(roomId, userInfo.userId);
    emitSocketSuccess(socket, 'room:left', {
      roomId,
      userId: userInfo.userId,
    });
  }

  /**
   * Handle room message via socket
   */
  private async handleRoomMessage(socket: Socket, data: { roomId: string; message: any }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomMessagePayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'room:error', validation.error || 'Invalid room message payload');
      return;
    }

    // Broadcast message to room only (targeted emit)
    socket.to(roomChannel(validation.roomId)).emit('room:message', {
      roomId: validation.roomId,
      userId: userInfo.userId,
      message: validation.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle WebRTC offer
   */
  private async handleWebRTCOffer(socket: Socket, data: { roomId: string; targetUserId: string; offer: any }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload({ roomId: data.roomId });
    if (!validation.valid) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid roomId', { type: 'offer' });
      return;
    }
    if (!validateUserId(data.targetUserId)) {
      emitSocketError(socket, 'webrtc:error', 'Invalid targetUserId', { type: 'offer', roomId: data.roomId });
      return;
    }

    try {
      // Send offer to target user
      await this.notifyUser(data.targetUserId, 'webrtc:offer', {
        roomId: data.roomId,
        fromUserId: userInfo.userId,
        offer: data.offer,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('WebRTC offer handling error:', error);
      socket.emit('webrtc:error', {
        type: 'offer',
        error: 'Failed to send offer',
        roomId: data.roomId,
      });
    }
  }

  /**
   * Handle WebRTC answer
   */
  private async handleWebRTCAnswer(socket: Socket, data: { roomId: string; targetUserId: string; answer: any }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload({ roomId: data.roomId });
    if (!validation.valid) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid roomId', { type: 'answer' });
      return;
    }
    if (!validateUserId(data.targetUserId)) {
      emitSocketError(socket, 'webrtc:error', 'Invalid targetUserId', { type: 'answer', roomId: data.roomId });
      return;
    }

    try {
      // Send answer to target user
      await this.notifyUser(data.targetUserId, 'webrtc:answer', {
        roomId: data.roomId,
        fromUserId: userInfo.userId,
        answer: data.answer,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('WebRTC answer handling error:', error);
      socket.emit('webrtc:error', {
        type: 'answer',
        error: 'Failed to send answer',
        roomId: data.roomId,
      });
    }
  }

  /**
   * Handle WebRTC ICE candidate
   */
  private async handleWebRTCIceCandidate(socket: Socket, data: { roomId: string; targetUserId: string; candidate: any }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload({ roomId: data.roomId });
    if (!validation.valid) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid roomId', { type: 'ice-candidate' });
      return;
    }
    if (!validateUserId(data.targetUserId)) {
      emitSocketError(socket, 'webrtc:error', 'Invalid targetUserId', { type: 'ice-candidate', roomId: data.roomId });
      return;
    }

    try {
      // Send ICE candidate to target user
      await this.notifyUser(data.targetUserId, 'webrtc:ice-candidate', {
        roomId: data.roomId,
        fromUserId: userInfo.userId,
        candidate: data.candidate,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('WebRTC ICE candidate handling error:', error);
      socket.emit('webrtc:error', {
        type: 'ice-candidate',
        error: 'Failed to send ICE candidate',
        roomId: data.roomId,
      });
    }
  }

  /**
   * Handle WebRTC join call
   */
  private async handleWebRTCJoinCall(socket: Socket, data: { roomId: string }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid join-call payload', { type: 'join-call' });
      return;
    }
    const roomId = validation.roomId;

    try {
      const canJoin = await distributedRoomStateService.validateUserCanJoinRoom(roomId, userInfo.userId);
      if (!canJoin) {
        emitSocketError(socket, 'webrtc:error', 'User is not allowed to join call for this room', { type: 'join-call', roomId });
        return;
      }

      // Get all current call participants
      const callParticipants = await this.getRoomCallParticipants(roomId);
      await distributedRoomStateService.addUserToCall(roomId, userInfo.userId);

      // Notify existing participants that new user joined
      socket.to(roomChannel(roomId)).emit('webrtc:user-joined-call', {
        roomId,
        userId: userInfo.userId,
        timestamp: new Date().toISOString(),
      });

      // Send list of existing participants to the new user
      socket.emit('webrtc:call-joined', {
        roomId,
        userId: userInfo.userId,
        existingParticipants: callParticipants.filter(id => id !== userInfo.userId),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('WebRTC join call error:', error);
      socket.emit('webrtc:error', {
        type: 'join-call',
        error: 'Failed to join call',
        roomId: data.roomId,
      });
    }
  }

  /**
   * Handle WebRTC leave call
   */
  private async handleWebRTCLeaveCall(socket: Socket, data: { roomId: string }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid leave-call payload', { type: 'leave-call' });
      return;
    }
    const roomId = validation.roomId;

    try {
      await distributedRoomStateService.removeUserFromCall(roomId, userInfo.userId);
      // Notify room participants that user left the call
      socket.to(roomChannel(roomId)).emit('webrtc:user-left-call', {
        roomId,
        userId: userInfo.userId,
        reason: 'left',
        timestamp: new Date().toISOString(),
      });

      // Confirm to user
      socket.emit('webrtc:call-left', {
        roomId,
        userId: userInfo.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('WebRTC leave call error:', error);
      socket.emit('webrtc:error', {
        type: 'leave-call',
        error: 'Failed to leave call',
        roomId: data.roomId,
      });
    }
  }

  /**
   * Handle WebRTC ping for connection monitoring
   */
  private async handleWebRTCPing(socket: Socket, data: { roomId: string }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid ping payload', { type: 'ping' });
      return;
    }

    // Respond with pong to maintain connection health
    socket.emit('webrtc:pong', {
      roomId: validation.roomId,
      userId: userInfo.userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle WebRTC connection quality reports
   */
  private async handleWebRTCConnectionQuality(socket: Socket, data: { roomId: string; quality: string }): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const validation = validateRoomJoinPayload({ roomId: data.roomId });
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid connection-quality payload', { type: 'connection-quality' });
      return;
    }

    // Broadcast connection quality to room participants for adaptive streaming
    socket.to(roomChannel(validation.roomId)).emit('webrtc:connection-quality-changed', {
      roomId: validation.roomId,
      userId: userInfo.userId,
      quality: data.quality,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get user connection info
   */
  getUserConnectionInfo(userId: string): SocketUser | undefined {
    return Array.from(this.connectedUsers.values()).find(user => user.userId === userId);
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get server instance
   */
  getServer(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Shutdown WebSocket server
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      console.log('📴 Shutting down WebSocket server...');
      this.io.close();
      this.io = null;
      this.connectedUsers.clear();
      this.userSockets.clear();
    }
    await closeSocketRedisClients(this.redisAdapterClients);
    this.redisAdapterClients = null;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
