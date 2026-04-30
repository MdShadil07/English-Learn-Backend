import { redisCache } from '../../config/redis.js';
import { database } from '../../config/database.js';
export class APIError extends Error {
    statusCode;
    status;
    isOperational;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
class ErrorMonitor {
    maxLogs = 1000; // Keep only last 1000 error logs in memory
    async logError(error) {
        try {
            // Add to Redis for persistence
            const logKey = `error:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
            await redisCache.setJSON(logKey, error, 86400); // Keep for 24 hours
            // Also log to console with structured format
            console.error(`[${error.level.toUpperCase()}] ${error.message}`, {
                id: error.id,
                timestamp: error.timestamp,
                userId: error.userId,
                url: error.url,
                statusCode: error.statusCode,
                stack: error.stack,
            });
            // Clean up old logs if we have too many
            await this.cleanupOldLogs();
        }
        catch (logError) {
            // Fallback to console if Redis logging fails
            console.error('Failed to log error to Redis:', logError);
            console.error('Original error:', error);
        }
    }
    async cleanupOldLogs() {
        try {
            // This is a simple cleanup - in production you'd want more sophisticated cleanup
            const keys = await redisCache.get('error_keys') || '[]';
            const errorKeys = JSON.parse(keys);
            if (errorKeys.length > this.maxLogs) {
                const keysToDelete = errorKeys.slice(0, errorKeys.length - this.maxLogs);
                for (const key of keysToDelete) {
                    await redisCache.del(key);
                }
                const remainingKeys = errorKeys.slice(-this.maxLogs);
                await redisCache.set('error_keys', JSON.stringify(remainingKeys), 86400);
            }
        }
        catch (error) {
            console.error('Error cleaning up logs:', error);
        }
    }
    // Enhanced request logging with security monitoring
    async logRequest(req, res, duration) {
        try {
            const requestId = req.requestId;
            const userId = req.user?.userId;
            const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent') || 'Unknown';
            const logEntry = {
                id: requestId,
                timestamp: new Date(),
                level: res.statusCode >= 400 ? 'error' : 'info',
                message: `${req.method} ${req.originalUrl} - ${res.statusCode}`,
                userId,
                userAgent,
                ip,
                url: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                responseTime: duration,
                body: req.method !== 'GET' ? req.body : undefined,
                query: Object.keys(req.query).length > 0 ? req.query : undefined,
                params: Object.keys(req.params).length > 0 ? req.params : undefined
            };
            // Log to Redis for persistence
            const logKey = `request:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
            await redisCache.setJSON(logKey, logEntry, 3600); // Keep for 1 hour
            // Log suspicious activity
            if (res.statusCode >= 400 || (duration && duration > 5000)) {
                console.warn(`Suspicious activity detected:`, {
                    requestId,
                    statusCode: res.statusCode,
                    duration,
                    ip,
                    url: req.originalUrl,
                    userId
                });
            }
        }
        catch (logError) {
            console.error('Failed to log request:', logError);
        }
    }
    // Security monitoring
    async logSecurityEvent(event) {
        try {
            const securityLog = {
                id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                level: 'warn',
                type: event.type,
                severity: event.severity,
                description: event.description,
                ip: event.ip,
                userId: event.userId,
                userAgent: event.userAgent,
                metadata: event.metadata
            };
            // Log to Redis with longer retention for security events
            const logKey = `security:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
            await redisCache.setJSON(logKey, securityLog, 86400 * 7); // Keep for 7 days
            console.warn(`[SECURITY] ${event.severity.toUpperCase()}: ${event.description}`, {
                type: event.type,
                ip: event.ip,
                userId: event.userId
            });
        }
        catch (logError) {
            console.error('Failed to log security event:', logError);
        }
    }
}
export const errorMonitor = new ErrorMonitor();
export const errorHandler = async (err, req, res, next) => {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errorLog = {
        id: errorId,
        timestamp: new Date(),
        level: 'error',
        message: err.message,
        stack: err.stack,
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        statusCode: err.statusCode || 500,
    };
    // Log the error
    await errorMonitor.logError(errorLog);
    let error = { ...err };
    error.message = err.message;
    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new APIError(message, 404);
    }
    // Mongoose duplicate key
    if (err.name === 'MongoError' && err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        error = new APIError(message, 409);
    }
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = 'Invalid input data';
        error = new APIError(message, 400);
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new APIError(message, 401);
    }
    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new APIError(message, 401);
    }
    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        errorId,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// Enhanced health check with performance metrics
export const enhancedHealthCheck = async (req, res) => {
    const startTime = Date.now();
    try {
        const healthData = {
            success: true,
            message: 'Server is running',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: {
                connected: database.isConnected(),
                name: database.getConnection()?.name,
            },
            cache: {
                connected: redisCache.isConnected(),
            },
            memory: {
                rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100, // MB
                heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100, // MB
                heapTotal: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100, // MB
            },
            responseTime: Date.now() - startTime,
        };
        const statusCode = healthData.database.connected && healthData.cache.connected ? 200 : 503;
        res.status(statusCode).json(healthData);
    }
    catch (error) {
        res.status(503).json({
            success: false,
            message: 'Health check failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - startTime,
        });
    }
};
export default errorMonitor;
//# sourceMappingURL=errorHandler.js.map