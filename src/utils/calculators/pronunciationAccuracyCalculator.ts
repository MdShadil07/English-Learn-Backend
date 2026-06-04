import { UnifiedAccuracyCalculator } from './unifiedAccuracyCalculators.js';
import type { 
  PronunciationScoringResult, 
  WordLevelPronunciationAnalysis,
  ForcedAlignmentResult
} from '../../services/Pronunciation/alignment/types.js';

export interface PronunciationAccuracyOptions {
  asrConfidence?: number;
  userId?: string;
  expectedTranscript: string;
  recognizedTranscript: string;
}

export class PronunciationAccuracyCalculator {
  private unifiedCalculator = new UnifiedAccuracyCalculator();

  /**
   * Evaluates the overall pronunciation accuracy incorporating acoustic signals,
   * ASR confidence, and NLP metrics (grammar/vocabulary).
   */
  public async evaluatePronunciation(
    baseScores: PronunciationScoringResult,
    options: PronunciationAccuracyOptions
  ): Promise<{
    adjustedScores: {
      pronunciation: number;
      fluency: number;
      stress: number;
      intonation: number;
      clarity: number;
      grammar?: number;
      vocabulary?: number;
    };
    nlpErrors?: any[];
  }> {
    const { asrConfidence = 1.0, expectedTranscript, recognizedTranscript } = options;
    
    console.log('[PronunciationAccuracyCalculator] evaluatePronunciation started:', {
      expectedTranscript,
      recognizedTranscript,
      asrConfidence
    });

    // 1. Get Base Metrics
    let { pronunciation, fluency, stress, intonation, clarity } = baseScores.scores;
    console.log('[PronunciationAccuracyCalculator] Base Metrics:', baseScores.scores);

    // 2. Adjust scores based on acoustic confidence (ASR)
    // We heavily penalize clarity if ASR struggles to understand the user
    const asrPenalty = Math.max(0, 1.0 - asrConfidence);
    clarity = Math.max(0, clarity - (asrPenalty * 100 * 0.8)); // Up to 80% penalty on clarity
    pronunciation = Math.max(0, pronunciation - (asrPenalty * 100 * 0.4)); // Up to 40% penalty on overall

    // Ensure we don't completely zero out if the user at least spoke
    clarity = Math.max(20, Math.round(clarity));
    pronunciation = Math.max(20, Math.round(pronunciation));

    console.log('[PronunciationAccuracyCalculator] Adjusted Metrics (ASR applied):', {
      asrPenalty,
      clarity,
      pronunciation
    });

    // 3. Integrate Unified NLP Analysis
    let grammar: number | undefined;
    let vocabulary: number | undefined;
    let nlpErrors: any[] = [];

    try {
      const nlpAnalysis = await this.unifiedCalculator.analyzeMessage(
        recognizedTranscript || expectedTranscript,
        '',
        {
          enableNLP: true,
          userId: options.userId,
        }
      );
      grammar = nlpAnalysis.grammar;
      vocabulary = nlpAnalysis.vocabulary;
      if (nlpAnalysis.errors) {
        nlpErrors = nlpAnalysis.errors;
      }
      console.log('[PronunciationAccuracyCalculator] NLP Analysis Result:', { grammar, vocabulary, nlpErrors });
    } catch (err) {
      console.warn('NLP integration failed in pronunciation calculator', err);
    }

    const finalResult = {
      adjustedScores: {
        pronunciation,
        fluency,
        stress,
        intonation,
        clarity,
        grammar,
        vocabulary
      },
      nlpErrors
    };
    console.log('[PronunciationAccuracyCalculator] Final Evaluated Result:', finalResult.adjustedScores);
    return finalResult;
  }

  /**
   * Refines word-level scoring by applying acoustic penalties to words
   * that MFA might have forced to be "perfect".
   */
  public refineWordAnalysis(
    wordAnalysis: WordLevelPronunciationAnalysis[],
    asrConfidence: number
  ): WordLevelPronunciationAnalysis[] {
    return wordAnalysis.map(word => {
      let finalWord = word;
      if (word.score >= 90 && asrConfidence < 0.75) {
        // Linear scale penalty based on ASR confidence drop
        const confidenceDrop = 0.75 - asrConfidence; // Max 0.75
        const penalty = Math.round(confidenceDrop * 100);
        
        const newScore = Math.max(0, word.score - penalty);
        let newStatus = word.issueType;
        let newSeverity = word.severity;

        if (newScore < 75) {
          newStatus = 'clarity';
          newSeverity = 2; // High severity
        } else if (newScore < 90) {
          newStatus = 'clarity';
          newSeverity = 1; // Warning
        }

        finalWord = {
          ...word,
          score: newScore,
          issueType: newStatus,
          severity: newSeverity,
        };
      }
      
      if (finalWord.alignmentConfidence !== undefined && finalWord.alignmentConfidence < 0.25) {
        finalWord = {
          ...finalWord,
          issueType: 'recognition_failure',
          severity: 2,
        };
      }

      return finalWord;
    });
  }
}

export const pronunciationAccuracyCalculator = new PronunciationAccuracyCalculator();
