/**
 * 🎯 MODULAR ANALYZER INTERFACE
 * 
 * This interface defines the contract for all language analyzers (grammar, vocabulary, spelling, fluency, pronunciation).
 * It enables reusability across different features like AI chat, pronunciation practice, and writing assessment.
 * 
 * Benefits:
 * - Consistent API across all analyzers
 * - Easy to add new analyzers (e.g., pronunciation, coherence)
 * - Modular and testable
 * - Reusable across different features
 */

export interface AnalyzerInput {
  text: string;
  context?: string;
  options?: AnalyzerOptions;
}

export interface AnalyzerOptions {
  language?: string;
  proficiencyLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  tier?: 'free' | 'pro' | 'premium';
  enableCache?: boolean;
  timeout?: number;
}

export interface AnalyzerResult {
  score: number;
  confidence: number;
  errors: AnalyzerError[];
  suggestions: string[];
  metrics?: Record<string, number>;
  processingTime: number;
  source: string;
}

export interface AnalyzerError {
  type: string;
  category: string;
  severity: 'critical' | 'major' | 'high' | 'medium' | 'low' | 'suggestion';
  message: string;
  position?: { start: number; end: number };
  suggestion: string;
  explanation?: string;
}

export interface IAnalyzer {
  name: string;
  version: string;
  
  /**
   * Analyze the input text and return results
   */
  analyze(input: AnalyzerInput): Promise<AnalyzerResult>;
  
  /**
   * Check if the analyzer is available (e.g., external service is up)
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get the confidence level of this analyzer
   */
  getConfidence(): number;
  
  /**
   * Get the priority of this analyzer (lower = higher priority)
   */
  getPriority(): number;
}

/**
 * Pronunciation-specific analyzer interface
 * Extends IAnalyzer with pronunciation-specific metrics
 */
export interface IPronunciationAnalyzer extends IAnalyzer {
  analyze(input: AnalyzerInput & {
    audioFeatures?: AudioFeatures;
  }): Promise<PronunciationResult>;
}

export interface AudioFeatures {
  duration: number;
  speechRate: number;
  pauseCount: number;
  pauseDuration: number;
  pitchVariation: number;
  volumeVariation: number;
}

export interface PronunciationResult extends AnalyzerResult {
  pronunciationMetrics: {
    overall: number;
    prosody: number;
    intelligibility: number;
    pacing: number;
    stress: number;
  };
  signals: {
    punctuationVariety: number;
    fillerInstances: number;
    connectorCount: number;
    stressIndicators: number;
  };
  phonemeAnalysis?: {
    correct: number;
    incorrect: number;
    total: number;
    details: Array<{
      phoneme: string;
      expected: string;
      actual: string;
      score: number;
    }>;
  };
}

/**
 * Factory function to create analyzers
 */
export type AnalyzerFactory = (options?: AnalyzerOptions) => IAnalyzer;

/**
 * Registry for all available analyzers
 */
export interface AnalyzerRegistry {
  register(name: string, factory: AnalyzerFactory): void;
  get(name: string): IAnalyzer | null;
  getAll(): IAnalyzer[];
  getAvailable(): Promise<IAnalyzer[]>;
}
