import type { Socket } from 'socket.io';
export declare const roomChannel: (roomId: string) => string;
export declare const userChannel: (userId: string) => string;
export declare const profileChannel: (userId: string) => string;
export declare const emitSocketSuccess: (socket: Socket, event: string, payload?: Record<string, any>) => void;
export declare const emitSocketError: (socket: Socket, event: string, message: string, payload?: Record<string, any>) => void;
//# sourceMappingURL=socketHelpers.d.ts.map