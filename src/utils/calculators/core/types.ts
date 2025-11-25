/**
 * 🎯 CORE TYPE DEFINITIONS
 * Central type system for the accuracy calculation engine
 * 
 * @module core/types
 * @version 2.0.0
 * @author AI Engineering Team
 * @date 2025-10-30
 */

// ============================================
// USER & TIER TYPES
// ============================================

export type UserTier = 'free' | 'pro' | 'premium';

export type UserProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type ErrorSeverity = 'critical' | 'major' | 'high' | 'medium' | 'low' | 'suggestion';

export type ErrorType = 
  | 'grammar' 
  | 'spelling' 
  | 'vocabulary' 
  | 'fluency' 
  | 'punctuation' 
  | 'capitalization' 
  | 'syntax' 
  | 'style' 
  | 'coherence' 
  | 'idiom' 
  | 'collocation'
  | 'semantic'
  | 'textspeak';

export type ErrorCategory = 'correctness' | 'clarity' | 'engagement' | 'delivery' | 'style';

// ============================================
// ERROR DETAIL TYPES
// ============================================

export interface ErrorPosition {
  start: number;
  end: number;
  word?: string;
  sentence?: string;
  context?: string;
}

export interface ErrorDetail {
  type: ErrorType;
  category: ErrorCategory;
  message: string;
  explanation?: string;
  position: ErrorPosition;
  severity: ErrorSeverity;
  suggestion: string;
  alternatives?: string[];
  rule?: string;
  examples?: string[];
  confidence?: number; // 0-1 confidence score
  source?: 'regex' | 'languagetool' | 'gpt' | 'spacy' | 'hybrid'; // Detection source
  aiDetected?: boolean; // Flag to prevent double-counting
}

// ============================================
// ANALYSIS RESULT TYPES
// ============================================

export interface ToneAnalysis {
  overall: 'formal' | 'neutral' | 'informal' | 'casual';
  confidence: number;
  recommendations?: string[];
  contextAppropriate: boolean;
  formalityScore?: number; // 0-100
}

export interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  smogIndex: number;
  colemanLiauIndex: number;
  automatedReadabilityIndex: number;
  averageLevel: string;
  recommendation?: string;
  targetAudience?: string;
}

export interface VocabularyAnalysis {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  academicWordUsage: number;
  rareWordUsage: number;
  wordDiversity: number;
  lexicalDensity?: number;
  suggestions?: Array<{
    word: string;
    alternatives: string[];
    context: string;
    reason?: string;
  }>;
}

export interface CoherenceAnalysis {
  score: number;
  transitions: {
    used: number;
    suggested: string[];
    quality?: number;
  };
  topicConsistency: number;
  logicalFlow: number;
  paragraphStructure?: number;
  issues?: string[];
}

export interface StyleAnalysis {
  passiveVoiceUsage: number;
  sentenceVariety: number;
  repetitionIssues: number;
  formalityScore: number;
  engagement: number;
  recommendations?: string[];
  strengthsDetected?: string[];
}

export interface PremiumInsights {
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
  semanticIssues?: Array<{
    text: string;
    issue: string;
    suggestion: string;
  }>;
}

export interface AIResponseAnalysis {
  hasCorrectionFeedback: boolean;
  detectedCorrections?: number;
  grammarCorrectionCount?: number;
  hasGrammarCorrection: boolean;
  hasStyleSuggestion: boolean;
  correctedErrors: string[];
  appreciationLevel: 'none' | 'low' | 'medium' | 'high';
  severityOfCorrections: 'none' | 'minor' | 'moderate' | 'major' | 'critical';
  feedbackQuality?: number; // 0-100
  penalties?: {
    grammar?: number;
    vocabulary?: number;
    fluency?: number;
    spelling?: number;
  };
}

export interface MessageStatistics {
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
  errorsBySeverity?: Record<ErrorSeverity, number>;
}

export interface UserInsights {
  level: UserProficiencyLevel;
  strengths: string[];
  weaknesses: string[];
  improvement: number;
  nextSteps?: string[];
  learningPath?: string[];
  estimatedCEFR?: string;
  progressTrend?: 'improving' | 'stable' | 'declining';
}

// ============================================
// SCORING TYPES
// ============================================

export interface CategoryScores {
  grammar: number;
  vocabulary: number;
  spelling: number;
  fluency: number;
  punctuation: number;
  capitalization: number;
  syntax: number;
  coherence: number;
  contextRelevance?: number;
  messageLengthScore?: number;
  complexityScore?: number;
}

export interface CategoryWeights {
  grammar: number;
  vocabulary: number;
  spelling: number;
  fluency: number;
  punctuation: number;
  capitalization: number;
  syntax: number;
  coherence: number;
}

