import { Types } from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { User, Room } from '../../models/index.js';
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

class WebSocketService {
  private io: SocketIOServer | null = null;
  private redisAdapterClients: SocketRedisClients | null = null;
  

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
      perMessageDeflate: { threshold: 512 },
      maxHttpBufferSize: 1e6,
    });

    // ── Connection-level auth middleware (runs ONCE per socket, not per packet) ──
    // BLOCKER-3 FIX: Previously socket.use() ran User.findById() on every event.
    // io.use() runs only at handshake time — result is cached in socket.data.
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) return next(new Error('Authentication required'));

        const decoded = await verifyToken(token, authConfig.jwtSecret);
        if (!decoded || decoded.type !== 'access') {
          return next(new Error('Invalid token type'));
        }

        // ONE DB hit per connection — userId cached for lifetime of socket
        const user = await User.findById(decoded.userId).select('_id username').lean();
        if (!user) return next(new Error('User not found'));

        socket.data.userId   = (user as any)._id.toString();
        socket.data.userName = (user as any).username;
        return next();
      } catch (err) {
        logSocketError('WebSocket connection auth failed', err);
        return next(new Error('Authentication failed'));
      }
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
      // socket.data.userId already set by io.use() auth middleware above
      const userId = socket.data.userId as string;
      console.log(`🔗 User connected: ${socket.id} (${userId})`);

      // Join personal channel — auth is already confirmed
      socket.join(userChannel(userId));
      emitSocketSuccess(socket, 'connected', { userId });

      // Profile events
      socket.on('profile:subscribe', (data: any) => { this.handleProfileSubscription(socket, data); });
      socket.on('profile:update',    (data: any) => { this.handleProfileUpdate(socket, data); });
      socket.on('typing:start',      (data: any) => { this.handleTypingStart(socket, data); });
      socket.on('typing:stop',       (data: any) => { this.handleTypingStop(socket, data); });
      socket.on('presence:update',   (data: any) => { this.handlePresenceUpdate(socket, data); });

      // Room event handlers
      this.setupRoomEventHandlers(socket);

      // Disconnection
      socket.on('disconnecting', (reason: string) => { void this.handleDisconnection(socket, reason); });
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
    const userId = socket.data.userId;
    if (!userId) return;

    // Subscribe to profile changes for this user
    socket.join(profileChannel(userId));
    emitSocketSuccess(socket, 'profile:subscribed', { userId: userId });
  }

  /**
   * Handle real-time profile updates
   */
  private handleProfileUpdate(socket: Socket, data: any): void {
    const userId = socket.data.userId;
    if (!userId) return;

    // Broadcast profile update to all connected clients for this user
    this.io?.to(profileChannel(userId)).emit('profile:updated', {
      userId: userId,
      data: data.profileData,
      timestamp: new Date().toISOString(),
    });

    // Invalidate cache
    this.invalidateProfileCache(userId);
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: Socket, data: any): void {
    const userId = socket.data.userId;
    if (!userId) return;

    // Broadcast typing start to relevant users
    socket.to(profileChannel(data.targetUserId || userId)).emit('typing:start', {
      userId: userId,
      field: data.field,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: Socket, data: any): void {
    const userId = socket.data.userId;
    if (!userId) return;

    // Broadcast typing stop to relevant users
    socket.to(profileChannel(data.targetUserId || userId)).emit('typing:stop', {
      userId: userId,
      field: data.field,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle presence updates
   */
  private handlePresenceUpdate(socket: Socket, data: any): void {
    const userId = socket.data.userId;
    if (!userId) return;

    // Update user presence
    socket.to(profileChannel(userId)).emit('presence:updated', {
      userId: userId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle user disconnection
   */
  private async handleDisconnection(socket: Socket, reason: string): Promise<void> {
    const userId = socket.data.userId;

    if (userId) {
      const userInfo = { userId };
      console.log(`📴 User disconnected: ${socket.id} (${userId}) - Reason: ${reason}`);

      // Notify rooms that user left calls
      for (const room of socket.rooms) {
        if (room.startsWith('room:')) {
          const roomId = room.replace('room:', '');
          
          try {
            // Break circular dependency with dynamic import
            const { roomService } = await import('../Room/roomService.js');
            await roomService.leaveRoom(roomId, userId);
          } catch (err) {
            console.error(`[Socket] Failed to auto-leave room ${roomId} on disconnect:`, err);
            // Fallback to manual state cleanup if service fails
            await distributedRoomStateService.removeUserFromRoom(roomId, userId);
            await distributedRoomStateService.removeUserFromCall(roomId, userId);
          }

          // Notify other participants that user left the call due to disconnection
          socket.to(room).emit('webrtc:user-left-call', {
            roomId,
            userId: userId,
            reason: 'disconnected',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Remove from connected users
      

      // Notify other clients about disconnection
      socket.to(profileChannel(userId)).emit('presence:updated', {
        userId: userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });

      // Leave user's personal room
      socket.leave(userChannel(userId));
      socket.leave(profileChannel(userId));
    }
  }

  /**
   * Send profile update notification to specific user
   */
  async notifyProfileUpdate(userId: string, profileData: any): Promise<void> {
    if (!this.io) return;

    
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
    // Cannot directly call socket.join on another instance.
    // Assuming user joined the room via REST and will listen to room events,
    // they can explicitly subscribe or we just let them auto-join on next connect.
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
    // Handled by room state and Redis; specific socket leaves will happen locally or on disconnect.
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

    // Handle hand raise
    socket.on('room:hand-toggle', (data: { roomId: string; isRaised: boolean }) => {
      this.handleRoomHandToggle(socket, data);
    });

    // Handle reaction
    socket.on('room:reaction', (data: { roomId: string; reaction: string }) => {
      this.handleRoomReaction(socket, data);
    });

    // Room Moderation events
    socket.on('room:kick-user', (data: any) => {
      this.handleRoomKickUser(socket, data);
    });

    socket.on('room:mute-user', (data: any) => {
      this.handleRoomMuteUser(socket, data);
    });

    socket.on('room:toggle-lock', (data: any) => {
      this.handleRoomToggleLock(socket, data);
    });

    socket.on('room:toggle-moderator', (data: any) => {
      this.handleRoomToggleModerator(socket, data);
    });

    socket.on('room:mute-all', (data: { roomId: string }) => {
      this.handleRoomMuteAll(socket, data);
    });

    socket.on('room:clear-chat', (data: { roomId: string }) => {
      this.handleRoomClearChat(socket, data);
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

    // Moderator controls
    socket.on('room:kick-user', (data: { roomId: string; targetUserId: string }) => {
      this.handleRoomKickUser(socket, data);
    });

    socket.on('room:mute-user', (data: { roomId: string; targetUserId: string }) => {
      this.handleRoomMuteUser(socket, data);
    });

    socket.on('room:toggle-lock', (data: { roomId: string; isLocked: boolean }) => {
      this.handleRoomToggleLock(socket, data);
    });

    socket.on('room:unblock-user', (data: { roomId: string; targetUserId: string }) => {
      this.handleRoomUnblockUser(socket, data);
    });
  }

  /**
   * Handle moderator unblock
   */
  private async handleRoomUnblockUser(socket: Socket, data: { roomId: string; targetUserId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const isHost = await distributedRoomStateService.isRoomHost(data.roomId, userId);
    if (!isHost) return;

    // Remove from persistent blocking
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { $pull: { blockedUsers: new Types.ObjectId(data.targetUserId) } }
    );

    // Notify room
    this.io?.to(roomChannel(data.roomId)).emit('room:user-unblocked', { 
      userId: data.targetUserId,
      unblockedBy: userId 
    });
  }

  /**
   * Handle moderator kick
   */
  private async handleRoomKickUser(socket: Socket, data: { roomId: string; targetUserId: string; isBlock?: boolean }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const isMod = await distributedRoomStateService.isRoomModerator(data.roomId, userId);
    if (!isMod) return;

    // Verify room and ensure target is NOT the host
    const room = await Room.findByRoomId(data.roomId);
    if (!room) return;

    const targetObjectId = new Types.ObjectId(data.targetUserId);
    if (room.hostId.equals(targetObjectId)) {
      console.warn('[Moderation] Attempted to moderate the room host; action denied.');
      return;
    }

    // Handle persistent blocking and immediate participant removal
    const updateQuery: any = { 
      $pull: { participants: targetObjectId } 
    };
    
    if (data.isBlock) {
      updateQuery.$addToSet = { blockedUsers: targetObjectId };
    }

    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      updateQuery
    );

    // Notify targeted user to leave
    this.io?.to(userChannel(data.targetUserId)).emit('room:force-kick', {
        roomId: data.roomId,
        isBlocked: !!data.isBlock 
      });

    // Notify room
    this.io?.to(roomChannel(data.roomId)).emit('room:user-kicked', { 
      userId: data.targetUserId,
      kickedBy: userId,
      isBlocked: !!data.isBlock
    });
  }

  /**
   * Handle moderator mute
   */
  private async handleRoomMuteUser(socket: Socket, data: { roomId: string; targetUserId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const isMod = await distributedRoomStateService.isRoomModerator(data.roomId, userId);
    if (!isMod) return;

    // Verify target is NOT the host
    const room = await Room.findByRoomId(data.roomId);
    if (!room || room.hostId.equals(new Types.ObjectId(data.targetUserId))) return;

    this.io?.to(userChannel(data.targetUserId)).emit('room:force-mute', {
        roomId: data.roomId,
        mutedBy: userId 
      });
  }

  /**
   * Handle moderator status toggle
   */
  private async handleRoomToggleModerator(socket: Socket, data: { roomId: string; targetUserId: string; isModerator: boolean }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    // ONLY the host can promote/demote moderators
    const isHost = await distributedRoomStateService.isRoomHost(data.roomId, userId);
    if (!isHost) return;

    const targetObjectId = new Types.ObjectId(data.targetUserId);
    const update = data.isModerator 
      ? { $addToSet: { moderators: targetObjectId } }
      : { $pull: { moderators: targetObjectId } };

    await Room.findOneAndUpdate({ roomId: data.roomId }, update);

    // Notify room
    this.io?.to(roomChannel(data.roomId)).emit('room:moderator-updated', {
      userId: data.targetUserId,
      isModerator: data.isModerator,
      updatedBy: userId
    });
  }

  /**
   * Handle room lock toggle
   */
  private async handleRoomToggleLock(socket: Socket, data: { roomId: string; isLocked: boolean }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const isMod = await distributedRoomStateService.isRoomModerator(data.roomId, userId);
    if (!isMod) return;

    await Room.findOneAndUpdate({ roomId: data.roomId }, { isLocked: data.isLocked });
    
    // Global broadcast for real-time dashboard updates
    this.io?.to(roomChannel(data.roomId)).emit('room:lock-updated', { 
      roomId: data.roomId,
      isLocked: data.isLocked,
      updatedBy: userId
    });
  }

  /**
   * Handle hand raise toggle
   */
  private handleRoomHandToggle(socket: Socket, data: { roomId: string; isRaised: boolean }): void {
    const userId = socket.data.userId;
    if (!userId || !data.roomId) return;

    socket.to(roomChannel(data.roomId)).emit('room:hand-toggled', {
      userId: userId,
      isRaised: data.isRaised,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle room reaction
   */
  private handleRoomReaction(socket: Socket, data: { roomId: string; reaction: string }): void {
    const userId = socket.data.userId;
    if (!userId || !data.roomId) return;

    socket.to(roomChannel(data.roomId)).emit('room:reaction', {
      userId: userId,
      reaction: data.reaction,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle room join via socket
   */
  private async handleRoomJoin(socket: Socket, data: { roomId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    try {
      const validation = validateRoomJoinPayload(data);
      if (!validation.valid || !validation.roomId) {
        emitSocketError(socket, 'room:error', validation.error || 'Invalid room join payload');
        return;
      }

      const { roomId } = validation;

      if (!validateUserId(userId)) {
        emitSocketError(socket, 'room:error', 'Invalid userId', { roomId });
        return;
      }

      const roomExists = await distributedRoomStateService.validateRoomExists(roomId);
      if (!roomExists) {
        emitSocketError(socket, 'room:error', 'Room not found or inactive', { roomId });
        return;
      }

      const canJoin = await distributedRoomStateService.validateUserCanJoinRoom(roomId, userId);
      if (!canJoin) {
        emitSocketError(socket, 'room:error', 'User is not allowed to join this room', { roomId });
        return;
      }

      socket.join(roomChannel(roomId));
      await distributedRoomStateService.addUserToRoom(roomId, userId);

      emitSocketSuccess(socket, 'room:joined', {
        roomId,
        userId: userId,
      });

      // Send chat history if any
      const history = await distributedRoomStateService.getRoomMessages(roomId);
      if (history && history.length > 0) {
        socket.emit('room:history', { roomId, messages: history });
      }
    } catch (error) {
      logSocketError('handleRoomJoin failed', error, { userId: userId, roomId: data?.roomId });
      emitSocketError(socket, 'room:error', 'Failed to join room', { roomId: data?.roomId });
    }
  }

  /**
   * Handle room leave via socket
   */
  private async handleRoomLeave(socket: Socket, data: { roomId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'room:error', validation.error || 'Invalid room leave payload');
      return;
    }

    const { roomId } = validation;

    socket.leave(roomChannel(roomId));
    await distributedRoomStateService.removeUserFromRoom(roomId, userId);
    emitSocketSuccess(socket, 'room:left', {
      roomId,
      userId: userId,
    });
  }

  /**
   * Handle room message via socket
   */
  private async handleRoomMessage(socket: Socket, data: { roomId: string; message: any }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const validation = validateRoomMessagePayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'room:error', validation.error || 'Invalid room message payload');
      return;
    }

    const messageData = {
      roomId: validation.roomId,
      userId: userId,
      message: validation.message,
      timestamp: new Date().toISOString(),
    };

    // Save to history
    await distributedRoomStateService.saveRoomMessage(validation.roomId, messageData);

    // Broadcast message to room only (targeted emit)
    socket.to(roomChannel(validation.roomId)).emit('room:message', messageData);
  }

  /**
   * Handle WebRTC offer
   */
  private async handleWebRTCOffer(socket: Socket, data: { roomId: string; targetUserId: string; offer: any }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

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
        fromUserId: userId,
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
    const userId = socket.data.userId;
    if (!userId) return;

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
        fromUserId: userId,
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
    const userId = socket.data.userId;
    if (!userId) return;

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
        fromUserId: userId,
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
    const userId = socket.data.userId;
    if (!userId) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid join-call payload', { type: 'join-call' });
      return;
    }
    const roomId = validation.roomId;

    try {
      const canJoin = await distributedRoomStateService.validateUserCanJoinRoom(roomId, userId);
      if (!canJoin) {
        emitSocketError(socket, 'webrtc:error', 'User is not allowed to join call for this room', { type: 'join-call', roomId });
        return;
      }

      // Get all current call participants
      const callParticipants = await this.getRoomCallParticipants(roomId);
      await distributedRoomStateService.addUserToCall(roomId, userId);

      // Notify existing participants that new user joined
      socket.to(roomChannel(roomId)).emit('webrtc:user-joined-call', {
        roomId,
        userId: userId,
        timestamp: new Date().toISOString(),
      });

      // Send list of existing participants to the new user
      socket.emit('webrtc:call-joined', {
        roomId,
        userId: userId,
        existingParticipants: callParticipants.filter(id => id !== userId),
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
    const userId = socket.data.userId;
    if (!userId) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid leave-call payload', { type: 'leave-call' });
      return;
    }
    const roomId = validation.roomId;

    try {
      await distributedRoomStateService.removeUserFromCall(roomId, userId);
      // Notify room participants that user left the call
      socket.to(roomChannel(roomId)).emit('webrtc:user-left-call', {
        roomId,
        userId: userId,
        reason: 'left',
        timestamp: new Date().toISOString(),
      });

      // Confirm to user
      socket.emit('webrtc:call-left', {
        roomId,
        userId: userId,
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
    const userId = socket.data.userId;
    if (!userId) return;

    const validation = validateRoomJoinPayload(data);
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid ping payload', { type: 'ping' });
      return;
    }

    // Respond with pong to maintain connection health
    socket.emit('webrtc:pong', {
      roomId: validation.roomId,
      userId: userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle WebRTC connection quality reports
   */
  private async handleWebRTCConnectionQuality(socket: Socket, data: { roomId: string; quality: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const validation = validateRoomJoinPayload({ roomId: data.roomId });
    if (!validation.valid || !validation.roomId) {
      emitSocketError(socket, 'webrtc:error', validation.error || 'Invalid connection-quality payload', { type: 'connection-quality' });
      return;
    }

    // Broadcast connection quality to room participants for adaptive streaming
    socket.to(roomChannel(validation.roomId)).emit('webrtc:connection-quality-changed', {
      roomId: validation.roomId,
      userId: userId,
      quality: data.quality,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.io?.engine.clientsCount || 0;
  }

  /**
   * Get user connection info
   */
  getUserConnectionInfo(userId: string): any | undefined {
    return undefined;
  }

  /**
   * Check if user is connected
   */
  async isUserConnected(userId: string): Promise<boolean> {
    if (!this.io) return false;
    const sockets = await this.io.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  }

  /**
   * Get server instance
   */
  getServer(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Handle global mute
   */
  private async handleRoomMuteAll(socket: Socket, data: { roomId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const isMod = await distributedRoomStateService.isRoomModerator(data.roomId, userId);
    if (!isMod) return;

    const room = await Room.findByRoomId(data.roomId);
    if (!room) return;

    // Broadcast force-mute to all participants EXCEPT host and moderators
    const excludedIds = [room.hostId.toString(), ...room.moderators.map(m => m.toString())];
    
    this.io?.to(roomChannel(data.roomId)).emit('room:force-mute-all', { 
      mutedBy: userId,
      excludedIds
    });
  }

  /**
   * Handle chat history clear
   */
  private async handleRoomClearChat(socket: Socket, data: { roomId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;

    const isMod = await distributedRoomStateService.isRoomModerator(data.roomId, userId);
    if (!isMod) return;

    // Clear from Redis/Cache
    await distributedRoomStateService.clearRoomMessages(data.roomId);

    // Notify room
    this.io?.to(roomChannel(data.roomId)).emit('room:chat-cleared', {
      clearedBy: userId
    });
  }

  /**
   * Shutdown WebSocket server
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      console.log('📴 Shutting down WebSocket server...');
      this.io.close();
      this.io = null;
      
    }
    await closeSocketRedisClients(this.redisAdapterClients);
    this.redisAdapterClients = null;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
