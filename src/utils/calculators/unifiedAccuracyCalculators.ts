/**
 * 🎯 UNIFIED ACCURACY CALCULATOR - ADVANCED IMPLEMENTATION
 * 
 * This is the definitive, optimized accuracy calculation system that consolidates:
 * - Core accuracy analysis from accuracyCalculator.enhanced.ts
 * - NLP service integration from accuracy.orchestrator.ts  
 * - Weighted calculation from accuracyWeightedCalculator.ts
 * - Performance optimizations and caching
 * 
 * Features:
 * - Single entry point for all accuracy calculations
 * - Intelligent NLP service integration (Typo.js, CEFR, LanguageTool, OpenRouter)
 * - Advanced weighted calculation with historical context
 * - Optimized for millions of concurrent requests
 * - Full backward compatibility
 */

// Removed: All XP/Level calculation imports - now handled by dedicated XP controller
// XP calculation should be done separately by calling /api/xp/award endpoint
import { IAccuracyData } from '../../models/Progress.js';
import { redisCache } from '../../config/redis.js';
import Redis from 'ioredis';

// Import database models
import User from '../../models/User.js';
import Progress from '../../models/Progress.js';

// Import NLP services
import spellingChecker from '../../services/NLP/spellingChecker.js';
import { vocabAnalyzer } from '../../services/NLP/vocabAnalyzer.js';
import { fluencyScorer, LOCAL_TRANSFORMER_ENABLED } from '../../services/NLP/fluencyScorer.js';
import type { LanguageDetectionSummary } from '../../services/NLP/languageDetectionService.js';
// token-level detector removed — pipeline will rely on `languageDetectionService.detectLanguage` for language ratios

// Import core components for advanced NLP
import { RedisCache } from './core/RedisCache.js';
import { LanguageToolDetector } from './core/LanguageToolDetector.js';
import { OpenRouterFluencyDetector } from './detectors/OpenRouterDetector.js';
import { performanceLogger, nlpLogger } from './core/logger.js';
import type { ErrorDetail, AnalysisConfig } from './core/types.js';

// Import our new modules to avoid duplicates
import { extractErrorsFromAIResponseImproved } from './improvedErrorExtractor.js';
import { enhancedWeightedAccuracyService } from './enhancedWeightedAccuracy.js';
import { normalizeTypographicQuotes } from '../text/englishNormalizer.js';

const NLP_DEBUG_LOGS_ENABLED = process.env.ENABLE_NLP_DEBUG_LOGS === 'true';

const debugConsoleLog = (...args: Parameters<typeof console.log>) => {
  if (NLP_DEBUG_LOGS_ENABLED) {
    console.log(...args);
  }
};

const debugConsoleWarn = (...args: Parameters<typeof console.warn>) => {
  if (NLP_DEBUG_LOGS_ENABLED) {
    console.warn(...args);
  }
};

const DIALECT_NORMALIZATIONS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\banalysed\b/gi, replacement: 'analyzed' },
  { pattern: /\banalyses\b/gi, replacement: 'analyzes' },
  { pattern: /\borganisation\b/gi, replacement: 'organization' },
  { pattern: /\borganise\b/gi, replacement: 'organize' },
  { pattern: /\bbehaviour\b/gi, replacement: 'behavior' },
];

const DEVANAGARI_TOKEN_PATTERN = /[\u0900-\u097F]+/g;

// NOTE: Recent token-level language heuristics (e.g. romanized Hindi token lists) were removed
// to simplify the pipeline and operate on English-only checks. Non-English detection is handled
// via `languageDetectionService.detectLanguage` and `languageContext`.

interface LanguageFilterRange {
  start: number;
  end: number;
  token: string;
}

interface LanguageFilterResult {
  sanitizedMessage: string;
  maskedRanges: LanguageFilterRange[];
  maskedCharacterCount: number;
  romanizedTokens: Set<string>;
}

const normalizeDialectVariants = (text: string): string => {
  let normalized = DIALECT_NORMALIZATIONS.reduce(
    (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
    text,
  );

  // Normalize dashes and fancy quotes for consistent tokenization and LanguageTool input
  normalized = normalized.replace(/[—–]/g, ' - '); // em/en dash to hyphen with spaces
  normalized = normalized.replace(/[“”„‟]/g, '"');
  normalized = normalized.replace(/[‘’‚‛]/g, "'");
  // Normalize multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
};

// ============================================
// TYPE DEFINITIONS
// ============================================

export type UserTier = 'free' | 'pro' | 'premium';
export type UserProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
export type ErrorSeverity = 'critical' | 'major' | 'high' | 'medium' | 'low' | 'suggestion';

interface LanguageToolResult {
  errors: number;
  confidence: number;
  source: string;
  details: ErrorDetail[];
}

interface FluencyAnalysisResult {
  score: number;
  method: string;
  confidence: number;
  source: string;
  details?: string;
}

type NumericAccuracyKey =
  | 'overall'
  | 'adjustedOverall'
  | 'grammar'
  | 'vocabulary'
  | 'spelling'
  | 'fluency'
  | 'punctuation'
  | 'capitalization'
  | 'syntax'
  | 'coherence';

export type CategoryTrendDirection = 'improving' | 'declining' | 'stable';

export interface CategoryTrendInsight {
  currentScore: number;
  previousScore: number | null;
  delta: number | null;
  percentChange: number | null;
  momentum: CategoryTrendDirection;
  sampleSize: number;
}

export interface GrammarHeuristicPenalty {
  rule: string;
  penalty: number;
  reason: string;
}

export interface GrammarCategoryMetrics {
  score: number;
  weightedPenalty: number;
  normalizedImpact: number;
  severityDistribution: Record<ErrorSeverity, number>;
  dominantPatterns: string[];
  totalErrors: number;
  trend?: CategoryTrendInsight;
  heuristicPenalties?: GrammarHeuristicPenalty[];
}

export interface VocabularyCategoryMetrics {
  score: number;
  rangeScore: number;
  repetitionPenalty: number;
  diversity: number;
  repetitionRate: number;
  academicUsage: number;
  rareWordUsage: number;
  trend?: CategoryTrendInsight;
}

export interface SpellingCategoryMetrics {
  score: number;
  normalizedDensity: number;
  densityPerTokenType: {
    content: number;
    function: number;
  };
  totalErrors: number;
  contentTokenCount: number;
  functionTokenCount: number;
  trend?: CategoryTrendInsight;
}

export interface PronunciationCategoryMetrics {
  overall: number;
  prosody: number;
  intelligibility: number;
  pacing: number;
  stress: number;
  signals: {
    punctuationVariety: number;
    fillerInstances: number;
    connectorCount: number;
    stressIndicators: number;
  };
  trend?: CategoryTrendInsight;
}

export interface CategoryMetricMap {
  grammar?: GrammarCategoryMetrics;
  vocabulary?: VocabularyCategoryMetrics;
  spelling?: SpellingCategoryMetrics;
  pronunciation?: PronunciationCategoryMetrics;
}

export interface HistoricalWeightingConfig {
  decayFactor?: number;
  categoryBaselines?: Partial<Record<NumericAccuracyKey, number>>;
  minimumMessageCountForHistory?: number;
  currentWeightOverride?: number;
}

const NUMERIC_ACCURACY_KEYS: NumericAccuracyKey[] = [
  'overall',
  'adjustedOverall',
  'grammar',
  'vocabulary',
  'spelling',
  'fluency',
  'punctuation',
  'capitalization',
  'syntax',
  'coherence',
];

const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'while', 'for', 'to', 'of', 'in', 'on', 'at',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'has', 'have', 'had',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'with', 'from', 'by',
  'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during',
  'without', 'before', 'under', 'around', 'among', 'than', 'so', 'because', 'when', 'where', 'who',
  'whom', 'which', 'that', 'this', 'these', 'those', 'my', 'your', 'his', 'her', 'their', 'our',
  'its', 'me', 'him', 'them', 'us', 'you', 'i'
]);

export function summarizeCategoryTrend(
  currentScore: number | undefined,
  previousScore: number | undefined,
  sampleSize: number = 0
): CategoryTrendInsight | undefined {
  if (typeof currentScore !== 'number' || Number.isNaN(currentScore)) {
    return undefined;
  }

  const clamp = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, value));
  };

  const current = Number(clamp(currentScore).toFixed(2));

  if (typeof previousScore !== 'number' || Number.isNaN(previousScore)) {
    return {
      currentScore: current,
      previousScore: null,
      delta: null,
      percentChange: null,
      momentum: 'stable',
      sampleSize,
    };
  }

  const previous = Number(clamp(previousScore).toFixed(2));
  const rawDelta = current - previous;
  const delta = Number(rawDelta.toFixed(2));
  const percentChange = previous === 0
    ? null
    : Number(((delta / previous) * 100).toFixed(2));

  const threshold = 1.5;
  let momentum: CategoryTrendDirection = 'stable';
  if (delta > threshold) {
    momentum = 'improving';
  } else if (delta < -threshold) {
    momentum = 'declining';
  }

  return {
    currentScore: current,
    previousScore: previous,
    delta,
    percentChange,
    momentum,
    sampleSize,
  };
}

export interface UnifiedAccuracyResult {
  // Core accuracy scores
  overall: number;
  adjustedOverall: number;
  grammar: number;
  vocabulary: number;
  spelling: number;
  fluency: number;
  punctuation: number;
  capitalization: number;
  
  // Enhanced scores (for premium tiers)
  syntax?: number;
  coherence?: number;
  
  // FREE NLP INTEGRATION (from orchestrator)
  freeNLPEnhanced?: boolean; // Flag indicating free NLP was used
  nlpCost?: string; // "$0/month"
  detectorContributions?: {
    languageTool?: { errors: number; confidence: number; source: string };
    spelling?: { accuracy: number; confidence: number; source: string; errorsFound?: number };
    vocabulary?: { level: string; score: number; source: string };
    fluency?: { score: number; method: string; source: string };
    languageBypass?: {
      reason: string;
      detectedLanguage?: string;
      englishRatio?: number;
    };
  };
  
  // Tier-specific Analysis (from enhanced calculator)
  tone?: {
    overall: 'formal' | 'neutral' | 'informal' | 'casual';
    confidence: number;
    recommendations?: string[];
    contextAppropriate: boolean;
  };
  readability?: {
    fleschKincaidGrade: number;
    fleschReadingEase: number;
    smogIndex: number;
    colemanLiauIndex: number;
    automatedReadabilityIndex: number;
    averageLevel: string;
    recommendation?: string;
  };
  vocabularyAnalysis?: {
    level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    academicWordUsage: number;
    rareWordUsage: number;
    wordDiversity: number;
    suggestions?: Array<{
      word: string;
      alternatives: string[];
      context: string;
    }>;
  };
  coherenceAnalysis?: {
    score: number;
    transitions: {
      used: number;
      suggested: string[];
    };
    topicConsistency: number;
    logicalFlow: number;
    issues?: string[];
  };
  styleAnalysis?: {
    passiveVoiceUsage: number;
    sentenceVariety: number;
    repetitionIssues: number;
    formalityScore: number;
    engagement: number;
    recommendations?: string[];
  };
  premiumInsights?: {
    idiomaticExpressions: {
      found: string[];
      improvements: Array<{
        original: string;
        suggestion: string;
        explanation: string;
      }>;
    };
    collocations: {
      correctUsage: number;
      issues: Array<{
        phrase: string;
        correction: string;
        reason: string;
      }>;
    };
    contextualSuggestions: string[];
    advancedPatterns: {
      detected: string[];
      recommendations: string[];
    };
  };
  
  // Error analysis
  errors: UnifiedErrorDetail[];
  feedback: string[];
  suggestions: string[];
  
  // Statistics
  statistics: {
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordsPerSentence: number;
    avgSyllablesPerWord: number;
    complexWordCount: number;
    uniqueWordRatio: number;
    errorCount: number;
    criticalErrorCount: number;
    errorsByCategory: Record<string, number>;
    processingTime: number;
  };
  
  // AI Response Analysis
  aiResponseAnalysis: {
    hasCorrectionFeedback: boolean;
    detectedCorrections?: number;
    hasGrammarCorrection: boolean;
    hasStyleSuggestion: boolean;
    correctedErrors: string[];
    appreciationLevel: 'none' | 'minimal' | 'moderate' | 'high';
    severityOfCorrections: 'none' | 'minor' | 'moderate' | 'major';
    engagementScore: number;
    penalties?: {
      grammar?: number;
      vocabulary?: number;
      fluency?: number;
      spelling?: number;
    };
  };
  
  // NLP enhancements
  nlpEnhanced: boolean;
  nlpContributions?: {
    languageTool?: { errors: number; confidence: number; source: string };
    spelling?: { accuracy: number; errorsFound: number; source: string; confidence?: number; processingTime?: number; appliedToScore?: boolean };
    vocabulary?: { level: string; score: number; source: string };
    fluency?: { score: number; method: string; source: string };
    languageBypass?: {
      reason: string;
      detectedLanguage?: string;
      englishRatio?: number;
    };
  };
  
  // Weighted calculation results
  weightedAccuracy?: Partial<IAccuracyData>;
  currentAccuracy?: Partial<IAccuracyData>;

  categoryDetails?: CategoryMetricMap;
  
  // Note: XP calculation removed - use XP controller (/api/xp/award) instead
  // This keeps accuracy calculation clean and separated from gamification logic
  
  // Metadata
  tier: string;
  analysisDepth: string;
  insights: {
    level: UserProficiencyLevel;
    confidence: number;
    primaryCategory: string;
  };
  languageContext?: LanguageDetectionSummary;
  
  // Performance metrics
  performance?: {
    totalProcessingTime: number;
    cacheHit: boolean;
    strategy: string;
    weightsUsed: {
      historical: number;
      current: number;
    };
    decayFactorApplied?: number;
    baselinesApplied?: NumericAccuracyKey[];
  };
}

export interface UnifiedErrorDetail {
  type: 'grammar' | 'spelling' | 'vocabulary' | 'fluency' | 'punctuation' | 'capitalization' | 'syntax' | 'style' | 'coherence' | 'idiom' | 'collocation' | 'semantic';
  category: string;
  severity: ErrorSeverity;
  message: string;
  position?: { start: number; end: number; word?: string };
  suggestion: string;
  explanation?: string; // Detailed explanation (Pro/Premium only)
  alternatives?: string[]; // Alternative phrasings (Premium only)
  rule?: string; // Grammar rule reference (Pro/Premium only)
  examples?: string[]; // Example usage (Premium only)
}

export interface AccuracyAnalysisOptions {
  tier?: UserTier;
  proficiencyLevel?: UserProficiencyLevel;
  userId?: string;
  previousAccuracy?: Partial<IAccuracyData>;
  enableNLP?: boolean;
  enableWeightedCalculation?: boolean;
  redisClient?: any;
  historicalWeighting?: HistoricalWeightingConfig;
  languageContext?: LanguageDetectionSummary;
}

// ============================================
// CONFIGURATION
// ============================================

const TIER_FEATURES = {
  free: {
    maxFeedbackPoints: 5,
    maxSuggestions: 3,
    detailedExplanations: false,
    toneAnalysis: false,
    readabilityMetrics: false,
    vocabularyAnalysis: false,
    coherenceAnalysis: false,
    styleAnalysis: false,
    premiumInsights: false,
    advancedGrammar: false,
    contextualSuggestions: false,
    alternativePhrasing: false,
    idiomaticExpressions: false,
    sentenceRewriting: false,
    advancedVocabSuggestions: false,
    professionalTips: false,
    personalizedLearning: false,
    progressTracking: false,
    comparativeAnalysis: false,
    // xpMultiplier removed - handled by XP controller
    priorityProcessing: false,
    analysisDepth: 'basic',
    errorExplanationDepth: 'simple',
    // Basic features
    basicGrammar: true,
    basicSpelling: true,
    basicVocabulary: true,
    basicFluency: true,
  },
  pro: {
    maxFeedbackPoints: 20,
    maxSuggestions: 10,
    detailedExplanations: true,
    toneAnalysis: true,
    readabilityMetrics: true,
    vocabularyAnalysis: true,
    coherenceAnalysis: true,
    styleAnalysis: true,
    premiumInsights: false,
    advancedGrammar: true,
    contextualSuggestions: true,
    alternativePhrasing: true,
    idiomaticExpressions: true,
    sentenceRewriting: true,
    advancedVocabSuggestions: true,
    professionalTips: true,
    personalizedLearning: true,
    progressTracking: true,
    comparativeAnalysis: false,
    // xpMultiplier removed - handled by XP controller
    priorityProcessing: true,
    analysisDepth: 'advanced',
    errorExplanationDepth: 'detailed',
    // Basic features
    basicGrammar: true,
    basicSpelling: true,
    basicVocabulary: true,
    basicFluency: true,
  },
  premium: {
    maxFeedbackPoints: 50,
    maxSuggestions: 20,
    detailedExplanations: true,
    toneAnalysis: true,
    readabilityMetrics: true,
    vocabularyAnalysis: true,
    coherenceAnalysis: true,
    styleAnalysis: true,
    premiumInsights: true,
    advancedGrammar: true,
    contextualSuggestions: true,
    alternativePhrasing: true,
    idiomaticExpressions: true,
    sentenceRewriting: true,
    advancedVocabSuggestions: true,
    professionalTips: true,
    personalizedLearning: true,
    progressTracking: true,
    comparativeAnalysis: true,
    // xpMultiplier removed - handled by XP controller
    priorityProcessing: true,
    analysisDepth: 'expert',
    errorExplanationDepth: 'comprehensive',
    // Basic features
    basicGrammar: true,
    basicSpelling: true,
    basicVocabulary: true,
    basicFluency: true,
  },
} as const;

const CATEGORY_WEIGHTS = {
  grammar: 1.0,
  vocabulary: 1.0,
  spelling: 1.0,
  fluency: 1.2,
  punctuation: 0.8,
  capitalization: 0.6,
  syntax: 1.1,
  coherence: 1.0,
} as const;

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================
const LANGUAGETOOL_ENABLED = process.env.LANGUAGETOOL_ENABLED === 'true';
const OPENROUTER_ENABLED = process.env.OPENROUTER_ENABLED === 'true';
const NLP_CACHE_ENABLED = process.env.NLP_CACHE_ENABLED === 'true';
const NLP_ENABLED = process.env.NLP_ENABLED === 'true';
const LANGUAGETOOL_API_URL = process.env.LANGUAGETOOL_API_URL || 'http://localhost:8081/v2/check';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';

// ============================================
// ACADEMIC WORDS DATABASE (from enhanced calculator)
// ============================================

// Academic Word List (AWL) - simplified subset for CEFR level assessment
const ACADEMIC_WORDS = new Set([
  'analyze', 'approach', 'area', 'assess', 'assume', 'authority', 'available',
  'benefit', 'concept', 'consistent', 'constitutional', 'context', 'contract',
  'create', 'data', 'define', 'derive', 'distribute', 'economy', 'environment',
  'establish', 'estimate', 'evidence', 'export', 'factors', 'finance', 'formula',
  'function', 'identify', 'income', 'indicate', 'individual', 'interpret', 'involve',
  'issue', 'labor', 'legal', 'legislate', 'major', 'method', 'occur', 'percent',
  'period', 'policy', 'principle', 'proceed', 'process', 'require', 'research',
  'respond', 'role', 'section', 'sector', 'significant', 'similar', 'source',
  'specific', 'structure', 'theory', 'vary', 'achieve', 'acquire', 'administrate',
  'affect', 'appropriate', 'aspect', 'assist', 'category', 'chapter', 'commission',
  'community', 'complex', 'compute', 'conclude', 'conduct', 'consequent', 'construct',
  'consume', 'credit', 'cultural', 'design', 'distinct', 'element', 'equation',
  'evaluate', 'feature', 'final', 'focus', 'impact', 'injure', 'institute',
  'invest', 'item', 'journal', 'maintain', 'normal', 'obtain', 'participate',
  'perceive', 'positive', 'potential', 'previous', 'primary', 'purchase', 'range',
  'region', 'regulate', 'relevant', 'reside', 'resource', 'restrict', 'secure',
  'seek', 'select', 'site', 'strategy', 'survey', 'text', 'tradition', 'transfer'
]);

// ============================================
// UTILITY FUNCTIONS (from enhanced calculator)
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 * Used to determine if two words are similar (potential spelling error)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Extract errors from AI response corrections (PRIMARY SOURCE OF TRUTH)
 * NOW USING IMPROVED EXTRACTOR MODULE
 */
function extractErrorsFromAIResponse(
  userMessage: string,
  aiResponse: string,
  result: UnifiedAccuracyResult,
  features: any
): void {
  // Use our improved error extractor module
  extractErrorsFromAIResponseImproved(userMessage, aiResponse, result, features);
}

// ============================================
// COMPREHENSIVE GRAMMAR RULES (from enhanced calculator)
// ============================================

interface GrammarRule {
  id: string;
  pattern: RegExp;
  message: string;
  category: string;
  severity: ErrorSeverity;
  suggestion: (match: RegExpMatchArray) => string;
  explanation?: string;
  examples?: string[];
  tier: UserTier;
}

