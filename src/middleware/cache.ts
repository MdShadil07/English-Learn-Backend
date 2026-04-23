import Redis from 'ioredis';

const redis = new (Redis as any)({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || undefined,
});

export const cache = (keyPrefix: string, ttlSeconds: number) => {
  return async (req: any, res: any, next: any) => {
    const key = `${keyPrefix}:${JSON.stringify(req.query)}:${req.user?.id || 'anonymous'}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      res.set('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (data: any) => {
        redis.setex(key, ttlSeconds, JSON.stringify(data)).catch((err: any) =>
          console.error('Cache write error:', err)
        );
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache error:', error);
      next();
    }
  };
};

export const clearCache = async (pattern: string) => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
};

export { redis };
