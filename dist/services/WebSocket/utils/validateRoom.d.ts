export declare const validateRoomId: (roomId: string) => boolean;
export declare const validateUserId: (userId: string) => boolean;
export declare const validateRoomJoinPayload: (payload: unknown) => {
    valid: boolean;
    error?: string;
    roomId?: string;
};
export declare const validateRoomMessagePayload: (payload: unknown) => {
    valid: boolean;
    error?: string;
    roomId?: string;
    message?: any;
};
//# sourceMappingURL=validateRoom.d.ts.map