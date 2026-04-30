type AccuracyCardPayload = {
    totalXP?: number;
    currentLevel?: number;
    prestigeLevel?: number;
};
type NullableNumber = number | null | undefined;
type AccuracyScore = {
    overall: NullableNumber;
    grammar: NullableNumber;
    vocabulary: NullableNumber;
    spelling: NullableNumber;
    fluency: NullableNumber;
};
interface LatestAccuracyScores extends AccuracyScore {
    adjustedOverall?: NullableNumber;
    punctuation?: NullableNumber;
    capitalization?: NullableNumber;
    syntax?: NullableNumber;
    coherence?: NullableNumber;
    timestamp?: string;
}
interface LatestAccuracyInput extends AccuracyScore {
    adjustedOverall?: NullableNumber;
    punctuation?: NullableNumber;
    capitalization?: NullableNumber;
    syntax?: NullableNumber;
    coherence?: NullableNumber;
    timestamp?: Date | string;
}
export interface AccuracyTrackingPayload {
    userId: string;
    messageText?: string;
    timestamp?: Date | string;
    overall?: NullableNumber;
    grammar?: NullableNumber;
    vocabulary?: NullableNumber;
    spelling?: NullableNumber;
    fluency?: NullableNumber;
    overallScore?: NullableNumber;
    grammarScore?: NullableNumber;
    vocabularyScore?: NullableNumber;
    spellingScore?: NullableNumber;
    fluencyScore?: NullableNumber;
    latest?: LatestAccuracyInput;
    latestOverall?: NullableNumber;
    latestAdjustedOverall?: NullableNumber;
    latestGrammar?: NullableNumber;
    latestVocabulary?: NullableNumber;
    latestSpelling?: NullableNumber;
    latestFluency?: NullableNumber;
    latestPunctuation?: NullableNumber;
    latestCapitalization?: NullableNumber;
    latestSyntax?: NullableNumber;
    latestCoherence?: NullableNumber;
    xpSnapshot?: AccuracyCardPayload;
}
export interface CachedAccuracy extends AccuracyScore {
    userId: string;
    lastMessage?: string | null;
    timestamp: string;
    latest?: LatestAccuracyScores;
    xpSnapshot?: AccuracyCardPayload;
}
export declare const optimizedAccuracyTracker: {
    trackAccuracy(payload: AccuracyTrackingPayload): Promise<void>;
    getCachedAccuracy(userId: string): Promise<CachedAccuracy | null>;
    clearMemoryCache(): void;
    invalidate(userId: string): Promise<void>;
};
export default optimizedAccuracyTracker;
//# sourceMappingURL=optimizedAccuracyTracker.d.ts.map