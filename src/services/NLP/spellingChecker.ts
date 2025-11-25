/**
 * 🔤 SPELLING CHECKER SERVICE (FREE)
 * Uses Typo.js for offline spelling detection
 * Zero-cost alternative to proprietary spell checkers
 */

import Typo from 'typo-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { logger } from '../../utils/calculators/core/logger.js';
// If normalizeTypographicQuotes is defined in another file, update the import path accordingly, for example:
// import { normalizeTypographicQuotes } from '../../utils/normalizeTypographicQuotes.js';

// If it does not exist, you can define a simple version here:
function normalizeTypographicQuotes(text: string): string {
  return text
    .replace(/[‘’‛‹›`´]/g, "'")
    .replace(/[“”«»„‟]/g, '"');
}

// ES module compatibility: get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SpellingError {
  word: string;
  position: number;
  suggestions: string[];
  confidence: number;
}

class SpellingCheckerService {
  private static readonly WORD_REGEX = /^[a-zA-Z]+$/;
  private dictionary: Typo | null = null;
  private initialized: boolean = false;
  private initializationFailed: boolean = false;
  private readonly customAllowedWords = new Set<string>([
    'face-to-face',
  ]);
  // (No language-specific whitelist — spelling checks operate on detected English content only)
  
  /**
   * Initialize Typo dictionary and load optional hinglish whitelist
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      if (process.env.NODE_ENV === 'development') console.log('  ℹ️ Typo.js already initialized, skipping...');
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') console.log('  🔤 Initializing Typo.js spelling checker...');
      logger.info('🔤 Initializing Typo.js spelling checker...');

        // No whitelist is loaded here. Language-specific handling is performed upstream in the accuracy pipeline.

      // Stable path selection: prefer explicit env override, otherwise try to
      // resolve the installed `dictionary-en` package using Node resolution.
      const envPath = process.env.DICTIONARY_EN_PATH;
      let DICT_BASE: string | null = null;

      if (envPath && envPath.trim().length > 0) {
        DICT_BASE = envPath;
      } else {
        // Try Node resolution via require.resolve (works in ESM via createRequire)
        try {
          const req = createRequire(import.meta.url);
          // resolve package.json parent directory
          const pkgJson = req.resolve('dictionary-en/package.json');
          DICT_BASE = dirname(pkgJson);
        } catch (e) {
          // As a fallback, try module-relative node_modules
          const candidate = join(__dirname, '..', '..', 'node_modules', 'dictionary-en');
          if (existsSync(candidate)) DICT_BASE = candidate;
        }
      }

      if (!DICT_BASE) {
        logger.warn('dictionary-en package not found via DICTIONARY_EN_PATH, require.resolve, or local node_modules');
        this.dictionary = null;
        this.initialized = false;
        this.initializationFailed = true;
        return;
      }

      const affPath = join(DICT_BASE, 'index.aff');
      const dicPath = join(DICT_BASE, 'index.dic');

      if (!existsSync(affPath) || !existsSync(dicPath)) {
        logger.warn(`dictionary-en found at ${DICT_BASE} but index.aff/index.dic missing`);
        this.dictionary = null;
        this.initialized = false;
        this.initializationFailed = true;
        return;
      }

      const affData = readFileSync(affPath, 'utf-8');
      const dicData = readFileSync(dicPath, 'utf-8');
      try {
        this.dictionary = new Typo('en_US', affData, dicData);
      } catch (err) {
        logger.warn({ err }, 'Typo.js failed to construct dictionary instance');
        this.dictionary = null;
        this.initialized = false;
        this.initializationFailed = true;
        return;
      }
      this.initialized = true;
      this.initializationFailed = false;
      logger.info(`✅ Typo.js spelling checker initialized using ${affPath}`);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('  ❌ Failed to initialize Typo.js:', error);
      logger.warn({ error }, '⚠️ Could not load dictionary files, spelling checker disabled');
      this.dictionary = null;
      this.initialized = false;
      this.initializationFailed = true;
    }

  }
  
  /**
   * Check if a word is spelled correctly
   */
  isAvailable(): boolean {
    return !!(this.dictionary && this.initialized && !this.initializationFailed);
  }

  check(word: string): boolean {
    // If dictionary isn't available, assume correctness — don't create false negatives.
    if (!this.dictionary) return true;
    
    // Clean the word
    const normalizedInput = normalizeTypographicQuotes(word);
    const cleanWord = normalizedInput.trim().replace(/[.,!?;:"']/g, '');
    if (!cleanWord || cleanWord.length < 2) return true;
    
    // Skip numbers and special characters
    if (/^\d+$/.test(cleanWord)) return true;
    if (/^[^a-zA-Z]+$/.test(cleanWord)) return true;

    const normalized = cleanWord.toLowerCase();

    if (this.customAllowedWords.has(normalized)) {
      return true;
    }

    if (cleanWord.includes('-')) {
      const segments = cleanWord.split('-').filter(Boolean);
      if (segments.length >= 2) {
        const allSegmentsCorrect = segments.every((segment: string) => segment.length <= 1 || this.dictionary!.check(segment.toLowerCase()));
        if (allSegmentsCorrect) {
          return true;
        }
      }
    }
    
    const isCorrect = this.dictionary.check(cleanWord);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`  🔍 Checking word: "${cleanWord}"`);
      console.log(`     ${isCorrect ? '✅ Correct' : '❌ Misspelled'}`);
    }
    
    return isCorrect;
  }
  
  /**
   * Get spelling suggestions for a misspelled word
   */
  suggest(word: string): string[] {
    if (!this.dictionary) return [];
    
  const normalizedInput = normalizeTypographicQuotes(word);
  const cleanWord = normalizedInput.trim().replace(/[.,!?;:"']/g, '');
    if (!cleanWord) return [];

    const normalized = cleanWord.toLowerCase();
    if (this.customAllowedWords.has(normalized)) {
      return [];
    }

    if (cleanWord.includes('-')) {
      const segments = cleanWord.split('-').filter(Boolean);
      if (segments.length >= 2) {
        const allSegmentsCorrect = segments.every((segment: string) => segment.length <= 1 || this.dictionary!.check(segment.toLowerCase()));
        if (allSegmentsCorrect) {
          return [];
        }
      }
    }
    
    try {
      const suggestions = this.dictionary.suggest(cleanWord);
      const topSuggestions = suggestions.slice(0, 5); // Return top 5 suggestions
      
      if (process.env.NODE_ENV === 'development' && topSuggestions.length > 0) {
        console.log(`     📝 Suggestions: [${topSuggestions.slice(0, 3).map((s: string) => `"${s}"`).join(', ')}]`);
      }
      
      return topSuggestions;
    } catch (error) {
      logger.error({ error, word }, 'Error getting spelling suggestions');
      return [];
    }
  }
  
  /**
   * Analyze text for spelling errors
   */
  async analyzeText(text: string): Promise<SpellingError[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.dictionary) {
      logger.warn('Spelling checker not available');
      return [];
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📝 2.1: Spelling Analysis (Typo.js)...`);
      console.log(`  📄 Analyzing text: "${text}"`);
    }
    
  const normalizedText = normalizeTypographicQuotes(text);
  const errors: SpellingError[] = [];
  const words = normalizedText.split(/\s+/);
    let position = 0;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`  📊 Total words to check: ${words.length}`);
    }
    
    for (const word of words) {
      const cleanWord = word.replace(/[.,!?;:\"'()\[\]{}]/g, '').trim();

      // Only consider alphabetic tokens (skip punctuation, numbers, ellipses, etc.)
      if (!cleanWord || cleanWord.length < 2 || !SpellingCheckerService.WORD_REGEX.test(cleanWord)) {
        position += word.length + 1;
        continue;
      }

        // Note: Language-specific skipping (if needed) is handled by the accuracy pipeline.
        // Spelling checker assumes caller passes English-only text when appropriate.

      // Use the cleaned token for checks and suggestions
      if (!this.check(cleanWord)) {
        const suggestions = this.suggest(cleanWord);

        errors.push({
          word: cleanWord,
          position,
          suggestions,
          confidence: suggestions.length > 0 ? 0.85 : 0.70,
        });
      }

      position += word.length + 1; // +1 for space
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`  ✨ Spelling Analysis Results:`);
      console.log(`     Errors found: ${errors.length}`);
      if (errors.length > 0) {
        console.log(`     Misspelled words: [${errors.map(e => `"${e.word}"`).join(', ')}]`);
      }
    }
    
    logger.debug({ errorCount: errors.length }, 'Spelling analysis complete');
    return errors;
  }
  
  /**
   * Calculate spelling accuracy percentage
   */
  async calculateAccuracy(text: string): Promise<number> {
  const normalizedText = normalizeTypographicQuotes(text);
  if (!this.isAvailable()) {
    // Typo unavailable — return null to indicate absence of spelling detector
    return null as any;
  }
  const errors = await this.analyzeText(normalizedText);
  const words = normalizedText
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:\"'()\[\]{}]/g, '').trim())
    .filter((w: string) => w.length >= 2 && SpellingCheckerService.WORD_REGEX.test(w));
    
    if (words.length === 0) return 100;
    
    const accuracy = ((words.length - errors.length) / words.length) * 100;
    const finalAccuracy = Math.max(0, Math.min(100, accuracy));
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`  📊 Spelling Accuracy Calculation:`);
      console.log(`     Total valid words: ${words.length}`);
      console.log(`     Errors found: ${errors.length}`);
      console.log(`     Raw accuracy: ${accuracy.toFixed(2)}%`);
      console.log(`     Final accuracy: ${finalAccuracy.toFixed(2)}%`);
    }
    
    return finalAccuracy;
  }

  /**
   * Get detailed spelling report
   */
  async getReport(text: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📋 Generating Spelling Report...`);
    }

  const normalizedText = normalizeTypographicQuotes(text);
  // If Typo isn't available, return an explicit 'unavailable' report (accuracy: null)
  if (!this.isAvailable()) {
    const words = normalizedText
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?;:\"'()\[\]{}]/g, '').trim())
      .filter((w: string) => w.length >= 2 && SpellingCheckerService.WORD_REGEX.test(w));
    return {
      accuracy: null,
      totalWords: words.length,
      errorsFound: null,
      errors: [],
      source: 'typo-js-unavailable',
    };
  }

  // Run analyzeText once and compute accuracy from results to avoid duplicate Typo.js runs
  const errors = await this.analyzeText(normalizedText);
  const words = normalizedText
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:\"'()\[\]{}]/g, '').trim())
    .filter((w: string) => w.length >= 2 && SpellingCheckerService.WORD_REGEX.test(w));
  const accuracy = words.length === 0 ? 100 : ((words.length - errors.length) / words.length) * 100;
    
    const report = {
      accuracy,
      totalWords: words.length,
      errorsFound: errors.length,
      errors: errors.map(e => ({
        word: e.word,
        suggestions: e.suggestions.slice(0, 3),
        confidence: e.confidence,
      })),
      source: 'typo-js',
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`  ✅ Spelling Report Generated:`);
      console.log(`     Accuracy: ${accuracy.toFixed(2)}%`);
      console.log(`     Total words: ${words.length}`);
      console.log(`     Errors: ${errors.length}`);
      console.log(`     Source: typo-js`);
    }
    
    return report;
  }
}

// Singleton instance
export const spellingChecker = new SpellingCheckerService();

// Export types
export type { SpellingError };
export default spellingChecker;
