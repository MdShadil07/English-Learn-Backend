/**
 * 🔤 SPELLING CHECKER SERVICE (FREE)
 * Uses Typo.js for offline spelling detection
 * Zero-cost alternative to proprietary spell checkers
 */
interface SpellingError {
    word: string;
    position: number;
    suggestions: string[];
    confidence: number;
}
declare class SpellingCheckerService {
    private static readonly WORD_REGEX;
    private dictionary;
    private initialized;
    private initializationFailed;
    private readonly customAllowedWords;
    /**
     * Initialize Typo dictionary and load optional hinglish whitelist
     */
    initialize(): Promise<void>;
    /**
     * Check if a word is spelled correctly
     */
    isAvailable(): boolean;
    /**
     * Check if spelling checker has a valid dictionary loaded
     * Returns false if dictionary files are missing or initialization failed
     */
    hasValidDictionary(): boolean;
    check(word: string): boolean;
    /**
     * Get spelling suggestions for a misspelled word
     */
    suggest(word: string): string[];
    /**
     * Analyze text for spelling errors
     */
    analyzeText(text: string): Promise<SpellingError[]>;
    /**
     * Calculate spelling accuracy percentage
     */
    calculateAccuracy(text: string): Promise<number>;
    /**
     * Get detailed spelling report
     */
    getReport(text: string): Promise<{
        accuracy: number;
        totalWords: number;
        errorsFound: number;
        errors: {
            word: string;
            suggestions: string[];
            confidence: number;
        }[];
        source: string;
        hasValidDictionary: boolean;
    } | {
        accuracy: null;
        totalWords: number;
        errorsFound: null;
        errors: never[];
        source: string;
        hasValidDictionary: boolean;
    }>;
}
export declare const spellingChecker: SpellingCheckerService;
export type { SpellingError };
export default spellingChecker;
//# sourceMappingURL=spellingChecker.d.ts.map