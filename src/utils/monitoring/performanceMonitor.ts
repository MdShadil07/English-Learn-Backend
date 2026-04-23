import { Request, Response, NextFunction } from 'express';
import os from 'os';
import v8 from 'v8';
import { redisCache } from '../../config/redis.js';

interface PerformanceMetrics {
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  requestSize?: number;
  responseSize?: number;
  userId?: string;
  ip?: string;
}

interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  network: {
    activeConnections: number;
    totalRequests: number;
    errors: number;
  };
  database: {
    connected: boolean;
    poolSize?: number;
    activeConnections?: number;
  };
  cache: {
    connected: boolean;
    hitRate?: number;
    memoryUsage?: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private maxMetrics = 10000;
  private maxSystemMetrics = 1000;

  // Track API performance
  async trackRequest(req: Request, res: Response, startTime: number): Promise<void> {
    try {
      const responseTime = Date.now() - startTime;
      const memoryUsage = process.memoryUsage();

      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        memoryUsage,
        cpuUsage: process.cpuUsage().user / 1000, // Convert to milliseconds
        activeConnections: this.getActiveConnections(),
        requestSize: this.getRequestSize(req),
        responseSize: this.getResponseSize(res),
        userId: (req as any).user?.userId,
        ip: req.ip
      };

      // Store in memory
      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetrics) {
        this.metrics.shift();
      }

      // Store in Redis for persistence
      const metricsKey = `perf:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      await redisCache.setJSON(metricsKey, metrics, 3600); // Keep for 1 hour

      // Log slow requests
      if (responseTime > 2000) {
        console.warn(`Slow request detected: ${req.method} ${req.originalUrl} - ${responseTime}ms`, {
          statusCode: res.statusCode,
          userId: (req as any).user?.userId,
          ip: req.ip
        });
      }

    } catch (error) {
      console.error('Error tracking performance:', error);
    }
  }

  // Get system metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
          external: Math.round(process.memoryUsage().external / 1024 / 1024) // MB
        },
        cpu: {
          usage: this.getCpuUsage(),
          loadAverage: os.loadavg()
        },
        network: {
          activeConnections: this.getActiveConnections(),
          totalRequests: this.metrics.length,
          errors: this.metrics.filter(m => m.statusCode >= 400).length
        },
        database: {
          connected: true, // This would need actual database connection check
        },
        cache: {
          connected: redisCache.isConnected()
        }
      };

      // Store system metrics
      this.systemMetrics.push(metrics);
      if (this.systemMetrics.length > this.maxSystemMetrics) {
        this.systemMetrics.shift();
      }

      return metrics;
    } catch (error) {
      console.error('Error getting system metrics:', error);
      throw error;
    }
  }

  // Get performance statistics
  async getPerformanceStats(timeRange: number = 3600000): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number; avgTime: number }>;
    statusCodes: Record<number, number>;
    memoryTrend: Array<{ timestamp: Date; usage: number }>;
    systemMetrics: SystemMetrics;
  }> {
    try {
      const cutoffTime = Date.now() - timeRange;
      const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);

      const totalRequests = recentMetrics.length;
      const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;
      const slowRequests = recentMetrics.filter(m => m.responseTime > 2000).length;
      const errorRate = totalRequests > 0 ? (recentMetrics.filter(m => m.statusCode >= 400).length / totalRequests) * 100 : 0;

      // Top endpoints
      const endpointStats = new Map<string, { count: number; totalTime: number }>();
      recentMetrics.forEach(metric => {
        const key = `${metric.method} ${metric.endpoint}`;
        const existing = endpointStats.get(key) || { count: 0, totalTime: 0 };
        endpointStats.set(key, {
          count: existing.count + 1,
          totalTime: existing.totalTime + metric.responseTime
        });
      });

      const topEndpoints = Array.from(endpointStats.entries())
        .map(([endpoint, stats]) => ({
          endpoint,
          count: stats.count,
          avgTime: Math.round(stats.totalTime / stats.count)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Status codes
      const statusCodes: Record<number, number> = {};
      recentMetrics.forEach(metric => {
        statusCodes[metric.statusCode] = (statusCodes[metric.statusCode] || 0) + 1;
      });

      // Memory trend (last 50 data points)
      const memoryTrend = this.systemMetrics.slice(-50).map(m => ({
        timestamp: m.timestamp,
        usage: m.memory.heapUsed
      }));

      const systemMetrics = await this.getSystemMetrics();

      return {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime),
        slowRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        topEndpoints,
        statusCodes,
        memoryTrend,
        systemMetrics
      };
    } catch (error) {
      console.error('Error getting performance stats:', error);
      throw error;
    }
  }

  // Health check with performance metrics
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    memoryUsage: number;
    activeConnections: number;
    errorRate: number;
    uptime: number;
    details: any;
  }> {
    try {
      const startTime = Date.now();
      const systemMetrics = await this.getSystemMetrics();
      const responseTime = Date.now() - startTime;

      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const memoryUsagePercent = (systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal) * 100;
      const recentErrorRate = this.getRecentErrorRate();

      if (memoryUsagePercent > 90 || recentErrorRate > 5 || responseTime > 1000) {
        status = 'degraded';
      }

      if (memoryUsagePercent > 95 || recentErrorRate > 10 || responseTime > 5000) {
        status = 'unhealthy';
      }

      return {
        status,
        responseTime,
        memoryUsage: memoryUsagePercent,
        activeConnections: systemMetrics.network.activeConnections,
        errorRate: recentErrorRate,
        uptime: systemMetrics.uptime,
        details: systemMetrics
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        status: 'unhealthy',
        responseTime: 0,
        memoryUsage: 0,
        activeConnections: 0,
        errorRate: 0,
        uptime: 0,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private getActiveConnections(): number {
    // This is a simplified version - in production you'd use a proper connection tracking
    return Object.keys(require('http').globalAgent.sockets || {}).length;
  }

  private getCpuUsage(): number {
    const cpuUsage = process.cpuUsage();
    return (cpuUsage.user + cpuUsage.system) / 1000; // Convert to milliseconds
  }

  private getRequestSize(req: Request): number {
    const contentLength = req.headers['content-length'];
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  private getResponseSize(res: Response): number {
    // This would require more complex tracking in a real implementation
    return 0;
  }

  private getRecentErrorRate(): number {
    const recentMetrics = this.metrics.slice(-100); // Last 100 requests
    const errors = recentMetrics.filter(m => m.statusCode >= 400).length;
    return recentMetrics.length > 0 ? (errors / recentMetrics.length) * 100 : 0;
  }

  // Clean up old metrics
  async cleanup(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

      this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
      this.systemMetrics = this.systemMetrics.filter(m => m.timestamp.getTime() > cutoffTime);

      console.log(`Cleaned up performance metrics. Kept ${this.metrics.length} request metrics and ${this.systemMetrics.length} system metrics`);
    } catch (error) {
      console.error('Error cleaning up performance metrics:', error);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Middleware to track performance
export const performanceTracking = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Track request completion
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    performanceMonitor.trackRequest(req, res, responseTime);

    // Call original end method with proper arguments
    if (arguments.length === 2 && typeof encoding === 'function') {
      return originalEnd.call(this, chunk, encoding);
    } else {
      return originalEnd.call(this, chunk, encoding);
    }
  };

  next();
};

// Automatic cleanup every hour
setInterval(() => {
  performanceMonitor.cleanup();
}, 60 * 60 * 1000);

export default performanceMonitor;
