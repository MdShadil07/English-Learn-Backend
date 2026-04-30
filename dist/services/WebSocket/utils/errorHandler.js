export const logSocketError = (context, error, metadata = {}) => {
    const normalizedError = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
    console.error('[WebSocketError]', {
        context,
        ...metadata,
        ...normalizedError,
        timestamp: new Date().toISOString(),
    });
};
export const logSocketInfo = (context, metadata = {}) => {
    console.log('[WebSocketInfo]', {
        context,
        ...metadata,
        timestamp: new Date().toISOString(),
    });
};
//# sourceMappingURL=errorHandler.js.map