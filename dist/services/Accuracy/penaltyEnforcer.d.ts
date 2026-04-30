import type { UnifiedAccuracyResult, UserTier } from '../../utils/calculators/unifiedAccuracyCalculators.js';
import type { LanguageDetectionSummary } from '../NLP/languageDetectionService.js';
export declare const ensureStatistics: (stats?: UnifiedAccuracyResult["statistics"]) => UnifiedAccuracyResult["statistics"];
export declare const buildFallbackUnifiedResult: (tier: UserTier, reason?: string, languageContext?: LanguageDetectionSummary) => UnifiedAccuracyResult;
export declare const enforcePenalty: (result: UnifiedAccuracyResult, sourceText: string, languageContext?: LanguageDetectionSummary) => UnifiedAccuracyResult;
//# sourceMappingURL=penaltyEnforcer.d.ts.map