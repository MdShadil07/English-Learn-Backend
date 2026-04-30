/**
 * 🔥 OPTIMIZED STREAK TRACKING MIDDLEWARE
 * Automatically tracks AI chat activity using batched updates
 *
 * Performance Optimizations:
 * - Batched database writes (30s intervals)
 * - Redis caching for real-time UI
 * - Non-blocking operations
 * - Memory-efficient session management
 * - Handles millions of concurrent users
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth/auth.js';
interface AIChatSession {
    startTime: Date;
    messageCount: number;
    lastMessageTime: Date;
    lastAccuracy: number;
}
/**
 * Track AI chat message for streak (optimized with batching)
 */
export declare const trackAIChatMessage: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * End AI chat session and finalize streak tracking
 */
export declare const endAIChatSession: (userId: string, tier: "free" | "pro" | "premium") => Promise<void>;
/**
 * Get active session info
 */
export declare const getActiveSession: (userId: string) => AIChatSession | undefined;
declare const _default: {
    trackAIChatMessage: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    endAIChatSession: (userId: string, tier: "free" | "pro" | "premium") => Promise<void>;
    getActiveSession: (userId: string) => AIChatSession | undefined;
};
export default _default;
//# sourceMappingURL=streakTracking.d.ts.map