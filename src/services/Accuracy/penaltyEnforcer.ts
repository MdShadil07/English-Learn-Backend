import type {
  UnifiedAccuracyResult,
  UserTier,
} from '../../utils/calculators/unifiedAccuracyCalculators.js';
import type { IAccuracyData } from '../../models/Progress.js';
import type { LanguageDetectionSummary } from '../NLP/languageDetectionService.js';
import { CEFR_COMBINED_WORDSET } from '../NLP/vocabAnalyzer.js';
import { normalizeEnglishToken, tokenizeAsciiWords } from '../../utils/text/englishNormalizer.js';


const NON_LATIN_REGEX = /[^\u0000-\u007f]/g;
const HINDI_REGEX = /[\u0900-\u097F]/g;

const ENGLISH_RATIO_CONFIDENCE_THRESHOLD = 0.55;
const MIN_ENGLISH_WORDS_FOR_CONFIDENCE = 8;
const MIN_KNOWN_RATIO_FOR_CONFIDENCE = 0.05;
const LEXICAL_PENALTY_THRESHOLD = 0.2;
const MAX_LEXICAL_PENALTY = 10;
const MAX_NON_ENGLISH_PENALTY = 45;

const BASIC_ENGLISH_WORDS = new Set<string>([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'them', 'us',
  'hello', 'hi', 'thanks', 'thank', 'please', 'sorry', 'good', 'bad', 'yes', 'no',
  'ok', 'okay', 'sure', 'fine', 'great', 'nice', 'job', 'cool',
  'learn', 'practice', 'english', 'help', 'need', 'want', 'like', 'love', 'do', 'does', 'did',
  'am', 'are', 'is', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
  'what', 'when', 'where', 'why', 'how', 'can', 'could', 'will', 'would', 'should', 'maybe',
  'today', 'tomorrow', 'lesson', 'word', 'sentence', 'speak', 'talk', 'understand', 'teacher',
  'student', 'practice', 'study', 'improve', 'learned', 'learning', 'language', 'write', 'read'
]);

const ACADEMIC_ENGLISH_WORDS = new Set<string>([
  'research', 'researcher', 'researchers', 'study', 'studies', 'participant', 'participants',
  'participation', 'analysis', 'analyses', 'analyze', 'analyzed', 'evaluate', 'evaluation', 'assess',
  'assessment', 'metric', 'metrics', 'significant', 'significance', 'significantly', 'improvement',
  'improve', 'impact', 'impacts', 'result', 'results', 'finding', 'findings', 'concentration',
  'performance', 'development', 'evidence', 'conclusion', 'conclusions', 'experiment', 'experiments',
  'academic', 'cognitive', 'behavior', 'behaviour', 'learning', 'outcome', 'outcomes', 'level', 'levels',
  'measure', 'measured', 'measurement', 'data'
]);

const ENGLISH_VOCAB_DICTIONARY: Set<string> = (() => {
  const dictionary = new Set<string>();
  const addWord = (word: string): void => {
    const normalized = word.toLowerCase();
    if (normalized) {
      dictionary.add(normalized);
    }
  };

  BASIC_ENGLISH_WORDS.forEach(addWord);
  CEFR_COMBINED_WORDSET.forEach(addWord);
  ACADEMIC_ENGLISH_WORDS.forEach(addWord);

  return dictionary;
})();

export const ensureStatistics = (
  stats?: UnifiedAccuracyResult['statistics']
): UnifiedAccuracyResult['statistics'] => {
  if (!stats) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      complexWordCount: 0,
      uniqueWordRatio: 0,
      errorCount: 0,
      criticalErrorCount: 0,
      errorsByCategory: {},
      processingTime: 0,
    };
  }

  return {
    ...stats,
    errorsByCategory: { ...(stats.errorsByCategory ?? {}) },
  };
};

export const buildFallbackUnifiedResult = (
  tier: UserTier,
  reason?: string,
  languageContext?: LanguageDetectionSummary
): UnifiedAccuracyResult => ({
  overall: 15,
  adjustedOverall: 15,
  grammar: 12,
  vocabulary: 10,
  spelling: 18,
  fluency: 12,
  punctuation: 20,
  capitalization: 20,
  errors: [],
  feedback: reason ? [reason] : [],
  suggestions: [],
  statistics: ensureStatistics(),
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
  tier,
  analysisDepth: tier === 'premium' ? 'comprehensive' : tier === 'pro' ? 'detailed' : 'standard',
  insights: {
    level: 'Beginner',
    confidence: 0,
    primaryCategory: 'grammar',
  },
  languageContext,
});

