/**
 * OPTIMIZED PROGRESS API
 * High-performance endpoints with Redis caching
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth/auth.js';
export declare const getRealtimeProgress: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getOptimizedDashboard: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getBatchStats: (req: AuthRequest, res: Response) => Promise<void>;
export declare const forceFlushQueue: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    getRealtimeProgress: (req: AuthRequest, res: Response) => Promise<void>;
    getOptimizedDashboard: (req: AuthRequest, res: Response) => Promise<void>;
    getBatchStats: (req: AuthRequest, res: Response) => Promise<void>;
    forceFlushQueue: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=optimizedProgressController.d.ts.map