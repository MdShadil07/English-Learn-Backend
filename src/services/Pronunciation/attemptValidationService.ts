import {
  alignWordSequences,
  calculateWordAlignmentConfidence,
  tokenizeForAlignment,
} from './alignment/wordSequenceAligner.js';

export type AttemptClassification =
  | 'valid_reading'
  | 'partial_reading'
  | 'wrong_passage'
  | 'random_speech'
  | 'native_language'
  | 'low_audio_quality'
  | 'silence';

export interface AttemptValidationInput {
  expectedTranscript: string;
  recognizedTranscript: string;
  asrConfidence: number;
  metadata?: Record<string, unknown>;
}

export interface AttemptValidationResult {
  classification: AttemptClassification;
  isScoreable: boolean;
  expectedTranscript: string;
  recognizedTranscript: string;
  reason: string;
  recommendation: string;
  metrics: {
    similarity: number;
    insertionRatio: number;
    omissionRatio: number;
    matchedRatio: number;
    expectedWordCount: number;
    recognizedWordCount: number;
    asrConfidence: number;
    audioQualityScore?: number;
    silenceRatio?: number;
    speechToNoiseRatio?: number;
    detectedLanguage: 'english' | 'non_english' | 'unknown';
    semanticSimilarity?: number;
    semanticConfidence?: number;
    alignmentSimilarity?: number;
  };
}

export class AttemptValidationService {
  validate(input: AttemptValidationInput): AttemptValidationResult {
    const expectedTranscript = input.expectedTranscript.trim();
    const recognizedTranscript = input.recognizedTranscript.trim();
    const expectedWords = tokenizeForAlignment(expectedTranscript);
    const recognizedWords = tokenizeForAlignment(recognizedTranscript);
    const qualityMetrics = ((input.metadata?.qualityMetrics || {}) as Record<string, unknown>);
    const audioQualityScore = this.readNumber(qualityMetrics.audioQualityScore);
    const silenceRatio = this.readNumber(qualityMetrics.silenceRatio);
    const speechToNoiseRatio = this.readNumber(qualityMetrics.speechToNoiseRatio);
    const language = this.detectEnglishVsNonEnglish(recognizedTranscript);

    if (!recognizedWords.length || (silenceRatio !== undefined && silenceRatio >= 0.94)) {
      return this.result(input, 'silence', false, {
        similarity: 0,
        insertionRatio: 0,
        omissionRatio: 1,
        matchedRatio: 0,
        expectedWordCount: expectedWords.length,
        recognizedWordCount: recognizedWords.length,
        audioQualityScore,
        silenceRatio,
        speechToNoiseRatio,
        detectedLanguage: language,
      });
    }

    if ((audioQualityScore !== undefined && audioQualityScore < 25) || (speechToNoiseRatio !== undefined && speechToNoiseRatio < 1.5)) {
      return this.result(input, 'low_audio_quality', false, {
        similarity: 0,
        insertionRatio: 0,
        omissionRatio: 0,
        matchedRatio: 0,
        expectedWordCount: expectedWords.length,
        recognizedWordCount: recognizedWords.length,
        audioQualityScore,
        silenceRatio,
        speechToNoiseRatio,
        detectedLanguage: language,
      });
    }

    if (language === 'non_english') {
      return this.result(input, 'native_language', false, {
        similarity: 0,
        insertionRatio: 0,
        omissionRatio: 1,
        matchedRatio: 0,
        expectedWordCount: expectedWords.length,
        recognizedWordCount: recognizedWords.length,
        audioQualityScore,
        silenceRatio,
        speechToNoiseRatio,
        detectedLanguage: language,
      });
    }

    const pairs = alignWordSequences(expectedWords, recognizedWords);
    const similarity = calculateWordAlignmentConfidence(pairs);
    const insertions = pairs.filter((pair) => pair.operation === 'insertion').length;
    const omissions = pairs.filter((pair) => pair.operation === 'deletion').length;
    const strongMatches = pairs.filter((pair) => pair.targetWord && pair.actualWord && pair.confidence >= 0.82).length;
    const insertionRatio = insertions / Math.max(1, recognizedWords.length);
    const omissionRatio = omissions / Math.max(1, expectedWords.length);
    const matchedRatio = strongMatches / Math.max(1, expectedWords.length);
    const metrics = {
      similarity,
      insertionRatio: Number(insertionRatio.toFixed(2)),
      omissionRatio: Number(omissionRatio.toFixed(2)),
      matchedRatio: Number(matchedRatio.toFixed(2)),
      expectedWordCount: expectedWords.length,
      recognizedWordCount: recognizedWords.length,
      audioQualityScore,
      silenceRatio,
      speechToNoiseRatio,
      detectedLanguage: language,
    };

    if (similarity > 0.15 || matchedRatio >= 0.10) {
      return this.result(input, 'valid_reading', true, metrics);
    }

    if (matchedRatio >= 0.10 && omissionRatio >= 0.20) {
      return this.result(input, 'partial_reading', false, metrics);
    }

    if ((insertionRatio > 0.85 || (matchedRatio < 0.10 && recognizedWords.length >= Math.max(4, expectedWords.length * 0.6))) && similarity < 0.20) {
      return this.result(input, 'random_speech', false, metrics);
    }

    if (similarity < 0.20) {
      return this.result(input, 'wrong_passage', false, metrics);
    }

    return this.result(input, 'partial_reading', false, metrics);
  }

