import { UnifiedAccuracyResult, UserTier, UserProficiencyLevel, HistoricalWeightingConfig, CategoryMetricMap } from '../../utils/calculators/unifiedAccuracyCalculators.js';
import { IAccuracyData } from '../../models/Progress.js';
import { type LanguageDetectionSummary } from '../NLP/languageDetectionService.js';
export interface AccuracyProcessingParams {
    userId?: string;
    userMessage: string;
    aiResponse?: string;
    userTier: UserTier;
    userLevel?: UserProficiencyLevel | string;
    previousAccuracy?: Partial<IAccuracyData> | null;
    historicalWeighting?: HistoricalWeightingConfig;
}
export interface AccuracyProcessingResult {
    analysis: UnifiedAccuracyResult;
    currentAccuracy: Partial<IAccuracyData>;
    weightedAccuracy: Partial<IAccuracyData>;
    categoryDetails?: CategoryMetricMap;
    languageContext: LanguageDetectionSummary;
    historicalControls?: {
        requested?: HistoricalWeightingConfig;
        applied?: {
            current: number;
            historical: number;
            decayFactorApplied?: number;
            baselinesApplied?: string[];
        };
    };
    cacheSummary?: {
        overall: number;
        grammar: number;
        vocabulary: number;
        spelling: number;
        fluency: number;
        messageCount: number;
        lastUpdated: string;
    } | null;
}
export declare function processAccuracyRequest(params: AccuracyProcessingParams): Promise<AccuracyProcessingResult>;
//# sourceMappingURL=accuracyProcessingService.d.ts.map