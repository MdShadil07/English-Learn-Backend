import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ExpectedWordPhonemeData } from '../alignment/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const normalizeWord = (word: string) => word.toLowerCase().replace(/[^a-z']/g, '');
const stripStress = (phoneme: string) => phoneme.replace(/[0-2]/g, '');
const getStress = (phoneme: string) => {
  const match = phoneme.match(/([0-2])/);
  return match ? Number(match[1]) : 0;
};
const isVowelPhoneme = (phoneme: string) =>
  /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)/.test(stripStress(phoneme));

/**
 * Common Indian English words not in CMU dictionary.
 * Maps to ARPAbet phoneme sequences (with stress markers).
 */
const INDIAN_ENGLISH_SUPPLEMENT: Record<string, string[]> = {
  prepone: ['P', 'R', 'IY1', 'P', 'OW2', 'N'],
  revert: ['R', 'IH0', 'V', 'ER1', 'T'],
  lakh: ['L', 'AA1', 'K'],
  lakhs: ['L', 'AA1', 'K', 'S'],
  crore: ['K', 'R', 'AO1', 'R'],
  crores: ['K', 'R', 'AO1', 'R', 'Z'],
  rupee: ['R', 'UW1', 'P', 'IY0'],
  rupees: ['R', 'UW1', 'P', 'IY0', 'Z'],
  diwali: ['D', 'IH0', 'W', 'AA1', 'L', 'IY0'],
  namaste: ['N', 'AH0', 'M', 'AH0', 'S', 'T', 'EY1'],
  chai: ['CH', 'AY1'],
  bengaluru: ['B', 'EH1', 'NG', 'G', 'AH0', 'L', 'UW2', 'R', 'UW0'],
  chennai: ['CH', 'EH1', 'N', 'AY2'],
  mumbai: ['M', 'UH1', 'M', 'B', 'AY2'],
  delhi: ['D', 'EH1', 'L', 'IY0'],
  kolkata: ['K', 'OW0', 'L', 'K', 'AA1', 'T', 'AH0'],
  hyderabad: ['HH', 'AY1', 'D', 'ER0', 'AH0', 'B', 'AE2', 'D'],
  pune: ['P', 'UW1', 'N', 'EY0'],
  ahmedabad: ['AA1', 'M', 'AH0', 'D', 'AH0', 'B', 'AE2', 'D'],
  jaipur: ['JH', 'AY1', 'P', 'UH2', 'R'],
  lucknow: ['L', 'AH1', 'K', 'N', 'AW2'],
  chandigarh: ['CH', 'AE1', 'N', 'D', 'IH0', 'G', 'AA2', 'R'],
  bhopal: ['B', 'OW1', 'P', 'AA2', 'L'],
  gurgaon: ['G', 'UH1', 'R', 'G', 'AA2', 'N'],
  noida: ['N', 'OY1', 'D', 'AH0'],
  needful: ['N', 'IY1', 'D', 'F', 'AH0', 'L'],
  timepass: ['T', 'AY1', 'M', 'P', 'AE2', 'S'],
  godown: ['G', 'OW1', 'D', 'AW2', 'N'],
  mugging: ['M', 'AH1', 'G', 'IH0', 'NG'],
  fresher: ['F', 'R', 'EH1', 'SH', 'ER0'],
  updation: ['AH1', 'P', 'D', 'EY2', 'SH', 'AH0', 'N'],
  intimation: ['IH2', 'N', 'T', 'AH0', 'M', 'EY1', 'SH', 'AH0', 'N'],
};

/**
 * Letter-cluster to ARPAbet G2P rules.
 * Ordered by decreasing specificity so longer patterns are matched first.
 */
