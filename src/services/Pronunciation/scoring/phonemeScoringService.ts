import { PronunciationLexiconService } from './pronunciationLexiconService.js';
import { logger } from '../../../utils/calculators/core/logger.js';
import {
  alignWordSequences,
  calculateWordAlignmentConfidence,
  tokenizeForAlignment,
} from '../alignment/wordSequenceAligner.js';
import type {
  ForcedAlignmentResult,
  PhonemeTimelineEvent,
  PhonemeLevelPronunciationAnalysis,
  PronunciationScoringResult,
  WordLevelPronunciationAnalysis,
  AlignmentPhoneInterval,
} from '../alignment/types.js';

const VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
const isVowel = (phoneme: string) => VOWELS.has(phoneme);
const WORD_SCORING_CONFIDENCE_THRESHOLD = 0.6;

export class PhonemeScoringService {
  private readonly lexicon = new PronunciationLexiconService();
  private readonly debugLogsEnabled = process.env.PRONUNCIATION_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

  async scoreAlignedPronunciation(targetTranscript: string, alignment: ForcedAlignmentResult): Promise<PronunciationScoringResult> {
    const targetWords = tokenizeForAlignment(targetTranscript);
    const alignedWords = alignment.wordIntervals;
    const pairedWords = alignWordSequences(targetWords, alignedWords.map((word) => word.word));

    const wordAnalysis: WordLevelPronunciationAnalysis[] = [];
    const phonemeAnalysis: PhonemeLevelPronunciationAnalysis[] = [];
    const phonemeTimeline: PhonemeTimelineEvent[] = [];

    if (this.debugLogsEnabled) {
      logger.info(
        {
          targetTranscript,
          alignmentTranscript: alignment.transcript,
          normalizedTranscript: alignment.normalizedTranscript,
          provider: alignment.provider,
          targetWordCount: targetWords.length,
          alignedWordCount: alignedWords.length,
          wordAlignment: pairedWords,
        },
        'Pronunciation scoring started'
      );

      logger.debug(
        {
          alignedWords: alignedWords.map((word) => ({
            word: word.word,
            normalizedWord: word.normalizedWord,
            phonemes: word.phonemes.map((item) => item.phoneme),
            startTime: word.startTime,
            endTime: word.endTime,
            durationMs: word.durationMs,
          })),
        },
        'Aligned pronunciation word intervals'
      );
    }

    for (const pair of pairedWords) {
      if (!pair.targetWord) {
        if (pair.actualIndex !== null) {
          const alignedWord = alignedWords[pair.actualIndex];
          const actualPhonemes = alignedWord?.phonemes?.map((item) => item.phoneme) || [];
          const componentScores = {
            phonemeCorrectness: 0,
            consonantCompletion: 0,
            vowelQuality: 0,
            stressCorrectness: 0,
            durationTiming: 0,
          };

          wordAnalysis.push({
            word: alignedWord?.word ?? 'unknown',
            expectedPhonemes: [],
            expectedStress: [],
            expectedSyllables: 0,
            actualPhonemes,
            severity: 2,
            score: 0,
            startTime: alignedWord?.startTime || 0,
            endTime: alignedWord?.endTime || 0,
            issueType: 'insertion',
            alignmentConfidence: pair.confidence,
            alignedWord: alignedWord?.word ?? null,
            componentScores,
          });

          actualPhonemes.forEach((phoneme) => {
            phonemeTimeline.push({
              phoneme,
              expected: '',
              actual: phoneme,
              confidence: 0,
              startTime: alignedWord?.startTime || 0,
              endTime: alignedWord?.endTime || 0,
              issueType: 'insertion',
              severity: 'high',
              taxonomy: 'insertion',
            });
          });
        }
        continue;
      }

      const targetWord = pair.targetWord;
      const alignedWord = pair.actualIndex !== null ? alignedWords[pair.actualIndex] : null;
      const expectedWord = await this.lexicon.getExpectedWordData(targetWord, {
        sentence: alignment.transcript,
        wordIndex: pair.targetIndex ?? undefined,
        targetWord: pair.targetWord,
      });
      const expectedPhonemes = expectedWord.expectedPhonemes;

      if (!alignedWord || pair.confidence < WORD_SCORING_CONFIDENCE_THRESHOLD) {
        const componentScores = {
          phonemeCorrectness: 0,
          consonantCompletion: 0,
          vowelQuality: 0,
          stressCorrectness: 0,
          durationTiming: 0,
        };

        // Try to extract actual phonemes even with low confidence
        const actualPhonemes = alignedWord?.phonemes?.map((item) => item.phoneme) || [];

        wordAnalysis.push({
          word: targetWord,
          expectedPhonemes,
          expectedStress: expectedWord.expectedStress,
          expectedSyllables: expectedWord.expectedSyllables,
          actualPhonemes,
          severity: 2,
          score: 0,
          startTime: alignedWord?.startTime || 0,
          endTime: alignedWord?.endTime || 0,
          issueType: pair.operation === 'deletion' ? 'omission' : 'alignment',
          alignmentConfidence: pair.confidence,
          alignedWord: alignedWord?.word ?? null,
          componentScores,
        });

        expectedPhonemes.forEach((phoneme) => {
          phonemeTimeline.push({
            phoneme,
            expected: phoneme,
            actual: '',
            confidence: 0,
            startTime: 0,
            endTime: 0,
            issueType: 'deletion',
            severity: 'high',
            taxonomy: 'omission',
          });
        });

        logger.warn(
          {
            targetWord,
            alignedWord: alignedWord?.word ?? null,
            alignmentConfidence: pair.confidence,
            operation: pair.operation,
          },
          'Skipped phoneme scoring for low-confidence word alignment'
        );

        continue;
      }

      let actualPhonemes = alignedWord?.phonemes?.map((item) => item.phoneme) || [];
      if (alignedWord && pair.targetWord && alignedWord.word.toLowerCase() !== pair.targetWord.toLowerCase()) {
        const actualWordData = await this.lexicon.getExpectedWordData(alignedWord.word, {
          sentence: alignment.transcript,
          wordIndex: pair.actualIndex ?? undefined,
          targetWord: pair.targetWord,
        });
        if (actualWordData.expectedPhonemes.length === actualPhonemes.length) {
          actualPhonemes = actualWordData.expectedPhonemes;
          alignedWord.phonemes = alignedWord.phonemes.map((interval, index) => ({
            ...interval,
            phoneme: actualPhonemes[index],
          }));
        }
      }

      const comparison = this.comparePhonemeSequences(expectedPhonemes, actualPhonemes);
      const componentScores = this.calculateComponentScores(expectedPhonemes, actualPhonemes, comparison, alignedWord?.durationMs || 0, expectedWord.expectedSyllables);
      const score = this.combineComponentScores(componentScores);
      const severity = score >= 90 ? 0 : score >= 75 ? 1 : 2;
      const issueType = score >= 90 ? 'stable' : this.resolvePrimaryIssueType(comparison.events);

      if (this.debugLogsEnabled) {
        logger.debug(
          {
            targetWord,
            alignedWord: alignedWord?.word ?? null,
            wordAlignmentConfidence: pair.confidence,
            expectedPhonemes,
            actualPhonemes,
            comparisonEvents: comparison.events,
            componentScores,
            score,
            severity,
            issueType,
            alignedWordDurationMs: alignedWord?.durationMs,
            expectedSyllables: expectedWord.expectedSyllables,
          },
          'Pronunciation word scoring details'
        );
      }

      wordAnalysis.push({
        word: targetWord,
        expectedPhonemes,
        expectedStress: expectedWord.expectedStress,
        expectedSyllables: expectedWord.expectedSyllables,
        actualPhonemes,
        severity,
        score,
        startTime: alignedWord?.startTime || 0,
        endTime: alignedWord?.endTime || 0,
        issueType,
        alignmentConfidence: pair.confidence,
        alignedWord: alignedWord.word,
        componentScores,
      });

      let actualPhoneCursor = 0;
      comparison.events.forEach((event, index) => {
        const phoneInterval = event.actual ? alignedWord.phonemes[actualPhoneCursor] : undefined;
        if (event.actual) {
          actualPhoneCursor += 1;
        }
        const timeline = this.createTimelineEvent(event, index, alignedWord, phoneInterval);
        phonemeTimeline.push(timeline);
        phonemeAnalysis.push({
          phoneme: event.expected || event.actual || 'UNK',
          expected: event.expected || '',
          actual: event.actual || '',
          confidence: timeline.confidence,
          issueType: timeline.issueType,
          severity: timeline.severity,
          taxonomy: timeline.taxonomy,
          startTime: timeline.startTime,
          endTime: timeline.endTime,
        });
      });
    }

    const pronunciationScore = Math.round(wordAnalysis.reduce((sum, item) => sum + item.score, 0) / Math.max(1, wordAnalysis.length));
    const substitutionCount = phonemeAnalysis.filter((item) => item.taxonomy === 'substitution').length;
    const omissionCount = phonemeAnalysis.filter((item) => item.taxonomy === 'omission').length;
    const insertionCount = phonemeAnalysis.filter((item) => item.taxonomy === 'insertion').length;
    const totalPhonemes = Math.max(1, phonemeAnalysis.length);
    const clarityScore = Math.max(0, Math.round(100 - ((substitutionCount + omissionCount) / totalPhonemes) * 100));
    const errorRate = (substitutionCount + omissionCount + insertionCount) / totalPhonemes;
    const fluencyScore = Math.max(0, Math.min(100, Math.round(100 - (errorRate * 60) - (wordAnalysis.filter((item) => item.score < 70).length * 4))));
    const stressScore = Math.max(0, Math.round(wordAnalysis.reduce((sum, item) => sum + (item.componentScores?.stressCorrectness || 0), 0) / Math.max(1, wordAnalysis.length)));
    // Intonation: weighted blend of stress accuracy and fluency (proxy for pitch variation)
    const intonationScore = Math.max(0, Math.round(stressScore * 0.55 + fluencyScore * 0.30 + clarityScore * 0.15));
    const weakestWords = wordAnalysis.filter((item) => item.score < 82).slice(0, 4);
    const alignmentConfidence = this.calculateAlignmentConfidence(alignment, phonemeTimeline, pairedWords);
    const mtiLikelihood = this.detectMtiPatterns(phonemeTimeline);

    if (this.debugLogsEnabled) {
      logger.info(
        {
          pronunciationScore,
          fluencyScore,
          clarityScore,
          stressScore,
          intonationScore,
          alignmentConfidence,
          substitutionCount,
          omissionCount,
          insertionCount,
          totalPhonemes,
          weakestWords: weakestWords.map((item) => item.word),
        },
        'Pronunciation aggregate score calculation'
      );
    }

    return {
      wordAnalysis,
      phonemeAnalysis,
      phonemeTimeline,
      scores: {
        pronunciation: pronunciationScore,
        fluency: fluencyScore,
        stress: stressScore,
        intonation: intonationScore,
        clarity: clarityScore,
      },
      prosodyAnalysis: {
        averageSpeakingRate: this.calculateSpeakingRate(alignedWords),
        pauseCount: this.calculatePauseCount(alignedWords),
        pauseTotalMs: this.calculatePauseTotal(alignedWords),
        pauseRatio: this.calculatePauseRatio(alignedWords),
        rhythmVariance: this.calculateRhythmVariance(alignedWords),
        hesitationCount: this.calculateHesitationCount(alignedWords),
        stressFlow: this.calculateStressFlow(alignedWords, stressScore),
        alignedWordCount: alignedWords.length,
        provider: alignment.provider,
        timingSource: alignment.metadata.timingSource,
        timingQuality: alignment.metadata.timingQuality,
        phoneCount: alignment.metadata.phoneCount,
      },
      drillRecommendations: weakestWords.map((item) => ({
        type: 'phoneme-repeat',
        word: item.word,
        instruction: `Repeat "${item.word}" slowly, focusing on ${item.expectedPhonemes.join(' ')}.`,
      })),
      metadata: {
        scoringMode: alignment.provider === 'mfa' ? 'alignment_driven' : 'fallback',
        alignedWordCount: alignedWords.length,
        targetWordCount: targetWords.length,
        alignmentConfidence,
        mtiLikelihood,
      },
    };
  }

