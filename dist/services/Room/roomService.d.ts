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
}
export interface RoomParticipant {
    userId: string;
    username?: string;
    fullName?: string;
    avatar?: string;
}
export interface RoomDetails {
    roomId: string;
    roomCode?: string;
    topic: string;
    description?: string;
    banner?: string;
    bannerText?: string;
    bannerFontFamily?: string;
    bannerIsBold?: boolean;
    bannerIsItalic?: boolean;
    bannerFontSize?: number;
    hostId: string;
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
}
export declare class RoomService {
    /**
     * Create a new practice room
     */
    createRoom(data: CreateRoomData): Promise<RoomDetails>;
    /**
     * Join an existing room
     */
    joinRoom(roomId: string, userId: string, roomCode?: string): Promise<RoomDetails>;
    /**
     * Leave a room
     */
    leaveRoom(roomId: string, userId: string): Promise<RoomDetails>;
    getRoomDetails(roomId: string, userId?: string): Promise<RoomDetails | null>;
    getUserRooms(userId: string): Promise<RoomDetails[]>;
    getActiveRooms(): Promise<RoomDetails[]>;
    closeRoom(roomId: string, userId: string): Promise<RoomDetails>;
    startCall(roomId: string, userId: string): Promise<void>;
    endCall(roomId: string, userId: string): Promise<void>;
    getCallParticipants(roomId: string): Promise<string[]>;
    /**
     * Format room details.
     * roomCode is only exposed to the host (privacy guarantee).
     */
    private formatRoomDetails;
}
export declare const roomService: RoomService;
export default roomService;
//# sourceMappingURL=roomService.d.ts.map