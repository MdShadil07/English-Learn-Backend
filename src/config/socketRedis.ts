import { createClient } from 'redis';
import { logSocketError, logSocketInfo } from '../services/WebSocket/utils/errorHandler.js';

export interface SocketRedisClients {
  pubClient: any;
  subClient: any;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SOCKET_REDIS_CONNECT_TIMEOUT_MS = Number(process.env.SOCKET_REDIS_CONNECT_TIMEOUT_MS || 4000);
const SOCKET_REDIS_MAX_RETRIES = Number(process.env.SOCKET_REDIS_MAX_RETRIES || 5);

const getReconnectDelay = (retries: number): number => {
  if (retries > SOCKET_REDIS_MAX_RETRIES) {
    return 0;
  }

  return Math.min(100 * 2 ** retries, 5000);
};

const createSocketRedisClient = (label: 'pub' | 'sub') => {
  const client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: SOCKET_REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) => getReconnectDelay(retries),
    },
  });

  client.on('ready', () => {
    logSocketInfo('socket redis client ready', { label });
  });

  client.on('error', (error) => {
    logSocketError('socket redis client error', error, { label });
  });

  client.on('end', () => {
    logSocketInfo('socket redis client ended', { label });
  });

  return client;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, context: string): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${context} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const createSocketRedisClients = async (): Promise<SocketRedisClients | null> => {
  const pubClient = createSocketRedisClient('pub');
  const subClient = createSocketRedisClient('sub');

  try {
    await withTimeout(
      Promise.all([pubClient.connect(), subClient.connect()]),
      SOCKET_REDIS_CONNECT_TIMEOUT_MS,
      'Socket Redis adapter connection'
    );

    return { pubClient, subClient };
  } catch (error) {
    logSocketError('failed to initialize socket redis clients', error, {
      redisUrl: REDIS_URL,
      timeoutMs: SOCKET_REDIS_CONNECT_TIMEOUT_MS,
    });

    try {
      if (pubClient.isOpen) await pubClient.disconnect();
      if (subClient.isOpen) await subClient.disconnect();
    } catch (disconnectError) {
      logSocketError('failed to close socket redis clients after init failure', disconnectError);
    }

    return null;
  }
};

export const closeSocketRedisClients = async (clients: SocketRedisClients | null): Promise<void> => {
  if (!clients) return;

  try {
    if (clients.pubClient.isOpen) {
      await clients.pubClient.disconnect();
    }

    if (clients.subClient.isOpen) {
      await clients.subClient.disconnect();
    }
  } catch (error) {
    logSocketError('failed to close socket redis clients', error);
  }
};