export const enforcePenalty = (
  result: UnifiedAccuracyResult,
  sourceText: string,
  languageContext?: LanguageDetectionSummary
): UnifiedAccuracyResult => {
  const clone: UnifiedAccuracyResult = {
    ...result,
    feedback: Array.isArray(result.feedback) ? [...result.feedback] : [],
    suggestions: Array.isArray(result.suggestions) ? [...result.suggestions] : [],
    errors: Array.isArray(result.errors) ? [...result.errors] : [],
    statistics: ensureStatistics(result.statistics),
    categoryDetails: result.categoryDetails ? { ...result.categoryDetails } : result.categoryDetails,
    languageContext: languageContext ?? result.languageContext,
  };

  const trimmed = sourceText?.trim?.() ?? '';
  if (!trimmed) {
    clone.overall = 0;
    clone.adjustedOverall = 0;
    clone.grammar = 0;
    clone.vocabulary = 0;
    clone.spelling = 0;
    clone.fluency = 0;
    clone.statistics.errorCount = Math.max(clone.statistics.errorCount, 18);
    clone.statistics.criticalErrorCount = Math.max(clone.statistics.criticalErrorCount, 9);
    clone.statistics.errorsByCategory = {
      ...clone.statistics.errorsByCategory,
      language: Math.max(clone.statistics.errorsByCategory?.language ?? 0, clone.statistics.errorCount),
      fluency: Math.max(clone.statistics.errorsByCategory?.fluency ?? 0, Math.ceil(clone.statistics.errorCount * 0.6)),
    };
    clone.currentAccuracy = {
      ...(clone.currentAccuracy ?? {}),
      overall: 0,
      adjustedOverall: 0,
      grammar: 0,
      vocabulary: 0,
      spelling: 0,
      fluency: 0,
      punctuation: 0,
      capitalization: 0,
      syntax: 0,
      coherence: 0,
    };
    clone.weightedAccuracy = {
      ...(clone.weightedAccuracy ?? clone.currentAccuracy ?? {}),
      overall: 0,
      adjustedOverall: 0,
      grammar: 0,
      vocabulary: 0,
      spelling: 0,
      fluency: 0,
      punctuation: 0,
      capitalization: 0,
      syntax: 0,
      coherence: 0,
    };
    clone.errors = [
      ...clone.errors,
      {
        type: 'fluency',
        category: 'clarity',
        severity: 'critical',
        message: 'No answer received to analyze.',
        position: { start: 0, end: 0 },
        suggestion: 'Please reply in clear English sentences so we can award XP.',
        explanation: 'Empty responses do not count toward practice and will deduct XP.',
      },
    ];
    clone.feedback = [
      'We could not detect any English content in your reply.',
      'Please respond in English to earn XP and receive helpful corrections.',
    ];
    return clone;
  }

  const condensed = trimmed.replace(/\s+/g, ' ');
  const totalChars = condensed.replace(/\s/g, '').length;
  const nonLatinCount = (condensed.match(NON_LATIN_REGEX) || []).length;
  const hindiCount = (condensed.match(HINDI_REGEX) || []).length;
  const asciiWords: string[] = tokenizeAsciiWords(condensed);
  const normalizedDictionaryTokens: string[] = asciiWords
    .map((word: string) => normalizeEnglishToken(word, ENGLISH_VOCAB_DICTIONARY))
    .filter((token: string) => token.length > 0);
  const englishWordCount = asciiWords.length;
  const knownMatches = normalizedDictionaryTokens.filter((token: string) => ENGLISH_VOCAB_DICTIONARY.has(token));
  const knownRatio = englishWordCount > 0 ? knownMatches.length / englishWordCount : 0;
  const nonLatinRatio = totalChars > 0 ? nonLatinCount / totalChars : 0;
  const shortGibberish = englishWordCount > 0 && englishWordCount <= 3 && knownRatio === 0 && totalChars > 6;
  const recognizedExamples = knownMatches.length > 0
    ? Array.from(new Set(knownMatches)).slice(0, 5)
    : [];

  const penalties: string[] = [];
  let penaltyApplied = false;
  let lexicalPenaltyApplied = false;

  const detection = languageContext ?? result.languageContext;
  const detectedNonEnglish = detection?.shouldSkipEnglishChecks ?? false;
  const detectedMixed = Boolean(detection?.shouldRelaxGrammar && !detectedNonEnglish);
  const primaryLabel = detection?.primaryLanguageName || detection?.primaryLanguage;
  const englishRatio = detection?.englishRatio ?? 0;
  const detectionConfidence = detection?.probability ?? 0;
  const isPrimaryEnglish = typeof primaryLabel === 'string' && primaryLabel.toLowerCase().includes('english');
  const strongEnglishSignal = (isPrimaryEnglish && detectionConfidence >= 0.5) || englishRatio >= ENGLISH_RATIO_CONFIDENCE_THRESHOLD;
  const hasSufficientEnglishVolume = englishWordCount >= MIN_ENGLISH_WORDS_FOR_CONFIDENCE;
  const lexicalCoverageLow = englishWordCount >= 4 && knownRatio < LEXICAL_PENALTY_THRESHOLD;

  if (detectedNonEnglish) {
    penaltyApplied = true;
    penalties.push(
      primaryLabel
        ? `Detected primarily ${primaryLabel}; English-only scoring skipped.`
        : 'Detected mostly non-English characters.'
    );
  }

  const nonLatinTriggered = nonLatinRatio > 0.35 || hindiCount > 0;
  if (!penaltyApplied && nonLatinTriggered) {
    penaltyApplied = true;
    penalties.push('Your response contains mostly non-English characters.');
  }

  if (!penaltyApplied && englishWordCount === 0 && totalChars > 0) {
    penaltyApplied = true;
    penalties.push('No English words were detected in your message.');
  }

  let lexicalFlag = false;
  if (!penaltyApplied && lexicalCoverageLow) {
    lexicalFlag = true;
  }

  if (!penaltyApplied && shortGibberish) {
    penaltyApplied = true;
    penalties.push('We detected random text that does not look like English sentences.');
  }

  if (!penaltyApplied && lexicalFlag) {
    if (strongEnglishSignal && hasSufficientEnglishVolume && knownRatio >= MIN_KNOWN_RATIO_FOR_CONFIDENCE) {
      console.log('✅ [PenaltyEnforcer] Ignoring low vocabulary ratio due to strong English signal', {
        knownRatio: Number(knownRatio.toFixed(3)),
        englishWordCount,
        englishRatio: Number(englishRatio.toFixed(3)),
        recognizedExamples,
      });
    } else {
      penaltyApplied = true;
      lexicalPenaltyApplied = true;
      penalties.push('Most words were not recognized as English vocabulary.');
    }
  }

  if (penaltyApplied) {
    const baselineAccuracy = {
      overall: clone.overall,
      adjustedOverall: clone.adjustedOverall ?? clone.overall,
      grammar: clone.grammar,
      vocabulary: clone.vocabulary,
      spelling: clone.spelling,
      fluency: clone.fluency,
      punctuation: clone.punctuation ?? 0,
      capitalization: clone.capitalization ?? 0,
      syntax: clone.syntax ?? 0,
      coherence: clone.coherence ?? 0,
    };

    const applyScorePenalty = (value: number | undefined, drop: number, floor = 0): number => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return floor;
      }
      return Math.max(floor, value - drop);
    };

    let appliedPenalty = 0;
    if (detectedNonEnglish || nonLatinTriggered || englishWordCount === 0) {
      const severityMultiplier = detectedNonEnglish || nonLatinTriggered ? 1.0 : 0.7;
      const hingeMitigation = detectedMixed ? 0.35 : 0;
      const cappedPenalty = Math.min(MAX_NON_ENGLISH_PENALTY, Math.round((1 - knownRatio) * 50 * severityMultiplier));
      appliedPenalty = Math.max(18, cappedPenalty - Math.round(hingeMitigation * 20));

      console.log('⚠️ [PenaltyEnforcer] Applying non-English penalty', {
        detectedNonEnglish,
        detectedMixed,
        primaryLabel,
        nonLatinRatio: Number(nonLatinRatio.toFixed(3)),
        englishWordCount,
        knownRatio: Number(knownRatio.toFixed(3)),
        recognizedExamples,
        penalties,
      });

      clone.overall = applyScorePenalty(baselineAccuracy.overall, appliedPenalty);
      clone.adjustedOverall = applyScorePenalty(baselineAccuracy.adjustedOverall, appliedPenalty);
      clone.grammar = applyScorePenalty(baselineAccuracy.grammar, Math.round(appliedPenalty * 0.65));
      clone.vocabulary = applyScorePenalty(baselineAccuracy.vocabulary, Math.round(appliedPenalty * 0.7));
      clone.spelling = applyScorePenalty(baselineAccuracy.spelling, Math.round(appliedPenalty * 0.55));
      clone.fluency = applyScorePenalty(baselineAccuracy.fluency, Math.round(appliedPenalty * 0.6));
      clone.punctuation = applyScorePenalty(baselineAccuracy.punctuation, Math.round(appliedPenalty * 0.35));
      clone.capitalization = applyScorePenalty(baselineAccuracy.capitalization, Math.round(appliedPenalty * 0.35));
      clone.syntax = applyScorePenalty(baselineAccuracy.syntax, Math.round(appliedPenalty * 0.55));
      clone.coherence = applyScorePenalty(baselineAccuracy.coherence, Math.round(appliedPenalty * 0.6));

      const baseError = Math.max(
        clone.statistics.errorCount,
        Math.max(Math.ceil(totalChars * 0.9 * severityMultiplier), englishWordCount * 4, 18)
      );

      clone.statistics.errorCount = baseError;
      clone.statistics.criticalErrorCount = Math.max(
        clone.statistics.criticalErrorCount,
        Math.ceil(baseError * (nonLatinTriggered ? 0.75 : 0.6))
      );

      const errorsByCategory = {
        ...clone.statistics.errorsByCategory,
        language: Math.max(clone.statistics.errorsByCategory?.language ?? 0, Math.ceil(baseError * 0.9)),
        vocabulary: Math.max(clone.statistics.errorsByCategory?.vocabulary ?? 0, Math.ceil(baseError * 0.6)),
        grammar: Math.max(clone.statistics.errorsByCategory?.grammar ?? 0, Math.ceil(baseError * 0.5)),
        fluency: Math.max(clone.statistics.errorsByCategory?.fluency ?? 0, Math.ceil(baseError * 0.45)),
      };
      clone.statistics.errorsByCategory = errorsByCategory;
    } else {
      const lexicalSeverity = Math.max(0, LEXICAL_PENALTY_THRESHOLD - knownRatio);
      const severityScale = Math.min(1, lexicalSeverity / LEXICAL_PENALTY_THRESHOLD);
      appliedPenalty = Math.max(0, Math.round(severityScale * MAX_LEXICAL_PENALTY));

      if (appliedPenalty > 0 || shortGibberish) {
        const adjustedPenalty = Math.max(6, appliedPenalty);
        console.log('⚠️ [PenaltyEnforcer] Applying lexical penalty', {
          primaryLabel,
          knownRatio: Number(knownRatio.toFixed(3)),
          englishWordCount,
          dictionaryHits: knownMatches.length,
          recognizedExamples,
          adjustedPenalty,
          penalties,
        });

        clone.overall = applyScorePenalty(baselineAccuracy.overall, adjustedPenalty);
        clone.adjustedOverall = applyScorePenalty(baselineAccuracy.adjustedOverall, adjustedPenalty);
        clone.grammar = applyScorePenalty(baselineAccuracy.grammar, Math.round(adjustedPenalty * 0.45));
        clone.vocabulary = applyScorePenalty(baselineAccuracy.vocabulary, Math.round(adjustedPenalty * 0.65));
        clone.spelling = applyScorePenalty(baselineAccuracy.spelling, Math.round(adjustedPenalty * 0.3));
        clone.fluency = applyScorePenalty(baselineAccuracy.fluency, Math.round(adjustedPenalty * 0.45));
        clone.punctuation = applyScorePenalty(baselineAccuracy.punctuation, Math.round(adjustedPenalty * 0.25));
        clone.capitalization = applyScorePenalty(baselineAccuracy.capitalization, Math.round(adjustedPenalty * 0.25));
        clone.syntax = applyScorePenalty(baselineAccuracy.syntax, Math.round(adjustedPenalty * 0.35));
        clone.coherence = applyScorePenalty(baselineAccuracy.coherence, Math.round(adjustedPenalty * 0.35));

        const baselineErrors = Math.max(englishWordCount * 2, 8);
        const lexicalErrorBoost = Math.ceil(baselineErrors * (0.4 + severityScale));
        clone.statistics.errorCount = Math.max(clone.statistics.errorCount, lexicalErrorBoost);
        clone.statistics.criticalErrorCount = Math.max(
          clone.statistics.criticalErrorCount,
          Math.ceil(lexicalErrorBoost * 0.35)
        );

        const errorsByCategory = {
          ...clone.statistics.errorsByCategory,
          vocabulary: Math.max(clone.statistics.errorsByCategory?.vocabulary ?? 0, Math.ceil(lexicalErrorBoost * 0.65)),
          grammar: Math.max(clone.statistics.errorsByCategory?.grammar ?? 0, Math.ceil(lexicalErrorBoost * 0.4)),
          fluency: Math.max(clone.statistics.errorsByCategory?.fluency ?? 0, Math.ceil(lexicalErrorBoost * 0.3)),
        };
        clone.statistics.errorsByCategory = errorsByCategory;
      }
    }

    if (lexicalPenaltyApplied) {
      const grammarScore = typeof clone.grammar === 'number' && Number.isFinite(clone.grammar)
        ? clone.grammar
        : 0;
      const grammarFloor = Math.min(100, Math.round(grammarScore * 0.7));

      if (grammarFloor > 0) {
        if (typeof clone.overall !== 'number' || Number.isNaN(clone.overall) || clone.overall < grammarFloor) {
          clone.overall = grammarFloor;
        }

        const adjustedValue =
          typeof clone.adjustedOverall === 'number' && Number.isFinite(clone.adjustedOverall)
            ? clone.adjustedOverall
            : clone.overall;

        if (adjustedValue < grammarFloor) {
          clone.adjustedOverall = grammarFloor;
        }
      }
    }

    clone.errors = [
      ...clone.errors,
      {
        type: 'vocabulary',
        category: 'clarity',
        severity: 'critical',
        message: 'Non-English or low-quality content detected.',
        position: { start: 0, end: Math.min(trimmed.length, 50) },
        suggestion: 'Reply in English with simple sentences to avoid XP penalties.',
        explanation: penalties.join(' '),
      },
    ];

    clone.feedback = [
      ...penalties,
      detectedMixed
        ? 'We detected Hinglish. Only critical issues are penalized—try longer English sections for higher XP.'
        : 'Please respond in English to earn XP and get personalized feedback.',
      'Example: "I am practicing English today." Try something similar to stay on track.',
      '⚠️ XP penalty applied: random or non-English text will reduce your score.',
    ];

    const updateSnapshot = (snapshot: Partial<IAccuracyData> | undefined | null): Partial<IAccuracyData> => {
      const getDrop = (key: keyof typeof baselineAccuracy): number => {
        const baselineValue = baselineAccuracy[key] ?? 0;
        const updatedValue = (clone as unknown as Record<string, unknown>)[key];
        const normalizedUpdated = typeof updatedValue === 'number' && Number.isFinite(updatedValue)
          ? updatedValue
          : 0;
        return Math.max(0, baselineValue - normalizedUpdated);
      };

      return {
        ...(snapshot ?? {}),
        overall: clone.overall,
        adjustedOverall: clone.adjustedOverall,
        grammar: applyScorePenalty(snapshot?.grammar ?? baselineAccuracy.grammar, getDrop('grammar'), 0),
        vocabulary: applyScorePenalty(snapshot?.vocabulary ?? baselineAccuracy.vocabulary, getDrop('vocabulary'), 0),
        spelling: applyScorePenalty(snapshot?.spelling ?? baselineAccuracy.spelling, getDrop('spelling'), 0),
        fluency: applyScorePenalty(snapshot?.fluency ?? baselineAccuracy.fluency, getDrop('fluency'), 0),
        punctuation: applyScorePenalty(snapshot?.punctuation ?? baselineAccuracy.punctuation, getDrop('punctuation'), 0),
        capitalization: applyScorePenalty(snapshot?.capitalization ?? baselineAccuracy.capitalization, getDrop('capitalization'), 0),
        syntax: applyScorePenalty(snapshot?.syntax ?? baselineAccuracy.syntax, getDrop('syntax'), 0),
        coherence: applyScorePenalty(snapshot?.coherence ?? baselineAccuracy.coherence, getDrop('coherence'), 0),
      };
    };

    clone.currentAccuracy = updateSnapshot(clone.currentAccuracy);
    clone.weightedAccuracy = updateSnapshot(clone.weightedAccuracy ?? clone.currentAccuracy);

    console.log('⚠️ [PenaltyEnforcer] Post-penalty snapshots', {
      current: clone.currentAccuracy,
      weighted: clone.weightedAccuracy,
    });
  } else if (!clone.feedback || clone.feedback.length === 0) {
    clone.feedback = clone.suggestions && clone.suggestions.length > 0
      ? clone.suggestions.slice(0, 3)
      : ['Nice effort! Review the highlighted suggestions to improve further.'];
    console.log('✅ [PenaltyEnforcer] No language penalty applied');
  }

  return clone;
};
