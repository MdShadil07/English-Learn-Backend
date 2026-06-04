import { existsSync } from 'fs';
import { logger } from '../../../utils/calculators/core/logger.js';
import {
  alignWordSequences,
  calculateWordAlignmentConfidence,
  tokenizeForAlignment,
  normalizeAlignmentWord,
} from '../alignment/wordSequenceAligner.js';

type EmbeddingVector = number[];
type FeatureExtractor = (input: string) => Promise<unknown>;

export interface SemanticRelevanceInput {
  expectedTranscript: string;
  recognizedTranscript: string;
  asrConfidence: number;
  metadata?: Record<string, unknown>;
}

export interface SemanticRelevanceResult {
  semanticSimilarity: number;
  semanticConfidence: number;
  alignmentSimilarity: number;
  lexicalOverlap: number;
  expectedWordCount: number;
  recognizedWordCount: number;
  detectedLanguage: 'english' | 'non_english' | 'unknown';
  classification: 'valid_reading' | 'partial_reading' | 'wrong_passage' | 'random_speech' | 'native_language' | 'silence';
  shouldScore: boolean;
  reason: string;
  recommendation: string;
  usedEmbeddings: boolean;
}

const EMBEDDING_MODEL_ID = process.env.PRONUNCIATION_SEMANTIC_MODEL_ID?.trim() || 'Xenova/all-MiniLM-L6-v2';
const ENABLED = false; // Hardcoded to false to prevent 512MB OOM crash on Render

const SEMANTIC_EMBEDDINGS_PATH = (process.env.PRONUNCIATION_SEMANTIC_EMBEDDINGS_PATH || '').trim();

if (SEMANTIC_EMBEDDINGS_PATH && !existsSync(SEMANTIC_EMBEDDINGS_PATH)) {
  logger.warn({ path: SEMANTIC_EMBEDDINGS_PATH }, 'Pronunciation semantic embedding path not found; falling back to heuristic relevance checks');
}

const normalizeVector = (vector: EmbeddingVector) => {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  if (!Number.isFinite(norm) || norm <= 0) {
    return vector.map(() => 0);
  }
  const magnitude = Math.sqrt(norm);
  return vector.map((value) => value / magnitude);
};

const cosineSimilarity = (a: EmbeddingVector, b: EmbeddingVector) => {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    const av = a[index];
    const bv = b[index];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (!Number.isFinite(dot) || !Number.isFinite(normA) || !Number.isFinite(normB)) {
    return 0;
  }

  const magnitudeA = Math.sqrt(normA);
  const magnitudeB = Math.sqrt(normB);
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot / (magnitudeA * magnitudeB);
};

const toVector = (payload: unknown): EmbeddingVector | null => {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return null;
    }

    const first = payload[0];
    if (Array.isArray(first)) {
      return normalizeVector(first.map((value) => Number(value) || 0));
    }

    if (typeof first === 'number') {
      return normalizeVector((payload as number[]).map((value) => Number(value) || 0));
    }
  }

  if (payload instanceof Float32Array) {
    return normalizeVector(Array.from(payload));
  }

  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const data = (payload as { data: unknown }).data;
    if (data instanceof Float32Array) {
      return normalizeVector(Array.from(data));
    }
    if (Array.isArray(data)) {
      return normalizeVector(data.map((value) => Number(value) || 0));
    }
  }

  return null;
};

const normalizeTranscript = (text: string) => text.trim().replace(/\s+/g, ' ');
const tokenizeTranscript = (text: string) => tokenizeForAlignment(text).map((token) => normalizeAlignmentWord(token)).filter(Boolean);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

class SemanticRelevanceService {
  private extractorPromise: Promise<FeatureExtractor> | null = null;
  private initializationError: Error | null = null;
  private readonly embeddingCache = new Map<string, EmbeddingVector>();