  private calculateSpeakingRate(words: ForcedAlignmentResult['wordIntervals']) {
    if (!words.length) {
      return 0;
    }
    const totalDurationMs = Math.max(1, words[words.length - 1].endTime - words[0].startTime);
    return Math.round((words.length / totalDurationMs) * 60000);
  }

  private calculatePauseGaps(words: ForcedAlignmentResult['wordIntervals']) {
    const gaps: number[] = [];
    for (let index = 1; index < words.length; index += 1) {
      const gap = words[index].startTime - words[index - 1].endTime;
      if (gap > 0) {
        gaps.push(gap);
      }
    }
    return gaps;
  }

  private calculatePauseCount(words: ForcedAlignmentResult['wordIntervals']) {
    return this.calculatePauseGaps(words).filter((gap) => gap >= 300).length;
  }

  private calculatePauseTotal(words: ForcedAlignmentResult['wordIntervals']) {
    return this.calculatePauseGaps(words).filter((gap) => gap >= 300).reduce((sum, gap) => sum + gap, 0);
  }

  private calculatePauseRatio(words: ForcedAlignmentResult['wordIntervals']) {
    if (!words.length) {
      return 0;
    }
    const totalDurationMs = Math.max(1, words[words.length - 1].endTime - words[0].startTime);
    return Number((this.calculatePauseTotal(words) / totalDurationMs).toFixed(2));
  }

