import { Request, Response } from 'express';
import { roomService } from '../../services/Room/roomService.js';

interface AuthRequest extends Request {
  user?: any;
}

export class RoomController {
  /**
   * Create a new practice room
   * POST /api/rooms
   */
  async createRoom(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { topic, description, maxParticipants, isPrivate } = req.body;

      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Room topic is required',
        });
      }

      const room = await roomService.createRoom({
        hostId: req.user._id,
        topic: topic.trim(),
        description: description?.trim(),
        maxParticipants,
        isPrivate: isPrivate || false,
      });

      return res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: room,
      });
    } catch (error) {
      console.error('Create room error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create room',
      });
    }
  }

  /**
   * Join an existing room
   * POST /api/rooms/:roomId/join
   */
  async joinRoom(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      const room = await roomService.joinRoom(roomId, req.user._id);

      return res.json({
        success: true,
        message: 'Joined room successfully',
        data: room,
      });
    } catch (error) {
      console.error('Join room error:', error);

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 :
                        error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('full') ? 409 :
                        error instanceof Error && error.message.includes('already in') ? 409 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to join room',
      });
    }
  }

  /**
   * Leave a room
   * POST /api/rooms/:roomId/leave
   */
  async leaveRoom(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      const room = await roomService.leaveRoom(roomId, req.user._id);

      return res.json({
        success: true,
        message: 'Left room successfully',
        data: room,
      });
    } catch (error) {
      console.error('Leave room error:', error);

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 :
                        error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('not in') ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to leave room',
      });
    }
  }

  /**
   * Get all active non-private rooms
   * GET /api/rooms/active
   */
  async getActiveRooms(req: Request, res: Response) {
    try {
      const rooms = await roomService.getActiveRooms();

      return res.json({
        success: true,
        data: rooms,
      });
    } catch (error) {
      console.error('Get active rooms error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get active rooms',
      });
    }
  }

  /**
   * Get room details
   * GET /api/rooms/:roomId
   */
  async getRoomDetails(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      const room = await roomService.getRoomDetails(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        });
      }

      return res.json({
        success: true,
        data: room,
      });
    } catch (error) {
      console.error('Get room details error:', error);
      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get room details',
      });
    }
  }

  /**
   * Get user's rooms
   * GET /api/rooms/my-rooms
   */
  async getUserRooms(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const rooms = await roomService.getUserRooms(req.user._id);

      return res.json({
        success: true,
        data: rooms,
      });
    } catch (error) {
      console.error('Get user rooms error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get user rooms',
      });
    }
  }

  /**
   * Close a room (host only)
   * POST /api/rooms/:roomId/close
   */
  async closeRoom(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      const room = await roomService.closeRoom(roomId, req.user._id);

      return res.json({
        success: true,
        message: 'Room closed successfully',
        data: room,
      });
    } catch (error) {
      console.error('Close room error:', error);

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 :
                        error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Only host') ? 403 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to close room',
      });
    }
  }

  /**
   * Start WebRTC call in room
   * POST /api/rooms/:roomId/start-call
   */
  async startCall(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      await roomService.startCall(roomId, req.user._id);

      return res.json({
        success: true,
        message: 'Call started successfully',
      });
    } catch (error) {
      console.error('Start call error:', error);

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 :
                        error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('not active') ? 409 :
                        error instanceof Error && error.message.includes('not a participant') ? 403 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start call',
      });
    }
  }

  /**
   * End WebRTC call in room
   * POST /api/rooms/:roomId/end-call
   */
  async endCall(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      await roomService.endCall(roomId, req.user._id);

      return res.json({
        success: true,
        message: 'Call ended successfully',
      });
    } catch (error) {
      console.error('End call error:', error);

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 :
                        error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('not a participant') ? 403 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to end call',
      });
    }
  }

  /**
   * Get call participants in room
   * GET /api/rooms/:roomId/call-participants
   */
  async getCallParticipants(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { roomId } = req.params;

      const participants = await roomService.getCallParticipants(roomId);

      return res.json({
        success: true,
        data: participants,
      });
    } catch (error) {
      console.error('Get call participants error:', error);
      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get call participants',
      });
    }
  }
}

export const roomController = new RoomController();
export default roomController;
