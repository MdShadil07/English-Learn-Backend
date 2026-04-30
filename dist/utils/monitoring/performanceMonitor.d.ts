import { Request, Response, NextFunction } from 'express';
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
declare class PerformanceMonitor {
    private metrics;
    private systemMetrics;
    private maxMetrics;
    private maxSystemMetrics;
    trackRequest(req: Request, res: Response, startTime: number): Promise<void>;
    getSystemMetrics(): Promise<SystemMetrics>;
    getPerformanceStats(timeRange?: number): Promise<{
        totalRequests: number;
        averageResponseTime: number;
        slowRequests: number;
        errorRate: number;
        topEndpoints: Array<{
            endpoint: string;
            count: number;
            avgTime: number;
        }>;
        statusCodes: Record<number, number>;
        memoryTrend: Array<{
            timestamp: Date;
            usage: number;
        }>;
        systemMetrics: SystemMetrics;
    }>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        responseTime: number;
        memoryUsage: number;
        activeConnections: number;
        errorRate: number;
        uptime: number;
        details: any;
    }>;
    private getActiveConnections;
    private getCpuUsage;
    private getRequestSize;
    private getResponseSize;
    private getRecentErrorRate;
    cleanup(): Promise<void>;
}
export declare const performanceMonitor: PerformanceMonitor;
export declare const performanceTracking: (req: Request, res: Response, next: NextFunction) => void;
export default performanceMonitor;
//# sourceMappingURL=performanceMonitor.d.ts.map