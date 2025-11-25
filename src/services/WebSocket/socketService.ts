import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Socket } from 'socket.io';
import { User } from '../../models/index.js';
import { redisCache } from '../../config/redis.js';

interface SocketUser {
  userId: string;
  socketId: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
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
    console.log('🚀 WebSocket server initialized');
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
          socket.join(`user:${user._id}`);

          // Send connection confirmation
          socket.emit('connected', {
            success: true,
            userId: user._id,
            timestamp: new Date().toISOString(),
          });

          next();
        } catch (error) {
          console.error('WebSocket authentication error:', error);
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

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle connection errors
      socket.on('error', (error: Error) => {
        console.error('Socket error:', error);
        this.handleDisconnection(socket, 'error');
      });
    });
  }

  /**
   * Verify JWT token and get user (placeholder implementation)
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      // TODO: Integrate with your existing JWT verification system
      // For now, return a mock user for development
      return {
        _id: '507f1f77bcf86cd799439011', // Mock user ID
        email: 'user@example.com',
      };
    } catch (error) {
      console.error('Token verification error:', error);
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
    socket.join(`profile:${userInfo.userId}`);

    socket.emit('profile:subscribed', {
      success: true,
      userId: userInfo.userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle real-time profile updates
   */
  private handleProfileUpdate(socket: Socket, data: any): void {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    // Broadcast profile update to all connected clients for this user
    this.io?.to(`profile:${userInfo.userId}`).emit('profile:updated', {
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
    socket.to(`profile:${data.targetUserId || userInfo.userId}`).emit('typing:start', {
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
    socket.to(`profile:${data.targetUserId || userInfo.userId}`).emit('typing:stop', {
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
    socket.to(`profile:${userInfo.userId}`).emit('presence:updated', {
      userId: userInfo.userId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle user disconnection
   */
  private handleDisconnection(socket: Socket, reason: string): void {
    const userInfo = this.connectedUsers.get(socket.id);

    if (userInfo) {
      console.log(`📴 User disconnected: ${socket.id} (${userInfo.userId}) - Reason: ${reason}`);

      // Remove from connected users
      this.connectedUsers.delete(socket.id);
      this.userSockets.delete(userInfo.userId);

      // Notify other clients about disconnection
      socket.to(`profile:${userInfo.userId}`).emit('presence:updated', {
        userId: userInfo.userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });

      // Leave user's personal room
      socket.leave(`user:${userInfo.userId}`);
      socket.leave(`profile:${userInfo.userId}`);
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

    // Also broadcast to profile room
    this.io.to(`profile:${userId}`).emit('profile:updated', {
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

    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    }
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
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
