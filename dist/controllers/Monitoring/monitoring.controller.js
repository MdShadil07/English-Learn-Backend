import os from 'os';
import v8 from 'v8';
import { database } from '../../config/database.js';
import { redisCache } from '../../config/redis.js';
const metricsStore = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    dbQueryCount: 0,
    totalDbQueryTime: 0,
    redisOperationCount: 0,
    totalRedisOperationTime: 0,
    activeConnections: 0,
    startTime: Date.now(),
};
// Middleware to track request metrics
export const metricsMiddleware = (req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        metricsStore.requestCount++;
        metricsStore.totalResponseTime += duration;
        if (res.statusCode >= 400) {
            metricsStore.errorCount++;
        }
    });
    next();
};
// Helper to track database queries
export const trackDbQuery = (duration) => {
    metricsStore.dbQueryCount++;
    metricsStore.totalDbQueryTime += duration;
};
// Helper to track Redis operations
export const trackRedisOperation = (duration) => {
    metricsStore.redisOperationCount++;
    metricsStore.totalRedisOperationTime += duration;
};
// Helper to track active connections
export const trackConnection = (increment) => {
    metricsStore.activeConnections += increment ? 1 : -1;
};
export class MonitoringController {
    /**
     * Enhanced health check with detailed service monitoring
     * GET /health
     */
    async healthCheck(req, res) {
        const startTime = Date.now();
        const healthCheck = {
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
            }
            else {
                const dbResponseTime = Date.now() - dbStartTime;
                healthCheck.services.database.responseTime = dbResponseTime;
                if (dbResponseTime > 1000) {
                    healthCheck.services.database.status = 'degraded';
                    if (healthCheck.status === 'healthy')
                        healthCheck.status = 'degraded';
                }
            }
            // Check Redis health
            if (redisCache.isConnected()) {
                const redisStartTime = Date.now();
                try {
                    await redisCache.get('health-check');
                    const redisResponseTime = Date.now() - redisStartTime;
                    healthCheck.services.redis.responseTime = redisResponseTime;
                    if (redisResponseTime > 500) {
                        healthCheck.services.redis.status = 'degraded';
                        if (healthCheck.status === 'healthy')
                            healthCheck.status = 'degraded';
                    }
                }
                catch (error) {
                    healthCheck.services.redis.status = 'unhealthy';
                    healthCheck.status = 'degraded';
                }
            }
            else {
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
        }
        catch (error) {
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
    async getMetrics(req, res) {
        try {
            const uptime = Date.now() - metricsStore.startTime;
            const avgResponseTime = metricsStore.requestCount > 0
                ? metricsStore.totalResponseTime / metricsStore.requestCount
                : 0;
            const avgDbQueryTime = metricsStore.dbQueryCount > 0
                ? metricsStore.totalDbQueryTime / metricsStore.dbQueryCount
                : 0;
            const avgRedisOperationTime = metricsStore.redisOperationCount > 0
                ? metricsStore.totalRedisOperationTime / metricsStore.redisOperationCount
                : 0;
            const errorRate = metricsStore.requestCount > 0
                ? (metricsStore.errorCount / metricsStore.requestCount) * 100
                : 0;
            const requestsPerSecond = uptime > 0
                ? (metricsStore.requestCount / (uptime / 1000))
                : 0;
            const metrics = {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                testUptime: uptime / 1000, // Test duration in seconds
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '1.0.0',
                // Request metrics
                requests: {
                    total: metricsStore.requestCount,
                    errors: metricsStore.errorCount,
                    errorRate: errorRate.toFixed(2) + '%',
                    avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
                    requestsPerSecond: requestsPerSecond.toFixed(2),
                    activeConnections: metricsStore.activeConnections,
                },
                // Database metrics
                database: {
                    connected: database.isConnected(),
                    connectionState: database.isConnected() ? 'connected' : 'disconnected',
                    queryCount: metricsStore.dbQueryCount,
                    avgQueryTime: avgDbQueryTime.toFixed(2) + 'ms',
                    totalQueryTime: metricsStore.totalDbQueryTime + 'ms',
                },
                // Redis metrics
                redis: {
                    connected: redisCache.isConnected(),
                    connectionState: redisCache.isConnected() ? 'connected' : 'disconnected',
                    operationCount: metricsStore.redisOperationCount,
                    avgOperationTime: avgRedisOperationTime.toFixed(2) + 'ms',
                    totalOperationTime: metricsStore.totalRedisOperationTime + 'ms',
                },
                // Process metrics
                process: {
                    pid: process.pid,
                    memory: {
                        rss: process.memoryUsage().rss,
                        heapUsed: process.memoryUsage().heapUsed,
                        heapTotal: process.memoryUsage().heapTotal,
                        external: process.memoryUsage().external,
                        usagePercent: ((process.memoryUsage().heapUsed / os.totalmem()) * 100).toFixed(2) + '%',
                    },
                    cpu: {
                        user: process.cpuUsage().user,
                        system: process.cpuUsage().system,
                        usagePercent: ((process.cpuUsage().user + process.cpuUsage().system) / 1000000).toFixed(2) + '%',
                    }
                },
                // System metrics
                system: {
                    platform: process.platform,
                    architecture: process.arch,
                    nodeVersion: process.version,
                    totalMemory: os.totalmem(),
                    freeMemory: os.freemem(),
                    memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%',
                    cpuCount: os.cpus().length,
                    loadAverage: os.loadavg(),
                    uptime: os.uptime()
                },
                // V8 heap statistics
                v8: {
                    heapSizeLimit: v8.getHeapStatistics().heap_size_limit,
                    totalHeapSize: v8.getHeapStatistics().total_heap_size,
                    usedHeapSize: v8.getHeapStatistics().used_heap_size,
                    totalAvailableSize: v8.getHeapStatistics().total_available_size,
                    totalPhysicalSize: v8.getHeapStatistics().total_physical_size,
                    heapUsagePercent: (v8.getHeapStatistics().used_heap_size / v8.getHeapStatistics().heap_size_limit * 100).toFixed(2) + '%',
                },
            };
            return res.json(metrics);
        }
        catch (error) {
            console.error('Metrics collection error:', error);
            return res.status(500).json({
                error: 'Failed to collect metrics',
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Readiness check for Kubernetes/Docker health probes
     * GET /ready
     */
    async readinessCheck(req, res) {
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
            }
            else {
                return res.status(503).json({
                    status: 'not ready',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'not ready',
                        redis: isRedisReady ? 'ready' : 'optional'
                    }
                });
            }
        }
        catch (error) {
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
    async livenessCheck(req, res) {
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
        }
        catch (error) {
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
    async prometheusMetrics(req, res) {
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
        }
        catch (error) {
            console.error('Prometheus metrics error:', error);
            return res.status(500).send('# Error collecting metrics\n');
        }
    }
}
export const monitoringController = new MonitoringController();
//# sourceMappingURL=monitoring.controller.js.map