  async evaluate(input: SemanticRelevanceInput): Promise<SemanticRelevanceResult> {
    const expectedTranscript = normalizeTranscript(input.expectedTranscript);
    const recognizedTranscript = normalizeTranscript(input.recognizedTranscript);
    const expectedWords = tokenizeTranscript(expectedTranscript);
    const recognizedWords = tokenizeTranscript(recognizedTranscript);

    if (!expectedWords.length || !recognizedWords.length) {
      return {
        semanticSimilarity: 0,
        semanticConfidence: 0,
        alignmentSimilarity: 0,
        lexicalOverlap: 0,
        expectedWordCount: expectedWords.length,
        recognizedWordCount: recognizedWords.length,
        detectedLanguage: 'unknown',
        classification: 'silence',
        shouldScore: false,
        reason: 'No clear speech was available for semantic relevance scoring.',
        recommendation: 'Please retry with a clear recording of the displayed passage.',
        usedEmbeddings: false,
      };
    }

    const language = this.detectLanguage(recognizedTranscript);
    const overlap = this.calculateLexicalOverlap(expectedWords, recognizedWords);
    const alignmentSimilarity = calculateWordAlignmentConfidence(alignWordSequences(expectedWords, recognizedWords));

    const extractor = await this.ensureExtractor();
    let semanticSimilarity = 0;
    let usedEmbeddings = false;

    if (extractor) {
      const expectedVector = await this.embedText(expectedTranscript, extractor);
      const recognizedVector = await this.embedText(recognizedTranscript, extractor);
      if (expectedVector && recognizedVector) {
        semanticSimilarity = clamp01((cosineSimilarity(expectedVector, recognizedVector) + 1) / 2);
        usedEmbeddings = true;
      }
    }

    if (!usedEmbeddings) {
      semanticSimilarity = this.heuristicSemanticSimilarity(expectedWords, recognizedWords, overlap, alignmentSimilarity);
    }

    const semanticConfidence = clamp01(
      (semanticSimilarity * 0.55)
      + (overlap * 0.20)
      + (alignmentSimilarity * 0.20)
      + (Math.min(expectedWords.length, recognizedWords.length) / Math.max(expectedWords.length, recognizedWords.length, 1) * 0.05)
    );

    const shouldScore = language !== 'non_english' && semanticConfidence >= 0.55 && alignmentSimilarity >= 0.32;
    const classification = this.classify({
      language,
      semanticSimilarity,
      semanticConfidence,
      alignmentSimilarity,
      overlap,
      expectedWords,
      recognizedWords,
    });

    return {
      semanticSimilarity: Number(semanticSimilarity.toFixed(2)),
      semanticConfidence: Number(semanticConfidence.toFixed(2)),
      alignmentSimilarity: Number(alignmentSimilarity.toFixed(2)),
      lexicalOverlap: Number(overlap.toFixed(2)),
      expectedWordCount: expectedWords.length,
      recognizedWordCount: recognizedWords.length,
      detectedLanguage: language,
      classification,
      shouldScore,
      reason: this.describeReason(classification, semanticConfidence, alignmentSimilarity, overlap),
      recommendation: this.describeRecommendation(classification),
      usedEmbeddings,
    };
  }

