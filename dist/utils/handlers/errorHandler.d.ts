import { Request, Response, NextFunction } from 'express';
interface AppError extends Error {
    statusCode?: number;
    status?: string;
    isOperational?: boolean;
}
interface ErrorLog {
    id: string;
    timestamp: Date;
    level: 'error' | 'warning' | 'info';
    message: string;
    stack?: string;
    userId?: string;
    userAgent?: string;
    ip?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
}
export declare class APIError extends Error implements AppError {
    statusCode: number;
    status: string;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
declare class ErrorMonitor {
    private maxLogs;
    logError(error: ErrorLog): Promise<void>;
    private cleanupOldLogs;
    logRequest(req: Request, res: Response, duration?: number): Promise<void>;
    logSecurityEvent(event: {
        type: 'suspicious_activity' | 'failed_login' | 'rate_limit' | 'malicious_request';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        ip?: string;
        userId?: string;
        userAgent?: string;
        metadata?: any;
    }): Promise<void>;
}
export declare const errorMonitor: ErrorMonitor;
export declare const errorHandler: (err: AppError, req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const enhancedHealthCheck: (req: Request, res: Response) => Promise<void>;
export default errorMonitor;
//# sourceMappingURL=errorHandler.d.ts.map