const GRAMMAR_RULES: GrammarRule[] = [
  // CRITICAL BASIC ERRORS - Catches catastrophic grammar
  {
    id: 'pronoun-verb-mismatch',
    pattern: /\b(me|him|her)\s+(am|is|are|was|were|have|has|do|does|go|goes|try|tries|want|wants)\b/gi,
    message: 'Object pronoun used instead of subject pronoun',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => {
      const [, pronoun, verb] = match;
      const correctPronoun = pronoun === 'me' ? 'I' : pronoun === 'him' ? 'he' : 'she';
      return `Use "${correctPronoun} ${verb}" instead of "${pronoun} ${verb}"`;
    },
    explanation: 'Subject pronouns (I, he, she, we, they) must be used with verbs, not object pronouns (me, him, her).',
    examples: ['I am (not "me am")', 'He goes (not "him go")'],
    tier: 'free',
  },
  {
    id: 'third-person-missing-s',
    pattern: /\b(he|she|it|the [a-z]+)\s+(go|do|try|want|need|have|say|come|work|play|like|know|think|make|take|give|tell|use|find|call|ask|seem|feel|become|leave)\b(?!ing)\b/gi,
    message: 'Missing -s/-es for third-person singular verb',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => {
      const [, subject, verb] = match;
      const correctVerb = verb === 'go' ? 'goes' : verb === 'do' ? 'does' : verb === 'have' ? 'has' : verb === 'try' ? 'tries' : `${verb}s`;
      return `Use "${subject} ${correctVerb}" instead of "${subject} ${verb}"`;
    },
    explanation: 'Third-person singular subjects (he, she, it) require -s or -es ending on present tense verbs.',
    examples: ['He goes (not "he go")', 'She tries (not "she try")', 'It has (not "it have")'],
    tier: 'free',
  },
  {
    id: 'multiple-auxiliaries',
    pattern: /\b(am|is|are)\s+(was|were|been|being)\s+/gi,
    message: 'Multiple auxiliary verbs used incorrectly',
    category: 'grammar',
    severity: 'critical',
    suggestion: () => 'Use only one auxiliary verb',
    explanation: 'Cannot combine "am/is/are" with "was/were/been" in the same verb phrase.',
    examples: ['I was trying (not "I am was trying")', 'He is working (not "he is was working")'],
    tier: 'free',
  },
  {
    id: 'wrong-verb-tense-past',
    pattern: /\b(yesterday|last night|last week|ago)\b.*\b(go|come|take|make|see|get|give|know|think|find|tell|become|begin|bring|buy|catch|choose|do|drink|drive|eat|fall|feel|forget|hear|keep|leave|lose|meet|pay|run|say|sell|send|sit|speak|stand|teach|understand|win|write)\b/gi,
    message: 'Present tense verb used with past time expression',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => 'Use past tense form of the verb',
    explanation: 'Past time expressions (yesterday, last week, ago) require past tense verbs.',
    examples: ['went yesterday (not "go yesterday")', 'bought last week (not "buy last week")'],
    tier: 'free',
  },
  {
    id: 'missing-be-verb',
    pattern: /\b(I|you|we|they|he|she|it|the [a-z]+)\s+(good|bad|happy|sad|angry|ready|nice|tired|hungry|cold|hot|busy|free|late|early|wrong|right|sure)\b(?!\s+(is|am|are|was|were))/gi,
    message: 'Missing "be" verb before adjective',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => {
      const [, subject] = match;
      const verb = subject === 'I' ? 'am' : (subject === 'he' || subject === 'she' || subject === 'it' || subject.startsWith('the ')) ? 'is' : 'are';
      return `Add "${verb}": "${match[0].replace(/(\w+)\s+/, `$1 ${verb} `)}`;
    },
    explanation: 'Adjectives describing a subject require a "be" verb (am/is/are/was/were).',
    examples: ['It is good (not "it good")', 'I am happy (not "I happy")'],
    tier: 'free',
  },
  {
    id: 'sentence-fragment',
    pattern: /\b[A-Z][a-z]+\.\s+[A-Z][a-z]+\.\s+[A-Z][a-z]+\.\s+/g,
    message: 'Sentence fragments - incomplete thoughts',
    category: 'grammar',
    severity: 'high',
    suggestion: () => 'Combine fragments into complete sentences with subjects and verbs',
    explanation: 'Complete sentences need both a subject and a verb, not just single words.',
    examples: ['I walked alone because the day was cold. (not "Cold day. Walk. Alone.")'],
    tier: 'free',
  },
  // Critical Grammar Errors - Missing auxiliary verbs in questions
  {
    id: 'missing-aux-verb-question',
    pattern: /\b(what|where|when|why|who|which|how)\s+(wrong|good|bad|right|important|necessary|possible|different)\b(?!\s+(is|are|was|were|do|does|did))/gi,
    message: 'Missing auxiliary verb in question',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => {
      const [full, qWord, adjective] = match;
      return `Add "is" or "are": "${qWord} is ${adjective}" or "${qWord} are ${adjective}"`;
    },
    explanation: 'Questions with "what/where/when/why/how + adjective" need an auxiliary verb (is/are/was/were).',
    examples: [
      'What is wrong? (not "what wrong")',
      'How is it different? (not "how different")',
      'Where is the problem? (not "where problem")'
    ],
    tier: 'free',
  },
  {
    id: 'question-word-order',
    pattern: /\b(how|what|where|when|why|who|which)\s+(i|you|he|she|it|we|they)\s+(am|is|are|was|were|do|does|did|can|could|will|would|should|have|has|had)\b/gi,
    message: 'Question word order error',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => {
      const [full, qWord, subject, verb] = match;
      return `Use "${qWord} ${verb} ${subject}" instead of "${qWord} ${subject} ${verb}"`;
    },
    explanation: 'In English questions, the auxiliary verb comes before the subject.',
    examples: ['How are you? (not "how you are")', 'What do you want? (not "what you want")'],
    tier: 'free',
  },
  {
    id: 'subject-verb-agreement',
    pattern: /\b(he|she|it)\s+(am|are|do|have)\b/gi,
    message: 'Subject-verb agreement error',
    category: 'grammar',
    severity: 'critical',
    suggestion: (match) => {
      const [, subject, verb] = match;
      const correctVerb = verb === 'am' || verb === 'are' ? 'is' : verb === 'do' ? 'does' : 'has';
      return `Use "${subject} ${correctVerb}" instead of "${subject} ${verb}"`;
    },
    explanation: 'Third-person singular subjects (he, she, it) require singular verbs.',
    examples: ['He is happy (not "he are")', 'She does work (not "she do")'],
    tier: 'free',
  },
  {
    id: 'double-negative',
    pattern: /\b(don't|didn't|doesn't|won't|can't|shouldn't)\s+\w+\s+(no|nothing|nobody|never|nowhere)\b/gi,
    message: 'Double negative detected',
    category: 'grammar',
    severity: 'high',
    suggestion: (match) => 'Remove one of the negative words for proper English',
    explanation: 'In standard English, avoid using two negatives in the same clause.',
    examples: ['I don\'t have anything (not "don\'t have nothing")', 'He didn\'t see anyone (not "didn\'t see nobody")'],
    tier: 'free',
  },
  
  // Article Errors (Pro+)
  {
    id: 'missing-article',
    pattern: /\b(is|was|am|are)\s+(good|bad|important|necessary|beautiful|difficult)\s+(idea|person|thing|place|way)\b/gi,
    message: 'Missing article (a/an/the)',
    category: 'grammar',
    severity: 'medium',
    suggestion: (match) => `Consider adding an article: "${match[0].replace(/(\w+\s+)/, '$1a ')}"`,
    explanation: 'Singular countable nouns usually require an article.',
    tier: 'pro',
  },
  
  // Preposition Errors (Pro+)
  {
    id: 'wrong-preposition',
    pattern: /\b(depend|rely|focus|concentrate)\s+at\b/gi,
    message: 'Wrong preposition',
    category: 'grammar',
    severity: 'medium',
    suggestion: (match) => match[0].replace(/at/i, 'on'),
    explanation: 'Some verbs require specific prepositions.',
    examples: ['depend on (not "at")', 'focus on (not "at")'],
    tier: 'pro',
  },
  
  // Advanced Grammar (Premium)
  {
    id: 'passive-voice-overuse',
    pattern: /\b(is|was|were|are|been)\s+(being\s+)?\w+ed\b/gi,
    message: 'Consider using active voice for clarity',
    category: 'style',
    severity: 'suggestion',
    suggestion: () => 'Try rephrasing in active voice for more direct communication',
    explanation: 'Active voice is often clearer and more engaging than passive voice.',
    tier: 'premium',
  },
];

// ============================================
// COMPREHENSIVE SPELLING DATABASE (from enhanced calculator)
// ============================================

const COMMON_MISSPELLINGS: Record<string, string> = {
  'teh': 'the',
  'recieve': 'receive',
  'seperate': 'separate',
  'occasion': 'occasion',
  'beleive': 'believe',
  'definately': 'definitely',
  'untill': 'until',
  'tommorrow': 'tomorrow',
  'begining': 'beginning',
  'grammer': 'grammar',
  'liging': 'living',
  'nothinbg': 'nothing',
  'recieved': 'received',
  'occured': 'occurred',
  'judgement': 'judgment',
  'arguement': 'argument',
  'wierd': 'weird',
  'freind': 'friend',
  'thier': 'their',
  'becuase': 'because',
  'wich': 'which',
  "youre": "you're",
  "im": "I'm",
  "dont": "don't",
  "cant": "can't",
  "wont": "won't",
  "didnt": "didn't",
  "doesnt": "doesn't",
  "isnt": "isn't",
  "arent": "aren't",
  "wasnt": "wasn't",
  "werent": "weren't",
  "havent": "haven't",
  "hasnt": "hasn't",
  "couldnt": "couldn't",
  "shouldnt": "shouldn't",
  "wouldnt": "wouldn't",
  "mightnt": "mightn't",
  "mustnt": "mustn't",
  "whats": "what's",
  "thats": "that's",
  "heres": "here's",
  "theres": "there's",
  "wheres": "where's",
  "whens": "when's",
  "whys": "why's",
  "hows": "how's",
  "whos": "who's",
  "youll": "you'll",
  "theyll": "they'll",
  "well": "we'll",
  "ill": "I'll",
  "shell": "she'll",
  "hell": "he'll",
  "itll": "it'll",
  "youve": "you've",
  "theyve": "they've",
  "weve": "we've",
  "ive": "I've",
  "shes": "she's",
  "hes": "he's",
  "theyre": "they're",
  "were": "we're",
  "youd": "you'd",
  "theyd": "they'd",
  "wed": "we'd",
  "id": "I'd",
  "shed": "she'd",
  "hed": "he'd",
};

// ============================================
// MAIN UNIFIED CALCULATOR CLASS
// ============================================

export class UnifiedAccuracyCalculator {
  private readonly NLP_ENABLED = NLP_ENABLED;
  private languageToolDetector: LanguageToolDetector | null = null;
  private openRouterFluencyDetector: OpenRouterFluencyDetector | null = null;
  private redisCache: RedisCache | null = null;
  
  constructor() {
    // Initialize NLP detectors if enabled
    // Note: Detectors require cache instance, so we create a mock cache if Redis not available
    const mockCache: any = {
      get: async () => null,
      set: async () => {},
      del: async () => {},
    };
    
    if (LANGUAGETOOL_ENABLED) {
      this.languageToolDetector = new LanguageToolDetector(LANGUAGETOOL_API_URL, mockCache);
    }
    if (OPENROUTER_ENABLED && OPENROUTER_API_KEY) {
      this.openRouterFluencyDetector = new OpenRouterFluencyDetector(OPENROUTER_API_KEY, mockCache);
    }
    if (NLP_CACHE_ENABLED && redisCache.isConnected()) {
      const client = redisCache.getClient();
      if (client) {
        this.redisCache = new RedisCache(client);
      }
    }
  }

