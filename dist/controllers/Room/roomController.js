import { roomService } from '../../services/Room/roomService.js';
import { roomBannerUploadService } from '../../services/Room/roomBannerUploadService.js';
export class RoomController {
    /**
     * Create a new practice room
     * POST /api/rooms
     */
    async createRoom(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            const { topic, description, maxParticipants, isPrivate, banner, bannerText, bannerFontFamily, bannerIsBold, bannerIsItalic, bannerFontSize } = req.body;
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
                banner: banner?.trim(),
                bannerText: bannerText !== undefined ? bannerText : undefined,
                bannerFontFamily: bannerFontFamily?.trim(),
                bannerIsBold,
                bannerIsItalic,
                bannerFontSize,
                maxParticipants,
                isPrivate: isPrivate || false,
            });
            const sfuUrl = process.env.SFU_URL || 'http://localhost:3001';
            return res.status(201).json({
                success: true,
                message: 'Room created successfully',
                data: { ...room, sfuUrl },
            });
        }
        catch (error) {
            console.error('Create room error:', error);
            return res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to create room',
            });
        }
    }
    /**
     * Upload practice room banner
     * POST /api/rooms/upload-banner
     */
    async uploadBanner(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No banner file provided',
                });
            }
            const bannerUrl = await roomBannerUploadService.uploadBanner(req.file, req.user._id);
            return res.status(200).json({
                success: true,
                message: 'Banner uploaded successfully',
                data: { bannerUrl },
            });
        }
        catch (error) {
            console.error('Upload banner error:', error);
            return res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to upload banner',
            });
        }
    }
    /**
     * Join an existing room
     * POST /api/rooms/:roomId/join
     */
    async joinRoom(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            const { roomId } = req.params;
            const { roomCode } = req.body; // Optional: required for private rooms
            const room = await roomService.joinRoom(roomId, req.user._id, roomCode);
            const sfuUrl = process.env.SFU_URL || 'http://localhost:3001';
            return res.json({
                success: true,
                message: 'Joined room successfully',
                data: { ...room, sfuUrl },
            });
        }
        catch (error) {
            console.error('Join room error:', error);
            const msg = error instanceof Error ? error.message : '';
            const statusCode = msg === 'PRIVATE_ROOM_CODE_REQUIRED' ? 403 :
                msg === 'INVALID_ROOM_CODE' ? 403 :
                    msg.includes('Invalid') ? 400 :
                        msg.includes('not found') ? 404 :
                            msg.includes('full') ? 409 : 500;
            return res.status(statusCode).json({
                success: false,
                message: msg || 'Failed to join room',
                code: msg === 'PRIVATE_ROOM_CODE_REQUIRED' || msg === 'INVALID_ROOM_CODE' ? msg : undefined,
            });
        }
    }
    /**
     * Leave a room
     * POST /api/rooms/:roomId/leave
     */
    async leaveRoom(req, res) {
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
        }
        catch (error) {
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
    async getActiveRooms(req, res) {
        try {
            const rooms = await roomService.getActiveRooms();
            const sfuUrl = process.env.SFU_URL || 'http://localhost:3001';
            return res.json({
                success: true,
                data: rooms.map(room => ({ ...room, sfuUrl })),
            });
        }
        catch (error) {
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
    async getRoomDetails(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            const { roomId } = req.params;
            const room = await roomService.getRoomDetails(roomId, req.user._id.toString());
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found',
                });
            }
            const sfuUrl = process.env.SFU_URL || 'http://localhost:3001';
            return res.json({
                success: true,
                data: { ...room, sfuUrl },
            });
        }
        catch (error) {
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
    async getUserRooms(req, res) {
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
        }
        catch (error) {
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
    async closeRoom(req, res) {
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
        }
        catch (error) {
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
    async startCall(req, res) {
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
        }
        catch (error) {
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
    async endCall(req, res) {
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
        }
        catch (error) {
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
    async getCallParticipants(req, res) {
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
        }
        catch (error) {
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
//# sourceMappingURL=roomController.js.map