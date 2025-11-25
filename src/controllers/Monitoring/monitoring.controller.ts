import { Request, Response } from 'express';
import os from 'os';
import v8 from 'v8';
import { database } from '../../config/database.js';
import { redisCache } from '../../config/redis.js';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      connectionCount?: number;
    };
    redis: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      connectionCount?: number;
    };
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      usage: number;
      total: number;
      rss: number;
    };
    cpu: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      usage: number;
      load: number[];
    };
  };
  version: string;
  environment: string;
}

export class MonitoringController {

  /**
   * Enhanced health check with detailed service monitoring
   * GET /health
   */
  async healthCheck(req: Request, res: Response) {
    const startTime = Date.now();
    const healthCheck: HealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: { status: 'healthy' },
        redis: { status: 'healthy' },
        memory: { status: 'healthy', usage: 0, total: 0, rss: 0 },
        cpu: { status: 'healthy', usage: 0, load: [] }
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    try {
      // Check database health
      const dbStartTime = Date.now();
      const isDbConnected = database.isConnected();

      if (!isDbConnected) {
        healthCheck.services.database.status = 'unhealthy';
        healthCheck.status = 'unhealthy';
      } else {
        const dbResponseTime = Date.now() - dbStartTime;
        healthCheck.services.database.responseTime = dbResponseTime;

        if (dbResponseTime > 1000) {
          healthCheck.services.database.status = 'degraded';
          if (healthCheck.status === 'healthy') healthCheck.status = 'degraded';
        }
      }

      // Check Redis health
      // Don't perform a blocking Redis read in health check; rely on connection state only
      if (redisCache.isConnected()) {
        healthCheck.services.redis.status = 'healthy';
      } else {
        healthCheck.services.redis.status = 'unhealthy';
        healthCheck.status = 'degraded';
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const memoryUsagePercent = (memUsage.heapUsed / totalMemory) * 100;

      healthCheck.services.memory = {
        usage: memoryUsagePercent,
        total: totalMemory,
        rss: memUsage.rss,
        status: memoryUsagePercent > 90 ? 'unhealthy' :
                memoryUsagePercent > 70 ? 'degraded' : 'healthy'
      };

      if (healthCheck.services.memory.status !== 'healthy') {
        healthCheck.status = healthCheck.services.memory.status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }

      // Check CPU usage
      const cpuUsage = process.cpuUsage();
      const loadAverage = os.loadavg();
      const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage

      healthCheck.services.cpu = {
        usage: cpuUsagePercent,
        load: loadAverage,
        status: cpuUsagePercent > 80 ? 'unhealthy' :
                cpuUsagePercent > 60 ? 'degraded' : 'healthy'
      };

      if (healthCheck.services.cpu.status !== 'healthy') {
        healthCheck.status = healthCheck.services.cpu.status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }

      // Add response time for this health check
      healthCheck.services.database.responseTime = Date.now() - startTime;

      const responseCode = healthCheck.status === 'healthy' ? 200 :
                          healthCheck.status === 'degraded' ? 200 : 503;

      return res.status(responseCode).json(healthCheck);

    } catch (error) {
      console.error('Health check error:', error);
      healthCheck.status = 'unhealthy';
      return res.status(503).json({
        ...healthCheck,
        error: 'Health check failed'
      });
    }
  }

  /**
   * Detailed metrics endpoint for monitoring systems
   * GET /metrics
   */
  async getMetrics(req: Request, res: Response) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',

        // Process metrics
        process: {
          pid: process.pid,
          memory: {
            rss: process.memoryUsage().rss,
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external
          },
          cpu: {
            user: process.cpuUsage().user,
            system: process.cpuUsage().system
          }
        },

        // System metrics
        system: {
          platform: process.platform,
          architecture: process.arch,
          nodeVersion: process.version,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpuCount: os.cpus().length,
          loadAverage: os.loadavg(),
          uptime: os.uptime()
        },

        // Database metrics
        database: {
          connected: database.isConnected(),
          connectionState: database.isConnected() ? 'connected' : 'disconnected'
        },

        // Redis metrics
        redis: {
          connected: redisCache.isConnected(),
          connectionState: redisCache.isConnected() ? 'connected' : 'disconnected'
        },

        // V8 heap statistics
        v8: {
          heapSizeLimit: v8.getHeapStatistics().heap_size_limit,
          totalHeapSize: v8.getHeapStatistics().total_heap_size,
          usedHeapSize: v8.getHeapStatistics().used_heap_size,
          totalAvailableSize: v8.getHeapStatistics().total_available_size,
          totalPhysicalSize: v8.getHeapStatistics().total_physical_size
        },
      };

