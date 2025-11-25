import { logger } from '../../../utils/calculators/core/logger.js';
import { existsSync } from 'fs';

const EMBEDDING_MODEL_ID = process.env.VOCAB_EMBEDDING_MODEL_ID?.trim() || 'Xenova/all-MiniLM-L6-v2';
const MAX_SEMANTIC_CANDIDATES = 32;

const LEVEL_SIMILARITY_THRESHOLDS: Record<'B1' | 'B2' | 'C1' | 'C2', number> = {
  B1: 0.52,
  B2: 0.56,
  C1: 0.6,
  C2: 0.62,
};

const EMBEDDING_ANCHORS: Record<'B1' | 'B2' | 'C1' | 'C2', string[]> = {
  B1: ['collaborate', 'intermediate', 'resourceful', 'strategic', 'framework'],
  B2: ['methodology', 'analytical', 'precision', 'prototype', 'synthesize'],
  C1: ['paradigm', 'contextualize', 'epistemic', 'quantitative', 'formidable'],
  C2: ['metacognitive', 'phenomenology', 'symbiotic', 'axiomatic', 'transcendent'],
};

const readBooleanFlag = (key: string, fallback: boolean) => {
  const raw = process.env[key];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) {
    return false;
  }
  return fallback;
};

// If a VOCAB_EMBEDDINGS_PATH is provided, ensure it exists. If missing, disable embeddings gracefully.
const VOCAB_EMBEDDINGS_PATH = (process.env.VOCAB_EMBEDDINGS_PATH || '').trim();
if (VOCAB_EMBEDDINGS_PATH && !existsSync(VOCAB_EMBEDDINGS_PATH)) {
  logger.warn({ path: VOCAB_EMBEDDINGS_PATH }, 'No embedding model found – skipping semantic vocabulary scoring');
}

const ENABLED = (() => {
  const base = readBooleanFlag('ENABLE_VOCAB_EMBEDDINGS', true);
  if (VOCAB_EMBEDDINGS_PATH && !existsSync(VOCAB_EMBEDDINGS_PATH)) {
    return false;
  }
  return base;
})();

type EmbeddingVector = number[];
type FeatureExtractor = (input: string) => Promise<unknown>;

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

const averageVectors = (vectors: EmbeddingVector[]): EmbeddingVector => {
  if (vectors.length === 0) {
    return [];
  }
  const length = vectors[0].length;
  const totals = new Array(length).fill(0);
  vectors.forEach((vector) => {
    for (let index = 0; index < length; index += 1) {
      totals[index] += vector[index] ?? 0;
    }
  });
  return normalizeVector(totals.map((value) => value / vectors.length));
};

class SemanticVocabularyCalibrator {
  private extractorPromise: Promise<FeatureExtractor> | null = null;
  private anchorVectorsPromise: Promise<Map<'B1' | 'B2' | 'C1' | 'C2', EmbeddingVector>> | null = null;
  private readonly embeddingCache = new Map<string, EmbeddingVector>();
  private initializationError: Error | null = null;

  private async ensureExtractor(): Promise<FeatureExtractor | null> {
    if (!ENABLED) {
      return null;
    }

    if (this.initializationError) {
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
        logger.warn({ error: normalized }, 'Failed to initialize vocabulary embedding model');
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

  private async ensureAnchorVectors(): Promise<Map<'B1' | 'B2' | 'C1' | 'C2', EmbeddingVector> | null> {
    if (!ENABLED) {
      return null;
    }

    if (this.initializationError) {
      return null;
    }

    if (!this.anchorVectorsPromise) {
      this.anchorVectorsPromise = (async () => {
        const extractor = await this.ensureExtractor();
        if (!extractor) {
          throw new Error('Embedding extractor unavailable');
        }

        const anchorEntries = await Promise.all(
          Object.entries(EMBEDDING_ANCHORS).map(async ([level, words]) => {
            const vectors: EmbeddingVector[] = [];
            for (const word of words) {
              const vector = await this.embedWord(word, extractor);
              if (vector) {
                vectors.push(vector);
              }
            }
            if (vectors.length === 0) {
              return null;
            }
            return [level as 'B1' | 'B2' | 'C1' | 'C2', averageVectors(vectors)] as const;
          }),
        );

        const anchorMap = new Map<'B1' | 'B2' | 'C1' | 'C2', EmbeddingVector>();
        anchorEntries.forEach((entry) => {
          if (entry) {
            anchorMap.set(entry[0], entry[1]);
          }
        });

        if (anchorMap.size === 0) {
          throw new Error('Failed to create vocabulary embedding anchors');
        }

        return anchorMap;
      })().catch((error) => {
        const normalized = error instanceof Error ? error : new Error(String(error));
        this.initializationError = normalized;
        this.anchorVectorsPromise = null;
        logger.warn({ error: normalized }, 'Failed to prepare vocabulary embedding anchors');
        throw normalized;
      });
    }

    try {
      return await this.anchorVectorsPromise;
    } catch {
      return null;
    }
  }

  private async embedWord(word: string, extractor: FeatureExtractor): Promise<EmbeddingVector | null> {
    const cacheKey = word.toLowerCase();
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const raw = await extractor(word);
      const vector = toVector(raw);
      if (!vector) {
        return null;
      }
      this.embeddingCache.set(cacheKey, vector);
      return vector;
    } catch (error) {
      logger.debug({ word, error }, 'Failed to embed token for vocabulary calibration');
      return null;
    }
  }

  async promote(words: string[]): Promise<Array<{ word: string; level: 'B1' | 'B2' | 'C1' | 'C2'; similarity: number }>> {
    if (!ENABLED || words.length === 0) {
      return [];
    }

    const anchors = await this.ensureAnchorVectors();
    const extractor = await this.ensureExtractor();

    if (!anchors || !extractor) {
      return [];
    }

    const uniqueWords = Array.from(new Set(words.map((word) => word.toLowerCase()))).filter((word) => {
      if (word.length < 4) {
        return false;
      }
      return /^[a-z][a-z-]*$/.test(word);
    }).slice(0, MAX_SEMANTIC_CANDIDATES);

    if (uniqueWords.length === 0) {
      return [];
    }

    const promotions: Array<{ word: string; level: 'B1' | 'B2' | 'C1' | 'C2'; similarity: number }> = [];

    for (const word of uniqueWords) {
      const vector = await this.embedWord(word, extractor);
      if (!vector) {
        continue;
      }

      const normalizedVector = normalizeVector(vector);

      let bestLevel: 'B1' | 'B2' | 'C1' | 'C2' | null = null;
      let bestSimilarity = -1;

      anchors.forEach((anchorVector, level) => {
        const score = cosineSimilarity(normalizedVector, anchorVector);
        if (score > bestSimilarity) {
          bestSimilarity = score;
          bestLevel = level;
        }
      });

      if (!bestLevel || bestSimilarity < 0) {
        continue;
      }

      const threshold = LEVEL_SIMILARITY_THRESHOLDS[bestLevel];
      if (bestSimilarity >= threshold) {
        promotions.push({ word, level: bestLevel, similarity: bestSimilarity });
      }
    }

    return promotions.sort((a, b) => b.similarity - a.similarity);
  }
}

export const semanticVocabCalibrator = new SemanticVocabularyCalibrator();
export type SemanticPromotion = { word: string; level: 'B1' | 'B2' | 'C1' | 'C2'; similarity: number };
