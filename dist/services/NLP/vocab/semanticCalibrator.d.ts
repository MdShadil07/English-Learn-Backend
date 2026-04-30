declare class SemanticVocabularyCalibrator {
    private extractorPromise;
    private anchorVectorsPromise;
    private readonly embeddingCache;
    private initializationError;
    private ensureExtractor;
    private ensureAnchorVectors;
    private embedWord;
    promote(words: string[]): Promise<Array<{
        word: string;
        level: 'B1' | 'B2' | 'C1' | 'C2';
        similarity: number;
    }>>;
}
export declare const semanticVocabCalibrator: SemanticVocabularyCalibrator;
export type SemanticPromotion = {
    word: string;
    level: 'B1' | 'B2' | 'C1' | 'C2';
    similarity: number;
};
export {};
//# sourceMappingURL=semanticCalibrator.d.ts.map