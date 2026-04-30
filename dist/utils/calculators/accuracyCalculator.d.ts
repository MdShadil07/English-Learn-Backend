export interface AccuracyAnalysis {
    overall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    feedback: string[];
    errors: string[];
    suggestions: string[];
}
export declare const analyzeMessage: (userMessage: string, aiResponse?: string) => Promise<AccuracyAnalysis>;
//# sourceMappingURL=accuracyCalculator.d.ts.map