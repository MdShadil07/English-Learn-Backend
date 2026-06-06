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
      passageAccuracy?: number;
      wordAccuracy?: number;
      phonemeAccuracy?: number;
      intelligibility?: number;
      audioQuality?: number;
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

    // Extract base metrics
    let { pronunciation: basePhonemeAccuracy, fluency, stress } = baseScores.scores;
    
    // 1. Passage Accuracy (15%)
    // Simple word-level Jaccard similarity for passage accuracy
    const expectedWords = expectedTranscript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
    const recognizedWords = recognizedTranscript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
    
    let matches = 0;
    const recognizedSet = new Set(recognizedWords);
    for (const w of expectedWords) {
      if (recognizedSet.has(w)) matches++;
    }
    
    const maxLen = Math.max(expectedWords.length, 1);
    const passageAccuracy = Math.min(100, Math.round((matches / maxLen) * 100));

    // 2. Word Accuracy (15%)
    // Calculate average score of words that were not completely omitted or heavily substituted
    let wordAccTotal = 0;
    let wordCount = 0;
    baseScores.wordAnalysis.forEach(word => {
      wordCount++;
      // If severity is critical (substitution meaning change), heavily penalize word accuracy
      if (word.severity === 3) wordAccTotal += word.score * 0.4;
      else if (word.severity === 2) wordAccTotal += word.score * 0.7;
      else wordAccTotal += word.score;
    });
    const wordAccuracy = wordCount > 0 ? Math.round(wordAccTotal / wordCount) : 0;

    // 3. Phoneme Accuracy (30%)
    const phonemeAccuracy = Math.round(basePhonemeAccuracy);

    // 4. Intelligibility (15%)
    // Driven purely by ASR confidence (no accent penalty)
    const intelligibility = Math.round(asrConfidence * 100);

    // 5. Audio Quality (5%)
    // Assuming 95 as base good quality, dropping slightly if ASR is extremely low
    const audioQuality = asrConfidence > 0.4 ? 95 : 70;
    
    // 6. Fluency (10%) & Prosody (10%)
    const prosody = Math.round(stress);
    fluency = Math.round(fluency);

    // Calculate final composite Pronunciation score
    const finalPronunciation = Math.round(
      (0.15 * passageAccuracy) +
      (0.15 * wordAccuracy) +
      (0.30 * phonemeAccuracy) +
      (0.15 * intelligibility) +
      (0.10 * fluency) +
      (0.10 * prosody) +
      (0.05 * audioQuality)
    );

    const finalResult = {
      adjustedScores: {
        pronunciation: finalPronunciation,
        fluency,
        stress: prosody,
        intonation: baseScores.scores.intonation,
        clarity: intelligibility, // Map clarity to intelligibility for backwards compatibility
        passageAccuracy,
        wordAccuracy,
        phonemeAccuracy,
        intelligibility,
        audioQuality
      }
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
