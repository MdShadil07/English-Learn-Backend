/**
 * Backward-compatible lightweight accuracy gateway.
 *
 * This module now delegates to the canonical `unifiedAccuracyCalculators` implementation
 * and maps the comprehensive `UnifiedAccuracyResult` down to a simpler `AccuracyAnalysis`
 * shape used by legacy callers.
 */
import { analyzeMessage as analyzeUnified } from './unifiedAccuracyCalculators.js';

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

export const analyzeMessage = async (
  userMessage: string,
  aiResponse?: string
): Promise<AccuracyAnalysis> => {
  if (!userMessage || userMessage.trim().length === 0) {
    return {
      overall: 0,
      grammar: 0,
      vocabulary: 0,
      spelling: 0,
      fluency: 0,
      feedback: [],
      errors: [],
      suggestions: [],
    };
  }

  const unified = await analyzeUnified(userMessage, aiResponse ?? '', {
    enableNLP: false,
    enableWeightedCalculation: false,
  });

  const overall = Math.round(unified.adjustedOverall ?? unified.overall ?? 0);
  const feedback = unified.feedback ?? [];
  const suggestions = unified.suggestions ?? [];
  const errors = (unified.errors ?? []).map((e: any) => (typeof e === 'string' ? e : e.message ?? JSON.stringify(e)));

  return {
    overall,
    grammar: unified.grammar ?? 0,
    vocabulary: unified.vocabulary ?? 0,
    spelling: unified.spelling ?? 0,
    fluency: unified.fluency ?? 0,
    feedback,
    errors,
    suggestions,
  };
};

/**
 * Analyze grammar patterns
 */
function analyzeGrammar(message: string, sentences: string[]): number {
  let score = 100;

  if (sentences.length === 0) return 0;

  sentences.forEach(sentence => {
    const trimmed = sentence.trim();

    // Check for basic sentence structure
    if (trimmed.length > 10) {
      if (!trimmed.includes(' ') || trimmed.split(' ').length < 3) {
        score -= 15;
      }
    }

    // Check for common grammar issues
    if (trimmed.includes(' i ')) {
      score -= 10;
    }
    if (trimmed.includes(' dont ')) {
      score -= 5;
    }
    if (trimmed.includes(' cant ')) {
      score -= 5;
    }
    if (trimmed.includes(' wont ')) {
      score -= 5;
    }

    // Check for subject-verb agreement (basic)
    const words = trimmed.split(' ');
    if (words.length > 2) {
      const firstWord = words[0].toLowerCase();
      const secondWord = words[1].toLowerCase();

      // Basic heuristic for subject-verb agreement
      if (firstWord === 'i' && !secondWord.startsWith('am')) {
        score -= 10;
      }
    }
  });

  return Math.max(0, score);
}

/**
 * Analyze vocabulary usage
 */
function analyzeVocabulary(words: string[]): number {
  let score = 100;

  if (words.length === 0) return 0;

  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when', 'why', 'how',
    'what', 'who', 'which', 'where', 'when', 'why', 'how'
  ]);

  const uniqueWords = new Set(words.filter(word =>
    word.length > 2 && !commonWords.has(word.toLowerCase())
  ));

  // Bonus for vocabulary diversity
  const diversityRatio = uniqueWords.size / words.length;
  score += diversityRatio * 50;

  // Penalty for repetition
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length > 2) {
      wordCounts.set(cleanWord, (wordCounts.get(cleanWord) || 0) + 1);
    }
  });

  const repeatedWords = Array.from(wordCounts.values()).filter(count => count > 3).length;
  score -= repeatedWords * 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Analyze spelling patterns
 */