  private result(
    input: AttemptValidationInput,
    classification: AttemptClassification,
    isScoreable: boolean,
    metrics: Omit<AttemptValidationResult['metrics'], 'asrConfidence'>
  ): AttemptValidationResult {
    const copy = this.copyFor(classification);
    return {
      classification,
      isScoreable,
      expectedTranscript: input.expectedTranscript,
      recognizedTranscript: input.recognizedTranscript,
      reason: copy.reason,
      recommendation: copy.recommendation,
      metrics: {
        ...metrics,
        asrConfidence: input.asrConfidence,
      },
    };
  }

  private copyFor(classification: AttemptClassification) {
    switch (classification) {
      case 'valid_reading':
        return {
          reason: 'Your speech matched the target passage closely enough for pronunciation scoring.',
          recommendation: 'Review the detailed pronunciation feedback below.',
        };
      case 'partial_reading':
        return {
          reason: 'Your recording matched only part of the target passage, so detailed pronunciation scoring would be misleading.',
          recommendation: 'Please read the full displayed passage clearly and completely.',
        };
      case 'wrong_passage':
        return {
          reason: 'Your recording appears to contain a different passage than the one provided.',
          recommendation: 'Please read the displayed passage exactly as shown.',
        };
      case 'random_speech':
        return {
          reason: 'Your recording contained speech that could not be reliably matched with the target passage.',
          recommendation: 'Please record again and read only the displayed passage.',
        };
      case 'native_language':
        return {
          reason: 'It looks like you spoke in another language instead of the target English passage.',
          recommendation: 'Please retry in English and read the displayed passage clearly.',
        };
      case 'low_audio_quality':
        return {
          reason: 'The audio quality was too poor for reliable pronunciation analysis.',
          recommendation: 'Please retry in a quieter place or move closer to the microphone.',
        };
      case 'silence':
        return {
          reason: 'No clear speech was detected in the recording.',
          recommendation: 'Please check your microphone and read the passage aloud.',
        };
    }
  }

  private detectEnglishVsNonEnglish(text: string): 'english' | 'non_english' | 'unknown' {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'unknown';
    }

    const nonLatinChars = Array.from(trimmed).filter((char) => /[^\u0000-\u024F\s.,!?'"’()-]/u.test(char)).length;
    if (nonLatinChars / Math.max(1, Array.from(trimmed).length) > 0.15) {
      return 'non_english';
    }

    const englishFunctionWords = new Set(['the', 'a', 'an', 'for', 'to', 'of', 'and', 'is', 'are', 'was', 'were', 'in', 'on', 'with']);
    const words = tokenizeForAlignment(trimmed);
    const functionWordCount = words.filter((word) => englishFunctionWords.has(word.toLowerCase())).length;
    return functionWordCount > 0 || words.length <= 4 ? 'english' : 'unknown';
  }

  private readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
}
