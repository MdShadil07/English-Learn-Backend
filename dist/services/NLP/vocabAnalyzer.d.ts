/**
 * 📚 VOCABULARY ANALYZER SERVICE (FREE)
 * Analyzes vocabulary level using CEFR wordlist and word frequency
 * Zero-cost vocabulary sophistication analysis
 */
export declare const CEFR_WORDLISTS: {
    A1: Set<string>;
    A2: Set<string>;
    B1: Set<string>;
    B2: Set<string>;
    C1: Set<string>;
    C2: Set<string>;
};
export declare const CEFR_COMBINED_WORDSET: Set<string>;
interface VocabularyAnalysis {
    level: string;
    score: number;
    averageWordLength: number;
    uniqueWords: number;
    totalWords: number;
    lexicalDiversity: number;
    complexWords: number;
    cefrDistribution: {
        A1: number;
        A2: number;
        B1: number;
        B2: number;
        C1: number;
        C2: number;
        unknown: number;
    };
    suggestions: string[];
}
declare class VocabularyAnalyzerService {
    /**
     * Determine CEFR level of a word
     */
    private getWordLevel;
    private lookupWordLevel;
    private generateLemmaCandidates;
    private inferLevelFromMorphology;
    /**
     * Calculate lexical diversity (Type-Token Ratio)
     */
    private calculateLexicalDiversity;
    /**
     * Determine overall CEFR level from distribution
     */
    private determineOverallLevel;
    /**
     * Analyze vocabulary level and sophistication
     */
    analyze(text: string): Promise<VocabularyAnalysis>;
    /**
     * Generate improvement suggestions
     */
    private generateSuggestions;
    /**
     * Get empty analysis result
     */
    private getEmptyAnalysis;
}
export declare const vocabAnalyzer: VocabularyAnalyzerService;
export type { VocabularyAnalysis };
export default vocabAnalyzer;
//# sourceMappingURL=vocabAnalyzer.d.ts.map