function analyzeSpelling(message: string): number {
  let score = 100;

  // Common misspellings
  const commonMisspellings: Record<string, string> = {
    'teh': 'the',
    'recieve': 'receive',
    'seperate': 'separate',
    'occured': 'occurred',
    'definately': 'definitely',
    'neccessary': 'necessary',
    'begining': 'beginning',
    'acheive': 'achieve',
    'buisness': 'business',
    'thier': 'their',
    'there': 'their',
    'theyre': 'they are',
    'its': 'it is',
    'dont': 'do not',
    'cant': 'cannot',
    'wont': 'will not'
  };

  Object.keys(commonMisspellings).forEach(misspelling => {
    if (message.toLowerCase().includes(misspelling)) {
      score -= 20;
    }
  });

  // Check for excessive capitalization (might indicate poor spelling awareness)
  const capitalLetters = message.replace(/[^A-Z]/g, '').length;
  const totalLetters = message.replace(/[^a-zA-Z]/g, '').length;

  if (totalLetters > 0) {
    const capitalRatio = capitalLetters / totalLetters;
    if (capitalRatio > 0.3) {
      score -= (capitalRatio - 0.3) * 100;
    }
  }

  // Check for random numbers or symbols (might indicate poor keyboard skills)
  const symbols = message.replace(/[a-zA-Z0-9\s]/g, '').length;
  if (symbols > message.length * 0.1) {
    score -= 15;
  }

  return Math.max(0, score);
}

/**
 * Analyze fluency and naturalness
 */
function analyzeFluency(message: string, sentences: string[]): number {
  let score = 100;

  if (sentences.length === 0) return 0;

  // Average sentence length (ideal: 10-20 words)
  const avgSentenceLength = message.split(/\s+/).length / sentences.length;
  if (avgSentenceLength < 5) score -= 20;
  else if (avgSentenceLength > 30) score -= 15;

  // Variety in sentence structure
  const shortSentences = sentences.filter(s => s.trim().split(/\s+/).length < 5).length;
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 20).length;

  if (shortSentences > sentences.length * 0.5) score -= 15;
  if (longSentences > sentences.length * 0.3) score -= 10;

  // Check for filler words overuse
  const fillerWords = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'kind of', 'sort of'];
  fillerWords.forEach(filler => {
    const count = (message.toLowerCase().match(new RegExp(filler.replace(' ', '\\s+'), 'g')) || []).length;
    score -= count * 5;
  });

  // Check for run-on sentences
  const runOnSentences = sentences.filter(s => s.trim().split(',').length > 3).length;
  score -= runOnSentences * 10;

  return Math.max(0, score);
}

/**
 * Generate feedback and suggestions
 */
function generateFeedback(analysis: AccuracyAnalysis, message: string, sentences: string[]): void {
  analysis.feedback = [];
  analysis.errors = [];
  analysis.suggestions = [];

  // Grammar feedback
  if (analysis.grammar < 70) {
    analysis.feedback.push("Try to use complete sentences with proper subject-verb agreement.");
    if (message.includes(' i ')) {
      analysis.errors.push("Use 'I' instead of ' i '");
      analysis.suggestions.push("Capitalize 'I' when referring to yourself.");
    }
  }

  // Vocabulary feedback
  if (analysis.vocabulary < 70) {
    analysis.feedback.push("Try using more varied vocabulary words in your responses.");
    analysis.suggestions.push("Read more to expand your vocabulary.");
  }

  // Spelling feedback
  if (analysis.spelling < 80) {
    analysis.feedback.push("Check your spelling carefully before sending messages.");
    analysis.suggestions.push("Use a spell checker or dictionary when unsure.");
  }

  // Fluency feedback
  if (analysis.fluency < 70) {
    analysis.feedback.push("Try to speak in complete thoughts and avoid filler words.");
    analysis.suggestions.push("Take time to think before responding.");
  }

  // Overall feedback
  if (analysis.overall > 85) {
    analysis.feedback.push("Great job! Your English is very clear and well-structured.");
  } else if (analysis.overall > 70) {
    analysis.feedback.push("Good effort! Keep practicing to improve your accuracy.");
  } else {
    analysis.feedback.push("Keep working on your English skills. Practice makes perfect!");
  }
}