      return res.json(metrics);

    } catch (error) {
      console.error('Metrics collection error:', error);
      return res.status(500).json({
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Combined realtime snapshot used by the SPA for charts
   * GET /monitor/realtime
   */
  async realtimeMetrics(req: Request, res: Response) {
    try {
      // import request metrics helper
      const reqMetrics = (await import('../../middleware/requestMetrics.js')).default;
      const routeMetrics = (await import('../../middleware/routeMetrics.js')).default;

      const pm = process.memoryUsage();
      const cpu = process.cpuUsage();

      // Use local-only getters to avoid hitting Redis from the realtime endpoint
      const alertSvc = (await import('../../services/Monitoring/alertService.js')).default;
      const monitoringSvc = (await import('../../services/Monitoring/monitoringService.js')).default;

      const snapshot = {
        timestamp: Date.now(),
        uptime: process.uptime(),
        process: {
          pid: process.pid,
          memory: { rss: pm.rss, heapUsed: pm.heapUsed, heapTotal: pm.heapTotal },
          cpu
        },
        system: {
          loadAvg: os.loadavg(),
          freeMemory: os.freemem(),
          totalMemory: os.totalmem(),
          cpuCount: os.cpus().length
        },
        requests: reqMetrics.getSnapshot(),
        routes: routeMetrics.getStats(),
        // local-only active alerts (no Redis read)
        alerts: alertSvc.getActiveAlertsLocal ? alertSvc.getActiveAlertsLocal() : [] ,
        // lightweight counts (no Redis read)
        counts: await (monitoringSvc.getCountsLocal ? monitoringSvc.getCountsLocal() : monitoringSvc.getCounts())
      }

      return res.json(snapshot);
    } catch (err) {
      console.error('realtimeMetrics error', err);
      return res.status(500).json({ error: 'failed to collect realtime metrics' });
    }
  }

  /**
   * Server Sent Events stream for real-time monitoring
   * GET /monitor/stream
   */
  async streamMetrics(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let isClosed = false;
    req.on('close', () => { isClosed = true; });

    const send = async () => {
      try {
        // Build a lightweight payload using existing metric helpers
        const payload: any = {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0'
        };
        // Attach counts from monitoring service if available
        try {
          // dynamic import to avoid circular deps — use local counts to avoid Redis
          const svc = (await import('../../services/Monitoring/monitoringService.js')).default;
          const counts = svc.getCountsLocal ? await svc.getCountsLocal() : await svc.getCounts();
          payload.counts = counts;
        } catch (e) {
          // ignore
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        console.error('SSE metrics send error', err);
      }
    };

    // send initial ping
    res.write(`data: ${JSON.stringify({ ok: true, ts: new Date().toISOString() })}\n\n`);

    const iv = setInterval(() => {
      if (isClosed) { clearInterval(iv); return; }
      send();
    }, 2000);
  }

  /**
   * Server side rendered monitoring UI (minimal, fast)
   * GET /monitor-ts
   */
  monitorPage(req: Request, res: Response) {
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Monitor (TS) - Backend</title>
<style>body{font-family:Inter,system-ui,Arial;background:#071224;color:#e6eef6;padding:18px} .card{background:#071827;padding:12px;border-radius:8px;margin-bottom:12px}</style>
</head><body>
<h1>Backend Monitoring (Server-rendered)</h1>
<div class="card"><div>Uptime: <span id="uptime">-</span></div><div>Version: <span id="ver">-</span></div></div>
<div class="card"><div>Recent Signups (1h): <span id="signups">-</span></div><div>Recent Logins (since restart): <span id="logins">-</span></div></div>
<div class="card"><div>Health: <a href="/health">/health</a></div><div>Metrics: <a href="/metrics">/metrics</a></div></div>
<script>
const es = new EventSource('/monitor/stream');
es.onmessage = e=>{ try{ const d=JSON.parse(e.data); document.getElementById('uptime').textContent = (d.uptime||'-'); document.getElementById('ver').textContent = d.version||'-'; }catch(_){} };
setInterval(async()=>{ try{ const r=await fetch('/monitor/counts'); if(r.ok){ const j=await r.json(); document.getElementById('signups').textContent = j.recentSignups; document.getElementById('logins').textContent = j.recentLogins; } }catch(e){} },2000);
</script>
</body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * Readiness check for Kubernetes/Docker health probes
   * GET /ready
   */
  async readinessCheck(req: Request, res: Response) {
    try {
      // Check if all critical services are ready
      const isDatabaseReady = database.isConnected();
      const isRedisReady = redisCache.isConnected() || true; // Redis is optional

      if (isDatabaseReady) {
        return res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          services: {
            database: 'ready',
            redis: isRedisReady ? 'ready' : 'optional'
          }
        });
      } else {
        return res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          services: {
            database: 'not ready',
            redis: isRedisReady ? 'ready' : 'optional'
          }
        });
      }
    } catch (error) {
      return res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  }

  /**
   * Liveness check for Kubernetes/Docker health probes
   * GET /live
   */
  async livenessCheck(req: Request, res: Response) {
    try {
      // Simple process check
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / os.totalmem()) * 100;

      // Consider unhealthy if memory usage is too high
      if (memoryUsagePercent > 95) {
        return res.status(503).json({
          status: 'not alive',
          timestamp: new Date().toISOString(),
          reason: 'Memory usage too high'
        });
      }

      return res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: `${memoryUsagePercent.toFixed(2)}%`
      });

    } catch (error) {
      return res.status(503).json({
        status: 'not alive',
        timestamp: new Date().toISOString(),
        error: 'Liveness check failed'
      });
    }
  }

  /**
   * Prometheus-style metrics endpoint
   * GET /metrics/prometheus
   */
  async prometheusMetrics(req: Request, res: Response) {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const metrics = `
# HELP english_practice_uptime_seconds Time since the application started
# TYPE english_practice_uptime_seconds gauge
english_practice_uptime_seconds ${process.uptime()}

# HELP english_practice_memory_usage_bytes Memory usage in bytes
# TYPE english_practice_memory_usage_bytes gauge
english_practice_memory_usage_bytes{rss="rss"} ${memoryUsage.rss}
english_practice_memory_usage_bytes{heap_used="heap_used"} ${memoryUsage.heapUsed}
english_practice_memory_usage_bytes{heap_total="heap_total"} ${memoryUsage.heapTotal}

# HELP english_practice_cpu_usage_nanoseconds CPU usage in nanoseconds
# TYPE english_practice_cpu_usage_nanoseconds gauge
english_practice_cpu_usage_nanoseconds{type="user"} ${cpuUsage.user}
english_practice_cpu_usage_nanoseconds{type="system"} ${cpuUsage.system}

# HELP english_practice_database_connected Database connection status
# TYPE english_practice_database_connected gauge
english_practice_database_connected ${database.isConnected() ? 1 : 0}

# HELP english_practice_redis_connected Redis connection status
# TYPE english_practice_redis_connected gauge
english_practice_redis_connected ${redisCache.isConnected() ? 1 : 0}

# HELP english_practice_heap_statistics V8 heap statistics
# TYPE english_practice_heap_statistics gauge
english_practice_heap_statistics{stat="total_heap_size"} ${v8.getHeapStatistics().total_heap_size}
english_practice_heap_statistics{stat="used_heap_size"} ${v8.getHeapStatistics().used_heap_size}
english_practice_heap_statistics{stat="total_available_size"} ${v8.getHeapStatistics().total_available_size}

# HELP english_practice_system_load_average System load average
# TYPE english_practice_system_load_average gauge
english_practice_system_load_average{period="1min"} ${os.loadavg()[0]}
english_practice_system_load_average{period="5min"} ${os.loadavg()[1]}
english_practice_system_load_average{period="15min"} ${os.loadavg()[2]}
`;

      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.send(metrics);

    } catch (error) {
      console.error('Prometheus metrics error:', error);
      return res.status(500).send('# Error collecting metrics\n');
    }
  }
}

export const monitoringController = new MonitoringController();
