/**
 * 📊 OPTIMIZED ACCURACY TRACKING SERVICE
 * Batched accuracy updates for AI chat conversations
 *
 * Prevents server overload by:
 * - Batching accuracy calculations
 * - Caching intermediate results
 * - Debouncing frequent updates
 * - Using atomic database operations
 */
interface AccuracyUpdate {
    userId: string;
    messageText: string;
    detectedErrors?: any[];
    grammarScore?: number;
    vocabularyScore?: number;
    spellingScore?: number;
    fluencyScore?: number;
    overallScore?: number;
}
declare class OptimizedAccuracyTracker {
    private readonly CACHE_TTL;
    private readonly MIN_UPDATE_INTERVAL;
    private lastUpdateTime;
    /**
     * Track accuracy from AI chat message (debounced)
     */
    trackAccuracy(update: AccuracyUpdate): Promise<void>;
    /**
     * Update Redis cache for real-time accuracy display
     */
    private updateCache;
    /**
     * Calculate XP bonus from accuracy score
     */
    private calculateAccuracyXP;
    /**
     * Get cached accuracy for real-time display
     */
    getCachedAccuracy(userId: string): Promise<any | null>;
    /**
     * Track conversation accuracy (accumulated over multiple messages)
     */
    trackConversationAccuracy(userId: string, conversationId: string, messages: AccuracyUpdate[]): Promise<void>;
    /**
     * Calculate average of array
     */
    private average;
}
export declare const optimizedAccuracyTracker: OptimizedAccuracyTracker;
export default optimizedAccuracyTracker;
//# sourceMappingURL=optimizedAccuracyTracker.d.ts.map