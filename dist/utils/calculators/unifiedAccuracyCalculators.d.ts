/**
 * 🎯 UNIFIED ACCURACY CALCULATOR - ADVANCED IMPLEMENTATION
 *
 * This is the definitive, optimized accuracy calculation system that consolidates:
 * - Core accuracy analysis from accuracyCalculator.enhanced.ts
 * - NLP service integration from accuracy.orchestrator.ts
 * - Weighted calculation from accuracyWeightedCalculator.ts
 * - Performance optimizations and caching
 *
 * Features:
 * - Single entry point for all accuracy calculations
 * - Intelligent NLP service integration (Typo.js, CEFR, LanguageTool, OpenRouter)
 * - Advanced weighted calculation with historical context
 * - Optimized for millions of concurrent requests
 * - Full backward compatibility
 */
import { IAccuracyData } from '../../models/Progress.js';
import type { LanguageDetectionSummary } from '../../services/NLP/languageDetectionService.js';
export type UserTier = 'free' | 'pro' | 'premium';
export type UserProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
export type ErrorSeverity = 'critical' | 'major' | 'high' | 'medium' | 'low' | 'suggestion';
type NumericAccuracyKey = 'overall' | 'adjustedOverall' | 'grammar' | 'vocabulary' | 'spelling' | 'fluency' | 'punctuation' | 'capitalization' | 'syntax' | 'coherence';
export type CategoryTrendDirection = 'improving' | 'declining' | 'stable';
export interface CategoryTrendInsight {
    currentScore: number;
    previousScore: number | null;
    delta: number | null;
    percentChange: number | null;
    momentum: CategoryTrendDirection;
    sampleSize: number;
}
export interface GrammarHeuristicPenalty {
    rule: string;
    penalty: number;
    reason: string;
}
export interface GrammarCategoryMetrics {
    score: number;
    weightedPenalty: number;
    normalizedImpact: number;
    severityDistribution: Record<ErrorSeverity, number>;
    dominantPatterns: string[];
    totalErrors: number;
    trend?: CategoryTrendInsight;
    heuristicPenalties?: GrammarHeuristicPenalty[];
}
export interface VocabularyCategoryMetrics {
    score: number;
    rangeScore: number;
    repetitionPenalty: number;
    diversity: number;
    repetitionRate: number;
    academicUsage: number;
    rareWordUsage: number;
    trend?: CategoryTrendInsight;
}
export interface SpellingCategoryMetrics {
    score: number;
    normalizedDensity: number;
    densityPerTokenType: {
        content: number;
        function: number;
    };
    totalErrors: number;
    contentTokenCount: number;
    functionTokenCount: number;
    trend?: CategoryTrendInsight;
}
export interface PronunciationCategoryMetrics {
    overall: number;
    prosody: number;
    intelligibility: number;
    pacing: number;
    stress: number;
    signals: {
        punctuationVariety: number;
        fillerInstances: number;
        connectorCount: number;
        stressIndicators: number;
    };
    trend?: CategoryTrendInsight;
}
export interface CategoryMetricMap {
    grammar?: GrammarCategoryMetrics;
    vocabulary?: VocabularyCategoryMetrics;
    spelling?: SpellingCategoryMetrics;
    pronunciation?: PronunciationCategoryMetrics;
    coherence?: {
        score: number;
        transitions: number;
        topicConsistency: number;
        logicalFlow: number;
        trend?: CategoryTrendInsight;
    };
    style?: {
        score: number;
        passiveVoiceUsage: number;
        sentenceVariety: number;
        formalityScore: number;
        trend?: CategoryTrendInsight;
    };
}
export interface HistoricalWeightingConfig {
    decayFactor?: number;
    categoryBaselines?: Partial<Record<NumericAccuracyKey, number>>;
    minimumMessageCountForHistory?: number;
    currentWeightOverride?: number;
}
export declare function summarizeCategoryTrend(currentScore: number | undefined, previousScore: number | undefined, sampleSize?: number): CategoryTrendInsight | undefined;
export interface UnifiedAccuracyResult {
    overall: number;
    adjustedOverall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    punctuation: number;
    capitalization: number;
    syntax?: number;
    coherence?: number;
    freeNLPEnhanced?: boolean;
    nlpCost?: string;
    detectorContributions?: {
        languageTool?: {
            errors: number;
            confidence: number;
            source: string;
        };
        spelling?: {
            accuracy: number;
            confidence: number;
            source: string;
            errorsFound?: number;
        };
        vocabulary?: {
            level: string;
            score: number;
            source: string;
        };
        fluency?: {
            score: number;
            method: string;
            source: string;
        };
        languageBypass?: {
            reason: string;
            detectedLanguage?: string;
            englishRatio?: number;
        };
    };
    tone?: {
        overall: 'formal' | 'neutral' | 'informal' | 'casual';
        confidence: number;
        recommendations?: string[];
        contextAppropriate: boolean;
    };
    readability?: {
        fleschKincaidGrade: number;
        fleschReadingEase: number;
        smogIndex: number;
        colemanLiauIndex: number;
        automatedReadabilityIndex: number;
        averageLevel: string;
        recommendation?: string;
    };
    vocabularyAnalysis?: {
        level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
        academicWordUsage: number;
        rareWordUsage: number;
        wordDiversity: number;
        suggestions?: Array<{
            word: string;
            alternatives: string[];
            context: string;
        }>;
    };
    coherenceAnalysis?: {
        score: number;
        transitions: {
            used: number;
            suggested: string[];
        };
        topicConsistency: number;
        logicalFlow: number;
        issues?: string[];
    };
    styleAnalysis?: {
        passiveVoiceUsage: number;
        sentenceVariety: number;
        repetitionIssues: number;
        formalityScore: number;
        engagement: number;
        recommendations?: string[];
    };
    premiumInsights?: {
        idiomaticExpressions: {
            found: string[];
            improvements: Array<{
                original: string;
                suggestion: string;
                explanation: string;
            }>;
        };
        collocations: {
            correctUsage: number;
            issues: Array<{
                phrase: string;
                correction: string;
                reason: string;
            }>;
        };
        contextualSuggestions: string[];
        advancedPatterns: {
            detected: string[];
            recommendations: string[];
        };
    };
    errors: UnifiedErrorDetail[];
    feedback: string[];
    suggestions: string[];
    statistics: {
        wordCount: number;
        sentenceCount: number;
        paragraphCount: number;
        avgWordsPerSentence: number;
        avgSyllablesPerWord: number;
        complexWordCount: number;
        uniqueWordRatio: number;
        errorCount: number;
        criticalErrorCount: number;
        errorsByCategory: Record<string, number>;
        processingTime: number;
    };
    aiResponseAnalysis: {
        hasCorrectionFeedback: boolean;
        detectedCorrections?: number;
        hasGrammarCorrection: boolean;
        hasStyleSuggestion: boolean;
        correctedErrors: string[];
        appreciationLevel: 'none' | 'minimal' | 'moderate' | 'high';
        severityOfCorrections: 'none' | 'minor' | 'moderate' | 'major';
        engagementScore: number;
        penalties?: {
            grammar?: number;
            vocabulary?: number;
            fluency?: number;
            spelling?: number;
        };
    };
    nlpEnhanced: boolean;
    nlpContributions?: {
        languageTool?: {
            errors: number;
            confidence: number;
            source: string;
        };
        spelling?: {
            accuracy: number;
            errorsFound: number;
            source: string;
            confidence?: number;
            processingTime?: number;
            appliedToScore?: boolean;
        };
        vocabulary?: {
            level: string;
            score: number;
            source: string;
        };
        fluency?: {
            score: number;
            method: string;
            source: string;
        };
        languageBypass?: {
            reason: string;
            detectedLanguage?: string;
            englishRatio?: number;
        };
    };
    weightedAccuracy?: Partial<IAccuracyData>;
    currentAccuracy?: Partial<IAccuracyData>;
    categoryDetails?: CategoryMetricMap;
    tier: string;
    analysisDepth: string;
    insights: {
        level: UserProficiencyLevel;
        confidence: number;
        primaryCategory: string;
    };
    languageContext?: LanguageDetectionSummary;
    performance?: {
        totalProcessingTime: number;
        cacheHit: boolean;
        strategy: string;
        weightsUsed: {
            historical: number;
            current: number;
        };
        decayFactorApplied?: number;
        baselinesApplied?: NumericAccuracyKey[];
    };
}
export interface UnifiedErrorDetail {
    type: 'grammar' | 'spelling' | 'vocabulary' | 'fluency' | 'punctuation' | 'capitalization' | 'syntax' | 'style' | 'coherence' | 'idiom' | 'collocation' | 'semantic';
    category: string;
    severity: ErrorSeverity;
    message: string;
    position?: {
        start: number;
        end: number;
        word?: string;
    };
    suggestion: string;
    explanation?: string;
    alternatives?: string[];
    rule?: string;
    examples?: string[];
}
export interface AccuracyAnalysisOptions {
    tier?: UserTier;
    proficiencyLevel?: UserProficiencyLevel;
    userId?: string;
    previousAccuracy?: Partial<IAccuracyData>;
    enableNLP?: boolean;
    enableWeightedCalculation?: boolean;
    redisClient?: any;
    historicalWeighting?: HistoricalWeightingConfig;
    languageContext?: LanguageDetectionSummary;
}
export declare class UnifiedAccuracyCalculator {
    private readonly NLP_ENABLED;
    private languageToolDetector;
    private openRouterFluencyDetector;
    private redisCache;
    constructor();
    private formatMetric;
    private summarizeAccuracy;
    private summarizeSnapshot;
    private logNLPContributions;
    private applySpellingContributionFromNLP;
    private applyLanguageToolContributionFromNLP;
    /**
     * Fetch user data from cache first, then database (tier and proficiency level)
     */
    private fetchUserData;
    /**
     * Main entry point for unified accuracy analysis
     */
    analyzeMessage(message: string, aiResponse?: string, options?: AccuracyAnalysisOptions): Promise<UnifiedAccuracyResult>;
    /**
     * Perform basic accuracy analysis (grammar, spelling, etc.)
     */
    private performBasicAnalysis;
    /**
     * Perform NLP analysis using FREE services (LanguageTool, Typo.js, CEFR, OpenRouter)
     */
    private performNLPAnalysis;
    /**
     * Run fallback grammar pattern checks when LanguageTool is unavailable or to supplement LT.
     * Returns detected error objects and a simple count.
     */
    private runFallbackGrammarChecks;
    /**
     * Analyze grammar using pattern-based detection
     */
    private analyzeGrammar;
    /**
     * Analyze spelling using comprehensive database
     */
    private analyzeSpelling;
    /**
     * Analyze vocabulary using comprehensive assessment with ACADEMIC_WORDS
     */
    private analyzeVocabulary;
    /**
     * Analyze tone and formality (Pro+ feature)
     */
    private analyzeTone;
    /**
     * Calculate readability metrics (Pro+ feature)
     */
    private calculateReadability;
    /**
     * Analyze coherence and discourse (Premium feature)
     */
    private analyzeCoherence;
    /**
     * Analyze writing style (Pro+ feature)
     */
    private analyzeStyle;
    /**
     * Helper function to count syllables in a word
     */
    private countSyllables;
    /**
     * Analyze AI response for feedback quality (ENHANCED from enhanced calculator)
     */
    private analyzeAIResponse;
    /**
     * Analyze premium features (idioms, collocations, advanced suggestions) - PREMIUM EXCLUSIVE
     */
    private analyzePremiumFeatures;
    /**
     * Helper: Generate shorter version of long sentence
     */
    private generateShorterVersion;
    /**
     * Helper: Convert passive to active voice (simplified)
     */
    private convertToActiveVoice;
    /**
     * Helper: Generate alternative phrasings (Premium feature)
     */
    private generateAlternativePhrasings;
    /**
     * ❌ REMOVED: getTierMultiplier method
     * XP multipliers are now handled by the XP controller
     */
    private getAnalysisDepth;
    private determineProficiencyLevel;
    private calculateOverallScore;
    private categorizeErrors;
    private clampScore;
    private buildErrorsByType;
    private captureAccuracySnapshot;
    private cloneAccuracySnapshot;
    private applyHistoricalSmoothingFallback;
    private attachCategoryTrends;
    /**
     * ❌ REMOVED: XP calculation logic
     *
     * XP calculation is now handled by the dedicated XP controller.
     * Use the /api/xp/award endpoint to calculate and award XP based on accuracy results.
     *
     * This keeps the accuracy calculator focused on accuracy analysis only,
     * following the single responsibility principle.
     *
     * Example usage:
     * 1. Call unifiedAccuracyCalculator.analyzeAccuracy() to get accuracy results
     * 2. Extract wordCount, accuracy, errorCount, criticalErrors from results
     * 3. Call POST /api/xp/award with these parameters to calculate and award XP
     */
    /**
     * Analyze fluency (basic implementation)
     */
    private analyzeFluency;
    /**
     * Analyze punctuation
     */
    private analyzePunctuation;
    /**
     * Analyze capitalization with proper noun checking
     */
    private analyzeCapitalization;
}
export declare const unifiedAccuracyCalculator: UnifiedAccuracyCalculator;
/**
 * Main export function for backward compatibility
 * This replaces both analyzeMessageEnhanced and analyzeMessageWithNLP
 */
export declare function analyzeMessage(message: string, aiResponse?: string, options?: AccuracyAnalysisOptions): Promise<UnifiedAccuracyResult>;
export declare function analyzeMessageEnhanced(message: string, aiResponse: string, tier: UserTier, previousAccuracy?: number, proficiencyLevel?: UserProficiencyLevel): Promise<UnifiedAccuracyResult>;
export declare function analyzeMessageWithNLP(userMessage: string, aiResponse: string, topic: string, options?: {
    tier?: UserTier;
    proficiencyLevel?: UserProficiencyLevel;
    userId?: string;
    wordCount?: number;
    redisClient?: any;
    enableLanguageTool?: boolean;
    enableOpenRouter?: boolean;
}): Promise<UnifiedAccuracyResult>;
export default unifiedAccuracyCalculator;
//# sourceMappingURL=unifiedAccuracyCalculators.d.ts.map