  private formatMetric(value?: number | null): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Number(value.toFixed(2));
  }

  private summarizeAccuracy(result: UnifiedAccuracyResult) {
    return {
      overall: this.formatMetric(result.overall),
      adjustedOverall: this.formatMetric(result.adjustedOverall),
      grammar: this.formatMetric(result.grammar),
      vocabulary: this.formatMetric(result.vocabulary),
      spelling: this.formatMetric(result.spelling),
      fluency: this.formatMetric(result.fluency),
      punctuation: this.formatMetric(result.punctuation ?? 0),
      capitalization: this.formatMetric(result.capitalization ?? 0),
      syntax: this.formatMetric(result.syntax ?? 0),
      coherence: this.formatMetric(result.coherence ?? 0),
    };
  }

  private summarizeSnapshot(label: string, snapshot?: Partial<IAccuracyData> | null) {
    if (!snapshot) {
      return `${label}: n/a`;
    }
    return `${label}: overall=${this.formatMetric(snapshot.overall ?? 0)} grammar=${this.formatMetric(snapshot.grammar ?? 0)} vocabulary=${this.formatMetric(snapshot.vocabulary ?? 0)} spelling=${this.formatMetric(snapshot.spelling ?? 0)} fluency=${this.formatMetric(snapshot.fluency ?? 0)}`;
  }

  private logNLPContributions(contributions: UnifiedAccuracyResult['nlpContributions'] | undefined) {
    if (!contributions) {
      return;
    }
    const summary = {
      languageTool: contributions.languageTool?.errors,
      spellingAccuracy: contributions.spelling?.accuracy,
      vocabularyLevel: contributions.vocabulary?.level,
      fluencyScore: contributions.fluency?.score,
      languageBypass: contributions.languageBypass?.reason,
    };
  debugConsoleLog('🔍 [UnifiedAccuracy] NLP contributions summary', summary);
  }

  private async applySpellingContributionFromNLP(result: UnifiedAccuracyResult): Promise<boolean> {
    const spellingContribution = result.nlpContributions?.spelling;
    if (!spellingContribution) {
      return false;
    }

    const rawAccuracy = Number(spellingContribution.accuracy);
    if (!Number.isFinite(rawAccuracy)) {
      // If Typo reported `null` (unavailable), surface null spelling score to the result
      try {
        result.spelling = null as any;
        if (!result.categoryDetails) result.categoryDetails = {};
        result.categoryDetails.spelling = result.categoryDetails.spelling || {} as any;
        (result.categoryDetails.spelling as any).score = null;
      } catch (e) {
        // ignore assignment errors
      }
      return true;
    }

    const boundedAccuracy = Math.max(0, Math.min(100, rawAccuracy));
    const normalizedAccuracy = Math.round(boundedAccuracy);

    // We'll merge Typo.js details with LanguageTool TYPOS to compute a combined accuracy/density.
    const ltDetails: ErrorDetail[] = (result.nlpContributions as any)?.languageTool?.details || [];
    const typoDetails: any[] = (spellingContribution as any).details || [];

    // Identify LT-detected typos (match type or category)
    const ltTypos = ltDetails.filter((d) => {
      try {
        const cat = (d.category || '').toString().toUpperCase();
        const t = (d.type || '').toString().toLowerCase();
        const rule = (d.rule || '').toString().toLowerCase();
        return t === 'spelling' || cat === 'TYPOS' || rule.includes('morfologik') || (d.message || '').toString().toLowerCase().includes('spelling');
      } catch (e) {
        return false;
      }
    });

    // Build map by position or word for deduplication
    const mergedMap: Record<string, { word?: string; start?: number; end?: number; sources: Set<string>; suggestions: Set<string> }> = {};

    const addToMap = (key: string, entry: { word?: string; start?: number; end?: number; source: string; suggestions?: string[] }) => {
      if (!mergedMap[key]) mergedMap[key] = { word: entry.word, start: entry.start, end: entry.end, sources: new Set(), suggestions: new Set() };
      mergedMap[key].sources.add(entry.source);
      (entry.suggestions || []).forEach(s => mergedMap[key].suggestions.add(s));
    };

    // Add LT typos first (they get preference for contextual suggestions)
    ltTypos.forEach((d) => {
      const start = d.position?.start as number | undefined;
      const end = d.position?.end as number | undefined;
      const word = (d.position?.word || '').toString();
      const key = (typeof start === 'number' && typeof end === 'number') ? `${start}:${end}` : word.toLowerCase();
      const suggs: string[] = [];
      if (d.suggestion) suggs.push(d.suggestion);
      if (Array.isArray(d.alternatives)) suggs.push(...d.alternatives.slice(0, 3));
      addToMap(key, { word, start, end, source: 'languagetool', suggestions: suggs });
    });

    // Add Typo.js misses; prefer LT suggestions when overlapping
    typoDetails.forEach((t) => {
      // Typo.js detail might provide word and offsets
      const word = (t.word || t.token || '').toString();
      const start = typeof t.start === 'number' ? t.start : undefined;
      const end = typeof t.end === 'number' ? t.end : undefined;
      const key = (typeof start === 'number' && typeof end === 'number') ? `${start}:${end}` : word.toLowerCase();
      const suggs = Array.isArray(t.suggestions) ? t.suggestions.slice(0, 3) : (t.suggestion ? [t.suggestion] : []);
      addToMap(key, { word, start, end, source: 'typo-js', suggestions: suggs });
    });

    // Create merged list and compute combinedErrors
    const mergedList = Object.keys(mergedMap).map((k) => {
      const v = mergedMap[k];
      const suggestions = Array.from(v.suggestions);
      // Prefer suggestions from LanguageTool if LT was a source
      const prefersLT = v.sources.has('languagetool');
      return {
        key: k,
        word: v.word,
        start: v.start,
        end: v.end,
        sources: Array.from(v.sources),
        suggestions: prefersLT ? suggestions : suggestions,
      };
    });

    const combinedErrors = mergedList.length;

    // Compute token counts: try to use existing category details; fallback to statistics.wordCount
    const tokenSum = ((result.categoryDetails?.spelling?.contentTokenCount ?? 0) + (result.categoryDetails?.spelling?.functionTokenCount ?? 0));
    const totalTokens = Math.max(1, tokenSum || result.statistics?.wordCount || 1);

    const normalizedDensity = Number(((combinedErrors / totalTokens) * 100).toFixed(2));

    // Recompute spelling accuracy directly from combined error rate (avoid magic constants)
    const combinedAccuracy = Math.max(0, Math.min(100, Math.round(100 - (combinedErrors / totalTokens) * 100)));

    // If combined accuracy is not better than existing, we still apply it (we want combined authoritative estimate)
    result.spelling = combinedAccuracy;
    if (!result.categoryDetails) {
      result.categoryDetails = {};
    }

    const spellingMetrics = result.categoryDetails.spelling;
    if (spellingMetrics) {
      spellingMetrics.score = combinedAccuracy;
      spellingMetrics.totalErrors = combinedErrors;
      // update token counts if missing: approximate using statistics.wordCount and function word set
      if (!spellingMetrics.contentTokenCount && !spellingMetrics.functionTokenCount) {
        const words = (result.statistics?.wordCount && result.statistics?.wordCount > 0) ? (result.statistics?.wordCount) : 0;
        // best-effort: split message into tokens and count function vs content
        try {
          const tokens = (result as any)._messageForAnalysis ? (result as any)._messageForAnalysis.split(/\s+/) : [];
          let content = 0;
          let func = 0;
          tokens.forEach((tk: string) => {
            if (!tk) return;
            const w = tk.replace(/[^a-zA-Z']/g, '').toLowerCase();
            if (FUNCTION_WORDS.has(w)) func++; else content++;
          });
          spellingMetrics.contentTokenCount = content;
          spellingMetrics.functionTokenCount = func;
        } catch (e) {
          // fallback
          spellingMetrics.contentTokenCount = Math.max(0, (result.statistics?.wordCount || 0) - 0);
          spellingMetrics.functionTokenCount = 0;
        }
      }
      const tokenTotal = spellingMetrics.contentTokenCount + spellingMetrics.functionTokenCount || totalTokens;
      spellingMetrics.normalizedDensity = Number(((combinedErrors / tokenTotal) * 100).toFixed(2));
    } else {
      result.categoryDetails.spelling = {
        score: combinedAccuracy,
        normalizedDensity,
        densityPerTokenType: {
          content: 0,
          function: 0,
        },
        totalErrors: combinedErrors,
        contentTokenCount: Math.max(0, result.statistics?.wordCount || 0),
        functionTokenCount: 0,
      };
    }

    if (typeof combinedErrors === 'number') {
      result.statistics.errorCount = Math.max(result.statistics.errorCount, combinedErrors);
      if (result.statistics.errorsByCategory) {
        result.statistics.errorsByCategory.spelling = Math.max(
          result.statistics.errorsByCategory.spelling ?? 0,
          combinedErrors,
        );
      }
    }

    (result.nlpContributions as any).spelling = {
      ...(spellingContribution as any),
      appliedToScore: true,
      accuracy: combinedAccuracy,
      combinedErrors,
      mergedDetails: mergedList,
    } as any;

    return true;
  }

  private async applyLanguageToolContributionFromNLP(result: UnifiedAccuracyResult): Promise<boolean> {
    const lt = result.nlpContributions?.languageTool;
    if (!lt || typeof lt.errors !== 'number') {
      return false;
    }

    let ltErrors = Math.max(0, Math.floor(Number(lt.errors) || 0));
    const ltDetails: ErrorDetail[] = (lt as any)?.details || [];

    // If token-level language detection indicates significant Hinglish content,
    // downweight LanguageTool contributions to avoid counting Hindi/Romanized tokens as grammar errors.
    try {
      const tokenLang = (result.nlpContributions as any)?.tokenLanguage;
      const hiRatio = tokenLang?.msgLangProportions?.hi ?? 0;
      const enRatio = tokenLang?.msgLangProportions?.en ?? 1;
      if (hiRatio > 0.15 && enRatio < 0.95) {
        // reduce LT's reported errors proportional to the hiRatio (aggressive downweighting)
        const reductionFactor = Math.max(0.2, 1 - hiRatio * 0.9);
        ltErrors = Math.floor(ltErrors * reductionFactor);
      }
    } catch (e) {
      // ignore detection problems
    }

    // Ensure statistics reflect LanguageTool as an authoritative detector when available
    result.statistics.errorCount = Math.max(result.statistics.errorCount ?? 0, ltErrors);
    if (!result.statistics.errorsByCategory) {
      result.statistics.errorsByCategory = {} as Record<string, number>;
    }
    result.statistics.errorsByCategory.grammar = Math.max(result.statistics.errorsByCategory.grammar ?? 0, ltErrors);

    // Build severity distribution from LT details (if available)
    const severityDistribution: Record<ErrorSeverity, number> = {
      critical: 0,
      major: 0,
      high: 0,
      medium: 0,
      low: 0,
      suggestion: 0,
    };
    ltDetails.forEach((d) => {
      const sev = (d.severity || 'medium') as ErrorSeverity;
      severityDistribution[sev] = (severityDistribution[sev] || 0) + 1;
    });

    // Attach applied flag to contributions
    (result.nlpContributions as NonNullable<typeof result.nlpContributions>).languageTool = {
      ...(result.nlpContributions as any).languageTool,
      appliedToStatistics: true,
      errors: ltErrors,
    };

    // If categoryDetails.grammar exists, nudge the totalErrors there as well
    if (result.categoryDetails?.grammar) {
      result.categoryDetails.grammar.totalErrors = Math.max(result.categoryDetails.grammar.totalErrors ?? 0, ltErrors);
    }

    // --- LanguageTool strict-zero override (configurable) ---
      const ltZeroStrict = process.env.GRAMMAR_LT_STRICT === 'true';
      if (ltErrors === 0 && ltZeroStrict) {
        // If LT reports zero errors and strict mode is enabled, ensure no
        // other detectors (spelling, AI corrections) indicate problems before
        // setting grammar to perfect.
        const aiGrammarCorrections = (result.aiResponseAnalysis?.hasGrammarCorrection ? 1 : 0) + (result.aiResponseAnalysis?.correctedErrors?.length ?? 0);
        const spellingIssuesCount = Number((result.nlpContributions as any)?.spelling?.errorsFound ?? result.categoryDetails?.spelling?.totalErrors ?? 0);
        const otherSignals = aiGrammarCorrections + spellingIssuesCount;
        if (otherSignals === 0) {
          // Honour LanguageTool: perfect grammar
          result.grammar = 100;
          if (!result.categoryDetails) result.categoryDetails = {} as CategoryMetricMap;
          result.categoryDetails.grammar = {
            score: 100,
            weightedPenalty: 0,
            normalizedImpact: 0,
            severityDistribution: { critical: 0, major: 0, high: 0, medium: 0, low: 0, suggestion: 0 },
            dominantPatterns: [],
            totalErrors: 0,
          } as GrammarCategoryMetrics;
          (result.nlpContributions as any).languageTool = {
            ...((result.nlpContributions as any).languageTool || {}),
            appliedToStatistics: true,
            appliedToScore: true,
            errors: 0,
          };
          return true;
        }
      }

    // --- Apply a severity-weighted grammar score adjustment based on LanguageTool details ---
    try {
      const existingGrammarScore = typeof result.grammar === 'number' ? result.grammar : 100;
      const minimumFloor = (result.languageContext?.shouldRelaxGrammar) ? 55 : 60;

      // Severity weights (points) - fallback if a rule-specific weight isn't present
      const severityWeights: Record<ErrorSeverity, number> = {
        critical: 12,
        major: 9,
        high: 6,
        medium: 4,
        low: 2,
        suggestion: 1,
      };

      // Build a breakdown by rule id for diagnostics
      const ruleBreakdown: Record<string, { count: number; weight: number; computedWeight?: number }> = {};

      // Severity rank (relative, used to compute dynamic weights rather than fixed hard values)
      const severityRank: Record<ErrorSeverity, number> = {
        critical: 4,
        major: 3,
        high: 2,
        medium: 1,
        low: 0.6,
        suggestion: 0.25,
      };

      // Sum weighted points for LT-detected issues using a dynamic formula
      let totalWeightedPoints = 0;
      for (const d of ltDetails) {
        const sev = (d.severity || 'medium') as ErrorSeverity;
        const ruleIdRaw = (d.rule || '').toString();
        const ruleId = ruleIdRaw ? ruleIdRaw.toLowerCase() : '';

        // Base derived from severity rank (relative)
        const baseSeverity = severityRank[sev] || 1;

        // Use reported confidence when available (0..1). Clamp to reasonable band.
        const confidence = typeof (d as any).confidence === 'number' ? Math.max(0.5, Math.min(1, (d as any).confidence)) : 1;

        // Historical occurrence factor: if Redis is available, use rule frequency to slightly increase weight
        let occurrenceFactor = 1;
        try {
          if (typeof redisCache !== 'undefined' && redisCache && (redisCache as any).isConnected && (redisCache as any).isConnected()) {
            const client = (redisCache as any).getClient();
            const key = `lt:rule:count:${ruleId || 'unknown'}`;
            // Increment usage counter (non-blocking) and get current count
            try {
              await client.incr(key);
              const countRaw = await client.get(key);
              const count = Number(countRaw || 0);
              // modest boost based on log count
              occurrenceFactor = 1 + Math.log1p(Math.max(0, count)) * 0.08;
            } catch (err) {
              // ignore redis errors and keep occurrenceFactor=1
            }
          }
        } catch (err) {
          // ignore
        }

        // Message-length scaling: longer messages tolerate more small issues, scale weight by log words
        const wordCount = Math.max(1, result.statistics?.wordCount || 1);
        const lengthFactor = 1 + Math.log1p(wordCount) / 6; // gentle scaling

        // Compute dynamic weight
        const computedWeight = baseSeverity * (0.9 + confidence * 0.6) * occurrenceFactor * lengthFactor;
        totalWeightedPoints += computedWeight;

        // Track breakdown
        const key = ruleId || (d.message || d.suggestion || 'unknown').slice(0, 40);
        if (!ruleBreakdown[key]) {
          ruleBreakdown[key] = { count: 0, weight: 0, computedWeight: 0 };
        }
        ruleBreakdown[key].count += 1;
        ruleBreakdown[key].weight += computedWeight;
        ruleBreakdown[key].computedWeight = (ruleBreakdown[key].computedWeight || 0) + computedWeight;
      }

      // Normalize totalWeightedPoints into a deduction (cap at 85) and soften for short messages
      let deduction = Math.min(85, Math.round(totalWeightedPoints));
      // For very short messages, be conservative: reduce deduction proportionally
      const wordCount = result.statistics?.wordCount || 1;
      if (wordCount < 6) {
        deduction = Math.round(deduction * (wordCount / 6));
      }

      const hardPenaltyCap = Math.max(100 - deduction, minimumFloor);
      const adjustedGrammarScore = Math.max(0, Math.min(existingGrammarScore, hardPenaltyCap));

      // Build dominantPatterns from breakdown (top 5 by weight)
      const dominantPatterns = Object.keys(ruleBreakdown)
        .map(k => ({ rule: k, ...ruleBreakdown[k] }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map(r => `${r.rule}(${r.count})`);

      // Update result.grammar and categoryDetails if present
      result.grammar = adjustedGrammarScore;
      if (!result.categoryDetails) {
        result.categoryDetails = {};
      }
      if (!result.categoryDetails.grammar) {
        result.categoryDetails.grammar = {
          score: adjustedGrammarScore,
          weightedPenalty: Math.min(100, deduction),
          normalizedImpact: Math.min(1, deduction / 100),
          severityDistribution,
          dominantPatterns,
          totalErrors: ltErrors,
        } as GrammarCategoryMetrics;
      } else {
        result.categoryDetails.grammar.score = adjustedGrammarScore;
        result.categoryDetails.grammar.weightedPenalty = Math.min(100, deduction);
        result.categoryDetails.grammar.normalizedImpact = Math.min(1, deduction / 100);
        result.categoryDetails.grammar.severityDistribution = severityDistribution;
        result.categoryDetails.grammar.dominantPatterns = dominantPatterns;
        result.categoryDetails.grammar.totalErrors = Math.max(result.categoryDetails.grammar.totalErrors ?? 0, ltErrors);
      }

      // Attach appliedToScore flag and include details
      (result.nlpContributions as NonNullable<typeof result.nlpContributions>).languageTool = {
        ...(result.nlpContributions as any).languageTool,
        appliedToStatistics: true,
        appliedToScore: true,
        errors: ltErrors,
        severityDistribution,
        weightedPenalty: Math.min(100, deduction),
        // expose diagnostics under `diagnostics` to avoid clobbering LT `details` array
        diagnostics: {
          totalWeightedPoints,
          ruleBreakdown,
          dominantPatterns,
        } as any,
      };

      if (ltErrors > 0) {
        const feed = `${ltErrors} LanguageTool issues detected (severity+rule-weighted deduction ${Math.round(deduction)}); grammar score adjusted.`;
        result.feedback = result.feedback || [];
        result.feedback.unshift(feed);
      }
    } catch (e) {
      debugConsoleWarn('⚠️ Failed to apply LanguageTool score adjustment:', e);
    }

    return true;
  }
  
  /**
   * Fetch user data from cache first, then database (tier and proficiency level)
   */
  private async fetchUserData(userId: string): Promise<{ tier: UserTier; proficiencyLevel: UserProficiencyLevel } | null> {
    try {
      // Step 1: Try to get from cache first
      if (this.redisCache) {
        try {
          const cacheKey = `user:data:${userId}`;
          const cachedUserData = await this.redisCache.get<{ tier: UserTier; proficiencyLevel: UserProficiencyLevel }>(cacheKey);
          
          if (cachedUserData) {
            debugConsoleLog(`✅ User data from cache: ${JSON.stringify(cachedUserData)}`);
            return cachedUserData;
          }
        } catch (cacheError) {
          debugConsoleWarn('⚠️ Cache read failed, falling back to database:', cacheError);
        }
      }
      
      // Step 2: Fetch from database if not in cache
  debugConsoleLog(`🔍 Fetching user data from database for userId: ${userId}`);
      
      // Validate userId format
      if (!userId || typeof userId !== 'string' || userId.length < 10) {
  debugConsoleWarn(`⚠️ Invalid userId format: ${userId}`);
        return null;
      }
      
      const [user, progress] = await Promise.all([
        // Fetch subscription metadata so we can compute the active tier
        User.findById(userId)
          .select('tier email subscriptionStatus subscriptionEndDate')
          .lean()
          .exec(),
        Progress.findOne({ userId }).select('proficiencyLevel').lean().exec()
      ]);

      if (!user) {
        debugConsoleWarn(`⚠️ User not found in database: ${userId}`);
        return null;
      }

      // Compute active tier taking subscription status and end date into account
      let tier: UserTier = (user.tier as UserTier) || 'free';
      try {
        const subscriptionStatus = (user.subscriptionStatus as string) || 'expired';
        const subscriptionEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;

        if (subscriptionStatus === 'active' && subscriptionEndDate) {
          if (new Date() > subscriptionEndDate) {
            tier = 'free';
          } else {
            // keep the stored tier when subscription is active and not expired
            tier = (user.tier as UserTier) || 'free';
          }
        } else if (subscriptionStatus === 'active' && !subscriptionEndDate) {
          // Active with no end date (lifetime) — respect stored tier
          tier = (user.tier as UserTier) || 'free';
        } else {
          // expired or cancelled
          tier = 'free';
        }
      } catch (tierErr) {
        debugConsoleWarn('⚠️ Failed to compute active tier, falling back to stored tier:', tierErr);
        tier = (user.tier as UserTier) || 'free';
      }
      
      // Normalize proficiency level to match UserProficiencyLevel type
      const rawLevel = progress?.proficiencyLevel || 'Intermediate';
      const proficiencyLevel: UserProficiencyLevel = typeof rawLevel === 'string'
        ? (rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1).toLowerCase()) as UserProficiencyLevel
        : 'Intermediate';
      
      const userData = { tier, proficiencyLevel };
      
      // Step 3: Cache the result for future use (5 minutes TTL)
      if (this.redisCache) {
        try {
          const cacheKey = `user:data:${userId}`;
          await this.redisCache.set(cacheKey, userData, 300); // 5 minutes TTL
          debugConsoleLog(`💾 Cached user data for userId: ${userId}`);
        } catch (cacheError) {
          debugConsoleWarn('⚠️ Cache write failed:', cacheError);
        }
      }
      
      debugConsoleLog(`✅ Fetched user data from database: Tier=${tier}, Level=${proficiencyLevel}, Email=${user.email}`);
      return userData;
    } catch (error) {
      console.error('❌ Error fetching user data:', error);
      return null;
    }
  }
  
  /**
   * Main entry point for unified accuracy analysis
   */
  async analyzeMessage(
    message: string,
    aiResponse: string = '',
    options: AccuracyAnalysisOptions = {}
  ): Promise<UnifiedAccuracyResult> {
    const startTime = Date.now();
    
    let {
      tier = 'free',
      proficiencyLevel,
      userId,
      previousAccuracy,
      enableNLP = this.NLP_ENABLED,
      enableWeightedCalculation = !!userId,
      redisClient,
      historicalWeighting,
      languageContext,
    } = options;

    const skipEnglishChecks = languageContext?.shouldSkipEnglishChecks ?? false;
    if (skipEnglishChecks) {
      enableNLP = false;
    }
    
    // 🔥 FETCH USER DATA FROM DATABASE IF userId IS PROVIDED
    if (userId) {
      const userData = await this.fetchUserData(userId);
      if (userData) {
        tier = userData.tier;
        proficiencyLevel = userData.proficiencyLevel;
      }
    }
    
    const features = TIER_FEATURES[tier];
    const level = proficiencyLevel || this.determineProficiencyLevel(message);
    
    debugConsoleLog(`🎯 Unified Accuracy Analysis: ${message.substring(0, 50)}...`);
    if (languageContext) {
      debugConsoleLog(
        `🌐 Language detection → ${languageContext.primaryLanguageName} (${(languageContext.probability * 100).toFixed(1)}%), englishRatio=${languageContext.englishRatio}`
      );
    }
    debugConsoleLog(`👤 Tier: ${tier.toUpperCase()}, Level: ${level}, NLP: ${enableNLP}`);
    
    try {
      // Step 1: Basic analysis (core grammar, spelling, etc.) — operate on the full message
      // IMPORTANT: Do NOT pass previousAccuracy or historicalWeighting into the basic analysis stage.
      // Historical data must never be loaded into or influence the initial analyzer scoring.
      // It will be merged only after the pure current analysis is computed.
      const basicResult = await this.performBasicAnalysis(
        message,
        aiResponse,
        tier,
        level,
        userId,
        enableWeightedCalculation,
        undefined, // previousAccuracy intentionally omitted here
        undefined, // historicalWeighting intentionally omitted here
        languageContext,
        enableNLP,
      );
      debugConsoleLog('📌 [UnifiedAccuracy] Basic analysis metrics', this.summarizeAccuracy(basicResult));
      debugConsoleLog('📌 [UnifiedAccuracy] Basic analysis stats', {
        wordCount: basicResult.statistics?.wordCount,
        sentenceCount: basicResult.statistics?.sentenceCount,
        errors: basicResult.statistics?.errorCount,
        criticalErrors: basicResult.statistics?.criticalErrorCount,
      });
      
      // Step 2: NLP enhancements (if enabled)
      let nlpContributions: any = undefined;
      if (enableNLP) {
        nlpContributions = await this.performNLPAnalysis(message, redisClient, languageContext, tier, level);
        basicResult.nlpContributions = nlpContributions;
          // Apply LanguageTool contribution counts into statistics to keep counts in sync
          if (this.applyLanguageToolContributionFromNLP) {
            try {
              await this.applyLanguageToolContributionFromNLP(basicResult);
            } catch (err) {
              debugConsoleWarn('Failed to apply LanguageTool contribution to basic result:', err);
            }
          }
          // Run fallback grammar checks AFTER LanguageTool contribution is applied
          try {
            const fallback = this.runFallbackGrammarChecks(message);
            // Merge fallback errors into result.errors (avoid duplicates by simple position check)
            if (fallback.errors.length > 0) {
              fallback.errors.forEach((fe) => {
                const exists = basicResult.errors.some((e) => e.position?.start === fe.position?.start && e.position?.end === fe.position?.end && e.message === fe.message);
                if (!exists) basicResult.errors.push(fe);
              });
            }

            const ltCount = Number((basicResult.nlpContributions as any)?.languageTool?.errors || 0);
            const fallbackCount = fallback.count || 0;

            // Debug logs requested by maintainer
            console.log('LT grammar errors:', ltCount);
            console.log('Fallback grammar errors:', fallbackCount);

            // AI-extractor: only treat explicit grammar corrections as candidates; derive conservative counts
            const aiDetectedTotal = Number(basicResult.aiResponseAnalysis?.detectedCorrections || 0);
            const aiGrammarCount = basicResult.aiResponseAnalysis?.hasGrammarCorrection ? (Number(basicResult.aiResponseAnalysis?.detectedCorrections || 1)) : 0;
            console.log('AI-extractor corrections (total):', aiDetectedTotal, 'explicit grammar corrections:', aiGrammarCount);

            // Prepare a variable visible to downstream scoring logic
            let totalGrammarErrors: number = 0;

            // Rule 1: If LanguageTool found any errors, use LT as authoritative (ignore AI rewrites)
            let rawGrammarScore: number;
            if (ltCount > 0) {
              totalGrammarErrors = ltCount + fallbackCount; // trust LT primarily
              if (totalGrammarErrors === 0) {
                rawGrammarScore = 100;
              } else if (totalGrammarErrors <= 3) {
                rawGrammarScore = Math.round(85 - (totalGrammarErrors - 1) * 7.5);
              } else if (totalGrammarErrors <= 5) {
                rawGrammarScore = totalGrammarErrors === 4 ? 65 : 60;
              } else {
                rawGrammarScore = Math.max(20, 50 - (totalGrammarErrors - 5) * 5);
              }
            } else {
              // Rule 2: LT reports zero errors — do NOT let AI rephrasing collapse the grammar score.
              // Use fallbackCount only (heuristic), but ensure a minimum floor of 80.
              totalGrammarErrors = fallbackCount; // ignore aiGrammarCount here
              if (totalGrammarErrors === 0) {
                rawGrammarScore = 100;
              } else if (totalGrammarErrors <= 3) {
                rawGrammarScore = Math.round(85 - (totalGrammarErrors - 1) * 7.5);
              } else if (totalGrammarErrors <= 5) {
                rawGrammarScore = totalGrammarErrors === 4 ? 65 : 60;
              } else {
                rawGrammarScore = Math.max(20, 50 - (totalGrammarErrors - 5) * 5);
              }

              // Enforce minimum floor for LT-perfect signals
              rawGrammarScore = Math.max(rawGrammarScore, 80);
              console.log('ℹ️ LT=0 → enforcing grammar floor >= 80');
            }

            console.log('Final grammar score before normalization:', rawGrammarScore);

            // Apply to result (respect existing clamping rules)
            const finalGrammarScore = Math.max(0, Math.min(100, rawGrammarScore));
            basicResult.grammar = finalGrammarScore;
            if (!basicResult.categoryDetails) basicResult.categoryDetails = {};
            if (!basicResult.categoryDetails.grammar) {
              basicResult.categoryDetails.grammar = {
                score: finalGrammarScore,
                weightedPenalty: Math.min(100, totalGrammarErrors * 8),
                normalizedImpact: Math.min(1, (totalGrammarErrors * 8) / 100),
                severityDistribution: { critical: 0, major: 0, high: 0, medium: 0, low: 0, suggestion: 0 },
                dominantPatterns: [],
                totalErrors: totalGrammarErrors,
              } as GrammarCategoryMetrics;
            } else {
              basicResult.categoryDetails.grammar.score = finalGrammarScore;
              basicResult.categoryDetails.grammar.totalErrors = Math.max(basicResult.categoryDetails.grammar.totalErrors ?? 0, totalGrammarErrors);
            }
            // Penalize fluency based on grammar issues: grammar errors should reduce fluency score.
            try {
              const fluencyPenaltyFromGrammar = Math.min(30, totalGrammarErrors * 6); // up to 30 points penalty
              basicResult.fluency = Math.max(0, (basicResult.fluency ?? 0) - fluencyPenaltyFromGrammar);
              basicResult.feedback.push(`Fluency adjusted for grammar issues (-${fluencyPenaltyFromGrammar} points)`);
            } catch (e) {
              debugConsoleWarn('Failed to apply grammar-based fluency penalty', e);
            }
          } catch (e) {
            debugConsoleWarn('⚠️ Fallback grammar merge failed:', e);
          }
            basicResult.nlpEnhanced = true;

        // Compose explicit statistics to avoid conflating fluency/vocab penalties with grammar errors
        try {
          const contrib: any = basicResult.nlpContributions || {};
          const grammarErrors = Number(contrib?.languageTool?.errors || 0);
          const spellingErrors = Number((contrib?.spelling?.errorsFound ?? (contrib?.spelling?.errors?.length ?? 0)) || 0);
          const vocabularyUnknown = Number(contrib?.vocabulary?.cefrDistribution?.unknown ?? 0);
          const fluencyScore = Number(contrib?.fluency?.score ?? basicResult.fluency ?? 100);
          const fluencyPenalties = Math.max(0, 100 - fluencyScore);

          basicResult.statistics = {
            // Keep message-level totals for internal metrics, but separate counts for user-facing trust
            grammarErrors,
            vocabularyPenalties: vocabularyUnknown,
            fluencyPenalties,
            spellingErrors,
          } as any;
          // Compute user-friendly totals with NaN protection
          try {
            let totalErrors = Number(grammarErrors || 0) + Number(spellingErrors || 0) + Number(vocabularyUnknown || 0) + Number(fluencyPenalties || 0);
            if (!Number.isFinite(totalErrors) || Number.isNaN(totalErrors)) totalErrors = 0;

            // critical errors from LanguageTool details (if available)
            const ltDetails: any[] = (basicResult.nlpContributions as any)?.languageTool?.details || [];
            const criticalErrors = ltDetails.filter((d: any) => d && (d.severity === 'critical' || d.severity === 'error')).length || 0;

            (basicResult.statistics as any).totalErrors = totalErrors;
            (basicResult.statistics as any).criticalErrors = criticalErrors;
          } catch (e) {
            debugConsoleWarn('Failed to compute total/critical statistics', e);
            (basicResult.statistics as any).totalErrors = 0;
            (basicResult.statistics as any).criticalErrors = 0;
          }
        } catch (statErr) {
          debugConsoleWarn('Failed to compute separated statistics', statErr);
        }

        this.logNLPContributions(basicResult.nlpContributions);

        // Apply vocabulary contribution if present (ensure unknown-token penalties are not ignored)
        try {
          const vocabContrib = (basicResult.nlpContributions as any)?.vocabulary;
          if (vocabContrib && typeof vocabContrib.score === 'number') {
            const bounded = Math.max(0, Math.min(100, Number(vocabContrib.score)));
            basicResult.vocabulary = Math.round(bounded);
            if (!basicResult.categoryDetails) basicResult.categoryDetails = {} as CategoryMetricMap;
            basicResult.categoryDetails.vocabulary = {
              score: basicResult.vocabulary,
              rangeScore: vocabContrib.rangeScore ?? basicResult.categoryDetails.vocabulary?.rangeScore ?? 0,
              repetitionPenalty: vocabContrib.repetitionPenalty ?? basicResult.categoryDetails.vocabulary?.repetitionPenalty ?? 0,
              diversity: Number((vocabContrib.lexicalDiversity ?? basicResult.categoryDetails.vocabulary?.diversity ?? 0)),
              repetitionRate: Number((vocabContrib.repetitionRate ?? basicResult.categoryDetails.vocabulary?.repetitionRate ?? 0)),
              academicUsage: Math.round(vocabContrib.academicWordUsage ?? 0),
              rareWordUsage: Math.round(vocabContrib.rareWordUsage ?? 0),
            } as VocabularyCategoryMetrics;
            (basicResult.nlpContributions as any).vocabulary = {
              ...(basicResult.nlpContributions as any).vocabulary,
              appliedToScore: true,
            };
            debugConsoleLog('🔁 Applied NLP vocabulary contribution to result.vocabulary', basicResult.vocabulary);
          }
        } catch (e) {
          debugConsoleWarn('⚠️ Failed to apply vocabulary contribution from NLP:', e);
        }

        if (await this.applySpellingContributionFromNLP(basicResult)) {
          basicResult.overall = this.calculateOverallScore(basicResult);
          basicResult.adjustedOverall = basicResult.overall;
        }
      } else if (languageContext?.analysisNotes?.length) {
        basicResult.nlpContributions = {
          ...(basicResult.nlpContributions ?? {}),
          languageBypass: {
            reason: languageContext.analysisNotes[0],
            detectedLanguage: languageContext.primaryLanguageName,
            englishRatio: languageContext.englishRatio,
          },
        };
        this.logNLPContributions(basicResult.nlpContributions);
      }
      
      const baselineSnapshot = this.captureAccuracySnapshot(basicResult);
      const alreadyWeighted = basicResult.performance?.strategy === 'enhanced-weighted';

      // Step 3: Apply enhanced weighted calculation (if enabled and not already applied)
      if (!alreadyWeighted && enableWeightedCalculation && userId) {
        try {
          debugConsoleLog('🧮 Applying enhanced weighted accuracy calculation (basic analysis)...');
          const enhancedResult = await enhancedWeightedAccuracyService.calculateEnhancedWeightedAccuracy(
            userId,
            {
              overall: basicResult.overall,
              grammar: basicResult.grammar,
              vocabulary: basicResult.vocabulary,
              spelling: basicResult.spelling,
              fluency: basicResult.fluency,
              punctuation: basicResult.punctuation,
              capitalization: basicResult.capitalization,
            },
            basicResult.statistics.errorCount
          );

          const { weighted, current } = enhancedResult;

          // Store both the canonical (current) and the weighted (historical-smoothed) snapshots
          // IMPORTANT: do NOT overwrite the authoritative current category scores with historical/weighted values.
          basicResult.currentAccuracy = current;
          basicResult.weightedAccuracy = weighted;

          // Keep current analyzer scores as the authoritative `basicResult` values.
          // Expose the weighted values separately so callers/UI can choose which to display.
          // Ensure adjustedOverall reflects the current analysis (not the historical-smoothed one)
          basicResult.adjustedOverall = current.overall ?? basicResult.adjustedOverall ?? basicResult.overall;

          basicResult.performance = {
            totalProcessingTime: basicResult.statistics.processingTime,
            cacheHit: enhancedResult.diagnostics?.fallback !== 'redis_offline',
            strategy: 'enhanced-weighted',
            weightsUsed: {
              historical: enhancedResult.weights.historical,
              current: enhancedResult.weights.current,
            },
          };

          if (historicalWeighting?.decayFactor !== undefined) {
            basicResult.performance.decayFactorApplied = Number(historicalWeighting.decayFactor.toFixed(2));
          }
          if (historicalWeighting?.categoryBaselines) {
            const baselineKeys = Object.keys(historicalWeighting.categoryBaselines)
              .filter((key): key is NumericAccuracyKey => NUMERIC_ACCURACY_KEYS.includes(key as NumericAccuracyKey));
            if (baselineKeys.length > 0) {
              basicResult.performance.baselinesApplied = baselineKeys;
            }
          }

          debugConsoleLog('✅ Enhanced weighted calculation applied successfully');
          debugConsoleLog(
            '🪄 [UnifiedAccuracy] Weighted snapshots',
            `${this.summarizeSnapshot('current', basicResult.currentAccuracy)} | ${this.summarizeSnapshot('weighted', basicResult.weightedAccuracy)}`
          );
          debugConsoleLog('🪄 [UnifiedAccuracy] Weight diagnostics', basicResult.performance);
        } catch (error) {
          debugConsoleWarn('⚠️ FALLBACK TRIGGERED: Enhanced weighted calculation failed in basic analysis path');
          debugConsoleWarn('  Reason:', error instanceof Error ? error.message : String(error));
          debugConsoleWarn('  User ID:', userId);
          debugConsoleWarn('  Fallback Strategy: Using unweighted basic accuracy results');
          debugConsoleWarn('  Impact: Historical context not applied, may show more variability');
        }
      }

      if (!basicResult.weightedAccuracy && previousAccuracy) {
        this.applyHistoricalSmoothingFallback(basicResult, tier, previousAccuracy, baselineSnapshot, historicalWeighting);
      } else if (!basicResult.currentAccuracy) {
        basicResult.currentAccuracy = this.cloneAccuracySnapshot(baselineSnapshot);
      }
      
      // Step 4: Finalize results
      basicResult.statistics.processingTime = Date.now() - startTime;

      if (!basicResult.languageContext && languageContext) {
        basicResult.languageContext = languageContext;
      }
      
      debugConsoleLog(`✅ Unified analysis complete: ${basicResult.overall}% overall, ${basicResult.statistics.processingTime}ms`);
      debugConsoleLog(
        '🎯 [UnifiedAccuracy] Final snapshots',
        `${this.summarizeSnapshot('current', basicResult.currentAccuracy)} | ${this.summarizeSnapshot('weighted', basicResult.weightedAccuracy)} | ${this.summarizeSnapshot('baseline', baselineSnapshot)}`
      );
      if (basicResult.categoryDetails) {
        const grammarScore = basicResult.categoryDetails.grammar?.score;
        const vocabularyScore = basicResult.categoryDetails.vocabulary?.score;
        const spellingScore = basicResult.categoryDetails.spelling?.score;
        debugConsoleLog('🧭 [UnifiedAccuracy] Category focus', {
          grammar: this.formatMetric(grammarScore ?? basicResult.grammar),
          vocabulary: this.formatMetric(vocabularyScore ?? basicResult.vocabulary),
          spelling: this.formatMetric(spellingScore ?? basicResult.spelling),
        });
      }
      debugConsoleLog(`ℹ️  XP calculation should be done separately via /api/xp/award endpoint`);
      
      return basicResult;
    } catch (error) {
      console.error('❌ Unified accuracy analysis failed:', error);
      throw error;
    }
  }

  /**
   * Perform basic accuracy analysis (grammar, spelling, etc.)
   */
  private async performBasicAnalysis(
    message: string,
    aiResponse: string,
    tier: UserTier,
    level: UserProficiencyLevel,
    userId?: string,
    enableWeightedCalculation?: boolean,
    previousAccuracy?: Partial<IAccuracyData>,
    historicalWeighting?: HistoricalWeightingConfig,
    languageContext?: LanguageDetectionSummary,
    enableNLP?: boolean,
  ): Promise<UnifiedAccuracyResult> {
    const features = TIER_FEATURES[tier];
    
    // Initialize result
    const result: UnifiedAccuracyResult = {
      overall: 100,
      adjustedOverall: 100,
      grammar: 100,
      vocabulary: 100,
      spelling: 100,
      fluency: 100,
      punctuation: 100,
      capitalization: 100,
      errors: [],
      feedback: [],
      suggestions: [],
      statistics: {
        wordCount: message.split(/\s+/).length,
        sentenceCount: message.split(/[.!?]+/).length - 1,
        paragraphCount: message.split(/\n\n+/).filter(p => p.trim().length > 0).length || 1,
        avgWordsPerSentence: 0,
        avgSyllablesPerWord: 0,
        complexWordCount: 0,
        uniqueWordRatio: 0,
        errorCount: 0,
        criticalErrorCount: 0,
        errorsByCategory: {},
        processingTime: 0,
      },
      aiResponseAnalysis: {
        hasCorrectionFeedback: false,
        hasGrammarCorrection: false,
        hasStyleSuggestion: false,
        correctedErrors: [],
        appreciationLevel: 'none',
        severityOfCorrections: 'none',
        engagementScore: 0,
      },
      nlpEnhanced: false,
      // XP calculation removed - use /api/xp/award endpoint instead
      tier: tier.toUpperCase(),
      analysisDepth: this.getAnalysisDepth(tier),
      insights: {
        level,
        confidence: 0.8,
        primaryCategory: 'grammar',
      },
      categoryDetails: {},
    };

    if (languageContext) {
      result.languageContext = languageContext;
    }
    
    // Grammar analysis
    if (features.basicGrammar) {
  const grammarResult = await this.analyzeGrammar(message, tier, level, languageContext, !!enableNLP);
      result.grammar = grammarResult.score;
      result.errors.push(...grammarResult.errors);
      result.feedback.push(...grammarResult.feedback);
      if (!result.categoryDetails) {
        result.categoryDetails = {};
      }
      result.categoryDetails.grammar = {
        ...grammarResult.metrics,
      };
    }
    
    // Spelling analysis
    if (features.basicSpelling) {
  const spellingResult = this.analyzeSpelling(message, tier);
      result.spelling = spellingResult.score;
      result.errors.push(...spellingResult.errors);
      result.feedback.push(...spellingResult.feedback);
      if (!result.categoryDetails) {
        result.categoryDetails = {};
      }
      result.categoryDetails.spelling = {
        ...spellingResult.metrics,
      };
    }
    
    // Vocabulary analysis
    if (features.basicVocabulary) {
  const vocabResult = this.analyzeVocabulary(message, tier, level);
      result.vocabulary = vocabResult.score;
      result.errors.push(...vocabResult.errors);
      result.feedback.push(...vocabResult.feedback);
      if (!result.categoryDetails) {
        result.categoryDetails = {};
      }
      result.categoryDetails.vocabulary = {
        ...vocabResult.metrics,
      };
      
      // Add advanced vocabulary analysis for pro/premium
      if (vocabResult.vocabularyAnalysis) {
        result.vocabularyAnalysis = vocabResult.vocabularyAnalysis;
      }
    }
    
    // Fluency analysis
    if (features.basicFluency) {
      const fluencyResult = this.analyzeFluency(message, tier, level);
      result.fluency = fluencyResult.score;
      result.errors.push(...fluencyResult.errors);
      result.feedback.push(...fluencyResult.feedback);
      if (!result.categoryDetails) {
        result.categoryDetails = {};
      }
      result.categoryDetails.pronunciation = {
        ...fluencyResult.pronunciationMetrics,
      };
    }
    
    // Punctuation analysis
    const punctuationResult = this.analyzePunctuation(message);
    result.punctuation = punctuationResult.score;
    result.errors.push(...punctuationResult.errors);

    // If message is strongly Hinglish, enforce neutral/high punctuation/capitalization
    try {
      const hiRatio = ((result.nlpContributions as any)?.tokenLanguage?.msgLangProportions?.hi) ?? (result.languageContext?.hindiRatio ?? 0);
      if (hiRatio > 0.9) {
        result.punctuation = 100;
        // Remove punctuation errors added earlier
        result.errors = result.errors.filter((e: any) => e.type !== 'punctuation');
      }
    } catch (e) {
      // ignore
    }
    
    // Capitalization analysis
    const capitalizationResult = this.analyzeCapitalization(message);
    result.capitalization = capitalizationResult.score;
    result.errors.push(...capitalizationResult.errors);

    try {
      const hiRatio = ((result.nlpContributions as any)?.tokenLanguage?.msgLangProportions?.hi) ?? (result.languageContext?.hindiRatio ?? 0);
      if (hiRatio > 0.9) {
        result.capitalization = 100;
        result.errors = result.errors.filter((e: any) => e.type !== 'capitalization');
      }
    } catch (e) {
      // ignore
    }
    
    // ===== ADVANCED FEATURES FOR PRO/PREMIUM TIERS =====
    
    // Tone analysis (Pro+)
    if (features.toneAnalysis) {
      result.tone = this.analyzeTone(message);
    }
    
    // Readability metrics (Pro+)
    if (features.readabilityMetrics) {
      result.readability = this.calculateReadability(message, result.statistics);
    }
    
    // Style analysis (Pro+)
    if (features.styleAnalysis) {
      result.styleAnalysis = this.analyzeStyle(message);
    }
    
    // Coherence analysis (Premium only)
    if (features.coherenceAnalysis) {
      result.coherenceAnalysis = this.analyzeCoherence(message);
      if (result.coherenceAnalysis) {
        result.coherence = result.coherenceAnalysis.score;
      }
    }
    
    // Premium insights (Premium only) OR Pro features
    if (features.premiumInsights || features.professionalTips) {
      result.premiumInsights = this.analyzePremiumFeatures(message, tier, result.errors);
    }
    
    // Enhanced statistics for all tiers
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = message.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = message.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    result.statistics = {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      avgWordsPerSentence: words.length / Math.max(sentences.length, 1),
      avgSyllablesPerWord: words.reduce((sum, word) => sum + this.countSyllables(word), 0) / Math.max(words.length, 1),
      complexWordCount: words.filter(w => this.countSyllables(w) >= 3).length,
      uniqueWordRatio: new Set(words.map(w => w.toLowerCase())).size / Math.max(words.length, 1),
      errorCount: result.errors.length,
      criticalErrorCount: result.errors.filter(e => e.severity === 'critical').length,
      errorsByCategory: this.categorizeErrors(result.errors),
      processingTime: 0,
    };
    
    // ===== EXTRACT ERRORS FROM AI RESPONSE (PRIMARY SOURCE OF TRUTH) =====
    // Use improved error extraction to avoid overcounting
    if (aiResponse && aiResponse.length > 0) {
      extractErrorsFromAIResponse(message, aiResponse, result, features);
    }
    
    // AI Response Analysis (from enhanced calculator)
    result.aiResponseAnalysis = this.analyzeAIResponse(message, aiResponse, result.errors, features);
    
    // Calculate overall score
    result.overall = this.calculateOverallScore(result);
    result.adjustedOverall = result.overall;

    const currentSnapshot = this.captureAccuracySnapshot(result);
    if (!result.currentAccuracy) {
      result.currentAccuracy = this.cloneAccuracySnapshot(currentSnapshot);
    }
    
    // Apply enhanced weighted accuracy if userId is provided
    if (userId && enableWeightedCalculation) {
      try {
  debugConsoleLog('🧮 Applying enhanced weighted accuracy calculation...');
        const enhancedResult = await enhancedWeightedAccuracyService.calculateEnhancedWeightedAccuracy(
          userId,
          {
            overall: result.overall,
            grammar: result.grammar,
            vocabulary: result.vocabulary,
            spelling: result.spelling,
            fluency: result.fluency,
            punctuation: result.punctuation,
            capitalization: result.capitalization,
          },
          result.statistics.errorCount
        );
        
        const { weighted, current } = enhancedResult;

          // Store the canonical current snapshot and the historical-weighted snapshot
          // Do NOT overwrite the authoritative numeric fields produced by the analyzers.
          result.currentAccuracy = current;
          result.weightedAccuracy = weighted;
          result.adjustedOverall = current.overall ?? result.adjustedOverall ?? result.overall;

          debugConsoleLog('✅ Enhanced weighted calculation produced separate snapshots (no overwrite)');
          debugConsoleLog(
            '🪄 [UnifiedAccuracy] Weighted snapshots',
            `${this.summarizeSnapshot('current', result.currentAccuracy)} | ${this.summarizeSnapshot('weighted', result.weightedAccuracy)}`
          );

          result.performance = {
            totalProcessingTime: result.statistics.processingTime,
            cacheHit: enhancedResult.diagnostics?.fallback !== 'redis_offline',
            strategy: 'enhanced-weighted',
            weightsUsed: {
              historical: enhancedResult.weights.historical,
              current: enhancedResult.weights.current,
            },
          };
      } catch (error) {
  debugConsoleWarn('⚠️ FALLBACK TRIGGERED: Enhanced weighted accuracy calculation failed in NLP path');
  debugConsoleWarn('  Reason:', error instanceof Error ? error.message : String(error));
  debugConsoleWarn('  User ID:', userId);
  debugConsoleWarn('  Fallback Strategy: Using current message accuracy without historical weighting');
  debugConsoleWarn('  Impact: Results may show more variability, historical smoothing not applied');
      }
    }

    if (!result.weightedAccuracy && previousAccuracy) {
      this.applyHistoricalSmoothingFallback(result, tier, previousAccuracy, currentSnapshot, historicalWeighting);
    } else if (!result.weightedAccuracy) {
      result.weightedAccuracy = this.cloneAccuracySnapshot(currentSnapshot);
    }

    this.attachCategoryTrends(result, previousAccuracy);
    
    return result;
  }

  /**
   * Perform NLP analysis using FREE services (LanguageTool, Typo.js, CEFR, OpenRouter)
   */
  private async performNLPAnalysis(
    message: string,
    redisClient?: any,
    languageContext?: LanguageDetectionSummary,
    tier: UserTier = 'free',
    level?: UserProficiencyLevel,
  ): Promise<any> {
    if (languageContext?.shouldSkipEnglishChecks) {
  debugConsoleLog('🔕 Skipping NLP analysis for non-English message.');
      return {
        languageBypass: {
          reason: languageContext.analysisNotes?.[0] ?? 'Detected primarily non-English content; English detectors skipped.',
          detectedLanguage: languageContext.primaryLanguageName,
          englishRatio: languageContext.englishRatio,
        },
      };
    }

    const contributions: any = {};
    const startTime = Date.now();
    const analysisMessage = message;

  debugConsoleLog('🔍 Starting NLP Analysis...');

    // Note: token-level detection removed; rely on `languageContext` (from detectLanguage) to decide skipping/relaxing checks.

    // 1. LanguageTool Grammar Detection (if enabled)
    if (LANGUAGETOOL_ENABLED && this.languageToolDetector) {
      try {
  debugConsoleLog('  📝 Running LanguageTool grammar check...');
        const ltStart = Date.now();
        
        // Check cache first
        let languageToolResult: LanguageToolResult | undefined;
        if (this.redisCache && NLP_CACHE_ENABLED) {
          const cached = await this.redisCache.get(`lt:${analysisMessage}`);
          if (cached) {
            languageToolResult = cached as LanguageToolResult;
            debugConsoleLog('  ✅ LanguageTool: Cache HIT');
          }
        }
        
        // Skip LanguageTool if languageContext indicates primarily non-English content
        const skipLanguageTool = !!(languageContext?.shouldSkipEnglishChecks || (languageContext?.hindiRatio ?? 0) > 0.4);
        if (skipLanguageTool) {
          debugConsoleLog('  🔕 Skipping LanguageTool due to non-English detection');
          contributions.languageTool = {
            errors: 0,
            confidence: 100,
            source: 'skipped-non-english',
            details: [],
            processingTime: 0,
          };
        } else if (!languageToolResult) {
          const detected = await this.languageToolDetector.detect(analysisMessage, { userTier: 'free', userLevel: 'Intermediate' });
          languageToolResult = {
            errors: detected.length,
            confidence: detected.length > 0 ? 85 : 95,
            source: 'languagetool',
            details: detected.slice(0, 10), // Limit to first 10 errors
          };
          
          // Cache result
          if (this.redisCache && NLP_CACHE_ENABLED) {
            await this.redisCache.set(`lt:${analysisMessage}`, languageToolResult, 3600); // 1 hour TTL
          }
        }
        
        contributions.languageTool = {
          ...languageToolResult,
          processingTime: Date.now() - ltStart
        };

        // Mixed-language heuristics removed — non-English deduction is applied at the end of NLP analysis
        
  debugConsoleLog(`  ✅ LanguageTool: ${languageToolResult?.errors || 0} errors found (${Date.now() - ltStart}ms)`);
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException | undefined;
        if (nodeError?.code === 'ECONNREFUSED') {
          nlpLogger.warn('Grammar API offline — using fallback heuristics');
        } else {
          nlpLogger.warn({ error }, 'LanguageTool analysis failed, using fallback heuristics');
        }
        contributions.languageTool = {
          errors: 0,
          confidence: 60,
          normalizedConfidence: 0.6,
          source: 'fallback-heuristics',
          status: nodeError?.code === 'ECONNREFUSED' ? 'offline' : 'error',
        };
  debugConsoleWarn('  ⚠️ LanguageTool analysis failed:', error);
      }
    }
    
    // 2. Spelling analysis with Typo.js (always free)
    try {
  debugConsoleLog('  🔤 Running Typo.js spelling check...');
      const spellStart = Date.now();
      
  await (spellingChecker as any).initialize();
  // If languageContext indicates primarily non-English, skip Typo.js to avoid false positives
      if (languageContext?.shouldSkipEnglishChecks || (languageContext?.hindiRatio ?? 0) > 0.4) {
    debugConsoleLog('  🔤 Skipping Typo.js spelling check due to non-English detection');
    // Do NOT set accuracy=100 for skipped/unavailable detectors — use null to indicate absence
    contributions.spelling = {
      accuracy: null,
      errorsFound: null,
      confidence: null,
      source: 'skipped-non-english',
      processingTime: 0,
      details: [],
    };
  } else {
    const normalizedForSpelling = normalizeDialectVariants(analysisMessage);
    const spellingReport = await (spellingChecker as any).getReport(normalizedForSpelling);
    contributions.spelling = {
      accuracy: (spellingReport && typeof spellingReport.accuracy === 'number') ? spellingReport.accuracy : null,
      errorsFound: spellingReport.errorsFound ?? null,
      confidence: typeof spellingReport.accuracy === 'number' ? spellingReport.accuracy : null,
      source: 'typo-js',
      processingTime: Date.now() - spellStart,
      // include detailed miss list when available for merging with LT
      details: spellingReport.details || spellingReport.misses || [],
    };
  }
      
  debugConsoleLog(`  ✅ Typo.js: ${(contributions.spelling?.accuracy ?? 'n/a')}% accuracy (${Date.now() - spellStart}ms)`);
    } catch (error) {
  debugConsoleWarn('  ⚠️ Spelling analysis failed:', error);
    }
    
    // 3. Vocabulary analysis with CEFR (always free)
    try {
  debugConsoleLog('  📚 Running CEFR vocabulary analysis...');
      const vocabStart = Date.now();
      
  // Vocabulary analysis: run on the message. Non-English deduction applied later if needed.
  const vocabAnalysis = await vocabAnalyzer.analyze(analysisMessage);
      contributions.vocabulary = {
        level: vocabAnalysis.level,
        score: vocabAnalysis.score,
        uniqueWords: vocabAnalysis.uniqueWords,
        totalWords: vocabAnalysis.totalWords,
        lexicalDiversity: vocabAnalysis.lexicalDiversity,
        source: 'cefr-wordlists',
        processingTime: Date.now() - vocabStart
      };
      
  debugConsoleLog(`  ✅ CEFR: Level ${vocabAnalysis.level}, Score ${vocabAnalysis.score} (${Date.now() - vocabStart}ms)`);
    } catch (error) {
  debugConsoleWarn('  ⚠️ Vocabulary analysis failed:', error);
    }
    
    // 4. Fluency analysis (Rule-based OR OpenRouter)
    try {
      // Premium users: prefer OpenRouter LLM -> local transformer fallback -> rule-based
      if (tier === 'premium' && OPENROUTER_ENABLED && this.openRouterFluencyDetector) {
        debugConsoleLog('  🤖 Running OpenRouter fluency analysis (Mistral 7B) for premium user...');
        const fluencyStart = Date.now();

        // Check cache first
        let fluencyResult: FluencyAnalysisResult | null = null;
        if (this.redisCache && NLP_CACHE_ENABLED) {
          const cached = await this.redisCache.get<FluencyAnalysisResult>(`fluency:${message}`);
          if (cached) {
            fluencyResult = cached;
            debugConsoleLog('  ✅ OpenRouter: Cache HIT');
          }
        }

        if (!fluencyResult) {
          const detected = await this.openRouterFluencyDetector.analyzeFluency(message);
          fluencyResult = {
            score: detected.score || 75,
            method: 'openrouter-mistral',
            confidence: detected.confidence || 75,
            source: 'openrouter-mistral-7b',
            details: detected.reasoning || 'Fluency analysis complete',
          };

          // Cache result
          if (this.redisCache && NLP_CACHE_ENABLED) {
            await this.redisCache.set(`fluency:${message}`, fluencyResult, 3600);
          }
        }

        contributions.fluency = {
          ...fluencyResult,
          processingTime: Date.now() - fluencyStart,
        };

        if (NLP_DEBUG_LOGS_ENABLED) {
          nlpLogger.debug({ score: contributions.fluency.score, durationMs: contributions.fluency.processingTime }, 'OpenRouter fluency score computed');
        }
      } else if (tier === 'premium' && LOCAL_TRANSFORMER_ENABLED) {
        // Premium + local transformer: try transformer
        if (NLP_DEBUG_LOGS_ENABLED) {
          nlpLogger.debug({ transformerEnabled: true }, 'Running local transformer fluency analysis for premium user');
        }
        const tStart = Date.now();
        try {
          const fluencyAnalysis = await fluencyScorer.analyzeWithTransformer(message);
          contributions.fluency = {
            score: fluencyAnalysis.score,
            method: fluencyAnalysis.method,
            confidence: fluencyAnalysis.score,
            source: fluencyAnalysis.method === 'ai-assisted' ? 'transformer-gpt2' : 'heuristics',
            processingTime: Date.now() - tStart,
          };

          if (NLP_DEBUG_LOGS_ENABLED) {
            nlpLogger.debug({ score: contributions.fluency.score, durationMs: contributions.fluency.processingTime }, 'Transformer fluency score computed');
          }
        } catch (err) {
          // Transformer failed — fall back to rule-based
          nlpLogger.warn({ err }, 'Transformer fluency failed; falling back to rule-based');
          const rStart = Date.now();
          const ruleResult = await fluencyScorer.analyzeRuleBased(message);
          contributions.fluency = {
            score: ruleResult.score,
            method: ruleResult.method,
            confidence: ruleResult.score,
            source: 'heuristics',
            processingTime: Date.now() - rStart,
          };
        }
      } else {
        // Non-premium tiers or transformer disabled: use rule-based fluency only
        if (NLP_DEBUG_LOGS_ENABLED) {
          nlpLogger.debug({ transformerEnabled: LOCAL_TRANSFORMER_ENABLED }, 'Running rule-based fluency analysis (non-premium or transformer disabled)');
        }
        const rStart = Date.now();
        const ruleResult = await fluencyScorer.analyzeRuleBased(message);
        contributions.fluency = {
          score: ruleResult.score,
          method: ruleResult.method,
          confidence: ruleResult.score,
          source: 'heuristics',
          processingTime: Date.now() - rStart,
        };
      }
    } catch (error) {
      if (NLP_DEBUG_LOGS_ENABLED) {
        nlpLogger.warn({ error }, 'Fluency analysis failed');
      }
    }
    
    const totalTime = Date.now() - startTime;
    if (NLP_DEBUG_LOGS_ENABLED) {
      nlpLogger.debug({ durationMs: totalTime }, 'NLP analysis complete');
    }
    // Apply a non-English deduction if languageContext indicates presence of other languages
    try {
      const englishRatio = languageContext?.englishRatio ?? 1;
      const nonEnglishRatio = Math.max(0, 1 - englishRatio);
      // small mapping: up to 20 points deduction proportional to non-English ratio
      const deductionPoints = Math.round(Math.min(0.5, nonEnglishRatio) * 40); // maps 0.5 -> 20
      if (deductionPoints > 0) {
        contributions.nonEnglishDeduction = {
          deductionPoints,
          nonEnglishRatio,
          note: 'Deduction applied because message contains non-English content'
        };
        // Apply to common categories if present
        ['grammar', 'vocabulary', 'spelling', 'fluency'].forEach((k) => {
          if (contributions[k] && typeof contributions[k].score === 'number') {
            contributions[k].score = Math.max(0, Math.min(100, contributions[k].score - deductionPoints));
          } else if (contributions[k] && typeof contributions[k].accuracy === 'number') {
            contributions[k].accuracy = Math.max(0, Math.min(100, contributions[k].accuracy - deductionPoints));
          } else if (contributions[k] && typeof contributions[k].score === 'undefined') {
            // best-effort: attach a score field if missing
            contributions[k] = { ...(contributions[k] || {}), score: Math.max(0, 100 - deductionPoints) };
          }
        });
      }
      // Expose language mode for callers
      const englishRatioFinal = languageContext?.englishRatio ?? 1;
        const languageMode = englishRatioFinal >= 0.9 ? 'PURE_ENGLISH' : englishRatioFinal < 0.25 ? 'NON_ENGLISH' : 'MIXED';
        contributions.languageMode = languageMode;
        // Explicit flag to indicate we should run full English checks when message is primarily English
        contributions.runFullEnglishChecks = languageMode === 'PURE_ENGLISH';
        console.log('Language mode:', languageMode, 'runFullEnglishChecks=', contributions.runFullEnglishChecks);
    } catch (e) {
      debugConsoleWarn('  ⚠️ Non-English deduction step failed:', e);
    }

    return contributions;
  }

  /**
   * Run fallback grammar pattern checks when LanguageTool is unavailable or to supplement LT.
   * Returns detected error objects and a simple count.
   */
  private runFallbackGrammarChecks(message: string): { errors: UnifiedErrorDetail[]; count: number } {
    const errors: UnifiedErrorDetail[] = [];
    const src = message || '';
    const lower = src.toLowerCase();

    const add = (msg: string, start: number, end: number, suggestion?: string, severity: ErrorSeverity = 'major', rule?: string) => {
      errors.push({
        type: 'grammar',
        category: 'fallback',
        severity,
        message: msg,
        position: { start, end, word: src.substring(start, end) },
        suggestion: suggestion || '',
        rule: rule || 'fallback-rule',
      });
    };

    // 1) Subject-verb mismatch using object pronouns
    const svPattern = /\b(me|him|her)\s+(am|is|are|was|were|have|has|do|does|go|goes|try|tries|want|wants)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = svPattern.exec(src)) !== null) {
      add('Object pronoun used as subject', m.index, m.index + m[0].length, `Use subject pronoun like 'I/he/she' instead of '${m[1]}'`, 'critical', 'fallback-subject-verb-mismatch');
    }

    // 2) 'very more' pattern
    const veryMore = /\bvery\s+more\b/gi;
    while ((m = veryMore.exec(lower)) !== null) {
      add('Incorrect comparative: "very more"', m.index, m.index + m[0].length, 'Use "much more" or remove "very"', 'medium', 'fallback-very-more');
    }

    // 3) 'many problem' pattern
    const manyProblem = /\bmany\s+problem(s)?\b/gi;
    while ((m = manyProblem.exec(lower)) !== null) {
      add('Incorrect collocation: "many problem"', m.index, m.index + m[0].length, 'Use "many problems" or "a big problem"', 'medium', 'fallback-many-problem');
    }

    // 4) Run-on detection: long sentence without punctuation
    const lines = src.split(/\n/);
    for (const line of lines) {
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length > 20 && !/[.!?]/.test(line)) {
        const idx = src.indexOf(line);
        add('Possible run-on sentence (long clause without punctuation)', idx, idx + line.length, 'Consider breaking into shorter sentences', 'high', 'fallback-run-on');
      }
    }

    // 5) Missing auxiliary before -ing (e.g., "I going" instead of "I am going")
    const ingPattern = /\b(I|you|he|she|they|we|it|the\s+\w+)\s+[A-Za-z]+ing\b/gi;
    while ((m = ingPattern.exec(src)) !== null) {
      const subj = m[1];
      // If a valid auxiliary exists immediately before the -ing word, skip
      const idx = m.index;
      const matchText = m[0];
      const words = matchText.split(/\s+/);
      if (words.length >= 2) {
        const possibleAux = '';
        // crude: if pattern matched, treat as missing auxiliary
        add('Missing auxiliary before -ing verb', idx, idx + matchText.length, `Add an auxiliary like 'am/is/are' before '${words[1]}'`, 'major', 'fallback-missing-aux- ing');
      }
    }

    return { errors, count: errors.length };
  }

  /**
   * Analyze grammar using pattern-based detection
   */
  private async analyzeGrammar(
    message: string,
    tier: UserTier,
    level: UserProficiencyLevel,
    languageContext?: LanguageDetectionSummary,
    enableNLP?: boolean,
  ): Promise<{
    score: number;
    errors: UnifiedErrorDetail[];
    feedback: string[];
    metrics: GrammarCategoryMetrics;
  }> {
    const errors: UnifiedErrorDetail[] = [];
    const feedback: string[] = [];
    const recordedRanges = new Set<string>();
  const analysisSource = message;
  const messageNormalized = normalizeTypographicQuotes(analysisSource);

    if (languageContext?.shouldSkipEnglishChecks) {
      const skipMessage = languageContext.analysisNotes?.[0] ?? 'Detected primarily non-English content. Grammar checks skipped.';
      const metrics: GrammarCategoryMetrics = {
        score: 20,
        weightedPenalty: 100,
        normalizedImpact: 1,
        severityDistribution: {
          critical: 0,
          major: 0,
          high: 0,
          medium: 0,
          low: 0,
          suggestion: 0,
        },
        dominantPatterns: [],
        totalErrors: 0,
        heuristicPenalties: [],
      };
      feedback.push(skipMessage);
      return {
        score: 20,
        errors,
        feedback,
        metrics,
      };
    }

    const addError = (error: UnifiedErrorDetail) => {
      const start = error.position?.start ?? -1;
      const end = error.position?.end ?? start;
      const key = start >= 0 ? `${error.type}:${start}-${end}` : `${error.type}:${error.message}:${errors.length}`;
      if (start >= 0 && recordedRanges.has(key)) {
        return;
      }
      if (start >= 0) {
        recordedRanges.add(key);
      }
      errors.push(error);
    };

  const words = messageNormalized.split(/\s+/).filter(Boolean);
  const sentences = messageNormalized.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Use comprehensive grammar rules based on tier
    const applicableRules = GRAMMAR_RULES.filter(rule => {
      const tierOrder = { free: 0, pro: 1, premium: 2 };
      return tierOrder[tier] >= tierOrder[rule.tier];
    });

    // ========================================
    // 🚀 LanguageTool integration for grammar
    // ========================================
    let ltErrors: ErrorDetail[] = [];
    // If an NLP analysis pass will run later (enableNLP===true), skip LanguageTool here
    if (!enableNLP && LANGUAGETOOL_ENABLED && this.languageToolDetector) {
      try {
  ltErrors = await this.languageToolDetector.detect(messageNormalized, { userTier: tier, userLevel: level });

        // Accept a broader set of LanguageTool category ids as grammar-related
        const grammarCategories = [
          'GRAMMAR',
          'TYPOS',
          'AGREEMENT',
          'SEMANTICS',
          'MISC',
          'MORPHOLOGY',
          'COLLOCATIONS',
          'STYLE',
          'PUNCTUATION',
          'SYNTAX'
        ];

        ltErrors.forEach((ltError: ErrorDetail) => {
          const rawCategory = (ltError.category ?? '').toString().toUpperCase();
          const rawRule = (ltError.rule ?? '').toString().toLowerCase();

          // Consider LT issues grammar-relevant if the raw category id is one of the known grammar categories
          const isGrammarCategory = grammarCategories.includes(rawCategory) || ltError.type === 'grammar';

          let severity: ErrorSeverity = ltError.severity || (ltError.type === 'grammar' ? 'critical' : 'medium');
          if (rawCategory.includes('COLLOC') || rawRule.includes('colloc')) {
            severity = severity === 'suggestion' || severity === 'low' ? 'high' : severity;
          }

          const detectedStart = ltError.position?.start ?? (ltError.position?.word
            ? messageNormalized.toLowerCase().indexOf((ltError.position.word || '').toLowerCase())
            : -1);
          const resolvedStart = detectedStart >= 0 ? detectedStart : 0;
          const resolvedEnd = ltError.position?.end ?? (detectedStart >= 0
            ? detectedStart + (ltError.position?.word?.length ?? 0)
            : resolvedStart);

          // If the LT issue is grammar-related (by category or type), add it as a grammar error
          if (isGrammarCategory) {
            addError({
              type: 'grammar',
              category: ltError.category as any || 'correctness',
              severity,
              message: ltError.message,
              position: { start: resolvedStart, end: resolvedEnd, word: ltError.position?.word },
              suggestion: ltError.suggestion,
              explanation: ltError.explanation,
              examples: ltError.examples,
              rule: ltError.rule || 'languagetool',
              alternatives: tier === 'premium' && ltError.suggestion ? [ltError.suggestion] : undefined,
            });
          } else {
            // Non-grammar LT issues should still be appended to errors for visibility but not counted as grammar
            const allowedTypes = new Set<string>(['grammar','vocabulary','spelling','fluency','punctuation','capitalization','syntax','coherence','style','idiom','collocation','semantic']);
            addError({
              type: allowedTypes.has(String(ltError.type)) ? (ltError.type as any) : 'grammar',
              category: ltError.category as any || 'other',
              severity,
              message: ltError.message,
              position: { start: resolvedStart, end: resolvedEnd, word: ltError.position?.word },
              suggestion: ltError.suggestion,
              explanation: ltError.explanation,
              examples: ltError.examples,
              rule: ltError.rule || 'languagetool',
            });
          }
        });

        nlpLogger.info(`LanguageTool detected ${ltErrors.length} errors`);
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException | undefined;
        if (nodeError?.code === 'ECONNREFUSED') {
          nlpLogger.warn('Grammar API offline — using fallback heuristics');
        } else {
          nlpLogger.warn({ error }, 'LanguageTool detection failed, falling back to pattern matching');
        }
  debugConsoleWarn('  ⚠️ LanguageTool error:', error);
      }
    }

    // ========================================
    // Heuristic patches for missed LT cases
    // ========================================
  const heuristicNotes: string[] = [];
  const heuristicPenalties: GrammarHeuristicPenalty[] = [];
  let subjunctivePenaltyApplied = false;
  let mixedTensePenaltyApplied = false;
  let perfectSequencePenaltyApplied = false;
    if (ltErrors.length === 0) {
      const auxiliaryPattern = /\b(?:the\s+\w+|it|this|that|they|we|he|she|results?|data)\s+not\s+(\w+)\b/gi;
      let auxMatch: RegExpExecArray | null;
  while ((auxMatch = auxiliaryPattern.exec(messageNormalized)) !== null) {
        const verbCandidate = auxMatch[1];
        const isPastOrGerund = /(?:ed|ing)$/i.test(verbCandidate);
        if (isPastOrGerund) {
          continue;
        }
        const start = auxMatch.index;
        const end = start + auxMatch[0].length;
        addError({
          type: 'grammar',
          category: 'correctness',
          severity: 'critical',
          message: 'Use an auxiliary verb (does/did) before "not" for subject-verb agreement.',
          position: { start, end, word: auxMatch[0] },
          suggestion: 'Consider "does not" or "did not" followed by the verb.',
          rule: 'heuristic-missing-auxiliary',
        });
        heuristicNotes.push('missing auxiliary before "not"');
      }
    }

    const dueOfPattern = /\bdue\s+of\b/gi;
    let dueMatch: RegExpExecArray | null;
  while ((dueMatch = dueOfPattern.exec(messageNormalized)) !== null) {
      const start = dueMatch.index;
      const end = start + dueMatch[0].length;
      addError({
        type: 'grammar',
        category: 'correctness',
        severity: 'major',
        message: 'Use "due to" instead of "due of".',
        position: { start, end, word: dueMatch[0] },
        suggestion: 'Replace with "due to" to form the correct expression.',
        rule: 'heuristic-due-to',
      });
      heuristicNotes.push('incorrect "due of" phrase');
    }

  const subjunctivePattern = /\bif\s+i\s+was\b/gi;
  let subjunctiveMatch: RegExpExecArray | null;
  while ((subjunctiveMatch = subjunctivePattern.exec(messageNormalized)) !== null) {
      const start = subjunctiveMatch.index;
      const end = start + subjunctiveMatch[0].length;
      addError({
        type: 'grammar',
        category: 'correctness',
        severity: 'major',
        message: 'Use "were" for hypothetical statements with "I".',
        position: { start, end, word: subjunctiveMatch[0] },
        suggestion: subjunctiveMatch[0].replace(/was/i, 'were'),
        rule: 'heuristic-conditional-subjunctive',
      });
      if (!subjunctivePenaltyApplied) {
        heuristicNotes.push('conditional subjunctive should use "If I were"');
        subjunctivePenaltyApplied = true;
      }
    }

    const mixedTensePattern = /\b(told|said)\b([^.!?]*?)\bwill\b/gi;
    let mixedTenseMatch: RegExpExecArray | null;
    while ((mixedTenseMatch = mixedTensePattern.exec(messageNormalized)) !== null) {
      const start = mixedTenseMatch.index;
      const end = start + mixedTenseMatch[0].length;
      addError({
        type: 'grammar',
        category: 'correctness',
        severity: 'major',
        message: 'Use "would" after past-tense reporting verbs for future-in-the-past statements.',
        position: { start, end, word: mixedTenseMatch[0] },
        suggestion: mixedTenseMatch[0].replace(/will/i, 'would'),
        rule: 'heuristic-mixed-tense-future',
      });
      if (!mixedTensePenaltyApplied) {
        mixedTensePenaltyApplied = true;
        heuristicNotes.push('reporting verb with future tense');
      }
    }

    const perfectSequencePattern = /\b(started|began)\b([^.!?]*?)(hasn't|has not)/gi;
    let perfectSequenceMatch: RegExpExecArray | null;
    while ((perfectSequenceMatch = perfectSequencePattern.exec(messageNormalized)) !== null) {
      const start = perfectSequenceMatch.index;
      const end = start + perfectSequenceMatch[0].length;
      addError({
        type: 'grammar',
        category: 'correctness',
        severity: 'major',
        message: 'Past context detected - use "hadn\'t" for completed past events.',
        position: { start, end, word: perfectSequenceMatch[0] },
        suggestion: perfectSequenceMatch[0].replace(/hasn'?t|has not/i, "hadn't"),
        rule: 'heuristic-mixed-perfect-sequence',
      });
      if (!perfectSequencePenaltyApplied) {
        perfectSequencePenaltyApplied = true;
        heuristicNotes.push('past context conflict with present perfect');
      }
    }

    const collocationPatterns: Array<{
      pattern: RegExp;
      message: string;
      suggestion: string;
      rule: string;
    }> = [
      {
        pattern: /\bdespite\s+of\b/gi,
        message: 'Use "despite" without "of" for correct collocation.',
        suggestion: 'Replace with "despite" or use "in spite of".',
        rule: 'heuristic-despite-of',
      },
      {
        pattern: /\bdiscussing\s+about\b/gi,
        message: 'Drop "about" after "discussing"; the verb already includes the object.',
        suggestion: 'Use "discussing" followed directly by the topic.',
        rule: 'heuristic-discuss-about',
      },
      {
        pattern: /\bemphasize\s+on\b/gi,
        message: 'Use "emphasize" without "on"; choose "place emphasis on" instead.',
        suggestion: 'Use "emphasize" or "place emphasis on" appropriately.',
        rule: 'heuristic-emphasize-on',
      },
    ];

    collocationPatterns.forEach(({ pattern, message, suggestion, rule }) => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(messageNormalized)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        addError({
          type: 'grammar',
          category: 'correctness',
          severity: 'high',
          message,
          position: { start, end, word: match[0] },
          suggestion,
          rule,
        });
        heuristicNotes.push(`collocation fix: ${match[0]}`);
      }
    });

    if (heuristicNotes.length > 0) {
      feedback.push(`Heuristic grammar guard triggered: ${Array.from(new Set(heuristicNotes)).join(', ')}.`);
    }

    // ========================================
    // Pattern-based detection (fallback/supplement)
    // ========================================
    applicableRules.forEach((rule) => {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(messageNormalized)) !== null) {
        const raw = match[0];
        const start = match.index;
        const end = start + raw.length;
        const duplicateKey = `grammar:${start}-${end}`;
        if (recordedRanges.has(duplicateKey)) {
          continue;
        }

        const features = TIER_FEATURES[tier];
        let enhancedExplanation = rule.explanation;
        let enhancedExamples = rule.examples;

        if (features.detailedExplanations && rule.explanation) {
          const tierBadge = tier === 'premium' ? '🏆 Premium' : tier === 'pro' ? '⭐ Pro' : '';
          enhancedExplanation = tierBadge ? `${tierBadge} Insight: ${rule.explanation}` : rule.explanation;
          if (tier !== 'free') {
            enhancedExplanation += ' Focus on sentence agreement to keep ideas clear.';
          }
        }

        if (tier === 'premium' && rule.examples) {
          enhancedExamples = [...rule.examples, '✨ Try rephrasing using a complex sentence structure.'];
        }

        addError({
          type: 'grammar',
          category: rule.category as any,
          severity: rule.severity,
          message: rule.message,
          position: { start, end, word: raw },
          suggestion: rule.suggestion(match),
          explanation: enhancedExplanation,
          examples: enhancedExamples,
          rule: rule.id,
          alternatives: tier === 'premium' ? this.generateAlternativePhrasings(raw) : undefined,
        });
      }
    });

    // Heuristic detection for fragments and repetition
    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      const sentenceWords = trimmed.split(/\s+/);
      if (sentenceWords.length === 1 && sentenceWords[0].length > 2) {
        const start = analysisSource.indexOf(trimmed);
        addError({
          type: 'grammar',
          category: 'correctness',
          severity: 'high',
          message: 'Sentence fragment detected',
          position: { start, end: start + trimmed.length, word: trimmed },
          suggestion: 'Add a verb or additional words to complete the sentence.',
          rule: 'sentence-fragment',
        });
      }
    });

    for (let i = 0; i < words.length - 1; i++) {
      const current = words[i].replace(/[^a-z']/gi, '').toLowerCase();
      const next = words[i + 1].replace(/[^a-z']/gi, '').toLowerCase();
      if (current && current === next && !['the', 'and', 'or', 'but'].includes(current)) {
        const searchPrefix = words.slice(0, i).join(' ');
        const analysisLower = analysisSource.toLowerCase();
        const prefixIndex = searchPrefix ? analysisLower.indexOf(searchPrefix.toLowerCase()) : 0;
        const withinSentence = analysisLower.indexOf(words[i].toLowerCase(), prefixIndex >= 0 ? prefixIndex : 0);
        const wordIndex = withinSentence >= 0 ? withinSentence : 0;
        addError({
          type: 'grammar',
          category: 'clarity',
          severity: 'medium',
          message: 'Repeated word reduces clarity',
          position: { start: wordIndex, end: wordIndex + current.length, word: message.substring(wordIndex, wordIndex + words[i].length) },
          suggestion: 'Remove duplicate words or replace with a different expression.',
          rule: 'repeated-word',
        });
      }
    }

    const severityWeights: Record<ErrorSeverity, number> = {
      critical: 2.0,
      major: 1.5,
      high: 1.2,
      medium: 0.8,
      low: 0.35,
      suggestion: 0.1,
    };

    const severityRank: Record<ErrorSeverity, number> = {
      suggestion: 0,
      low: 1,
      medium: 2,
      high: 3,
      major: 4,
      critical: 5,
    };

    const grammarRelevantTypes: UnifiedErrorDetail['type'][] = ['grammar', 'syntax', 'semantic', 'style'];
  const stylePenaltySeverities: ErrorSeverity[] = ['medium', 'high', 'major', 'critical'];
    const grammarRelevantCategories = new Set([
      'grammar',
      'correctness',
      'clarity',
      'agreement',
      'convention',
      'conventions',
    ]);

    const grammarErrors = errors.filter((error) => {
      if (!grammarRelevantTypes.includes(error.type)) {
        return false;
      }

      const normalizedCategory = (error.category ?? '').toString().toLowerCase();
      if (normalizedCategory.length === 0 && error.type === 'grammar') {
        return true;
      }

      if (grammarRelevantCategories.has(normalizedCategory)) {
        return true;
      }

      return normalizedCategory === 'style' && stylePenaltySeverities.includes(error.severity || 'medium');
    });
    const hingeRelaxed = Boolean(languageContext?.shouldRelaxGrammar);

    let effectiveGrammarErrors = grammarErrors;
    let suppressedCount = 0;
    if (hingeRelaxed) {
      const severityThreshold = severityRank.high;
      effectiveGrammarErrors = grammarErrors.filter((error) => {
        const severityValue = severityRank[error.severity ?? 'medium'] ?? severityRank.medium;
        return severityValue >= severityThreshold;
      });
      suppressedCount = grammarErrors.length - effectiveGrammarErrors.length;
      if (suppressedCount > 0) {
        feedback.push(`Mixed-language detected — skipped ${suppressedCount} minor grammar suggestions.`);
      }
    }
  const totalErrors = effectiveGrammarErrors.length;

    const severityDistribution: Record<ErrorSeverity, number> = {
      critical: 0,
      major: 0,
      high: 0,
      medium: 0,
      low: 0,
      suggestion: 0,
    };

    effectiveGrammarErrors.forEach((error) => {
      const severity = error.severity ?? 'medium';
      severityDistribution[severity] += 1;
    });

    const typeModifiers: Partial<Record<UnifiedErrorDetail['type'], number>> = {
      grammar: 1,
      syntax: 1,
      semantic: 0.75,
      style: 0.5,
    };

    const groupedByRule = new Map<string, { count: number; severity: number; message: string }>();
    effectiveGrammarErrors.forEach((error) => {
      const key = error.rule ? `rule:${error.rule}` : `msg:${error.message.toLowerCase()}`;
      const baseWeight = severityWeights[error.severity ?? 'medium'] ?? 1;
      const weight = baseWeight * (typeModifiers[error.type] ?? 1);
      const existing = groupedByRule.get(key);
      if (existing) {
        existing.count += 1;
        existing.severity = Math.max(existing.severity, weight);
      } else {
        groupedByRule.set(key, { count: 1, severity: weight, message: error.message });
      }
    });

    const lengthNormalizer = Math.max(4, Math.ceil(words.length / 4));

    const adjustedImpact = Array.from(groupedByRule.values()).reduce((sum, entry) => {
      const repeatedPenalty = 1 + 0.35 * Math.max(0, entry.count - 1);
      return sum + (entry.severity * repeatedPenalty) / lengthNormalizer;
    }, 0);

    const sentenceUnits = Math.max(1, sentences.length);
    const fallbackUnits = Math.max(1, Math.ceil(words.length / 15));
    const evaluationUnits = Math.max(4, sentenceUnits, fallbackUnits);
    let normalizedRatio = evaluationUnits > 0 ? adjustedImpact / evaluationUnits : 0;

    const highestSeverity = effectiveGrammarErrors.reduce((max, error) => {
      const level = severityRank[error.severity ?? 'medium'] ?? severityRank.medium;
      return Math.max(max, level);
    }, 0);

    if (highestSeverity === 0) {
      normalizedRatio *= 0;
    } else if (highestSeverity <= severityRank.low) {
      normalizedRatio *= 0.35;
    } else if (highestSeverity === severityRank.medium) {
      normalizedRatio *= 0.75;
    }

    normalizedRatio = Math.min(1, normalizedRatio);
    let score = Math.round((1 - normalizedRatio) * 100);

    if (level === 'Beginner') {
      score = Math.min(100, score + 8);
    } else if (level === 'Expert') {
      score = Math.max(0, score - 4);
    }

    if (hingeRelaxed) {
      score = Math.min(100, Math.max(score, 55));
    }

    score = Math.max(0, Math.min(100, score));

    if (totalErrors > 0) {
      // Increase per-error severity to make grammar penalties more impactful
      let perErrorPenalty = 8;
      if (highestSeverity >= severityRank.high) {
        perErrorPenalty = 9;
      }
      if (highestSeverity >= severityRank.critical) {
        perErrorPenalty = 10;
      }
      const minimumFloor = hingeRelaxed ? 55 : 60;
      const hardPenaltyCap = Math.max(100 - totalErrors * perErrorPenalty, minimumFloor);
      score = Math.min(score, hardPenaltyCap);
    }

    let heuristicPenaltyTotal = 0;
    if (subjunctivePenaltyApplied) {
      const penaltyValue = 20;
      heuristicPenaltyTotal += penaltyValue;
      score = Math.max(0, score - penaltyValue);
      heuristicPenalties.push({
        rule: 'heuristic-conditional-subjunctive',
        penalty: penaltyValue,
        reason: 'Detected "If I was" in a hypothetical clause; prefer "If I were".',
      });
      feedback.push('Conditional tone tip: Use "If I were" for unreal or hypothetical situations.');
    }

    if (mixedTensePenaltyApplied) {
      const penaltyValue = 15;
      heuristicPenaltyTotal += penaltyValue;
      score = Math.max(0, score - penaltyValue);
      heuristicPenalties.push({
        rule: 'heuristic-mixed-tense-future',
        penalty: penaltyValue,
        reason: 'Detected past reporting verb followed by "will"; prefer "would" to keep tense aligned.',
      });
      feedback.push('Sequence of tenses: Shift "will" to "would" after past reporting verbs like "told" or "said".');
    }

    if (perfectSequencePenaltyApplied) {
      const penaltyValue = 12;
      heuristicPenaltyTotal += penaltyValue;
      score = Math.max(0, score - penaltyValue);
      heuristicPenalties.push({
        rule: 'heuristic-mixed-perfect-sequence',
        penalty: penaltyValue,
        reason: 'Detected past start verb with present perfect negation; prefer past perfect ("hadn\'t").',
      });
      feedback.push('Timeline alignment: Use past perfect ("hadn\'t") after past actions like "started".');
    }

    score = Math.max(0, Math.min(100, score));

  const criticalErrors = effectiveGrammarErrors.filter((e) => e.severity === 'critical').length;
  const majorErrors = effectiveGrammarErrors.filter((e) => e.severity === 'major').length;
  const highErrors = effectiveGrammarErrors.filter((e) => e.severity === 'high').length;

    const maxFeedback = TIER_FEATURES[tier].maxFeedbackPoints;
    const dominantIssues: string[] = [];

    if (totalErrors === 0) {
      feedback.push('Excellent grammar! No issues detected.');
    } else {
      feedback.push(`Detected ${totalErrors} grammar issue${totalErrors > 1 ? 's' : ''} across ${groupedByRule.size} pattern${groupedByRule.size > 1 ? 's' : ''}.`);
      if (criticalErrors > 0) {
        feedback.push(`${criticalErrors} critical issue${criticalErrors > 1 ? 's' : ''} need immediate attention.`);
      }
      if (majorErrors > 0) {
        feedback.push(`${majorErrors} major issue${majorErrors > 1 ? 's' : ''} significantly impact meaning.`);
      }
      if (highErrors > 0) {
        feedback.push(`${highErrors} high-severity problem${highErrors > 1 ? 's' : ''} impact sentence clarity.`);
      }

      dominantIssues.push(
        ...Array.from(groupedByRule.values())
        .sort((a, b) => b.severity * b.count - a.severity * a.count)
        .slice(0, 2)
        .map((entry) => entry.message)
      );
      if (dominantIssues.length > 0) {
        feedback.push(`Focus on: ${dominantIssues.join(', ')}.`);
      }
    }

    if (feedback.length > maxFeedback) {
      feedback.splice(maxFeedback);
    }

    const weightedPenalty = Number(Math.min(100, normalizedRatio * 100 + heuristicPenaltyTotal).toFixed(2));
    const metrics: GrammarCategoryMetrics = {
      score,
      weightedPenalty,
      normalizedImpact: Number(normalizedRatio.toFixed(3)),
      severityDistribution,
      dominantPatterns: dominantIssues,
      totalErrors,
      heuristicPenalties,
    };

    let filteredErrors = errors;
    if (hingeRelaxed && suppressedCount > 0) {
      const allowed = new Set(effectiveGrammarErrors);
      filteredErrors = errors.filter((error) => error.type !== 'grammar' || allowed.has(error));
    }

    return { score, errors: filteredErrors, feedback, metrics };
  }
  /**
   * Analyze spelling using comprehensive database
   */
  private analyzeSpelling(message: string, tier: UserTier): {
    score: number;
    errors: UnifiedErrorDetail[];
    feedback: string[];
    metrics: SpellingCategoryMetrics;
  } {
  const errors: UnifiedErrorDetail[] = [];
  const feedback: string[] = [];
  const analysisSource = message;
  const normalizedMessage = normalizeDialectVariants(analysisSource);
  const rawTokens = normalizedMessage.match(/[A-Za-z']+/g) || [];
  const tokens = rawTokens;
    const normalizedTokens = tokens.map((token) => token.toLowerCase());

    if (normalizedTokens.length === 0) {
      const metrics: SpellingCategoryMetrics = {
        score: 100,
        normalizedDensity: 0,
        densityPerTokenType: { content: 0, function: 0 },
        totalErrors: 0,
        contentTokenCount: 0,
        functionTokenCount: 0,
      };
      return { score: 100, errors, feedback, metrics };
    }

    let contentTokenCount = 0;
    let functionTokenCount = 0;
    normalizedTokens.forEach((token) => {
      if (FUNCTION_WORDS.has(token)) {
        functionTokenCount += 1;
      } else {
        contentTokenCount += 1;
      }
    });

    let errorCount = 0;
    let contentErrors = 0;
    let functionErrors = 0;
    
    // Use comprehensive spelling database
    const lowerAnalysis = analysisSource.toLowerCase();
    Object.entries(COMMON_MISSPELLINGS).forEach(([wrong, correct]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      let match: RegExpExecArray | null;
      let searchOffset = 0;
      while ((match = regex.exec(normalizedMessage)) !== null) {
        const candidate = match[0];
        const normalized = candidate.toLowerCase();
        const originalIndex = lowerAnalysis.indexOf(normalized, searchOffset);
        const position = originalIndex >= 0 ? originalIndex : lowerAnalysis.indexOf(normalized);
        if (position < 0) {
          continue;
        }
        if (originalIndex >= 0) {
          searchOffset = originalIndex + candidate.length;
        }
        // token-level filtering/masking removed — operate on full message
        errorCount += 1;
        if (FUNCTION_WORDS.has(normalized)) {
          functionErrors += 1;
        } else {
          contentErrors += 1;
        }
        errors.push({
          type: 'spelling',
          category: 'correctness',
          severity: 'medium',
          message: `Spelling error: ${wrong}`,
          position: { start: position, end: position + candidate.length, word: message.substring(position, position + candidate.length) },
          suggestion: `Use "${correct}" instead`,
          explanation: TIER_FEATURES[tier].detailedExplanations ? `"${wrong}" should be spelled as "${correct}"` : undefined,
        });
      }
    });
    
    // Additional spelling patterns for contractions
    const contractionPatterns = [
      { wrong: "cant", correct: "can't" },
      { wrong: "wont", correct: "won't" },
      { wrong: "dont", correct: "don't" },
      { wrong: "didnt", correct: "didn't" },
      { wrong: "doesnt", correct: "doesn't" },
      { wrong: "isnt", correct: "isn't" },
      { wrong: "arent", correct: "aren't" },
      { wrong: "wasnt", correct: "wasn't" },
      { wrong: "werent", correct: "weren't" },
      { wrong: "havent", correct: "haven't" },
      { wrong: "hasnt", correct: "hasn't" },
      { wrong: "couldnt", correct: "couldn't" },
      { wrong: "shouldnt", correct: "shouldn't" },
      { wrong: "wouldnt", correct: "wouldn't" },
    ];
    
    contractionPatterns.forEach(({ wrong, correct }) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(analysisSource)) !== null) {
        const candidate = match[0];
        const start = match.index ?? analysisSource.indexOf(candidate);
        if (start < 0) {
          continue;
        }
        // token-level filtering/masking removed — operate on full message
        errorCount += 1;
        const normalized = candidate.toLowerCase();
        if (FUNCTION_WORDS.has(normalized)) {
          functionErrors += 1;
        } else {
          contentErrors += 1;
        }
        errors.push({
          type: 'spelling',
          category: 'correctness',
          severity: 'medium',
          message: `Contraction error: ${wrong}`,
          position: { start, end: start + candidate.length, word: message.substring(start, start + candidate.length) || candidate },
          suggestion: `Use "${correct}" instead`,
          explanation: TIER_FEATURES[tier].detailedExplanations ? `This should be written as the contraction "${correct}"` : undefined,
        });
      }
    });
    
    const totalTokens = normalizedTokens.length;
    const normalizedDensity = errorCount / Math.max(totalTokens, 1);
    const contentDensity = contentTokenCount > 0 ? contentErrors / contentTokenCount : 0;
    const functionDensity = functionTokenCount > 0 ? functionErrors / functionTokenCount : 0;
    const weightedPenalty = (contentDensity * 0.7) + (functionDensity * 0.3);
    const score = Math.max(0, Math.round(100 - weightedPenalty * 100));
    
    // Generate tier-appropriate feedback
    const maxFeedback = TIER_FEATURES[tier].maxFeedbackPoints;
    
    if (errorCount > 0) {
      feedback.push(`${errorCount} spelling error${errorCount > 1 ? 's' : ''} found`);

      if (contentErrors > functionErrors && contentErrors > 0) {
        feedback.push('Most spelling issues affect content words — double-check key vocabulary.');
      } else if (functionErrors > 0) {
        feedback.push('Watch common function words and contractions for small typos.');
      }

      if (TIER_FEATURES[tier].detailedExplanations && errors.length > 0) {
        const uniqueErrors = Array.from(new Set(errors.map((e) => e.position?.word).filter(Boolean)));
        if (uniqueErrors.length > 0) {
          feedback.push(`Words to check: ${uniqueErrors.slice(0, 5).join(', ')}`);
        }
      }
    } else {
      feedback.push('No spelling issues detected — great job!');
    }
    
    if (tier !== 'free' && errorCount > 0) {
      feedback.push('Consider activating premium spelling suggestions for personalized corrections.');
    }
    
    // Limit feedback points based on tier
    if (feedback.length > maxFeedback) {
      feedback.splice(maxFeedback);
    }

    const metrics: SpellingCategoryMetrics = {
      score,
      normalizedDensity: Number((normalizedDensity * 100).toFixed(2)),
      densityPerTokenType: {
        content: Number((contentDensity * 100).toFixed(2)),
        function: Number((functionDensity * 100).toFixed(2)),
      },
      totalErrors: errorCount,
      contentTokenCount,
      functionTokenCount,
    };
    
    return { score, errors, feedback, metrics };
  }
  /**
   * Analyze vocabulary using comprehensive assessment with ACADEMIC_WORDS
   */
  private analyzeVocabulary(message: string, tier: UserTier, level: UserProficiencyLevel): {
    score: number;
    errors: UnifiedErrorDetail[];
    feedback: string[];
    vocabularyAnalysis?: any;
    metrics: VocabularyCategoryMetrics;
  } {
    const errors: UnifiedErrorDetail[] = [];
    const feedback: string[] = [];
    
    // Extract words for analysis
    const rawWords: string[] = message.match(/\b\w+\b/g) || [];
    const words = rawWords;
    const avgWordLength = words.length > 0 
      ? words.reduce((sum: number, word: string) => sum + word.length, 0) / words.length 
      : 0;
    
    // Calculate vocabulary diversity
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyDiversity = uniqueWords.size / Math.max(words.length, 1);
    
    // Calculate academic word usage
    const academicWords = words.filter(w => ACADEMIC_WORDS.has(w.toLowerCase()));
    const academicCount = academicWords.length;
    const academicPercentage = (academicCount / Math.max(words.length, 1)) * 100;
    
    const rareWordRatio = words.filter((w) => w.length > 10).length / Math.max(words.length, 1);
    const repetitionRate = Math.max(0, 1 - vocabularyDiversity);
    const rangeScoreRaw = (vocabularyDiversity * 75) + Math.min(20, avgWordLength * 3) + Math.min(10, academicPercentage * 0.5);
    const rangeScore = Math.min(100, Math.round(rangeScoreRaw));
    const repetitionPenalty = Math.round(repetitionRate * 45);
    let score = Math.max(0, Math.min(100, rangeScore - repetitionPenalty + Math.min(5, rareWordRatio * 40)));

    const shortTextBoost = words.length > 0 && words.length < 25 ? 10 : 0;
    if (shortTextBoost > 0) {
      score = Math.min(100, score + shortTextBoost);
    }
    
    // Advanced vocabulary analysis for pro/premium
    let vocabularyAnalysis: any = undefined;
    if (TIER_FEATURES[tier].vocabularyAnalysis) {
      // CEFR level assessment based on academic word usage
      let cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
      if (academicPercentage > 30) cefrLevel = 'C2';
      else if (academicPercentage > 20) cefrLevel = 'C1';
      else if (academicPercentage > 10) cefrLevel = 'B2';
      else if (academicPercentage > 5) cefrLevel = 'B1';
      else if (words.length > 10) cefrLevel = 'A2';
      else cefrLevel = 'A1';
      
      vocabularyAnalysis = {
        level: cefrLevel,
        academicWordUsage: Math.round(academicPercentage),
        rareWordUsage: Math.round(rareWordRatio * 100),
        wordDiversity: Math.round(vocabularyDiversity * 100),
      };
      vocabularyAnalysis.rangeScore = rangeScore;
      vocabularyAnalysis.repetitionPenalty = repetitionPenalty;
      vocabularyAnalysis.repetitionRate = Math.round(repetitionRate * 100);
      if (shortTextBoost > 0) {
        vocabularyAnalysis.shortTextAdjustment = shortTextBoost;
      }
      
      // Add suggestions for premium
      if (tier === 'premium' && vocabularyDiversity < 0.7) {
        vocabularyAnalysis.suggestions = [
          {
            word: 'good',
            alternatives: ['excellent', 'outstanding', 'superb', 'magnificent'],
            context: 'general description'
          }
        ];
      }
    }
    
    // Generate feedback
    const maxFeedback = TIER_FEATURES[tier].maxFeedbackPoints;
    
    if (vocabularyDiversity > 0.8) {
      feedback.push('Excellent vocabulary diversity!');
    } else if (vocabularyDiversity > 0.6) {
      feedback.push('Good vocabulary usage');
    } else {
      feedback.push('Try using more varied vocabulary');
    }

    if (avgWordLength > 6) {
      feedback.push('Strong word choice with advanced vocabulary');
    } else if (avgWordLength < 4) {
      feedback.push('Consider using more descriptive words');
    }
    
    if (academicPercentage > 15 && TIER_FEATURES[tier].detailedExplanations) {
      feedback.push('Great use of academic vocabulary!');
    }

    if (repetitionRate > 0.35) {
      feedback.push('Reduce repeated words to broaden vocabulary impact.');
    }
    
    // Limit feedback based on tier
    if (feedback.length > maxFeedback) {
      feedback.splice(maxFeedback);
    }

    const metrics: VocabularyCategoryMetrics = {
      score,
      rangeScore,
      repetitionPenalty,
      diversity: Number((vocabularyDiversity * 100).toFixed(2)),
      repetitionRate: Number((repetitionRate * 100).toFixed(2)),
      academicUsage: Math.round(academicPercentage),
      rareWordUsage: Math.round(rareWordRatio * 100),
    };
    
    return { score, errors, feedback, vocabularyAnalysis, metrics };
  }

  /**
   * Analyze tone and formality (Pro+ feature)
   */
  private analyzeTone(message: string): any {
    const formalWords = ['furthermore', 'however', 'therefore', 'consequently', 'nevertheless'];
    const informalWords = ['hey', 'yeah', 'cool', 'awesome', 'gonna', 'wanna', 'kinda'];
    const casualWords = ['hi', 'hello', 'thanks', 'please', 'sorry'];
    
    const words = message.toLowerCase().split(/\s+/);
    const formalCount = words.filter(w => formalWords.includes(w)).length;
    const informalCount = words.filter(w => informalWords.includes(w)).length;
    const casualCount = words.filter(w => casualWords.includes(w)).length;
    
    let tone: 'formal' | 'neutral' | 'informal' | 'casual' = 'neutral';
    let confidence = 50;
    
    if (formalCount > 2) {
      tone = 'formal';
      confidence = Math.min(90, 50 + formalCount * 10);
    } else if (informalCount > 2) {
      tone = 'informal';
      confidence = Math.min(90, 50 + informalCount * 10);
    } else if (casualCount > 3) {
      tone = 'casual';
      confidence = Math.min(90, 50 + casualCount * 8);
    }
    
    return {
      overall: tone,
      confidence,
      contextAppropriate: true, // Simplified - would need context to determine
      recommendations: tone === 'formal' ? ['Maintain professional tone'] : 
                      tone === 'casual' ? ['Consider more formal language for professional contexts'] : 
                      ['Tone is appropriate for most contexts']
    };
  }

  /**
   * Calculate readability metrics (Pro+ feature)
   */
  private calculateReadability(message: string, statistics: any): any {
    const words = message.split(/\s+/).filter(w => w.length > 0);
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    
    // Flesch Reading Ease
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    const avgSyllablesPerWord = syllables / Math.max(words.length, 1);
    const fleschReadingEase = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
    ));
    
    // Flesch-Kincaid Grade Level
    const fleschKincaidGrade = Math.max(0, 
      (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59
    );
    
    // SMOG Index (simplified)
    const complexWords = words.filter(w => this.countSyllables(w) >= 3).length;
    const smogIndex = Math.max(0, 
      1.043 * Math.sqrt(complexWords * (30 / Math.max(sentences.length, 1))) + 3.1291
    );
    
    // Determine average level
    let averageLevel = 'Elementary';
    if (fleschKincaidGrade >= 16) averageLevel = 'Graduate';
    else if (fleschKincaidGrade >= 13) averageLevel = 'College';
    else if (fleschKincaidGrade >= 10) averageLevel = 'High School';
    else if (fleschKincaidGrade >= 7) averageLevel = 'Middle School';
    
    return {
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      fleschReadingEase: Math.round(fleschReadingEase),
      smogIndex: Math.round(smogIndex * 10) / 10,
      colemanLiauIndex: Math.round(fleschKincaidGrade), // Simplified
      automatedReadabilityIndex: Math.round(fleschKincaidGrade), // Simplified
      averageLevel,
      recommendation: fleschReadingEase < 30 ? 'Consider simplifying your language' : 
                      fleschReadingEase > 90 ? 'Consider using more complex sentences' : 
                      'Readability is appropriate for most audiences'
    };
  }

  /**
   * Analyze coherence and discourse (Premium feature)
   */
  private analyzeCoherence(message: string): any {
    const transitions = [
      'however', 'therefore', 'furthermore', 'moreover', 'consequently',
      'nevertheless', 'nonetheless', 'meanwhile', 'additionally', 'finally'
    ];
    
    const words = message.toLowerCase().split(/\s+/);
    const usedTransitions = words.filter(w => transitions.includes(w)).length;
    
    return {
      score: Math.min(100, 60 + usedTransitions * 8),
      transitions: {
        used: usedTransitions,
        suggested: usedTransitions < 2 ? ['however', 'therefore', 'furthermore'] : []
      },
      topicConsistency: 85, // Simplified - would need topic modeling
      logicalFlow: Math.min(100, 70 + usedTransitions * 5),
      issues: usedTransitions === 0 ? ['Consider adding transition words to improve flow'] : []
    };
  }

  /**
   * Analyze writing style (Pro+ feature)
   */
  private analyzeStyle(message: string): any {
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = message.split(/\s+/).filter(w => w.length > 0);
    
    // Passive voice detection (simplified)
    const passivePatterns = /\b(is|was|were|are|been|being)\s+\w+ed\b/gi;
    const passiveMatches = message.match(passivePatterns) || [];
    const passiveVoiceUsage = Math.round((passiveMatches.length / Math.max(sentences.length, 1)) * 100);
    
    // Sentence variety
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentenceLengths.length, 1);
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / Math.max(sentenceLengths.length, 1);
    const sentenceVariety = Math.min(100, Math.round(50 + variance * 2));
    
    return {
      passiveVoiceUsage,
      sentenceVariety,
      repetitionIssues: 0, // Simplified
      formalityScore: 75, // Simplified
      engagement: Math.round(70 + sentenceVariety * 0.3),
      recommendations: passiveVoiceUsage > 30 ? ['Consider using more active voice'] : 
                       sentenceVariety < 40 ? ['Vary sentence length for better flow'] : 
                       ['Writing style is effective']
    };
  }

  /**
   * Helper function to count syllables in a word
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    // Remove silent 'e' at the end
    if (word.endsWith('e')) word = word.slice(0, -1);
    
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    return Math.max(1, vowelGroups.length);
  }

  /**
   * Analyze AI response for feedback quality (ENHANCED from enhanced calculator)
   */
  private analyzeAIResponse(userMessage: string, aiResponse: string, errors: UnifiedErrorDetail[], features: any): any {
    if (!aiResponse) {
      return {
        hasCorrectionFeedback: false,
        hasGrammarCorrection: false,
        hasStyleSuggestion: false,
        correctedErrors: [],
        appreciationLevel: 'none',
        severityOfCorrections: 'none',
        engagementScore: 0,
      };
    }

    const aiLower = aiResponse.toLowerCase();
    
    // Detect ALL correction patterns
    const hasCorrectionMarker = 
      aiResponse.includes('[ERROR:') ||
      aiResponse.includes('[CORRECTION') || 
      aiResponse.includes('✓') ||
      aiResponse.includes('[NOTE');
    
    const hasCorrectionFeedback = 
      hasCorrectionMarker ||
      /should be|correct|mistake|error|wrong|incorrect|fix|change|instead of|better to say/i.test(aiResponse);
    
    const hasGrammarCorrection = 
      /grammar|word order|verb|tense|structure|subject-verb|question formation|pronoun/i.test(aiResponse);
    
    // Extract ALL corrections (more comprehensive)
    const correctedErrors: string[] = [];
    
    // Pattern 1: Quoted text
    const quotePattern = /"([^"]+)"/g;
    let match;
    while ((match = quotePattern.exec(aiResponse)) !== null) {
      correctedErrors.push(match[1]);
    }
    
    // Pattern 2: Single quotes
    const singleQuotePattern = /'([^']+)'/g;
    while ((match = singleQuotePattern.exec(aiResponse)) !== null) {
      correctedErrors.push(match[1]);
    }
    
    // Accurate severity determination based on errors
    let severity: 'none' | 'minor' | 'moderate' | 'major' | 'critical' = 'none';
    
    // Count errors by severity
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const highErrors = errors.filter(e => e.severity === 'high').length;
    const mediumErrors = errors.filter(e => e.severity === 'medium').length;
    const totalErrors = errors.length;
    
    // Determine severity based on error count and types
    if (criticalErrors > 0 || totalErrors >= 5) {
      severity = 'critical';
    } else if (highErrors >= 3 || totalErrors >= 4) {
      severity = 'major';
    } else if (highErrors > 0 || mediumErrors >= 2) {
      severity = 'moderate';
    } else if (totalErrors > 0) {
      severity = 'minor';
    }
    
    // Determine appreciation level
    let appreciationLevel: 'none' | 'minimal' | 'moderate' | 'high' = 'none';
    if (aiResponse.includes('great') || aiResponse.includes('excellent') || aiResponse.includes('perfect')) {
      appreciationLevel = 'high';
    } else if (aiResponse.includes('good') || aiResponse.includes('well done')) {
      appreciationLevel = 'moderate';
    } else if (aiResponse.includes('nice') || aiResponse.includes('okay')) {
      appreciationLevel = 'minimal';
    }
    
    // Calculate engagement score
    const engagementScore = Math.min(100, 
      (hasCorrectionFeedback ? 30 : 0) +
      (hasGrammarCorrection ? 25 : 0) +
      (correctedErrors.length > 0 ? 20 : 0) +
      (appreciationLevel === 'high' ? 25 : appreciationLevel === 'moderate' ? 15 : appreciationLevel === 'minimal' ? 5 : 0)
    );

    return {
      hasCorrectionFeedback,
      hasGrammarCorrection,
      hasStyleSuggestion: /style|tone|formality/i.test(aiResponse),
      correctedErrors,
      appreciationLevel,
      severityOfCorrections: severity,
      engagementScore,
    };
  }

  /**
   * Analyze premium features (idioms, collocations, advanced suggestions) - PREMIUM EXCLUSIVE
   */
  private analyzePremiumFeatures(message: string, tier: UserTier, errors: UnifiedErrorDetail[]): any {
    const features = TIER_FEATURES[tier];
    const words = message.match(/\b\w+\b/g) || [];
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const lowerMessage = message.toLowerCase();
    
    // Advanced idiom detection with explanations
    const commonIdioms = [
      { phrase: 'break the ice', meaning: 'To initiate conversation in a social setting', level: 'B2' },
      { phrase: 'piece of cake', meaning: 'Something very easy to do', level: 'B1' },
      { phrase: 'hit the nail on the head', meaning: 'To describe exactly what is causing a situation or problem', level: 'C1' },
      { phrase: 'let the cat out of the bag', meaning: 'To reveal a secret accidentally', level: 'B2' },
      { phrase: 'once in a blue moon', meaning: 'Very rarely', level: 'B2' },
      { phrase: 'spill the beans', meaning: 'To reveal secret information', level: 'B1' },
      { phrase: 'cost an arm and a leg', meaning: 'To be very expensive', level: 'B2' },
      { phrase: 'under the weather', meaning: 'Feeling ill or sick', level: 'B1' },
      { phrase: 'beat around the bush', meaning: 'To avoid talking about what is important', level: 'C1' },
      { phrase: 'call it a day', meaning: 'To stop working for the day', level: 'B1' },
    ];
    
    const foundIdioms = commonIdioms.filter(idiom => 
      lowerMessage.includes(idiom.phrase)
    );

    // Advanced collocation analysis
    const commonCollocations = {
      'make': ['a decision', 'an effort', 'a mistake', 'progress', 'money', 'a difference'],
      'take': ['a break', 'a chance', 'responsibility', 'time', 'place'],
      'do': ['homework', 'business', 'your best', 'damage', 'the dishes'],
      'have': ['a look', 'a chat', 'fun', 'difficulty', 'an impact']
    };
    
    const collocationIssues: any[] = [];
    Object.entries(commonCollocations).forEach(([verb, correctNouns]) => {
      if (lowerMessage.includes(verb)) {
        // Check for incorrect collocations
        const verbPattern = new RegExp(`${verb}\\s+(\\w+)`, 'gi');
        const matches = message.match(verbPattern);
        if (matches) {
          matches.forEach(match => {
            const noun = match.split(' ')[1]?.toLowerCase();
            if (noun && !correctNouns.some(cn => noun.includes(cn))) {
              // Potential collocation issue
              collocationIssues.push({
                phrase: match,
                correctAlternatives: correctNouns.slice(0, 3),
                explanation: `"${verb}" typically collocates with: ${correctNouns.slice(0, 3).join(', ')}`
              });
            }
          });
        }
      }
    });

    // Advanced sentence rewriting suggestions (PREMIUM)
    const sentenceRewrites: any[] = [];
    if (features.sentenceRewriting) {
      sentences.forEach((sentence, index) => {
        const trimmed = sentence.trim();
        const wordCount = trimmed.split(/\s+/).length;
        
        // Too long sentences
        if (wordCount > 25) {
          sentenceRewrites.push({
            original: trimmed,
            suggestion: `Consider breaking into 2 sentences at a logical point`,
            reason: 'Long sentences can reduce readability',
            improvedExample: this.generateShorterVersion(trimmed)
          });
        }
        
        // Passive voice suggestions
        if (/\b(is|was|were|are|been)\s+\w+ed\b/i.test(trimmed)) {
          const activeVersion = this.convertToActiveVoice(trimmed);
          if (activeVersion !== trimmed) {
            sentenceRewrites.push({
              original: trimmed,
              suggestion: activeVersion,
              reason: 'Active voice is more direct and engaging',
              improvedExample: activeVersion
            });
          }
        }
      });
    }

    // Advanced vocabulary suggestions (PRO+)
    const advancedVocabSuggestions: any[] = [];
    if (features.advancedVocabSuggestions) {
      const basicWords = {
        'good': ['excellent', 'outstanding', 'remarkable', 'exceptional', 'superb'],
        'bad': ['poor', 'inadequate', 'unsatisfactory', 'substandard', 'inferior'],
        'big': ['large', 'substantial', 'considerable', 'significant', 'extensive'],
        'small': ['minor', 'minimal', 'modest', 'limited', 'negligible'],
        'very': ['extremely', 'highly', 'remarkably', 'exceptionally', 'particularly'],
        'a lot': ['numerous', 'substantial', 'considerable', 'significant', 'abundant'],
        'get': ['obtain', 'acquire', 'receive', 'attain', 'secure'],
        'make': ['create', 'produce', 'generate', 'construct', 'form'],
        'think': ['believe', 'consider', 'assume', 'suppose', 'reckon']
      };
      
      Object.entries(basicWords).forEach(([basic, advanced]) => {
        const pattern = new RegExp(`\\b${basic}\\b`, 'gi');
        if (pattern.test(message)) {
          advancedVocabSuggestions.push({
            basicWord: basic,
            advancedAlternatives: advanced,
            usageExample: `Instead of "${basic}", try: "${advanced[0]}" or "${advanced[1]}"`,
            cefrLevel: 'B2-C1',
            context: 'Academic and professional writing'
          });
        }
      });
    }

    // Professional writing tips (PRO+)
    const professionalTips: string[] = [];
    if (features.professionalTips) {
      if (sentences.length < 3) {
        professionalTips.push('✨ Pro Tip: Aim for 3-5 sentences to fully develop your ideas');
      }
      
      if (words.length < 30) {
        professionalTips.push('✨ Pro Tip: Elaborate more on your points for better clarity and impact');
      }
      
      const academicWordCount = words.filter(w => ACADEMIC_WORDS.has(w.toLowerCase())).length;
      const academicPercentage = (academicWordCount / words.length) * 100;
      
      if (academicPercentage < 5) {
        professionalTips.push('✨ Pro Tip: Use more academic vocabulary to sound more professional (target: 5-15%)');
      }
      
      if (!/\b(however|therefore|furthermore|moreover|consequently)\b/i.test(message)) {
        professionalTips.push('✨ Pro Tip: Add transition words (however, therefore, furthermore) for better flow');
      }
      
      const contractions = message.match(/\b(don't|can't|won't|didn't|isn't|aren't)\b/gi);
      if (contractions && contractions.length > 0) {
        professionalTips.push(`✨ Pro Tip: Avoid contractions in formal writing (found ${contractions.length})`);
      }
    }

    // Contextual suggestions based on message analysis
    const contextualSuggestions: string[] = [];
    const errorTypes = Array.from(new Set(errors.map(e => e.type)));
    
    if (errorTypes.includes('grammar')) {
      contextualSuggestions.push('💡 Focus on subject-verb agreement and sentence structure');
    }
    if (errorTypes.includes('spelling')) {
      contextualSuggestions.push('💡 Review common spelling patterns and use spell-check tools');
    }
    if (words.length < 20) {
      contextualSuggestions.push('💡 Expand your response with more details and examples');
    }
    if (sentences.length < 2) {
      contextualSuggestions.push('💡 Use multiple sentences to organize your thoughts better');
    }
    
    // Advanced pattern detection (PREMIUM)
    const advancedPatterns = {
      detected: [] as string[],
      recommendations: [] as string[]
    };
    
    if (tier === 'premium') {
      // Detect writing patterns
      if (/\b(I think|I believe|I feel)\b/gi.test(message)) {
        advancedPatterns.detected.push('Personal opinion expressions');
        advancedPatterns.recommendations.push('Consider using "It appears that" or "Research suggests" for formal writing');
      }
      
      if (/\b(thing|stuff|something)\b/gi.test(message)) {
        advancedPatterns.detected.push('Vague language detected');
        advancedPatterns.recommendations.push('Replace vague words with specific terms for clarity');
      }
      
      const questionMarks = (message.match(/\?/g) || []).length;
      if (questionMarks > 2) {
        advancedPatterns.detected.push('Multiple questions');
        advancedPatterns.recommendations.push('Consider breaking into separate messages for better organization');
      }
      
      // Check for repetitive sentence starters
      const starters = sentences.map(s => s.trim().split(' ')[0]?.toLowerCase()).filter(Boolean);
      const starterCounts = starters.reduce((acc: any, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      const repetitive = Object.entries(starterCounts).filter(([_, count]) => (count as number) > 1);
      if (repetitive.length > 0) {
        advancedPatterns.detected.push('Repetitive sentence starters');
        advancedPatterns.recommendations.push(`Vary sentence beginnings - you started ${repetitive.length} sentences the same way`);
      }
    }

    return {
      idiomaticExpressions: {
        found: foundIdioms.map(i => ({
          phrase: i.phrase,
          meaning: i.meaning,
          level: i.level,
          usage: 'Correct usage detected ✓'
        })),
        improvements: foundIdioms.length === 0 && features.idiomaticExpressions ? [
          {
            suggestion: 'Try incorporating idioms for more natural English',
            examples: commonIdioms.slice(0, 5).map(i => `"${i.phrase}" (${i.level}) - ${i.meaning}`)
          }
        ] : []
      },
      collocations: {
        correctUsage: Math.max(0, 100 - (collocationIssues.length * 15)),
        issues: collocationIssues.slice(0, 5)
      },
      sentenceRewrites: sentenceRewrites.slice(0, features.maxSuggestions || 5),
      advancedVocabulary: advancedVocabSuggestions.slice(0, features.maxSuggestions || 5),
      professionalTips: professionalTips.slice(0, Math.min(5, features.maxFeedbackPoints || 3)),
      contextualSuggestions: contextualSuggestions.slice(0, 10),
      advancedPatterns: advancedPatterns,
      premiumBadges: tier === 'premium' ? ['🏆 Expert Analysis', '⭐ Native-level Insights', '🎯 Personalized Recommendations'] : []
    };
  }

  /**
   * Helper: Generate shorter version of long sentence
   */
  private generateShorterVersion(sentence: string): string {
    // Find natural break points (conjunctions, commas)
    const breakPoints = [' and ', ' but ', ' because ', ', which ', ', that '];
    for (const breakPoint of breakPoints) {
      if (sentence.includes(breakPoint)) {
        const parts = sentence.split(breakPoint);
        if (parts.length >= 2) {
          return `${parts[0].trim()}. ${parts[1].trim()}`;
        }
      }
    }
    return sentence;
  }

  /**
   * Helper: Convert passive to active voice (simplified)
   */
  private convertToActiveVoice(sentence: string): string {
    // Simplified conversion for common patterns
    const passivePatterns = [
      { passive: /is (being )?(\w+ed) by/, active: (match: string) => match.replace(/is (being )?(\w+ed) by/, '') },
      { passive: /was (being )?(\w+ed) by/, active: (match: string) => match.replace(/was (being )?(\w+ed) by/, '') },
      { passive: /were (being )?(\w+ed) by/, active: (match: string) => match.replace(/were (being )?(\w+ed) by/, '') },
    ];
    
    for (const pattern of passivePatterns) {
      if (pattern.passive.test(sentence)) {
        // This is a simplified conversion - in production, use NLP library
        return sentence.replace(pattern.passive, '');
      }
    }
    
    return sentence;
  }

  /**
   * Helper: Generate alternative phrasings (Premium feature)
   */
  private generateAlternativePhrasings(phrase: string): string[] {
    // Premium feature: provides multiple alternative phrasings
    const alternatives: string[] = [];
    const lowerPhrase = phrase.toLowerCase();
    
    // Common patterns and their alternatives
    const phraseAlternatives: Record<string, string[]> = {
      'i think': ['In my opinion', 'I believe', 'It seems to me', 'From my perspective'],
      'very good': ['excellent', 'outstanding', 'remarkable', 'exceptional'],
      'very bad': ['poor', 'unsatisfactory', 'inadequate', 'disappointing'],
      'a lot': ['numerous', 'substantial', 'considerable', 'significant'],
      'very big': ['enormous', 'substantial', 'considerable', 'extensive'],
      'very small': ['minimal', 'negligible', 'modest', 'tiny'],
    };
    
    // Check for exact matches
    for (const [pattern, alts] of Object.entries(phraseAlternatives)) {
      if (lowerPhrase.includes(pattern)) {
        alternatives.push(...alts);
      }
    }
    
    // If no specific alternatives found, provide general suggestions
    if (alternatives.length === 0) {
      alternatives.push(
        '🎯 Try rephrasing for clarity',
        '✨ Consider a more formal expression',
        '💡 Use more specific vocabulary'
      );
    }
    
    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * ❌ REMOVED: getTierMultiplier method
   * XP multipliers are now handled by the XP controller
   */

  private getAnalysisDepth(tier: UserTier): string {
    return TIER_FEATURES[tier].analysisDepth;
  }

  private determineProficiencyLevel(message: string): UserProficiencyLevel {
    const words = message.split(/\s+/).length;
    const avgWordLength = message.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / Math.max(words, 1);
    
    if (words < 10 || avgWordLength < 4) return 'Beginner';
    if (words < 25 || avgWordLength < 5) return 'Intermediate';
    if (words < 50 || avgWordLength < 6) return 'Advanced';
    return 'Expert';
  }

  private calculateOverallScore(result: UnifiedAccuracyResult): number {
    // ✅ PURE WEIGHTED AVERAGE - Overall accuracy is calculated from sub-categories
    // This ensures overall always matches the weighted sum of grammar, vocab, spelling, etc.
    // Grammar carries highest weight (40%) for realistic English evaluation
    
    const baseCategoryWeights = {
      grammar: 0.40,      // 40% weight - highest priority for English correctness
      vocabulary: 0.20,   // 20% weight - word choice and appropriateness
      spelling: 0.20,     // 20% weight - orthographic accuracy
      fluency: 0.15,      // 15% weight - naturalness and flow
      punctuation: 0.03,  // 3% weight - minor formatting
      capitalization: 0.02 // 2% weight - minor formatting
    };
    const categoryWeights = { ...baseCategoryWeights };

    const criticalErrorCount = result.statistics?.criticalErrorCount ?? 0;
    if (criticalErrorCount > 10 && categoryWeights.grammar > 0.25) {
      const cappedGrammarWeight = 0.25;
      const diff = categoryWeights.grammar - cappedGrammarWeight;
      const redistributionKeys: Array<keyof typeof categoryWeights> = ['vocabulary', 'spelling', 'fluency', 'punctuation', 'capitalization'];
      const redistributionTotal = redistributionKeys.reduce((sum, key) => sum + baseCategoryWeights[key], 0);
      categoryWeights.grammar = cappedGrammarWeight;
      redistributionKeys.forEach((key) => {
        const share = redistributionTotal > 0 ? baseCategoryWeights[key] / redistributionTotal : 0;
        categoryWeights[key] = Number((baseCategoryWeights[key] + share * diff).toFixed(4));
      });
    }
    
    // Calculate pure weighted average from sub-category scores
    const weightedScore = 
      (result.grammar || 0) * categoryWeights.grammar +
      (result.vocabulary || 0) * categoryWeights.vocabulary +
      (result.spelling || 0) * categoryWeights.spelling +
      (result.fluency || 0) * categoryWeights.fluency +
      (result.punctuation || 0) * categoryWeights.punctuation +
      (result.capitalization || 0) * categoryWeights.capitalization;
    
    // Round to nearest integer
    const finalScore = Math.round(weightedScore);
    
    // Ensure score is within valid range [0, 100]
    return Math.max(0, Math.min(100, finalScore));
  }

  private categorizeErrors(errors: UnifiedErrorDetail[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private clampScore(value: number | null | undefined): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }
    if (value < 0) return 0;
    if (value > 100) return 100;
    return Math.round(value);
  }

  private buildErrorsByType(errors: UnifiedErrorDetail[]): IAccuracyData['errorsByType'] {
    const template: IAccuracyData['errorsByType'] = {
      grammar: 0,
      vocabulary: 0,
      spelling: 0,
      punctuation: 0,
      capitalization: 0,
      syntax: 0,
      style: 0,
      coherence: 0,
    };

    errors.forEach((error) => {
      if (error.type in template) {
        const key = error.type as keyof typeof template;
        template[key] += 1;
      }
    });

    return template;
  }

  private captureAccuracySnapshot(result: UnifiedAccuracyResult): Partial<IAccuracyData> {
    const errorsByType = this.buildErrorsByType(result.errors);
    const snapshot: Partial<IAccuracyData> = {
      overall: this.clampScore(result.overall) ?? 0,
      adjustedOverall: this.clampScore(result.adjustedOverall) ?? this.clampScore(result.overall) ?? 0,
      grammar: this.clampScore(result.grammar) ?? 0,
      vocabulary: this.clampScore(result.vocabulary) ?? 0,
      spelling: this.clampScore(result.spelling) ?? 0,
      fluency: this.clampScore(result.fluency) ?? 0,
      punctuation: this.clampScore(result.punctuation) ?? 0,
      capitalization: this.clampScore(result.capitalization) ?? 0,
      totalErrors: result.statistics.errorCount,
      criticalErrors: result.statistics.criticalErrorCount,
      errorsByType,
      readabilityScore: this.clampScore(result.readability?.fleschReadingEase),
      toneScore: this.clampScore(result.tone?.confidence),
      styleScore: this.clampScore(result.styleAnalysis?.engagement),
      freeNLPEnhanced: result.nlpEnhanced,
      nlpCost: result.nlpEnhanced ? '$0/month' : undefined,
      vocabularyLevel: result.vocabularyAnalysis?.level,
      lastCalculated: new Date(),
      calculationCount: 1,
    };

    const syntaxScore = this.clampScore(result.syntax);
    if (typeof syntaxScore === 'number') {
      snapshot.syntax = syntaxScore;
    }

    const coherenceScore = this.clampScore(result.coherence);
    if (typeof coherenceScore === 'number') {
      snapshot.coherence = coherenceScore;
    }

    return {
      ...snapshot,
      errorsByType: { ...errorsByType },
    };
  }

  private cloneAccuracySnapshot(snapshot?: Partial<IAccuracyData>): Partial<IAccuracyData> {
    if (!snapshot) {
      return {};
    }
    const clone: Partial<IAccuracyData> = { ...snapshot };
    if (snapshot.errorsByType) {
      clone.errorsByType = { ...snapshot.errorsByType };
    }
    return clone;
  }

  private applyHistoricalSmoothingFallback(
    result: UnifiedAccuracyResult,
    tier: UserTier,
    previousAccuracy?: Partial<IAccuracyData>,
    baselineCurrent?: Partial<IAccuracyData>,
    weightingConfig?: HistoricalWeightingConfig
  ): void {
    const currentSnapshot = this.cloneAccuracySnapshot(baselineCurrent ?? this.captureAccuracySnapshot(result));

    if (!result.currentAccuracy) {
      result.currentAccuracy = this.cloneAccuracySnapshot(currentSnapshot);
    }

    if (!previousAccuracy) {
      if (!result.weightedAccuracy) {
        result.weightedAccuracy = this.cloneAccuracySnapshot(currentSnapshot);
      }
      return;
    }

    const calculationCount = Number(previousAccuracy.calculationCount ?? 0);
    const tierBias = tier === 'premium' ? 0.5 : tier === 'pro' ? 0.58 : 0.65;
    const experienceAdjustment = Math.min(0.18, calculationCount * 0.015);
    const { decayFactor, categoryBaselines, minimumMessageCountForHistory, currentWeightOverride } = weightingConfig || {};

    // Allow an explicit opt-out so callers can disable historical smoothing immediately
    if (weightingConfig && (weightingConfig as any).disableHistorical) {
      debugConsoleLog('🛑 Historical smoothing disabled via weightingConfig.disableHistorical');
      const snapshotClone = this.cloneAccuracySnapshot(currentSnapshot);
      result.weightedAccuracy = snapshotClone;
      result.currentAccuracy = this.cloneAccuracySnapshot({ ...currentSnapshot, lastCalculated: new Date(), calculationCount: Number(previousAccuracy.calculationCount ?? 0) + 1 });
      result.performance = {
        totalProcessingTime: result.statistics.processingTime,
        cacheHit: false,
        strategy: 'historical-disabled',
        weightsUsed: { historical: 0, current: 1 },
      };
      return;
    }

    let currentWeight = typeof currentWeightOverride === 'number'
      ? Math.min(1, Math.max(0, currentWeightOverride))
      : Math.max(0.4, tierBias - experienceAdjustment);
    let historicalWeight = 1 - currentWeight;

    // If no explicit override provided, make currentWeight dynamic based on recent error counts
    // IMPORTANT: give MORE weight to the CURRENT snapshot when the message is poor (so history does not mask errors)
    if (typeof currentWeightOverride !== 'number') {
      const recentErrorCount = result.statistics?.errorCount ?? 0;
      // For very poor messages, increase currentWeight (not decrease it)
      if (recentErrorCount > 8) {
        currentWeight = 0.85;
      } else if (recentErrorCount > 6) {
        currentWeight = 0.75;
      } else if (recentErrorCount > 4) {
        currentWeight = 0.65;
      } else {
        // keep a sensible minimum for typical messages
        currentWeight = Math.max(currentWeight, 0.55);
      }
      historicalWeight = 1 - currentWeight;
    }

    if (typeof minimumMessageCountForHistory === 'number' && calculationCount < minimumMessageCountForHistory) {
      historicalWeight *= 0.5;
      currentWeight = 1 - historicalWeight;
    }

    if (calculationCount >= 5 && historicalWeight < 0.2) {
      historicalWeight = 0.2;
      currentWeight = 0.8;
    }

    if (typeof decayFactor === 'number') {
      const boundedDecay = Math.min(2, Math.max(0, decayFactor));
      historicalWeight *= boundedDecay;
    }

    const totalWeight = currentWeight + historicalWeight || 1;
    const normalizedCurrentWeight = totalWeight === 0 ? 0.5 : currentWeight / totalWeight;
    const normalizedHistoricalWeight = totalWeight === 0 ? 0.5 : historicalWeight / totalWeight;

    const weightedSnapshot = this.cloneAccuracySnapshot(previousAccuracy);
    const baselinesApplied: NumericAccuracyKey[] = [];

    // Build the weighted snapshot by combining the current snapshot and previousAccuracy.
    // Do NOT write these smoothed values back into `result` — keep `result` fields equal to the
    // authoritative current analysis. The weighted snapshot is returned in `result.weightedAccuracy` only.
    NUMERIC_ACCURACY_KEYS.forEach((key) => {
      const currentValue = this.clampScore(currentSnapshot[key] as number | undefined);
      const previousValue = this.clampScore(previousAccuracy[key] as number | undefined);
      if (currentValue === undefined && previousValue === undefined) {
        return;
      }
      const baseline = categoryBaselines && Object.prototype.hasOwnProperty.call(categoryBaselines, key)
        ? categoryBaselines[key]
        : undefined;
      const fallbackPrev = previousValue ?? (baseline as number | undefined) ?? currentValue ?? 0;
      if (baseline !== undefined && previousValue === undefined) {
        baselinesApplied.push(key);
      }
      const smoothedValue = Math.round((normalizedCurrentWeight * (currentValue ?? fallbackPrev)) + (normalizedHistoricalWeight * fallbackPrev));
      (weightedSnapshot as Record<NumericAccuracyKey, number | undefined>)[key] = smoothedValue;
    });

    weightedSnapshot.totalErrors = currentSnapshot.totalErrors ?? previousAccuracy.totalErrors ?? result.statistics.errorCount;
    weightedSnapshot.criticalErrors = currentSnapshot.criticalErrors ?? previousAccuracy.criticalErrors ?? result.statistics.criticalErrorCount;
    weightedSnapshot.errorsByType = currentSnapshot.errorsByType
      ? { ...currentSnapshot.errorsByType }
      : previousAccuracy.errorsByType
        ? { ...previousAccuracy.errorsByType }
        : this.buildErrorsByType(result.errors);

    weightedSnapshot.readabilityScore = currentSnapshot.readabilityScore ?? previousAccuracy.readabilityScore;
    weightedSnapshot.toneScore = currentSnapshot.toneScore ?? previousAccuracy.toneScore;
    weightedSnapshot.styleScore = currentSnapshot.styleScore ?? previousAccuracy.styleScore;
    weightedSnapshot.freeNLPEnhanced = currentSnapshot.freeNLPEnhanced ?? previousAccuracy.freeNLPEnhanced;
    weightedSnapshot.nlpCost = currentSnapshot.nlpCost ?? previousAccuracy.nlpCost;
    weightedSnapshot.vocabularyLevel = currentSnapshot.vocabularyLevel ?? previousAccuracy.vocabularyLevel;
    weightedSnapshot.lastCalculated = new Date();
    weightedSnapshot.calculationCount = calculationCount + 1;

    result.weightedAccuracy = weightedSnapshot;
    result.currentAccuracy = this.cloneAccuracySnapshot({
      ...currentSnapshot,
      calculationCount: calculationCount + 1,
      lastCalculated: new Date(),
    });

    result.performance = {
      totalProcessingTime: result.statistics.processingTime,
      cacheHit: false,
      strategy: 'fallback-historical',
      weightsUsed: {
        historical: Number(normalizedHistoricalWeight.toFixed(2)),
        current: Number(normalizedCurrentWeight.toFixed(2)),
      },
      decayFactorApplied: typeof decayFactor === 'number' ? Number(decayFactor.toFixed(2)) : undefined,
      baselinesApplied: baselinesApplied.length > 0 ? Array.from(new Set<NumericAccuracyKey>(baselinesApplied)) : undefined,
    };

  debugConsoleLog('ℹ️ Fallback historical smoothing applied (enhanced weighting unavailable).');
  }

  private attachCategoryTrends(
    result: UnifiedAccuracyResult,
    previousAccuracy?: Partial<IAccuracyData>
  ): void {
    const details = result.categoryDetails;
    if (!details) {
      return;
    }

    const sampleSize = Number(previousAccuracy?.calculationCount ?? 0);

    const categoryPairs: Array<[
      keyof CategoryMetricMap,
      number | undefined,
      number | undefined
    ]> = [
      ['grammar', result.grammar, previousAccuracy?.grammar],
      ['vocabulary', result.vocabulary, previousAccuracy?.vocabulary],
      ['spelling', result.spelling, previousAccuracy?.spelling],
      ['pronunciation', result.fluency, previousAccuracy?.fluency],
    ];

    for (const [category, currentScore, previousScore] of categoryPairs) {
      const metrics = details[category];
      if (!metrics) {
        continue;
      }

      const trend = summarizeCategoryTrend(currentScore, previousScore, sampleSize);
      if (trend) {
        (metrics as { trend?: CategoryTrendInsight }).trend = trend;
      }
    }
  }

  /**
   * ❌ REMOVED: XP calculation logic
   * 
   * XP calculation is now handled by the dedicated XP controller.
   * Use the /api/xp/award endpoint to calculate and award XP based on accuracy results.
   * 
   * This keeps the accuracy calculator focused on accuracy analysis only,
   * following the single responsibility principle.
   * 
   * Example usage:
   * 1. Call unifiedAccuracyCalculator.analyzeAccuracy() to get accuracy results
   * 2. Extract wordCount, accuracy, errorCount, criticalErrors from results
   * 3. Call POST /api/xp/award with these parameters to calculate and award XP
   */

  /**
   * Analyze fluency (basic implementation)
   */
  private analyzeFluency(message: string, tier: UserTier, level: UserProficiencyLevel): {
    score: number;
    errors: UnifiedErrorDetail[];
    feedback: string[];
    pronunciationMetrics: PronunciationCategoryMetrics;
  } {
    const feedback: string[] = [];
    const errors: UnifiedErrorDetail[] = [];
    const rawSentences = message.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const rawWords = message.split(/\s+/).filter((w) => w.length > 0);

    if (rawWords.length === 0) {
      const pronunciationMetrics: PronunciationCategoryMetrics = {
        overall: 45,
        prosody: 40,
        intelligibility: 45,
        pacing: 50,
        stress: 55,
        signals: {
          punctuationVariety: 0,
          fillerInstances: 0,
          connectorCount: 0,
          stressIndicators: 0,
        },
      };
      return {
        score: 50,
        errors: [{
          type: 'fluency',
          category: 'delivery',
          severity: 'medium',
          message: 'Provide at least one full sentence for fluency analysis.',
          position: { start: 0, end: Math.min(message.length, 1) },
          suggestion: 'Write a complete thought with a subject and a verb.',
        }],
        feedback: ['Add more context so we can evaluate fluency accurately.'],
        pronunciationMetrics,
      };
    }

    const sentences = rawSentences.length > 0 ? rawSentences : [message];
    const sentenceLengths = sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length);
    const totalWords = rawWords.length;
    const avgSentenceLength = totalWords / Math.max(1, sentences.length);
    const mean = avgSentenceLength;
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / Math.max(sentenceLengths.length, 1);
    const stdDev = Math.sqrt(variance);

    const syllableCount = rawWords.reduce((sum, word) => sum + this.countSyllables(word), 0);
    const complexWords = rawWords.filter((word) => this.countSyllables(word) >= 3).length;

    const avgSyllablesPerWord = syllableCount / Math.max(totalWords, 1);
    const fleschReadingEase = Math.max(0, Math.min(100,
      206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
    ));

    const gunningFog = totalWords === 0
      ? 0
      : 0.4 * (avgSentenceLength + 100 * (complexWords / Math.max(totalWords, 1)));
    const gunningFogScore = Math.max(0, Math.min(100, 120 - gunningFog * 10));
    const readabilityScore = Math.round((fleschReadingEase * 0.6) + (gunningFogScore * 0.4));

    const targetSentenceLength = 16;
    const lengthDeviation = Math.abs(avgSentenceLength - targetSentenceLength);
    const lengthScore = Math.max(40, 100 - lengthDeviation * 4);
    const smoothnessScore = Math.max(40, 100 - Math.max(0, stdDev - 6) * 5);
    const sentenceSmoothnessScore = Math.round((lengthScore * 0.6) + (smoothnessScore * 0.4));

    const transitionWords = new Set([
      'however', 'therefore', 'furthermore', 'moreover', 'consequently',
      'nevertheless', 'nonetheless', 'meanwhile', 'additionally', 'finally',
      'also', 'then', 'first', 'second', 'third', 'overall', 'instead',
    ]);
    const normalizedWords = rawWords.map((word) => word.replace(/[^a-z']/gi, '').toLowerCase()).filter(Boolean);
    const connectorCount = normalizedWords.filter((word) => transitionWords.has(word)).length;
    const cohesionScore = Math.min(100, 65 + connectorCount * 6);

    const fillerWords = new Set([
      'um', 'uh', 'er', 'ah', 'like', 'basically', 'actually', 'literally', 'maybe', 'perhaps',
    ]);
    const fillerPhrasePatterns = ['you know', 'i mean', 'sort of', 'kind of'];
    const fillerOccurrences = normalizedWords.filter((word) => fillerWords.has(word));
    const fillerPhraseCount = fillerPhrasePatterns.reduce((sum, phrase) => {
      const regex = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      const matches = message.match(regex);
      return sum + (matches ? matches.length : 0);
    }, 0);
    const totalFillerInstances = fillerOccurrences.length + fillerPhraseCount;
    const fillerPenalty = Math.min(25, totalFillerInstances * 3);

    const lexicalVariety = new Set(normalizedWords).size / Math.max(normalizedWords.length, 1);
    let redundancyPenalty = 0;
    if (lexicalVariety < 0.35) {
      redundancyPenalty = 12;
    } else if (lexicalVariety < 0.45) {
      redundancyPenalty = 6;
    }

    const baseScore = (readabilityScore * 0.4) + (sentenceSmoothnessScore * 0.35) + (cohesionScore * 0.25);
    let score = Math.round(baseScore - fillerPenalty - redundancyPenalty);

    const punctuationVariety = new Set((message.match(/[,:;?!]/g) || [])).size;
    const stressIndicators = (message.match(/\b[A-Z]{2,}\b/g) || []).length;
    const pacingScore = Math.max(40, Math.min(100, 100 - Math.abs(avgSentenceLength - targetSentenceLength) * 3 - Math.max(0, stdDev - 4) * 4));
    const prosodyScore = Math.max(40, Math.min(100, 60 + Math.min(25, punctuationVariety * 6) + Math.min(15, connectorCount * 3) - Math.max(0, stdDev - 5) * 3));
    const intelligibilityScore = Math.max(40, Math.min(100, readabilityScore - fillerPenalty * 1.2 - redundancyPenalty * 1.5));
    const stressScore = Math.max(40, Math.min(100, 90 - Math.min(20, stressIndicators * 4)));
    const pronunciationOverall = Math.round((prosodyScore * 0.35) + (intelligibilityScore * 0.35) + (pacingScore * 0.2) + (stressScore * 0.1));

    // ===== Rule-based fluency penalties (tense errors, missing commas, run-ons)
    // Detect tense conflicts heuristically: presence of past markers vs future markers in same sentence
    let tenseConflictCount = 0;
    const pastRegex = /\b\w+ed\b|\bwas\b|\bwere\b|\bhad\b/gi;
    const futureRegex = /\bwill\b|\bgoing to\b|\bgonna\b|\bshall\b/gi;
    sentences.forEach((s) => {
      const hasPast = !!s.match(pastRegex);
      const hasFuture = !!s.match(futureRegex);
      if (hasPast && hasFuture) tenseConflictCount++;
    });

    if (tenseConflictCount > 1) {
      const penalty = 20;
      score = Math.max(0, score - penalty);
      errors.push({
        type: 'fluency',
        category: 'tense',
        severity: 'high',
        message: `Multiple tense inconsistencies detected (${tenseConflictCount}).`,
        suggestion: 'Keep verb tenses consistent within sentences; avoid mixing past and future in the same clause.',
      });
      feedback.push('Tense inconsistencies make writing confusing. Keep tenses consistent.');
    }

    // Missing commas: long sentences (>10 words) that have zero commas
    let missingCommaCount = 0;
    sentences.forEach((s) => {
      const wordsInSentence = s.trim().split(/\s+/).filter(Boolean).length;
      const commaCount = (s.match(/,/g) || []).length;
      if (wordsInSentence > 10 && commaCount === 0) missingCommaCount++;
    });
    if (missingCommaCount > 0) {
      const penalty = 10;
      score = Math.max(0, score - penalty);
      errors.push({
        type: 'fluency',
        category: 'punctuation',
        severity: 'medium',
        message: `Long sentence(s) missing commas (${missingCommaCount}).`,
        suggestion: 'Use commas to break long sentences into readable clauses.',
      });
      feedback.push('Consider using commas in long sentences to improve readability.');
    }

    // Run-on clauses: crude heuristic counting clause separators and coordinating conjunctions
    let runOnClauseCount = 0;
    sentences.forEach((s) => {
      // Count semicolons and repeated coordinating conjunction patterns as indicators
      const semicolons = (s.match(/;/g) || []).length;
      const conjMatches = (s.match(/\b(and|but|or|so|then)\b/gi) || []).length;
      const clauseIndicators = semicolons + Math.max(0, conjMatches - 1);
      if (clauseIndicators > 2) runOnClauseCount++;
    });
    if (runOnClauseCount > 2) {
      const penalty = 15;
      score = Math.max(0, score - penalty);
      errors.push({
        type: 'fluency',
        category: 'run-on',
        severity: 'high',
        message: `Run-on clause patterns detected (${runOnClauseCount}).`,
        suggestion: 'Split run-on clauses into separate sentences or use punctuation like commas/semicolons appropriately.',
      });
      feedback.push('Run-on sentences reduce clarity; try splitting clauses or adding punctuation.');
    }

    // ===== Additional grammar/fluency heuristics (fragments, missing auxiliaries, reversed structures)
    // Heuristics are intentionally conservative to avoid false positives.
    let fragmentCount = 0;
    let missingAuxCount = 0;
    let reversedStructureCount = 0;

    // Finite/modal/auxiliary verb indicators
    const finiteAuxRegex = /\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|must|may|might)\b/i;
    // Gerund without auxiliary: subject + \w+ing (e.g. "He going to school")
    const subjGerundRegex = /\b(I|you|he|she|we|they|it)\b[^.!?\n\r]{0,8}\b\w+ing\b/i;
    // Subject pronoun followed by 'not' + base verb (missing auxiliary 'do') e.g. "She not like it"
    const subjNotBaseVerbRegex = /\b(I|you|he|she|we|they)\b\s+not\s+\b([a-z]{2,})\b(?!ing|ed)/i;
    // Verb before pronoun without question mark (possible reversed/inversion) e.g. "Went he to the store"
    const verbBeforePronounRegex = /\b([A-Za-z]+(?:ed|s|ing)?)\b\s+\b(I|you|he|she|we|they|it)\b/i;

    sentences.forEach((s) => {
      const trimmed = s.trim();
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

      // Fragment heuristics: short sequences that lack a clear finite/modal/auxiliary verb
      // If sentence is short (<= 8 words) or generally lacks auxiliaries and finite verb forms, mark as fragment.
      const hasFinite = !!trimmed.match(finiteAuxRegex);
      const hasPastOrThird = !!trimmed.match(/\b\w+(ed|s)\b/i);
      if (!hasFinite && !hasPastOrThird && wordCount <= 8) {
        fragmentCount++;
      }

      // Missing auxiliary heuristics: subject + gerund without auxiliary OR subject + 'not' + base verb
      if (trimmed.match(subjGerundRegex)) {
        missingAuxCount++;
      } else if (trimmed.match(subjNotBaseVerbRegex)) {
        missingAuxCount++;
      }

      // Reversed/inversion heuristics: verb appears before a pronoun in a non-question sentence
      if (!trimmed.endsWith('?') && trimmed.match(verbBeforePronounRegex)) {
        // Avoid flagging valid auxiliary inversions used in fronting (e.g., "Never have I ...") by checking for starting adverbials
        const startsWithAdverbial = !!trimmed.match(/^(rarely|never|seldom|hardly|scarcely)\b/i);
        if (!startsWithAdverbial) reversedStructureCount++;
      }
    });

    if (fragmentCount > 0) {
      const penalty = Math.min(20, 6 + fragmentCount * 6); // scale but cap
      score = Math.max(0, score - penalty);
      errors.push({
        type: 'fluency',
        category: 'fluency',
        severity: 'medium',
        message: `Possible sentence fragments detected (${fragmentCount}).`,
        suggestion: 'Ensure sentences contain a main verb and express a complete thought.',
      });
      feedback.push('Some sentence fragments were detected; add a verb or complete the clause.');
    }

    if (missingAuxCount > 0) {
      const penalty = Math.min(30, 8 + missingAuxCount * 10);
      score = Math.max(0, score - penalty);
      errors.push({
        type: 'fluency',
        category: 'fluency',
        severity: 'high',
        message: `Missing auxiliary verbs detected (${missingAuxCount}).`,
        suggestion: "Check for missing 'be'/'do' auxiliaries (e.g., 'He going' -> 'He is going').",
      });
      feedback.push('Missing auxiliary verbs detected; add the correct auxiliary (is/are/do/does/has/have).');
    }

    // Missing contractions heuristic: penalize expanded forms in casual context when contractions are expected
    const expandedForms = (message.match(/\b(do not|does not|did not|is not|are not|would not|could not|should not|I am)\b/gi) || []).length;
    const contractionForms = (message.match(/\b(don't|doesn't|didn't|isn't|aren't|wouldn't|couldn't|shouldn't|I'm)\b/gi) || []).length;
    if (expandedForms > 0 && contractionForms === 0 && totalWords > 4) {
      const contractionPenalty = Math.min(8, expandedForms * 2);
      score = Math.max(0, score - contractionPenalty);
      errors.push({
        type: 'fluency',
        category: 'style',
        severity: 'low',
        message: `Expanded forms detected (${expandedForms}) with no contractions.`,
        suggestion: 'Use contractions in casual contexts to sound more natural (e.g., "do not" → "don\'t").',
      });
      feedback.push('Consider using contractions where appropriate to improve naturalness.');
    }

    if (reversedStructureCount > 0) {
      const penalty = Math.min(25, 7 + reversedStructureCount * 9);
      score = Math.max(0, score - penalty);
      errors.push({
        type: 'fluency',
        category: 'fluency',
        severity: 'high',
        message: `Possible reversed/incorrect subject-verb order detected (${reversedStructureCount}).`,
        suggestion: 'Check subject-verb order; ensure the subject typically precedes the main verb in declarative sentences.',
      });
      feedback.push('Some sentences appear to have inverted word order; check subject-verb placement.');
    }

    if (level === 'Beginner') {
      score = Math.min(100, score + 5);
    } else if (level === 'Expert') {
      score = Math.max(0, score - 3);
    }

    score = Math.max(0, Math.min(100, score));

    if (fleschReadingEase < 40) {
      const start = Math.min(message.length, sentences[0]?.length ?? message.length);
      errors.push({
        type: 'fluency',
        category: 'delivery',
        severity: 'high',
        message: 'Low readability makes the text hard to follow.',
        position: { start: 0, end: start },
        suggestion: 'Break complex sentences into shorter ones and reduce heavy phrasing.',
      });
    }

    if (totalFillerInstances > 0) {
      const fillerSample = fillerOccurrences[0] || fillerPhrasePatterns.find((phrase) => message.toLowerCase().includes(phrase));
      const fillerIndex = fillerSample ? message.toLowerCase().indexOf(fillerSample) : -1;
      errors.push({
        type: 'fluency',
        category: 'delivery',
        severity: 'medium',
        message: 'Filler words reduce sentence smoothness.',
        position: { start: Math.max(0, fillerIndex), end: Math.max(0, fillerIndex + (fillerSample?.length ?? 0)) },
        suggestion: fillerSample ? `Remove filler expressions like "${fillerSample}" for tighter flow.` : 'Reduce filler expressions for tighter flow.',
      });
    }

    if (connectorCount === 0 && sentences.length > 1) {
      errors.push({
        type: 'fluency',
        category: 'clarity',
        severity: 'medium',
        message: 'Add transition words to connect sentences smoothly.',
        position: { start: 0, end: Math.min(message.length, sentences[0]?.length ?? message.length) },
        suggestion: 'Use connectors such as "however", "therefore", or "additionally".',
      });
    }

    const maxFeedback = TIER_FEATURES[tier].maxFeedbackPoints;
    if (fleschReadingEase >= 70) {
      feedback.push('Great readability—sentences are easy to understand.');
    } else if (fleschReadingEase < 50) {
      feedback.push('Simplify sentence structure to improve readability.');
    }

    if (Math.abs(avgSentenceLength - targetSentenceLength) > 6) {
      feedback.push('Balance sentence length for smoother pacing.');
    }

    if (connectorCount < Math.max(1, sentences.length - 1)) {
      feedback.push('Add transition words to guide the reader between ideas.');
    }

    if (totalFillerInstances > 0) {
      const fillerHighlights = new Set<string>();
      fillerOccurrences.slice(0, 3).forEach((word) => fillerHighlights.add(word));
      fillerPhrasePatterns.forEach((phrase) => {
        if (message.toLowerCase().includes(phrase)) {
          fillerHighlights.add(phrase);
        }
      });
      feedback.push(`Remove filler expressions like ${Array.from(fillerHighlights).slice(0, 3).join(', ')}.`);
    }

    if (lexicalVariety < 0.45) {
      feedback.push('Vary your vocabulary to avoid repetition.');
    }

    if (prosodyScore < 70) {
      feedback.push('Introduce more varied punctuation to mirror natural speech rhythm.');
    }

    if (intelligibilityScore < 65) {
      feedback.push('Shorten complex sentences to keep pronunciation clear.');
    }

    if (feedback.length > maxFeedback) {
      feedback.splice(maxFeedback);
    }

    const pronunciationMetrics: PronunciationCategoryMetrics = {
      overall: pronunciationOverall,
      prosody: Math.round(prosodyScore),
      intelligibility: Math.round(intelligibilityScore),
      pacing: Math.round(pacingScore),
      stress: Math.round(stressScore),
      signals: {
        punctuationVariety,
        fillerInstances: totalFillerInstances,
        connectorCount,
        stressIndicators,
      },
    };

    return { score, errors, feedback, pronunciationMetrics };
  }

  /**
   * Analyze punctuation
   */
  private analyzePunctuation(message: string): {
    score: number;
    errors: UnifiedErrorDetail[];
  } {
    const errors: UnifiedErrorDetail[] = [];
    
    // Basic punctuation checks
    if (!message.match(/[.!?]$/)) {
      errors.push({
        type: 'punctuation',
        category: 'correctness',
        severity: 'low',
        message: 'Missing ending punctuation',
        position: { start: message.length - 1, end: message.length },
        suggestion: 'Add a period, question mark, or exclamation mark at the end',
      });
    }
    
    // Check for multiple spaces
    if (message.match(/\s{2,}/)) {
      errors.push({
        type: 'punctuation',
        category: 'correctness',
        severity: 'low',
        message: 'Multiple consecutive spaces',
        position: { start: 0, end: message.length },
        suggestion: 'Use single spaces between words',
      });
    }
    
    const score = Math.max(0, 100 - (errors.length * 10));
    return { score, errors };
  }

  /**
   * Analyze capitalization with proper noun checking
   */
  private analyzeCapitalization(message: string): {
    score: number;
    errors: UnifiedErrorDetail[];
  } {
    const errors: UnifiedErrorDetail[] = [];
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Check for capitalization at start of each sentence
    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (trimmed.length > 0 && trimmed[0] !== trimmed[0].toUpperCase()) {
        const sentenceIndex = message.indexOf(trimmed);
        errors.push({
          type: 'capitalization',
          category: 'correctness',
          severity: 'high',
          message: 'Sentence should start with a capital letter',
          position: { start: sentenceIndex, end: sentenceIndex + 1 },
          suggestion: 'Capitalize the first letter of the sentence',
        });
      }
    });
    
    // Check for lowercase "i" (pronoun "I" must always be capitalized)
    const iPattern = /\bi\b/g;
    let match;
    while ((match = iPattern.exec(message)) !== null) {
      errors.push({
        type: 'capitalization',
        category: 'correctness',
        severity: 'high',
        message: 'Pronoun "I" must be capitalized',
        position: { start: match.index, end: match.index + 1, word: 'i' },
        suggestion: 'Change "i" to "I"',
      });
    }
    
    // Check for common proper nouns that should be capitalized
    const properNouns = ['bihar', 'india', 'delhi', 'mumbai', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'english', 'america', 'china', 'japan', 'london', 'paris'];
    const words = message.match(/\b\w+\b/g) || [];
    
    words.forEach((word) => {
      const lower = word.toLowerCase();
      if (properNouns.includes(lower) && word !== word.charAt(0).toUpperCase() + word.slice(1)) {
        const wordIndex = message.indexOf(word);
        errors.push({
          type: 'capitalization',
          category: 'correctness',
          severity: 'medium',
          message: `Proper noun "${word}" should be capitalized`,
          position: { start: wordIndex, end: wordIndex + word.length, word },
          suggestion: `Change "${word}" to "${word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()}"`,
        });
      }
    });
    
    const score = Math.max(0, 100 - (errors.length * 10)); // 10 points per capitalization error
    return { score, errors };
  }
}

// ============================================
// EXPORTS AND SINGLETON INSTANCE
// ============================================

export const unifiedAccuracyCalculator = new UnifiedAccuracyCalculator();

/**
 * Main export function for backward compatibility
 * This replaces both analyzeMessageEnhanced and analyzeMessageWithNLP
 */
export async function analyzeMessage(
  message: string,
  aiResponse: string = '',
  options: AccuracyAnalysisOptions = {}
): Promise<UnifiedAccuracyResult> {
  return await unifiedAccuracyCalculator.analyzeMessage(message, aiResponse, options);
}

// Legacy exports for backward compatibility
export async function analyzeMessageEnhanced(
  message: string,
  aiResponse: string,
  tier: UserTier,
  previousAccuracy?: number,
  proficiencyLevel?: UserProficiencyLevel
): Promise<UnifiedAccuracyResult> {
  return await analyzeMessage(message, aiResponse, {
    tier,
    proficiencyLevel,
    enableNLP: false,
    enableWeightedCalculation: false,
  });
}

export async function analyzeMessageWithNLP(
  userMessage: string,
  aiResponse: string,
  topic: string,
  options: {
    tier?: UserTier;
    proficiencyLevel?: UserProficiencyLevel;
    userId?: string;
    wordCount?: number;
    redisClient?: any;
    enableLanguageTool?: boolean;
    enableOpenRouter?: boolean;
  } = {}
): Promise<UnifiedAccuracyResult> {
  return await analyzeMessage(userMessage, aiResponse, {
    tier: options.tier,
    proficiencyLevel: options.proficiencyLevel,
    userId: options.userId,
    enableNLP: true,
    enableWeightedCalculation: !!options.userId,
    redisClient: options.redisClient,
  });
}

export default unifiedAccuracyCalculator;
