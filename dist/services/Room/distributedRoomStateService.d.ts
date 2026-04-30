declare class DistributedRoomStateService {
    private localRoomUsers;
    private localCallUsers;
    private localRoomMessages;
    private readonly roomStateTTLSeconds;
    private getRedisRoomUsersKey;
    private getRedisCallUsersKey;
    private getRedisRoomMessagesKey;
    private getRedisRoomMetadataKey;
    private getRoomMetadata;
    invalidateRoomMetadata(roomId: string): Promise<void>;
    validateRoomExists(roomId: string): Promise<boolean>;
    validateUserCanJoinRoom(roomId: string, userId: string): Promise<boolean>;
    isRoomHost(roomId: string, userId: string): Promise<boolean>;
    isRoomModerator(roomId: string, userId: string): Promise<boolean>;
    addUserToRoom(roomId: string, userId: string): Promise<void>;
    removeUserFromRoom(roomId: string, userId: string): Promise<void>;
    getRoomUsers(roomId: string): Promise<string[]>;
    addUserToCall(roomId: string, userId: string): Promise<void>;
    removeUserFromCall(roomId: string, userId: string): Promise<void>;
    getCallUsers(roomId: string): Promise<string[]>;
    saveRoomMessage(roomId: string, message: any): Promise<void>;
    getRoomMessages(roomId: string): Promise<any[]>;
    clearRoomMessages(roomId: string): Promise<void>;
    clearRoomData(roomId: string): Promise<void>;
}
export declare const distributedRoomStateService: DistributedRoomStateService;
export default distributedRoomStateService;
//# sourceMappingURL=distributedRoomStateService.d.ts.map