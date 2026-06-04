import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const sharedBullmqConnection = new (Redis as any)(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: () => true,
});

sharedBullmqConnection.on('error', (err: any) => {
  // Only log if not a standard disconnect
  if (err?.code !== 'ECONNREFUSED' && err?.code !== 'ECONNRESET') {
    console.error('[Redis:SharedBullMQ] error:', err?.message || err);
  }
});

sharedBullmqConnection.on('connect', () => {
  console.log('[Redis:SharedBullMQ] connected successfully');
});

sharedBullmqConnection.on('close', () => {
  console.log('[Redis:SharedBullMQ] connection closed');
});