export interface WeightProfile {
  baseWeights: CategoryWeights;
  tierAdjustments?: Partial<CategoryWeights>;
  contextModifiers: {
    shortMessage: number; // <10 words
    mediumMessage: number; // 10-50 words
    longMessage: number; // >50 words
    questionType: number;
    statementType: number;
  };
  proficiencyAdjustments?: Record<UserProficiencyLevel, Partial<CategoryWeights>>;
}

export interface PenaltyModifiers {
  contextPenalty: number; // 0-15% max
  lengthPenalty: number; // 0-10% max for short messages
  offTopicPenalty: number; // 0-20% max
  textSpeakPenalty: number; // 0-25% for text speak
}

// ============================================
// XP & PROGRESSION TYPES
// ============================================

export interface XPCalculation {
  baseXP: number;
  accuracyMultiplier: number;
  tierMultiplier: number;
  streakBonus: number;
  precisionStreakBonus: number;
  difficultyBonus: number;
  wordCountBonus: number;
  penaltyAmount: number;
  bonusXP: number;
  netXP: number;
  floor: number; // min XP (default 5)
}

export interface StreakData {
  dailyStreak: number;
  precisionStreak: number; // Consecutive 95%+ accuracy sessions
  lastActivityDate: Date;
  streakMultiplier: number;
  isActive: boolean;
}

export interface LevelProgression {
  currentLevel: number;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpRequired: number;
  progress: number; // 0-100%
  levelUpReward?: {
    bonusXP: number;
    unlockedFeatures: string[];
    badge?: string;
  };
}

// ============================================
// MAIN RESULT TYPE
// ============================================

export interface AccuracyResult {
  // Core Scores
  overall: number;
  adjustedOverall: number;
  categoryScores: CategoryScores;
  
  // Advanced Analysis (Tier-dependent)
  tone?: ToneAnalysis;
  readability?: ReadabilityMetrics;
  vocabularyAnalysis?: VocabularyAnalysis;
  coherenceAnalysis?: CoherenceAnalysis;
  styleAnalysis?: StyleAnalysis;
  premiumInsights?: PremiumInsights;
  
  // Errors & Feedback
  errors: ErrorDetail[];
  feedback: string[];
  suggestions: string[];
  
  // Statistics
  statistics: MessageStatistics;
  
  // AI Analysis
  aiResponseAnalysis: AIResponseAnalysis;
  
  // User Insights
  insights: UserInsights;
  
  // XP & Rewards
  xp: XPCalculation;
  streak?: StreakData;
  levelProgression?: LevelProgression;
  
  // Metadata
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  processingTime: number;
  confidenceScore: number;
  detectionSources: string[]; // Which detection engines were used
  cacheHit?: boolean;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface TierConfig {
  maxFeedbackPoints: number;
  detailedExplanations: boolean;
  toneAnalysis: boolean;
  readabilityMetrics: boolean;
  vocabularyAnalysis: boolean;
  coherenceAnalysis: boolean;
  styleAnalysis: boolean;
  premiumInsights: boolean;
  advancedGrammar: boolean;
  contextualSuggestions: boolean;
  alternativePhrasing: boolean;
  idiomaticExpressions: boolean;
  xpMultiplier: number;
  priorityProcessing: boolean;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  nlpToolsEnabled: {
    languagetool: boolean;
    gpt: boolean;
    spacy: boolean;
    contextualSpellcheck: boolean;
  };
}

export interface AnalysisConfig {
  userTier: UserTier;
  userId?: string;
  previousAccuracy?: number;
  userLevel?: UserProficiencyLevel;
  /**
   * Optional ISO language code (e.g., "en-US") to guide NLP detectors
   */
  language?: string;
  weightProfile?: WeightProfile;
  enableCache?: boolean;
  timeoutMs?: number;
  fallbackToRegex?: boolean;
}

// ============================================
// NLP INTEGRATION TYPES
// ============================================

export interface NLPResponse {
  source: 'languagetool' | 'gpt' | 'spacy' | 'regex';
  errors: ErrorDetail[];
  confidence: number;
  processingTime: number;
  cached?: boolean;
}

export interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  context: { text: string; offset: number; length: number };
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: { id: string; name: string };
  };
}

export interface GPTFluencyScore {
  score: number; // 0-100
  reasoning: string;
  improvements: string[];
  strengths: string[];
  confidence: number;
}

export interface SpacySyntaxAnalysis {
  dependencies: Array<{
    text: string;
    dep: string;
    head: string;
    pos: string;
  }>;
  entities: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
  }>;
  issues: ErrorDetail[];
}

// ============================================
// PERFORMANCE METRICS
// ============================================

export interface PerformanceMetrics {
  totalTime: number;
  detectionTime: number;
  scoringTime: number;
  xpCalculationTime: number;
  cacheHits: number;
  cacheMisses: number;
  nlpCallsCount: number;
}

export default {
  // Export all types for easy import
};