  private calculateRhythmVariance(words: ForcedAlignmentResult['wordIntervals']) {
    if (words.length < 2) {
      return 0;
    }
    const durations = words.map((word) => Math.max(1, word.durationMs));
    const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const variance = durations.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / durations.length;
    const coefficient = Math.sqrt(variance) / Math.max(1, mean);
    return Number(Math.min(1, coefficient).toFixed(2));
  }

  private calculateHesitationCount(words: ForcedAlignmentResult['wordIntervals']) {
    return this.calculatePauseGaps(words).filter((gap) => gap >= 600).length;
  }

  private calculateStressFlow(words: ForcedAlignmentResult['wordIntervals'], stressScore: number) {
    const pauseRatio = this.calculatePauseRatio(words);
    const rhythmVariance = this.calculateRhythmVariance(words);
    const flow = stressScore * 0.55 + (1 - pauseRatio) * 100 * 0.25 + (1 - rhythmVariance) * 100 * 0.20;
    return Math.max(0, Math.min(100, Math.round(flow)));
  }

  private comparePhonemeSequences(expected: string[], actual: string[]) {
    const matrix = Array.from({ length: expected.length + 1 }, () =>
      Array.from({ length: actual.length + 1 }, () => 0)
    );

    for (let i = 0; i <= expected.length; i += 1) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= actual.length; j += 1) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= expected.length; i += 1) {
      for (let j = 1; j <= actual.length; j += 1) {
        const cost = expected[i - 1] === actual[j - 1] ? 0 : this.phonemeSubstitutionCost(expected[i - 1], actual[j - 1]);
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const events: Array<{ type: 'match' | 'substitution' | 'insertion' | 'deletion'; expected?: string; actual?: string }> = [];
    let i = expected.length;
    let j = actual.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && matrix[i][j] === matrix[i - 1][j - 1] && expected[i - 1] === actual[j - 1]) {
        events.unshift({ type: 'match', expected: expected[i - 1], actual: actual[j - 1] });
        i -= 1;
        j -= 1;
      } else if (i > 0 && j > 0 && matrix[i][j] === matrix[i - 1][j - 1] + 1) {
        events.unshift({ type: 'substitution', expected: expected[i - 1], actual: actual[j - 1] });
        i -= 1;
        j -= 1;
      } else if (i > 0 && matrix[i][j] === matrix[i - 1][j] + 1) {
        events.unshift({ type: 'deletion', expected: expected[i - 1] });
        i -= 1;
      } else {
        events.unshift({ type: 'insertion', actual: actual[j - 1] });
        j -= 1;
      }
    }

    return { distance: matrix[expected.length][actual.length], events };
  }

  private phonemeSubstitutionCost(expected: string, actual: string) {
    const normalizedExpected = expected.replace(/[0-2]/g, '');
    const normalizedActual = actual.replace(/[0-2]/g, '');

    const softVowelMatches: Record<string, string[]> = {
      AE: ['EH', 'AH'],
      EH: ['AE', 'EY', 'IH'],
      IH: ['IY', 'EH'],
      IY: ['IH', 'EY'],
      UH: ['UW'],
      UW: ['UH'],
      AA: ['AH'],
      AO: ['OW'],
      ER: ['UR'],
      OW: ['AO'],
      EY: ['EH', 'IY'],
    };

    const softConsonantMatches: Record<string, string[]> = {
      TH: ['T', 'D'],
      D: ['T', 'DH'],
      T: ['D', 'TH'],
      V: ['W'],
      W: ['V'],
      Z: ['JH', 'S'],
      SH: ['S'],
      S: ['SH'],
      L: ['R'],
      R: ['L'],
    };

    if (softVowelMatches[normalizedExpected]?.includes(normalizedActual)) {
      return 0.4;
    }
    if (softConsonantMatches[normalizedExpected]?.includes(normalizedActual)) {
      return 0.4;
    }
    if (softVowelMatches[normalizedActual]?.includes(normalizedExpected)) {
      return 0.4;
    }
    if (softConsonantMatches[normalizedActual]?.includes(normalizedExpected)) {
      return 0.4;
    }

    return 1;
  }

  private calculateComponentScores(
    expected: string[],
    actual: string[],
    comparison: ReturnType<PhonemeScoringService['comparePhonemeSequences']>,
    actualDurationMs: number,
    expectedSyllables: number
  ) {
    const totalEvents = Math.max(1, comparison.events.length);
    const substitutionCount = comparison.events.filter((event) => event.type === 'substitution').length;
    const deletionCount = comparison.events.filter((event) => event.type === 'deletion').length;
    const insertionCount = comparison.events.filter((event) => event.type === 'insertion').length;
    const vowelMismatchCount = comparison.events.filter((event) => event.expected && event.actual && isVowel(event.expected) && event.expected !== event.actual).length;
    const consonantOmissionCount = comparison.events.filter((event) => event.type === 'deletion' && event.expected && !isVowel(event.expected)).length;
    const actualSyllables = actual.filter((phoneme) => isVowel(phoneme)).length || expectedSyllables;

    const phonemeCorrectness = Math.max(0, Math.round(100 - ((comparison.distance / Math.max(1, expected.length, actual.length)) * 100)));
    const consonantCompletion = Math.max(0, 100 - Math.round((consonantOmissionCount / Math.max(1, expected.filter((phoneme) => !isVowel(phoneme)).length)) * 100));
    const vowelQuality = Math.max(0, 100 - Math.round((vowelMismatchCount / Math.max(1, expected.filter((phoneme) => isVowel(phoneme)).length)) * 100));
    const stressCorrectness = Math.max(0, 100 - Math.round((Math.abs(expectedSyllables - actualSyllables) / Math.max(1, expectedSyllables)) * 100));
    const expectedDurationMs = Math.max(180, expected.length * 85);
    const durationTiming = Math.max(0, 100 - Math.round((Math.abs(expectedDurationMs - actualDurationMs) / Math.max(expectedDurationMs, 1)) * 100));

    return {
      phonemeCorrectness,
      consonantCompletion,
      vowelQuality,
      stressCorrectness,
      durationTiming: Math.max(durationTiming, totalEvents > 0 ? 100 - Math.round((insertionCount + substitutionCount) / totalEvents * 35) : durationTiming),
    };
  }

  private combineComponentScores(componentScores: {
    phonemeCorrectness: number;
    consonantCompletion: number;
    vowelQuality: number;
    stressCorrectness: number;
    durationTiming: number;
  }) {
    // Weights calibrated for Indian English speakers:
    // - Stress raised to 0.20 (syllable-timed rhythm is #1 intelligibility issue)
    // - Vowel quality raised to 0.20 (Indian languages have different vowel inventories)
    // - Duration timing lowered to 0.06 (least reliable without F0 analysis)
    return Math.round(
      (componentScores.phonemeCorrectness * 0.32)
      + (componentScores.consonantCompletion * 0.22)
      + (componentScores.vowelQuality * 0.20)
      + (componentScores.stressCorrectness * 0.20)
      + (componentScores.durationTiming * 0.06)
    );
  }

  private resolvePrimaryIssueType(events: Array<{ type: 'match' | 'substitution' | 'insertion' | 'deletion'; expected?: string; actual?: string }>) {
    if (events.some((event) => event.type === 'substitution')) {
      return 'pronunciation';
    }
    if (events.some((event) => event.type === 'deletion')) {
      return 'clarity';
    }
    if (events.some((event) => event.type === 'insertion')) {
      return 'fluency';
    }
    return 'stable';
  }

  private createTimelineEvent(
    event: { type: 'match' | 'substitution' | 'insertion' | 'deletion'; expected?: string; actual?: string },
    index: number,
    alignedWord?: ForcedAlignmentResult['wordIntervals'][number] | null,
    phoneInterval?: AlignmentPhoneInterval
  ): PhonemeTimelineEvent {
    if (phoneInterval) {
      return {
        phoneme: event.expected || event.actual || 'UNK',
        expected: event.expected || '',
        actual: event.actual || '',
        confidence: this.resolveEventConfidence(event, phoneInterval),
        startTime: phoneInterval.startTime,
        endTime: phoneInterval.endTime,
        issueType: event.type,
        severity: this.resolveEventSeverity(event),
        taxonomy: this.resolveEventTaxonomy(event),
      };
    }

    const totalDuration = Math.max(80, alignedWord?.durationMs || 0);
    const span = Math.max(50, Math.floor(totalDuration / Math.max(1, alignedWord?.phonemes.length || 1)));
    const startTime = (alignedWord?.startTime || 0) + (index * span);
    const endTime = alignedWord ? Math.min(alignedWord.endTime, startTime + span) : startTime + span;
    const taxonomy = this.resolveEventTaxonomy(event);
    const severity = this.resolveEventSeverity(event);
    const confidence = this.resolveEventConfidence(event);

    return {
      phoneme: event.expected || event.actual || 'UNK',
      expected: event.expected || '',
      actual: event.actual || '',
      confidence,
      startTime,
      endTime,
      issueType: event.type,
      severity,
      taxonomy,
    };
  }

  private resolveEventTaxonomy(event: { type: 'match' | 'substitution' | 'insertion' | 'deletion' }) {
    return event.type === 'substitution'
      ? 'substitution'
      : event.type === 'deletion'
      ? 'omission'
      : event.type === 'insertion'
      ? 'insertion'
      : 'fluency';
  }

  private resolveEventSeverity(event: { type: 'match' | 'substitution' | 'insertion' | 'deletion' }) {
    return event.type === 'match'
      ? 'low'
      : event.type === 'substitution' || event.type === 'deletion'
      ? 'high'
      : 'medium';
  }

  private resolveEventConfidence(
    event: { type: 'match' | 'substitution' | 'insertion' | 'deletion' },
    phoneInterval?: AlignmentPhoneInterval
  ) {
    if (typeof phoneInterval?.confidence === 'number') {
      return phoneInterval.confidence;
    }
    if (phoneInterval?.source === 'mfa') {
      return event.type === 'match' ? 0.9 : event.type === 'substitution' ? 0.7 : 0.55;
    }
    return event.type === 'match' ? 0.78 : event.type === 'substitution' ? 0.52 : 0.42;
  }

  private calculateAlignmentConfidence(
    alignment: ForcedAlignmentResult,
    timeline: PhonemeTimelineEvent[],
    pairs: ReturnType<typeof alignWordSequences>
  ) {
    if (!alignment.wordIntervals.length || !timeline.length) {
      return 0;
    }
    const matched = timeline.filter((event) => event.issueType === 'match').length;
    const phonemeConfidence = matched / Math.max(1, timeline.length);
    const wordConfidence = calculateWordAlignmentConfidence(pairs);
    const providerMultiplier =
      alignment.provider === 'mfa' ? 1.0
      : alignment.provider === 'whisper-timestamps' ? 0.88
      : 0.65;
    return Number((Math.min(wordConfidence, phonemeConfidence) * providerMultiplier).toFixed(2));
  }

  /**
   * Comprehensive Mother Tongue Influence (MTI) detection.
   * Covers patterns across major Indian languages:
   * Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi.
   */
  private detectMtiPatterns(timeline: PhonemeTimelineEvent[]) {
    const reasons: string[] = [];
    let signal = 0;
    const subs = timeline.filter((e) => e.issueType === 'substitution');
    const omissions = timeline.filter((e) => e.taxonomy === 'omission');

    const count = (expected: string, actual: string) =>
      subs.filter((e) => e.expected === expected && e.actual === actual).length;
    const countAny = (expected: string, actuals: string[]) =>
      subs.filter((e) => e.expected === expected && actuals.includes(e.actual)).length;

    // --- Hindi / Urdu / Punjabi belt ---
    const thToT = count('TH', 'T') + count('TH', 'D');
    if (thToT >= 1) { reasons.push('TH→T/D: dental fricative replaced with stop (Hindi/Punjabi pattern).'); signal += 0.25; }

    const vwConfusion = count('V', 'W') + count('W', 'V');
    if (vwConfusion >= 1) { reasons.push('V↔W confusion (Hindi/Gujarati/Marathi pattern).'); signal += 0.20; }

    // --- Bengali / Assamese ---
    const fToP = count('F', 'P');
    if (fToP >= 1) { reasons.push('F→P: labiodental replaced with bilabial (Bengali/Assamese pattern).'); signal += 0.20; }

    const lrConfusion = count('L', 'R') + count('R', 'L');
    if (lrConfusion >= 1) { reasons.push('L↔R confusion (Bengali pattern).'); signal += 0.15; }

    // --- Tamil / Malayalam ---
    const zToJ = count('Z', 'JH') + count('Z', 'S');
    if (zToJ >= 1) { reasons.push('Z→J/S: voiced fricative confusion (Tamil/Malayalam pattern).'); signal += 0.20; }

    const shToS = count('SH', 'S') + count('S', 'SH');
    if (shToS >= 1) { reasons.push('SH↔S sibilant confusion (Tamil/Telugu pattern).'); signal += 0.15; }

    // --- Telugu / Kannada ---
    const pToB = count('P', 'B') + count('B', 'P');
    if (pToB >= 1) { reasons.push('P↔B voicing confusion (Telugu/Kannada pattern).'); signal += 0.10; }

    const tToD = count('T', 'D') + count('D', 'T');
    if (tToD >= 1) { reasons.push('T↔D voicing confusion (Telugu/Kannada pattern).'); signal += 0.10; }

    // --- All Indian languages ---
    const consonantDrops = omissions.filter((e) => !isVowel(e.expected)).length;
    if (consonantDrops >= 2) { reasons.push('Final consonant dropping (common across Indian languages).'); signal += 0.15; }

    // Vowel lengthening: short vowel → long vowel (Tamil, Telugu, Kannada)
    const vowelLengthening = count('IH', 'IY') + count('UH', 'UW') + count('AH', 'AA') + count('EH', 'EY');
    if (vowelLengthening >= 2) { reasons.push('Short→long vowel substitution (South Indian pattern).'); signal += 0.15; }

    // Cluster simplification: "school" → "iskool" (Tamil, Telugu)
    const insertions = timeline.filter((e) => e.taxonomy === 'insertion' && isVowel(e.actual)).length;
    if (insertions >= 2) { reasons.push('Vowel insertion in consonant clusters (South Indian pattern).'); signal += 0.15; }

    // Aspirated stop over-aspiration (Hindi, Marathi, Punjabi)
    const aspirationSubs = countAny('P', ['PH']) + countAny('T', ['TH']) + countAny('K', ['KH']);
    if (aspirationSubs >= 1) { reasons.push('Over-aspiration of stops (Hindi/Marathi/Punjabi pattern).'); signal += 0.10; }

    // Classify the likely language influence
    const label = signal >= 0.60
      ? this.classifyMtiRegion(reasons)
      : signal >= 0.30
      ? 'possible_indian_english'
      : 'undetermined';

    return {
      label,
      confidence: Number(Math.min(0.95, signal).toFixed(2)),
      reasons,
    };
  }

  private classifyMtiRegion(reasons: string[]): string {
    const text = reasons.join(' ').toLowerCase();
    if (text.includes('bengali') || text.includes('assamese')) return 'bengali_influenced_english';
    if (text.includes('tamil') || text.includes('malayalam')) return 'south_indian_influenced_english';
    if (text.includes('telugu') || text.includes('kannada')) return 'south_indian_influenced_english';
    if (text.includes('hindi') || text.includes('punjabi')) return 'hindi_influenced_english';
    if (text.includes('gujarati') || text.includes('marathi')) return 'western_indian_influenced_english';
    return 'indian_english';
  }
}
