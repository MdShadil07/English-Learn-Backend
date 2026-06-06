import { Request, Response, NextFunction } from 'express';
import { metricsPublisher } from '../utils/metricsPublisher.js';

export const requestMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    // Only track API routes to avoid noise
    if (req.originalUrl.startsWith('/api/')) {
      const diff = process.hrtime(startTime);
      const latencyMs = (diff[0] * 1e3) + (diff[1] * 1e-6);

      // Simplify route for cardinality (e.g. /api/auth/login instead of /api/user/123)
      let route = req.route ? req.route.path : req.originalUrl.split('?')[0];
      
      // Clean up UUIDs and IDs from routes
      route = route.replace(/\/[a-f0-9]{24}/g, '/:id');
      route = route.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');

      metricsPublisher.trackRequest({
        route,
        method: req.method,
        statusCode: res.statusCode,
        latencyMs,
        timestamp: Date.now()
      });
    }
  });

  next();
};
