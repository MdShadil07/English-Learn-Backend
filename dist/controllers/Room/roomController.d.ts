import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: any;
    file?: Express.Multer.File;
}
export declare class RoomController {
    /**
     * Create a new practice room
     * POST /api/rooms
     */
    createRoom(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Upload practice room banner
     * POST /api/rooms/upload-banner
     */
    uploadBanner(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Join an existing room
     * POST /api/rooms/:roomId/join
     */
    joinRoom(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Leave a room
     * POST /api/rooms/:roomId/leave
     */
    leaveRoom(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get all active non-private rooms
     * GET /api/rooms/active
     */
    getActiveRooms(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get room details
     * GET /api/rooms/:roomId
     */
    getRoomDetails(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get user's rooms
     * GET /api/rooms/my-rooms
     */
    getUserRooms(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Close a room (host only)
     * POST /api/rooms/:roomId/close
     */
    closeRoom(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Start WebRTC call in room
     * POST /api/rooms/:roomId/start-call
     */
    startCall(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * End WebRTC call in room
     * POST /api/rooms/:roomId/end-call
     */
    endCall(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get call participants in room
     * GET /api/rooms/:roomId/call-participants
     */
    getCallParticipants(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const roomController: RoomController;
export default roomController;
//# sourceMappingURL=roomController.d.ts.map