/**
 * 🔄 PROGRESS UPDATE MIDDLEWARE
 * Optimized middleware for updating progress data from AI chat messages
 * Uses debouncing and caching to reduce database load
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to update accuracy data after AI chat message
 * Debounces updates to prevent excessive DB writes
 */
export declare const updateAccuracyMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to add XP after AI chat message
 * Debounces XP updates to batch database writes
 */
export declare const addXPMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to handle level-up events
 * Always immediate (high priority)
 */
export declare const handleLevelUpMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Invalidate cache on specific events
 * Use this after personality change or page refresh
 */
export declare const invalidateCacheMiddleware: (dataType?: "progress" | "analytics" | "all") => (req: Request, res: Response, next: NextFunction) => Promise<void>;
declare const _default: {
    updateAccuracyMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    addXPMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    handleLevelUpMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    invalidateCacheMiddleware: (dataType?: "progress" | "analytics" | "all") => (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
export default _default;
//# sourceMappingURL=progressUpdate.middleware.d.ts.map