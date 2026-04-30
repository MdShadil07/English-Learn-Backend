export const roomChannel = (roomId) => `room:${roomId}`;
export const userChannel = (userId) => `user:${userId}`;
export const profileChannel = (userId) => `profile:${userId}`;
export const emitSocketSuccess = (socket, event, payload = {}) => {
    socket.emit(event, {
        success: true,
        ...payload,
        timestamp: new Date().toISOString(),
    });
};
export const emitSocketError = (socket, event, message, payload = {}) => {
    socket.emit(event, {
        success: false,
        error: message,
        ...payload,
        timestamp: new Date().toISOString(),
    });
};
//# sourceMappingURL=socketHelpers.js.map