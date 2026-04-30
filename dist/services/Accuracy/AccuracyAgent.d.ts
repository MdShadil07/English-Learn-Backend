/**
 * 🎯 AccuracyAgent - Industry-Level Accuracy Scoring Service
 *
 * Single source of truth for all accuracy analysis following enterprise patterns:
 * - Idempotency (requestId)
 * - Rate limiting & backpressure
 * - Tier-based feature gating
 * - Message analysis + session aggregation
 * - Async persistence with worker queue
 * - Circuit breaker & fallback
 * - Full observability
 *
 * @version 2.0.0
 * @author AccuracyAgent
 */
import type { Redis } from 'ioredis';
export type UserTier = 'free' | 'pro' | 'premium';
export type UserProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
export type AnalysisDepth = 'full' | 'basic' | 'error';
export type AnalysisStatus = 'success' | 'partial' | 'deferred' | 'error';
export interface AnalysisPayload {
    requestId?: string;
    userId?: string;
    userMessage: string;
    aiResponse?: string;
    userTier: UserTier;
    userLevel?: UserProficiencyLevel;
    previousAggregate?: AggregatedProfile;
    nPrev?: number;
    persist?: boolean;
    enableLanguageTool?: boolean;
    enableOpenRouter?: boolean;
}
export interface MessageAnalysis {
    scores: {
        grammar: number;
        vocabulary: number;
        spelling: number;
        fluency: number;
        punctuation?: number;
        capitalization?: number;
        syntax?: number;
        coherence?: number;
    };
    overall: number;
    adjustedOverall: number;
    xpEarned: number;
    xpPenalty: number;
    netXP: number;
    feedback: {
        grammar?: string;
        vocabulary?: string;
        spelling?: string;
        fluency?: string;
        [key: string]: string | undefined;
    };
    statistics: {
        wordCount: number;
        sentenceCount: number;
        errorCount: number;
        [key: string]: number;
    };
    analysisDepth: AnalysisDepth;
    featuresSkipped?: string[];
}
export interface AggregatedProfile {
    nMessages: number;
    scores: {
        grammar: number;
        vocabulary: number;
        spelling: number;
        fluency: number;
        punctuation?: number;
        capitalization?: number;
        syntax?: number;
        coherence?: number;
        overall: number;
    };
    lastUpdated: Date;
    confidenceScore: number;
}
export interface MessageAnalysisResponse {
    status: AnalysisStatus;
    requestId: string;
    messageAnalysis: MessageAnalysis;
    aggregated?: AggregatedProfile;
    processingTimeMs: number;
    confidenceScore: number;
    analysisDepth: AnalysisDepth;
    serverVersion: string;
    traceId: string;
    errorMessage?: string;
    retryAfter?: number;
}
declare class AccuracyAgentService {
    private queueSize;
    private redisClient?;
    private logger;
    private grammarAnalyzer;
    private vocabularyAnalyzer;
    private spellingAnalyzer;
    private fluencyAnalyzer;
    private aggregationEngine;
    private persistenceQueue;
    private idempotencyCache;
    constructor();
    /**
     * Initialize dependencies (called on startup)
     */
    initialize(dependencies: {
        redisClient?: Redis;
        grammarAnalyzer: any;
        vocabularyAnalyzer: any;
        spellingAnalyzer: any;
        fluencyAnalyzer: any;
        aggregationEngine: any;
        persistenceQueue: any;
        idempotencyCache: any;
    }): Promise<void>;
    /**
     * 🎯 MAIN ENTRY POINT - Analyze message with full pipeline
     */
    analyze(payload: AnalysisPayload): Promise<MessageAnalysisResponse>;
    /**
     * 📊 Analyze single message (per-message scoring)
     */
    private analyzeMessage;
    /**
     * 🔄 Aggregate scores (weighted average)
     */
    private aggregateScores;
    /**
     * 📐 Calculate weighted overall score
     */
    private calculateOverall;
    /**
     * 🎁 Apply leniency for short messages
     */
    private applyLeniency;
    /**
     * 💎 Calculate XP earned
     */
    private calculateXP;
    /**
     * 📊 Get category weights based on proficiency level
     */
    private getWeights;
    /**
     * 🎯 Calculate confidence score
     */
    private calculateConfidence;
    /**
     * ⚠️ Create minimal analysis (for errors)
     */
    private createMinimalAnalysis;
    /**
     * ❌ Create error response
     */
    private createErrorResponse;
    /**
     * 📊 Get current queue size (for monitoring)
     */
    getQueueSize(): number;
}
export declare const accuracyAgent: AccuracyAgentService;
export default accuracyAgent;
//# sourceMappingURL=AccuracyAgent.d.ts.map