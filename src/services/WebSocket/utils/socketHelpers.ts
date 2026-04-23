import type { Socket } from 'socket.io';

export const roomChannel = (roomId: string): string => `room:${roomId}`;
export const userChannel = (userId: string): string => `user:${userId}`;
export const profileChannel = (userId: string): string => `profile:${userId}`;

export const emitSocketSuccess = (
  socket: Socket,
  event: string,
  payload: Record<string, any> = {}
): void => {
  socket.emit(event, {
    success: true,
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

export const emitSocketError = (
  socket: Socket,
  event: string,
  message: string,
  payload: Record<string, any> = {}
): void => {
  socket.emit(event, {
    success: false,
    error: message,
    ...payload,
    timestamp: new Date().toISOString(),
  });
};
