import { francAll } from 'franc-min';

const NON_LATIN_REGEX = /[^\u0000-\u007f]/g;
const HINDI_REGEX = /[\u0900-\u097F]/g;
const ASCII_WORD_REGEX = /[a-zA-Z]+/g;
const DEVANAGARI_WORD_REGEX = /[\u0900-\u097F]+/g;

const FRANC_WHITELIST = [
  'eng', // English
  'hin', // Hindi
  'urd', // Urdu
  'ben', // Bengali
  'pan', // Punjabi
  'guj', // Gujarati
  'mar', // Marathi
  'tam', // Tamil
  'tel', // Telugu
  'mal', // Malayalam
  'ori', // Oriya
  'kan', // Kannada
  'und', // Unknown
];

const LANGUAGE_LABELS: Record<string, string> = {
  eng: 'English',
  hin: 'Hindi',
  urd: 'Urdu',
  ben: 'Bengali',
  pan: 'Punjabi',
  guj: 'Gujarati',
  mar: 'Marathi',
  tam: 'Tamil',
  tel: 'Telugu',
  mal: 'Malayalam',
  ori: 'Odia',
  kan: 'Kannada',
  und: 'Unknown',
};

export interface LanguageDetectionSummary {
  primaryLanguage: string;
  primaryLanguageName: string;
  probability: number;
  isReliable: boolean;
  isEnglish: boolean;
  isHindi: boolean;
  isMixed: boolean;
  englishRatio: number;
  hindiRatio: number;
  nonLatinRatio: number;
  totalAlphaCount: number;
  tokens: {
    total: number;
    english: number;
    hindi: number;
    other: number;
  };
  shouldSkipEnglishChecks: boolean;
  shouldRelaxGrammar: boolean;
  analysisNotes: string[];
  scores: Array<{ language: string; score: number; label: string }>;
}

const BASELINE_DETECTION: LanguageDetectionSummary = {
  primaryLanguage: 'und',
  primaryLanguageName: 'Unknown',
  probability: 0,
  isReliable: false,
  isEnglish: false,
  isHindi: false,
  isMixed: false,
  englishRatio: 0,
  hindiRatio: 0,
  nonLatinRatio: 0,
  totalAlphaCount: 0,
  tokens: {
    total: 0,
    english: 0,
    hindi: 0,
    other: 0,
  },
  shouldSkipEnglishChecks: false,
  shouldRelaxGrammar: false,
  analysisNotes: [],
  scores: [],
};

const clampRatio = (value: number): number => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return Number(value.toFixed(3));
};

const resolveLanguageLabel = (code: string): string => LANGUAGE_LABELS[code] ?? code.toUpperCase();

export function detectLanguage(message: string | null | undefined): LanguageDetectionSummary {
  const raw = message?.trim?.() ?? '';
  if (!raw) {
    return { ...BASELINE_DETECTION };
  }

  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return { ...BASELINE_DETECTION };
  }

  const asciiWords = compact.match(ASCII_WORD_REGEX) ?? [];
  const hindiWords = compact.match(DEVANAGARI_WORD_REGEX) ?? [];
  const hindiChars = (compact.match(HINDI_REGEX) ?? []).length;
  const nonLatinChars = (compact.match(NON_LATIN_REGEX) ?? []).length;
  const asciiChars = asciiWords.reduce((sum, word) => sum + word.length, 0);
  const totalLetters = asciiChars + hindiChars;

  const englishRatio = totalLetters > 0 ? asciiChars / totalLetters : asciiWords.length > 0 ? 1 : 0;
  const hindiRatio = totalLetters > 0 ? hindiChars / totalLetters : 0;
  const nonLatinRatio = compact.replace(/\s+/g, '').length > 0
    ? nonLatinChars / compact.replace(/\s+/g, '').length
    : 0;

  const francResults = francAll(compact, {
    only: FRANC_WHITELIST,
    minLength: Math.min(60, Math.max(20, compact.length)),
  }) as Array<[string, number]>;

  const [primaryLanguage, probability = 0] = francResults[0] ?? ['und', 0];
  const englishCandidate = francResults.find(([code]) => code === 'eng');
  const hindiCandidate = francResults.find(([code]) => code === 'hin');

  const englishScore = englishCandidate?.[1] ?? 0;
  const hindiScore = hindiCandidate?.[1] ?? 0;

  const englishConfidence = Math.max(englishScore, englishRatio);
  const hindiConfidence = Math.max(hindiScore, hindiRatio);

  const isEnglish = primaryLanguage === 'eng' || englishConfidence >= 0.58;
  const isHindi = primaryLanguage === 'hin' || hindiConfidence >= 0.35;
  const isMixed = !isEnglish && !isHindi
    ? englishRatio >= 0.25 && englishRatio <= 0.75 && hindiChars > 0
    : englishRatio >= 0.2 && hindiChars > 0 && englishRatio <= 0.85;

  const shouldSkipEnglishChecks = !isEnglish && englishRatio < 0.4 && hindiChars > 0;
  const shouldRelaxGrammar = isMixed || (isHindi && englishRatio >= 0.15);

  const analysisNotes: string[] = [];
  if (shouldSkipEnglishChecks) {
    analysisNotes.push('Detected mostly non-English content; skipping English-heavy detectors.');
  } else if (isMixed) {
    analysisNotes.push('Detected Hinglish/mixed-language content; relaxing strict grammar thresholds.');
  }
  if (!shouldSkipEnglishChecks && englishRatio < 0.5) {
    analysisNotes.push('English coverage is limited; accuracy scores may be less stable.');
  }

  return {
    primaryLanguage,
    primaryLanguageName: resolveLanguageLabel(primaryLanguage),
    probability: Number(probability.toFixed(3)),
    isReliable: probability >= 0.45 || englishConfidence >= 0.65 || hindiConfidence >= 0.45,
    isEnglish,
    isHindi,
    isMixed,
    englishRatio: clampRatio(englishRatio),
    hindiRatio: clampRatio(hindiRatio),
    nonLatinRatio: clampRatio(nonLatinRatio),
    totalAlphaCount: totalLetters,
    tokens: {
      total: asciiWords.length + hindiWords.length,
      english: asciiWords.length,
      hindi: hindiWords.length,
      other: 0,
    },
    shouldSkipEnglishChecks,
    shouldRelaxGrammar,
    analysisNotes,
    scores: francResults.slice(0, 5).map(([language, score]) => ({
      language,
      score: Number(score.toFixed(3)),
      label: resolveLanguageLabel(language),
    })),
  };
}
