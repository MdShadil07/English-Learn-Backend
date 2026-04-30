/**
 * AI CORRECTION EXTRACTION ENGINE v3.0
 * -------------------------------------
 * Features:
 *  - Multi-pattern correction extraction
 *  - Semantic rewrite detection (Levenshtein + Jaccard)
 *  - Hinglish-safe matching
 *  - Duplicate protection
 *  - False positive suppression
 *  - Capped penalties (max 5 per category)
 *  - Structured error metadata output
 */
import { UnifiedAccuracyResult } from './unifiedAccuracyCalculators.js';
/**
 * MAIN MODULE
 */
export declare function extractErrorsFromAIResponseImproved(userMessage: string, aiResponse: string, result: UnifiedAccuracyResult, features: any): void;
//# sourceMappingURL=improvedErrorExtractor.d.ts.map