  private async ensureExtractor(): Promise<FeatureExtractor | null> {
    if (!ENABLED || this.initializationError) {
      return null;
    }

    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        const transformersModule = await import('@xenova/transformers');
        const featureExtractor = await (transformersModule as any).pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
          quantized: true,
          pooling: 'mean',
          normalize: true,
        });
        return featureExtractor as FeatureExtractor;
      })().catch((error) => {
        const normalized = error instanceof Error ? error : new Error(String(error));
        this.initializationError = normalized;
        this.extractorPromise = null;
        logger.warn({ error: normalized }, 'Failed to initialize pronunciation semantic embedding model');
        throw normalized;
      });
    }

    try {
      return await this.extractorPromise;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (!this.initializationError) {
        this.initializationError = normalized;
      }
      return null;
    }
  }

  private async embedText(text: string, extractor: FeatureExtractor): Promise<EmbeddingVector | null> {
    const cacheKey = text.toLowerCase();
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const raw = await extractor(text);
      const vector = toVector(raw);
      if (!vector) {
        return null;
      }
      this.embeddingCache.set(cacheKey, vector);
      return vector;
    } catch (error) {
      logger.debug({ error }, 'Failed to embed pronunciation text for semantic gating');
      return null;
    }
  }

  private heuristicSemanticSimilarity(expectedWords: string[], recognizedWords: string[], overlap: number, alignmentSimilarity: number) {
    if (!expectedWords.length || !recognizedWords.length) {
      return 0;
    }

    const expectedSet = new Set(expectedWords);
    const recognizedSet = new Set(recognizedWords);
    const common = [...expectedSet].filter((word) => recognizedSet.has(word)).length;
    const coverage = common / Math.max(1, expectedWords.length);
    const lengthRatio = Math.min(expectedWords.length, recognizedWords.length) / Math.max(expectedWords.length, recognizedWords.length);

    return clamp01((coverage * 0.45) + (overlap * 0.25) + (alignmentSimilarity * 0.20) + (lengthRatio * 0.10));
  }

  private calculateLexicalOverlap(expectedWords: string[], recognizedWords: string[]) {
    if (!expectedWords.length || !recognizedWords.length) {
      return 0;
    }

    const expected = new Set(expectedWords);
    const recognized = new Set(recognizedWords);
    const common = [...expected].filter((word) => recognized.has(word)).length;
    return common / Math.max(1, expectedWords.length);
  }

  private detectLanguage(text: string): 'english' | 'non_english' | 'unknown' {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'unknown';
    }

    const nonLatinChars = Array.from(trimmed).filter((char) => /[^\u0000-\u024F\s.,!?"'’()-]/u.test(char)).length;
    if (nonLatinChars / Math.max(1, Array.from(trimmed).length) > 0.15) {
      return 'non_english';
    }

    const englishFunctionWords = new Set(['the', 'a', 'an', 'for', 'to', 'of', 'and', 'is', 'are', 'was', 'were', 'in', 'on', 'with']);
    const words = tokenizeForAlignment(trimmed);
    const functionWordCount = words.filter((word) => englishFunctionWords.has(word.toLowerCase())).length;
    return functionWordCount > 0 || words.length <= 4 ? 'english' : 'unknown';
  }

  private classify(input: {
    language: 'english' | 'non_english' | 'unknown';
    semanticSimilarity: number;
    semanticConfidence: number;
    alignmentSimilarity: number;
    overlap: number;
    expectedWords: string[];
    recognizedWords: string[];
  }): SemanticRelevanceResult['classification'] {
    if (input.language === 'non_english') {
      return 'native_language';
    }

    if (input.recognizedWords.length === 0) {
      return 'silence';
    }

    const strongMismatch = input.semanticConfidence < 0.28 || (input.semanticSimilarity < 0.22 && input.overlap < 0.2);
    const unrelatedSpeech = input.semanticConfidence < 0.40 && input.alignmentSimilarity < 0.24;
    const partialReading = input.semanticConfidence < 0.60 || input.alignmentSimilarity < 0.45;

    if (strongMismatch && input.recognizedWords.length >= Math.max(4, Math.ceil(input.expectedWords.length * 0.6))) {
      return 'random_speech';
    }

    if (strongMismatch) {
      return 'wrong_passage';
    }

    if (unrelatedSpeech) {
      return 'random_speech';
    }

    if (partialReading) {
      return 'partial_reading';
    }

    return 'valid_reading';
  }

  private describeReason(
    classification: SemanticRelevanceResult['classification'],
    semanticConfidence: number,
    alignmentSimilarity: number,
    overlap: number
  ) {
    switch (classification) {
      case 'valid_reading':
        return 'The recognized transcript is semantically aligned with the target passage and is safe for pronunciation scoring.';
      case 'partial_reading':
        return `Semantic confidence is moderate (${Math.round(semanticConfidence * 100)}%), but not high enough to trust fully. alignment=${Math.round(alignmentSimilarity * 100)}%, overlap=${Math.round(overlap * 100)}%.`;
      case 'wrong_passage':
        return `The recognized speech does not match the expected passage closely enough for pronunciation scoring. semantic=${Math.round(semanticConfidence * 100)}%, alignment=${Math.round(alignmentSimilarity * 100)}%.`;
      case 'random_speech':
        return `The recording appears semantically unrelated to the expected passage. semantic=${Math.round(semanticConfidence * 100)}%, alignment=${Math.round(alignmentSimilarity * 100)}%.`;
      case 'native_language':
        return 'The system detected non-English or multilingual interference, so pronunciation scoring is withheld.';
      case 'silence':
        return 'No clear speech was available for semantic relevance scoring.';
    }
  }

  private describeRecommendation(classification: SemanticRelevanceResult['classification']) {
    switch (classification) {
      case 'valid_reading':
        return 'Proceed with detailed pronunciation analysis.';
      case 'partial_reading':
        return 'Please read the full displayed passage clearly before scoring.';
      case 'wrong_passage':
        return 'Please read the exact displayed passage again.';
      case 'random_speech':
        return 'Please retry and speak only the displayed passage.';
      case 'native_language':
        return 'Please retry in English and read the displayed passage aloud.';
      case 'silence':
        return 'Please check your microphone and read the passage aloud.';
    }
  }
}

export const semanticRelevanceService = new SemanticRelevanceService();
