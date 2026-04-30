declare class SFUMappingService {
    private getRoomKey;
    private getUserKey;
    private getNodeMetaKey;
    private getActiveSFUNodes;
    private selectBestNode;
    assignRoomToSFUServer(roomId: string): Promise<string>;
    getSFUServerForRoom(roomId: string): Promise<string>;
    clearRoomSFUMapping(roomId: string): Promise<void>;
    assignUserToRoom(userId: string, roomId: string): Promise<void>;
    getRoomForUser(userId: string): Promise<string | null>;
    removeUserRoomMapping(userId: string): Promise<void>;
}
export declare const sfuMappingService: SFUMappingService;
export default sfuMappingService;
//# sourceMappingURL=sfuMappingService.d.ts.map