import { Request, Response } from 'express';
export declare const metricsMiddleware: (req: Request, res: Response, next: Function) => void;
export declare const trackDbQuery: (duration: number) => void;
export declare const trackRedisOperation: (duration: number) => void;
export declare const trackConnection: (increment: boolean) => void;
export declare class MonitoringController {
    /**
     * Enhanced health check with detailed service monitoring
     * GET /health
     */
    healthCheck(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Detailed metrics endpoint for monitoring systems
     * GET /metrics
     */
    getMetrics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Readiness check for Kubernetes/Docker health probes
     * GET /ready
     */
    readinessCheck(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Liveness check for Kubernetes/Docker health probes
     * GET /live
     */
    livenessCheck(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Prometheus-style metrics endpoint
     * GET /metrics/prometheus
     */
    prometheusMetrics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const monitoringController: MonitoringController;
//# sourceMappingURL=monitoring.controller.d.ts.map