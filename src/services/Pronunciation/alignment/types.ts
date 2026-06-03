export interface AlignmentPhoneInterval {
  phoneme: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  confidence?: number;
  source?: 'mfa' | 'synthetic' | 'whisper-estimated';
}

export interface AlignmentWordInterval {
  word: string;
  normalizedWord: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  phonemes: AlignmentPhoneInterval[];
}

export interface ExpectedWordPhonemeData {
  word: string;
  normalizedWord: string;
  expectedPhonemes: string[];
  expectedStress: number[];
  expectedSyllables: number;
}

export interface ForcedAlignmentResult {
  provider: 'mfa' | 'whisper-timestamps' | 'fallback';
  transcript: string;
  normalizedTranscript: string;
  wordIntervals: AlignmentWordInterval[];
  metadata: {
    textGridPath?: string;
    dictionaryPath?: string;
    acousticModelPath?: string;
    mode?: 'strict' | 'best_effort';
    whisperWordCount?: number;
    targetWordCount?: number;
    matchRate?: number;
    phoneCount?: number;
    timingSource?: 'mfa-textgrid' | 'whisper-word-timestamps' | 'synthetic';
    timingQuality?: number;
  };
}

export interface WordLevelPronunciationAnalysis {
  word: string;
  alignedWord?: string | null;
  alignmentConfidence?: number;
  expectedPhonemes: string[];
  expectedStress?: number[];
  expectedSyllables?: number;
  actualPhonemes: string[];
  severity: number;
  score: number;
  startTime: number;
  endTime: number;
  issueType: string;
  animationCue?: Record<string, unknown>;
  componentScores?: {
    phonemeCorrectness: number;
    consonantCompletion: number;
    vowelQuality: number;
    stressCorrectness: number;
    durationTiming: number;
  };
}

export interface PhonemeLevelPronunciationAnalysis {
  phoneme: string;
  expected: string;
  actual: string;
  confidence: number;
  issueType: 'match' | 'substitution' | 'insertion' | 'deletion' | 'prosody' | 'fluency';
  severity?: 'low' | 'medium' | 'high';
  taxonomy?: 'substitution' | 'omission' | 'insertion' | 'prosody' | 'fluency';
  startTime?: number;
  endTime?: number;
}

export interface PhonemeTimelineEvent {
  phoneme: string;
  expected: string;
  actual: string;
  confidence: number;
  startTime: number;
  endTime: number;
  issueType: 'match' | 'substitution' | 'insertion' | 'deletion' | 'prosody' | 'fluency';
  severity: 'low' | 'medium' | 'high';
  taxonomy: 'substitution' | 'omission' | 'insertion' | 'prosody' | 'fluency';
}

export interface PronunciationScoringResult {
  wordAnalysis: WordLevelPronunciationAnalysis[];
  phonemeAnalysis: PhonemeLevelPronunciationAnalysis[];
  phonemeTimeline: PhonemeTimelineEvent[];
  scores: {
    pronunciation: number;
    fluency: number;
    stress: number;
    intonation: number;
    clarity: number;
  };
  prosodyAnalysis: Record<string, unknown>;
  drillRecommendations: Array<{
    type: string;
    word?: string;
    instruction: string;
  }>;
  metadata: {
    scoringMode: 'alignment_driven' | 'fallback';
    alignedWordCount: number;
    targetWordCount: number;
    alignmentConfidence: number;
    mtiLikelihood?: {
      label: string;
      confidence: number;
      reasons: string[];
    };
  };
}