const G2P_RULES: Array<[RegExp, string[]]> = [
  // Multi-letter digraphs/trigraphs
  [/tion/g, ['SH', 'AH0', 'N']],
  [/sion/g, ['ZH', 'AH0', 'N']],
  [/ough/g, ['AO1']],
  [/ight/g, ['AY1', 'T']],
  [/ould/g, ['UH1', 'D']],
  [/ture/g, ['CH', 'ER0']],
  [/sure/g, ['SH', 'ER0']],
  [/th/g, ['TH']],
  [/sh/g, ['SH']],
  [/ch/g, ['CH']],
  [/ph/g, ['F']],
  [/wh/g, ['W']],
  [/ck/g, ['K']],
  [/ng/g, ['NG']],
  [/qu/g, ['K', 'W']],
  [/oo/g, ['UW1']],
  [/ee/g, ['IY1']],
  [/ea/g, ['IY1']],
  [/ou/g, ['AW1']],
  [/ow/g, ['OW1']],
  [/ai/g, ['EY1']],
  [/ay/g, ['EY1']],
  [/oi/g, ['OY1']],
  [/oy/g, ['OY1']],
  [/au/g, ['AO1']],
  [/aw/g, ['AO1']],
  [/er/g, ['ER0']],
  [/ir/g, ['ER0']],
  [/ur/g, ['ER0']],
  [/or/g, ['AO1', 'R']],
  [/ar/g, ['AA1', 'R']],
  // Single letters
  [/a/g, ['AE1']],
  [/e/g, ['EH1']],
  [/i/g, ['IH1']],
  [/o/g, ['AA1']],
  [/u/g, ['AH1']],
  [/y/g, ['IY0']],
  [/b/g, ['B']],
  [/c/g, ['K']],
  [/d/g, ['D']],
  [/f/g, ['F']],
  [/g/g, ['G']],
  [/h/g, ['HH']],
  [/j/g, ['JH']],
  [/k/g, ['K']],
  [/l/g, ['L']],
  [/m/g, ['M']],
  [/n/g, ['N']],
  [/p/g, ['P']],
  [/r/g, ['R']],
  [/s/g, ['S']],
  [/t/g, ['T']],
  [/v/g, ['V']],
  [/w/g, ['W']],
  [/x/g, ['K', 'S']],
  [/z/g, ['Z']],
];

