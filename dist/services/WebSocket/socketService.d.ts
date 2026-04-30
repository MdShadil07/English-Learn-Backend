import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
declare class WebSocketService {
    private io;
    private redisAdapterClients;
    /**
     * Initialize WebSocket server
     */
    initialize(server: HTTPServer): void;
    private setupRedisAdapter;
    /**
     * Setup WebSocket event handlers
     */
    private setupEventHandlers;
    /**
     * Verify JWT token and get user
     */
    private verifyToken;
    /**
     * Handle profile subscription
     */
    private handleProfileSubscription;
    /**
     * Handle real-time profile updates
     */
    private handleProfileUpdate;
    /**
     * Handle typing start
     */
    private handleTypingStart;
    /**
     * Handle typing stop
     */
    private handleTypingStop;
    /**
     * Handle presence updates
     */
    private handlePresenceUpdate;
    /**
     * Handle user disconnection
     */
    private handleDisconnection;
    /**
     * Send profile update notification to specific user
     */
    notifyProfileUpdate(userId: string, profileData: any): Promise<void>;
    /**
     * Send notification to user
     */
    notifyUser(userId: string, event: string, data: any): Promise<void>;
    /**
     * Invalidate profile cache
     */
    private invalidateProfileCache;
    /**
     * Notify when a room is created
     */
    notifyRoomCreated(roomId: string, hostId: string): Promise<void>;
    /**
     * Notify when a user joins a room
     */
    notifyRoomJoined(roomId: string, userId: string): Promise<void>;
    /**
     * Notify when a user leaves a room
     */
    notifyRoomLeft(roomId: string, userId: string): Promise<void>;
    /**
     * Notify when a room is closed
     */
    notifyRoomClosed(roomId: string): Promise<void>;
    /**
     * Send message to room participants
     */
    sendRoomMessage(roomId: string, userId: string, message: any): Promise<void>;
    /**
     * Notify WebRTC call started in room
     */
    notifyWebRTCCallStarted(roomId: string, initiatorUserId: string): Promise<void>;
    /**
     * Notify WebRTC call ended in room
     */
    notifyWebRTCCallEnded(roomId: string, endedByUserId: string): Promise<void>;
    /**
     * Get room participants currently in call
     */
    getRoomCallParticipants(roomId: string): Promise<string[]>;
    /**
     * Handle room-specific socket events
     */
    private setupRoomEventHandlers;
    /**
     * Handle moderator unblock
     */
    private handleRoomUnblockUser;
    /**
     * Handle moderator kick
     */
    private handleRoomKickUser;
    /**
     * Handle moderator mute
     */
    private handleRoomMuteUser;
    /**
     * Handle moderator status toggle
     */
    private handleRoomToggleModerator;
    /**
     * Handle room lock toggle
     */
    private handleRoomToggleLock;
    /**
     * Handle hand raise toggle
     */
    private handleRoomHandToggle;
    /**
     * Handle room reaction
     */
    private handleRoomReaction;
    /**
     * Handle room join via socket
     */
    private handleRoomJoin;
    /**
     * Handle room leave via socket
     */
    private handleRoomLeave;
    /**
     * Handle room message via socket
     */
    private handleRoomMessage;
    /**
     * Handle WebRTC offer
     */
    private handleWebRTCOffer;
    /**
     * Handle WebRTC answer
     */
    private handleWebRTCAnswer;
    /**
     * Handle WebRTC ICE candidate
     */
    private handleWebRTCIceCandidate;
    /**
     * Handle WebRTC join call
     */
    private handleWebRTCJoinCall;
    /**
     * Handle WebRTC leave call
     */
    private handleWebRTCLeaveCall;
    /**
     * Handle WebRTC ping for connection monitoring
     */
    private handleWebRTCPing;
    /**
     * Handle WebRTC connection quality reports
     */
    private handleWebRTCConnectionQuality;
    /**
     * Get connected users count
     */
    getConnectedUsersCount(): number;
    /**
     * Get user connection info
     */
    getUserConnectionInfo(userId: string): any | undefined;
    /**
     * Check if user is connected
     */
    isUserConnected(userId: string): Promise<boolean>;
    /**
     * Get server instance
     */
    getServer(): SocketIOServer | null;
    /**
     * Handle global mute
     */
    private handleRoomMuteAll;
    /**
     * Handle chat history clear
     */
    private handleRoomClearChat;
    /**
     * Shutdown WebSocket server
     */
    shutdown(): Promise<void>;
}
export declare const webSocketService: WebSocketService;
export default webSocketService;
//# sourceMappingURL=socketService.d.ts.map