export interface LanguageDetectionSummary {
    primaryLanguage: string;
    primaryLanguageName: string;
    probability: number;
    isReliable: boolean;
    isEnglish: boolean;
    isHindi: boolean;
    isMixed: boolean;
    englishRatio: number;
    hindiRatio: number;
    nonLatinRatio: number;
    totalAlphaCount: number;
    tokens: {
        total: number;
        english: number;
        hindi: number;
        other: number;
    };
    shouldSkipEnglishChecks: boolean;
    shouldRelaxGrammar: boolean;
    analysisNotes: string[];
    scores: Array<{
        language: string;
        score: number;
        label: string;
    }>;
}
export declare function detectLanguage(message: string | null | undefined): LanguageDetectionSummary;
//# sourceMappingURL=languageDetectionService.d.ts.map