const PAST_INDICATORS = new Set(['did', 'had', 'was', 'were', 'yesterday', 'ago', 'already', 'earlier']);
const MODAL_VERBS = new Set(['will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'shall', 'do', 'does', 'did']);

const tokenizeSentence = (sentence: string) =>
  sentence
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export class PronunciationLexiconService {
  private dictionary = new Map<string, string[][]>();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Ensures the CMU dictionary is loaded. Safe to call multiple times —
   * only the first call actually reads from disk.
   */
  async ensureLoaded() {
    if (this.loaded) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadDictionary();
    await this.loadPromise;
  }

  private async _loadDictionary() {
    // 1. Try the bundled JSON dictionary first (built by buildCmuDictionary.mjs)
    const jsonPaths = [
      process.env.CMU_DICTIONARY_JSON_PATH,
      path.resolve(__dirname, '..', '..', '..', 'data', 'cmu-dict.json'),
      path.resolve(__dirname, '..', '..', '..', '..', 'data', 'cmu-dict.json'),
    ].filter(Boolean) as string[];

    for (const jsonPath of jsonPaths) {
      try {
        const raw = await fs.readFile(jsonPath, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, string[]>;
        for (const [word, phonemes] of Object.entries(parsed)) {
          const variant = Array.isArray(phonemes) && phonemes.every((item) => typeof item === 'string')
            ? [phonemes as string[]]
            : (phonemes as unknown as string[][]);
          this.dictionary.set(word, variant);
        }
        console.log(`✅ CMU dictionary loaded: ${this.dictionary.size.toLocaleString()} words from ${jsonPath}`);
        break;
      } catch {
        // Try next path
      }
    }

    // 2. Fallback: try the plain-text CMU dict format (MFA_DICTIONARY_PATH)
    if (!this.dictionary.size && process.env.MFA_DICTIONARY_PATH) {
      try {
        const contents = await fs.readFile(process.env.MFA_DICTIONARY_PATH, 'utf8');
        for (const rawLine of contents.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith(';;;')) {
            continue;
          }

          const parts = line.split(/\s+/);
          if (parts.length < 2) {
            continue;
          }

          const entryWord = normalizeWord(parts[0].replace(/\(\d+\)$/, ''));
          if (!entryWord) {
            continue;
          }

          const variant = parts.slice(1).map((p) => p.toUpperCase());
          const existing = this.dictionary.get(entryWord) || [];
          existing.push(variant);
          this.dictionary.set(entryWord, existing);
        }
        console.log(`✅ CMU dictionary loaded from MFA_DICTIONARY_PATH: ${this.dictionary.size.toLocaleString()} words`);
      } catch (err) {
        console.warn(`⚠️ Failed to load MFA dictionary from ${process.env.MFA_DICTIONARY_PATH}:`, err);
      }
    }

    // 3. Add Indian English supplement words
    for (const [word, phonemes] of Object.entries(INDIAN_ENGLISH_SUPPLEMENT)) {
      const existing = this.dictionary.get(word) || [];
      existing.push(phonemes);
      this.dictionary.set(word, existing);
    }

    if (!this.dictionary.size) {
      console.error(
        '❌ CRITICAL: CMU dictionary could not be loaded from any source. ' +
        'Pronunciation scoring will use G2P fallback which is less accurate. ' +
        'Run: node scripts/buildCmuDictionary.mjs to build the dictionary.'
      );
    }

    this.loaded = true;
    this.loadPromise = null;
  }

  get wordCount() {
    return this.dictionary.size;
  }

  async getExpectedWordData(
    word: string,
    options: { sentence?: string; wordIndex?: number; targetWord?: string } = {}
  ): Promise<ExpectedWordPhonemeData> {
    await this.ensureLoaded();
    const normalized = normalizeWord(word);
    const candidates = this.dictionary.get(normalized);

    const selectedPhonemes = candidates && candidates.length > 0
      ? this.choosePronunciationVariant(normalized, candidates, options)
      : this.g2pPhonemize(normalized || word);

    return this.buildExpectedWordData(word, selectedPhonemes);
  }

  async getPhonemesForWord(
    word: string,
    options: { sentence?: string; wordIndex?: number; targetWord?: string } = {}
  ): Promise<string[]> {
    const expected = await this.getExpectedWordData(word, options);
    return expected.expectedPhonemes;
  }

  /**
   * Rule-based Grapheme-to-Phoneme conversion.
   * Much more accurate than the old letter-by-letter approach.
   * Processes longest patterns first to handle digraphs correctly.
   */
  private choosePronunciationVariant(
    normalized: string,
    variants: string[][],
    options: { sentence?: string; wordIndex?: number; targetWord?: string }
  ) {
    if (!variants.length) {
      return ['AH0'];
    }

    if (variants.length === 1) {
      return variants[0];
    }

    const words = options.sentence ? tokenizeSentence(options.sentence) : [normalized];
    const index = typeof options.wordIndex === 'number'
      ? options.wordIndex
      : words.findIndex((token) => normalizeWord(token) === normalized);
    const sense = this.inferPronunciationSense(normalized, words, index, options.targetWord);

    const best = variants.find((variant) => this.variantMatchesSense(normalized, variant, sense));
    return best || variants[0];
  }

  private inferPronunciationSense(
    normalized: string,
    sentenceWords: string[],
    wordIndex: number,
    targetWord?: string
  ) {
    const lowerTarget = targetWord ? normalizeWord(targetWord) : '';
    const word = normalized.toLowerCase();
    const previous = sentenceWords[wordIndex - 1]?.toLowerCase() || '';
    const next = sentenceWords[wordIndex + 1]?.toLowerCase() || '';
    const sentence = sentenceWords.map((w) => w.toLowerCase());
    const hasPastSignal = sentence.some((token) => PAST_INDICATORS.has(token));
    const hasModal = sentence.some((token) => MODAL_VERBS.has(token));

    if (word === 'read') {
      if (lowerTarget === 'red' || hasPastSignal || previous === 'already' || previous === 'did' || previous === 'had') {
        return 'past';
      }
      if (previous === 'to' || hasModal || next === 'the' || next === 'a' || next === 'an') {
        return 'present';
      }
      return hasPastSignal ? 'past' : 'present';
    }

    if (word === 'lead') {
      if (next === 'a' || next === 'the' || next === 'an' || next === 'this' || next === 'that') {
        return 'noun';
      }
      if (previous === 'to' || hasModal || previous === 'will' || previous === 'can') {
        return 'verb';
      }
      return 'noun';
    }

    if (word === 'wind') {
      if (next === 'up' || previous === 'to' || hasModal) {
        return 'verb';
      }
      if (next === 'the' || next === 'a' || next === 'an' || next === 'this') {
        return 'noun';
      }
      return 'verb';
    }

    if (word === 'live') {
      if (previous === 'to' || previous === 'will' || hasModal) {
        return 'verb';
      }
      if (next === 'in' || next === 'on' || next === 'near' || next === 'at' || next === 'by') {
        return 'verb';
      }
      return 'adjective';
    }

    if (word === 'bow') {
      if (next === 'down' || previous === 'to' || hasModal) {
        return 'verb';
      }
      return 'noun';
    }

    return 'default';
  }

  private variantMatchesSense(word: string, variant: string[], sense: string) {
    const normalizedSense = sense || 'default';
    const sound = variant.map(stripStress).join(' ');

    if (word === 'read') {
      return normalizedSense === 'past'
        ? sound.includes('EH D')
        : sound.includes('IY D');
    }

    if (word === 'lead') {
      return normalizedSense === 'noun'
        ? sound.includes('IY D')
        : normalizedSense === 'verb'
        ? sound.includes('EH D')
        : true;
    }

    if (word === 'wind') {
      return normalizedSense === 'noun'
        ? sound.includes('IH N D') || sound.includes('IH D') || sound.includes('IH D')
        : normalizedSense === 'verb'
        ? sound.includes('AY N D')
        : true;
    }

    if (word === 'live') {
      return normalizedSense === 'verb'
        ? sound.includes('AY V') || sound.includes('IY V')
        : normalizedSense === 'adjective'
        ? sound.includes('IH V') || sound.includes('AH V')
        : true;
    }

    if (word === 'bow') {
      return normalizedSense === 'verb'
        ? sound.includes('OW')
        : normalizedSense === 'noun'
        ? sound.includes('AW')
        : true;
    }

    return true;
  }

  private g2pPhonemize(word: string): string[] {
    const lower = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!lower) {
      return ['AH0'];
    }

    const phonemes: string[] = [];
    let remaining = lower;

    while (remaining.length > 0) {
      let matched = false;

      for (const [pattern, replacement] of G2P_RULES) {
        pattern.lastIndex = 0;
        if (remaining.match(new RegExp(`^${pattern.source}`))) {
          const matchStr = remaining.match(new RegExp(`^${pattern.source}`))?.[0];
          if (matchStr) {
            phonemes.push(...replacement);
            remaining = remaining.slice(matchStr.length);
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        // Skip unknown characters
        remaining = remaining.slice(1);
      }
    }

    return phonemes.length > 0 ? phonemes : ['AH0'];
  }

  private buildExpectedWordData(word: string, phonemes: string[]): ExpectedWordPhonemeData {
    const stress = phonemes
      .filter((phoneme) => isVowelPhoneme(phoneme))
      .map((phoneme) => getStress(phoneme));

    return {
      word,
      normalizedWord: normalizeWord(word),
      expectedPhonemes: phonemes.map((phoneme) => stripStress(phoneme)),
      expectedStress: stress,
      expectedSyllables: Math.max(1, stress.length || phonemes.filter((phoneme) => isVowelPhoneme(phoneme)).length),
    };
  }
}
