/**
 * 🎯 FLUENCY SCORER SERVICE (FREE)
 * Rule-based fluency analysis using sentence structure, transitions, and punctuation
 * Zero-cost alternative to AI-based fluency scoring
 */
declare const LOCAL_TRANSFORMER_ENABLED: boolean;
interface FluencyAnalysis {
    score: number;
    sentenceCount: number;
    averageSentenceLength: number;
    transitionWords: number;
    punctuationScore: number;
    structureScore: number;
    coherenceScore: number;
    improvements: string[];
    strengths: string[];
    method: 'rule-based' | 'ai-assisted';
}
declare class FluencyScorerService {
    private mapPerplexityToScore;
    private computeTransformerFluency;
    analyzeWithTransformer(text: string): Promise<FluencyAnalysis>;
    /**
     * Split text into sentences using sbd library
     */
    private splitSentences;
    /**
     * Count transition words in text
     */
    private countTransitions;
    /**
     * Analyze punctuation usage
     */
    private analyzePunctuation;
    /**
     * Analyze sentence structure
     */
    private analyzeStructure;
    /**
     * Analyze coherence and flow
     */
    private analyzeCoherence;
    /**
     * Generate improvement suggestions
     */
    private generateImprovements;
    /**
     * Identify strengths
     */
    private identifyStrengths;
    /**
     * Analyze fluency using rule-based methods
     */
    analyzeRuleBased(text: string): Promise<FluencyAnalysis>;
    /**
     * Get empty analysis result
     */
    private getEmptyAnalysis;
}
export declare const fluencyScorer: FluencyScorerService;
export { LOCAL_TRANSFORMER_ENABLED };
export type { FluencyAnalysis };
export default fluencyScorer;
//# sourceMappingURL=fluencyScorer.d.ts.map