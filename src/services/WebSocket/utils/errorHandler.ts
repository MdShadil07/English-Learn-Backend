export const logSocketError = (
  context: string,
  error: unknown,
  metadata: Record<string, any> = {}
): void => {
  const normalizedError =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };

  console.error('[WebSocketError]', {
    context,
    ...metadata,
    ...normalizedError,
    timestamp: new Date().toISOString(),
  });
};

export const logSocketInfo = (context: string, metadata: Record<string, any> = {}): void => {
  console.log('[WebSocketInfo]', {
    context,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};
