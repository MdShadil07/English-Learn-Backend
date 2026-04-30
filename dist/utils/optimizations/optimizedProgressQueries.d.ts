/**
 * 🚀 DATABASE QUERY OPTIMIZATIONS
 * Enhanced queries with indexes, projections, and lean() for performance
 */
import type mongoose from 'mongoose';
import { Types } from 'mongoose';
type LeaderboardMetric = 'xp' | 'weeklyXP' | 'monthlyXP' | 'streak' | 'accuracy' | 'grammar' | 'vocabulary' | 'spelling' | 'fluency' | 'timeSpent' | 'sessions';
interface LeaderboardQueryOptions {
    metric?: LeaderboardMetric;
    timeframe?: 'week' | 'month' | 'all';
    direction?: 'asc' | 'desc';
    tier?: 'free' | 'pro' | 'premium';
}
export declare class OptimizedProgressQueries {
    /**
     * Get user progress with caching (read-heavy operation)
     */
    static getUserProgress(userId: string | Types.ObjectId): Promise<any>;
    /**
     * Get streak data only (minimal projection)
     */
    static getStreakData(userId: string | Types.ObjectId): Promise<any>;
    /**
     * Get leaderboard with pagination and caching
     */
    static getLeaderboard(limit?: number, offset?: number, options?: LeaderboardQueryOptions): Promise<any>;
    /**
     * Get active streaks count (aggregation with index)
     */
    static getActiveStreaksCount(): Promise<any>;
    /**
     * Get users with expiring streaks (for notifications)
     */
    static getUsersWithExpiringStreaks(hoursThreshold?: number): Promise<(mongoose.FlattenMaps<import("../../models/Progress.js").IProgress> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    /**
     * Batch update multiple users' progress (for background jobs)
     */
    static batchUpdateProgress(updates: Array<{
        userId: string;
        updates: any;
    }>): Promise<mongoose.mongo.BulkWriteResult>;
    /**
     * Clear all progress-related caches
     */
    static clearAllCaches(): Promise<void>;
    /**
     * Invalidate user-specific cache
     */
    static invalidateUserCache(userId: string | Types.ObjectId): Promise<void>;
}
/**
 * 📊 Recommended MongoDB Indexes
 * Add these indexes to your Progress collection for optimal performance:
 *
 * db.progress.createIndex({ userId: 1 }, { unique: true })
 * db.progress.createIndex({ totalXP: -1 })
 * db.progress.createIndex({ "streak.current": -1 })
 * db.progress.createIndex({ "streak.lastActivityDate": 1 })
 * db.progress.createIndex({ tier: 1 })
 *
 * Compound indexes for common queries:
 * db.progress.createIndex({ "streak.current": 1, "streak.lastActivityDate": 1 })
 * db.progress.createIndex({ tier: 1, totalXP: -1 })
 */
export default OptimizedProgressQueries;
//# sourceMappingURL=optimizedProgressQueries.d.ts.map