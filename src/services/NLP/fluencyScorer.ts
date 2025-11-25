/**
 * 🎯 FLUENCY SCORER SERVICE (FREE)
 * Rule-based fluency analysis using sentence structure, transitions, and punctuation
 * Zero-cost alternative to AI-based fluency scoring
 */

import sbd from 'sbd';
import { Worker, type WorkerOptions } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../../utils/calculators/core/logger.js';

const LOCAL_TRANSFORMER_ENABLED = (() => {
  const rawValue = process.env.ENABLE_LOCAL_TRANSFORMER;
  if (!rawValue || rawValue.trim().length === 0) {
    return true;
  }

  const normalized = rawValue.trim().toLowerCase();
  const positiveFlags = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled']);
  const negativeFlags = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled']);

  if (positiveFlags.has(normalized)) {
    return true;
  }

  if (negativeFlags.has(normalized)) {
    return false;
  }

  return true;
})();
let transformerDisabledNotified = false;

const DEBUG_TRANSFORMER_IO = (() => {
  const explicitFlag = process.env.ENABLE_NLP_DEBUG_LOGS?.toLowerCase();
  if (explicitFlag) {
    if (['1', 'true', 'yes', 'on', 'debug'].includes(explicitFlag)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(explicitFlag)) {
      return false;
    }
  }

  const debugEnv = process.env.DEBUG?.toLowerCase() ?? '';
  if (debugEnv.includes('transformer') || debugEnv.includes('nlp')) {
    return true;
  }

  return false;
})();

const TRANSFORMER_TIMEOUT_MS = 45000;

const ensureTsxExecArgs = (initialExecArgv: string[]) => {
  const execArgv = [...initialExecArgv];
  const hasTsxSupport = execArgv.some((arg, index) => {
    if (typeof arg !== 'string') {
      return false;
    }
    if (arg.includes('tsx')) {
      return true;
    }
    const next = execArgv[index + 1];
    return typeof next === 'string' && next.includes('tsx');
  });

  if (!hasTsxSupport) {
    const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
    if (Number.isFinite(nodeMajor) && nodeMajor >= 20) {
      execArgv.push('--import=tsx/esm');
    } else {
      execArgv.push('--loader', 'tsx');
    }
  }

  return execArgv;
};

type TransformerWorkerRequest = { id: number; type: 'compute'; text: string };
type TransformerWorkerResult = { perplexity: number; tokenCount: number };
type TransformerWorkerResponse =
  | { id: number; status: 'ok'; result: TransformerWorkerResult }
  | { id: number; status: 'error'; error: { message: string; stack?: string } };

interface PendingWorkerRequest {
  resolve: (result: TransformerWorkerResult) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

let transformerWorker: Worker | null = null;
let transformerWorkerRequestId = 0;
const transformerWorkerPending = new Map<number, PendingWorkerRequest>();

const flushPendingWorkerRequests = (error: Error) => {
  transformerWorkerPending.forEach(({ reject, timer }) => {
    if (timer) {
      clearTimeout(timer);
    }
    reject(error);
  });
  transformerWorkerPending.clear();
};

const handleWorkerMessage = (message: TransformerWorkerResponse) => {
  const pending = transformerWorkerPending.get(message.id);
  if (!pending) {
    return;
  }

  transformerWorkerPending.delete(message.id);
  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  if (message.status === 'ok') {
    pending.resolve(message.result);
  } else {
    const error = new Error(message.error.message);
    if (message.error.stack) {
      error.stack = message.error.stack;
    }
    pending.reject(error);
  }
};

const configureWorkerStreams = (worker: Worker) => {
  if (DEBUG_TRANSFORMER_IO) {
    worker.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk);
    });
    worker.stderr?.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
    return;
  }

  worker.stdout?.on('data', () => {});
  worker.stderr?.on('data', () => {});
};

const createTransformerWorker = () => {
  const isTypescriptRuntime = import.meta.url.endsWith('.ts');
  const baseOptions: WorkerOptions = {
    stdout: true,
    stderr: true,
  };

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const distWorkerPath = resolve(currentDir, '../../../dist/services/NLP/transformer/transformerWorker.js');

  const candidateSpecs: Array<{ url: URL; needsTsxSupport: boolean; label: string }> = [];

  if (existsSync(distWorkerPath)) {
    candidateSpecs.push({ url: pathToFileURL(distWorkerPath), needsTsxSupport: false, label: 'dist-js' });
  }

  const localJsUrl = new URL('./transformer/transformerWorker.js', import.meta.url);
  try {
    const localJsPath = fileURLToPath(localJsUrl);
    if (existsSync(localJsPath)) {
      candidateSpecs.push({ url: localJsUrl, needsTsxSupport: false, label: 'local-js' });
    }
  } catch {
    // Ignore resolution issues; the JS build may not exist in TS runtime.
  }

  if (isTypescriptRuntime) {
    const localTsUrl = new URL('./transformer/transformerWorker.ts', import.meta.url);
    candidateSpecs.push({ url: localTsUrl, needsTsxSupport: true, label: 'local-ts' });
  }

  let worker: Worker | null = null;
  let lastError: unknown = null;

  for (const spec of candidateSpecs) {
    const candidateOptions: WorkerOptions = { ...baseOptions };
    if (spec.needsTsxSupport) {
      const execArgv = Array.isArray(process.execArgv) ? [...process.execArgv] : [];
      candidateOptions.execArgv = ensureTsxExecArgs(execArgv);
    }

    try {
      worker = new Worker(spec.url, {
        ...(candidateOptions as Record<string, unknown>),
        type: 'module',
      } as WorkerOptions);
      if (DEBUG_TRANSFORMER_IO) {
        logger.debug({ candidate: spec.label, url: spec.url.href }, 'Transformer worker instantiated');
      }
      break;
    } catch (error) {
      lastError = error;
      if (DEBUG_TRANSFORMER_IO) {
        logger.warn({ err: error, candidate: spec.label }, 'Transformer worker candidate failed to launch');
      }
    }
  }

  if (!worker) {
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error('Unable to initialize transformer worker');
  }

  configureWorkerStreams(worker);
  worker.on('message', (message: TransformerWorkerResponse) => {
    handleWorkerMessage(message);
  });
  worker.on('error', (error) => {
    const normalizedError = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Transformer worker error');
    logger.error({ err: normalizedError }, 'Transformer worker encountered an error');
    flushPendingWorkerRequests(normalizedError);
    transformerWorker = null;
  });
  worker.on('exit', (code) => {
    if (code !== 0) {
      logger.warn({ code }, 'Transformer worker exited unexpectedly');
      flushPendingWorkerRequests(new Error(`Transformer worker exited with code ${code}`));
    } else if (transformerWorkerPending.size > 0) {
      flushPendingWorkerRequests(new Error('Transformer worker exited before completing pending requests'));
    }
    transformerWorker = null;
  });

  return worker;
};

const ensureTransformerWorker = () => {
  if (!transformerWorker) {
    transformerWorker = createTransformerWorker();
  }
  return transformerWorker;
};

const terminateTransformerWorker = () => {
  if (!transformerWorker) {
    return;
  }

  const workerToTerminate = transformerWorker;
  transformerWorker = null;
  workerToTerminate.terminate().catch(() => {
    // Ignore termination errors; worker is already torn down or terminating.
  });
};

const runTransformerInference = (text: string): Promise<TransformerWorkerResult> => {
  const worker = ensureTransformerWorker();
  const requestId = ++transformerWorkerRequestId;

  return new Promise<TransformerWorkerResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      transformerWorkerPending.delete(requestId);
      reject(new Error('Transformer worker timed out after 45s'));
      flushPendingWorkerRequests(new Error('Transformer worker timed out'));
      terminateTransformerWorker();
    }, TRANSFORMER_TIMEOUT_MS);

    transformerWorkerPending.set(requestId, { resolve, reject, timer });

    const payload: TransformerWorkerRequest = {
      id: requestId,
      type: 'compute',
      text,
    };

    worker.postMessage(payload);
  });
};

// Warm-up: ensure transformer worker and model/session are created once at process startup
if (LOCAL_TRANSFORMER_ENABLED) {
  // Non-blocking warm-up so server startup is not delayed; worker will load model once
  setImmediate(() => {
    try {
      ensureTransformerWorker();
      logger.info('Transformer worker warm-up scheduled');
    } catch (err) {
      logger.warn({ err }, 'Transformer warm-up failed');
    }
  });
}

interface FluencyAnalysis {
  score: number; // 0-100
  sentenceCount: number;
  averageSentenceLength: number;
  transitionWords: number;
  punctuationScore: number;
  structureScore: number;
  coherenceScore: number;
  improvements: string[];
  strengths: string[];
  method: 'rule-based' | 'ai-assisted';
}

// Common transition words and phrases
const TRANSITION_WORDS = new Set([
  'however', 'therefore', 'moreover', 'furthermore', 'additionally', 'consequently',
  'nevertheless', 'nonetheless', 'meanwhile', 'similarly', 'likewise', 'conversely',
  'in contrast', 'on the other hand', 'in addition', 'for example', 'for instance',
  'as a result', 'in conclusion', 'to summarize', 'first', 'second', 'third',
  'firstly', 'secondly', 'finally', 'next', 'then', 'also', 'besides', 'indeed',
  'in fact', 'actually', 'certainly', 'obviously', 'clearly', 'specifically',
]);

class FluencyScorerService {

  private mapPerplexityToScore(perplexity: number): number {
    if (!Number.isFinite(perplexity) || Number.isNaN(perplexity)) {
      return 45;
    }
    const normalized = 120 - 20 * Math.log(perplexity + 1e-6);
    if (!Number.isFinite(normalized)) {
      return 45;
    }
    return Math.max(0, Math.min(100, normalized));
  }

  private async computeTransformerFluency(text: string): Promise<{ score: number; perplexity: number; tokenCount: number }> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { score: 45, perplexity: Infinity, tokenCount: 0 };
    }

    try {
      const { perplexity, tokenCount } = await runTransformerInference(trimmed);
      const score = this.mapPerplexityToScore(perplexity);
      return { score, perplexity, tokenCount };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Transformer worker fluency computation failed');
      logger.warn({ error: normalizedError }, 'Transformer worker fluency computation failed; falling back to rule-based result');
      throw normalizedError;
    }
  }

  async analyzeWithTransformer(text: string): Promise<FluencyAnalysis> {
    const ruleBased = await this.analyzeRuleBased(text);

    if (!LOCAL_TRANSFORMER_ENABLED) {
      if (!transformerDisabledNotified) {
        logger.info('Local transformer fluency scoring disabled; returning rule-based analysis. Set ENABLE_LOCAL_TRANSFORMER=true to re-enable.');
        transformerDisabledNotified = true;
      }
      if (!ruleBased.improvements.some((tip) => tip.includes('ENABLE_LOCAL_TRANSFORMER'))) {
        ruleBased.improvements = [
          'Enable advanced fluency scoring by setting ENABLE_LOCAL_TRANSFORMER=true (requires local transformer support).',
          ...ruleBased.improvements,
        ];
      }
      return ruleBased;
    }

    try {
      const { score: transformerScore, perplexity } = await this.computeTransformerFluency(text);
      const blendedScore = Math.round(ruleBased.score * 0.4 + transformerScore * 0.6);

      const improvements = [...ruleBased.improvements];
      const strengths = new Set(ruleBased.strengths);
      strengths.add('AI fluency check completed successfully.');

      improvements.unshift(
        `AI model confidence: ${Math.round(transformerScore)} / 100 (perplexity ${Number.isFinite(perplexity) ? perplexity.toFixed(1) : '∞'}).`
      );

      return {
        ...ruleBased,
        score: blendedScore,
        improvements,
        strengths: Array.from(strengths),
        method: 'ai-assisted',
      };
    } catch (error) {
      logger.warn({ error }, 'Transformer-based fluency scoring failed. Falling back to rule-based result.');
      return ruleBased;
    }
  }
  /**
   * Split text into sentences using sbd library
   */
  private splitSentences(text: string): string[] {
    try {
      const sentences = sbd.sentences(text, { preserve_whitespace: false });
      return sentences.filter((s: string) => s.trim().length > 0);
    } catch (error) {
      logger.error({ error }, 'Error splitting sentences');
      // Fallback to simple split
      return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    }
  }
  
  /**
   * Count transition words in text
   */
  private countTransitions(text: string): number {
    const lowerText = text.toLowerCase();
    let count = 0;
    
    TRANSITION_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });
    
    return count;
  }
  
  /**
   * Analyze punctuation usage
   */
  private analyzePunctuation(text: string): number {
    const sentences = this.splitSentences(text);
    if (sentences.length === 0) return 50;
    
    let score = 70; // Base score
    
    // Check for proper sentence ending
    const properEndings = sentences.filter(s => /[.!?]$/.test(s.trim()));
    const endingRatio = properEndings.length / sentences.length;
    score += endingRatio * 15; // Up to +15
    
    // Check for comma usage (not too many, not too few)
    const commas = (text.match(/,/g) || []).length;
    const words = text.split(/\s+/).length;
    const commaRatio = commas / Math.max(words / 10, 1);
    
    if (commaRatio > 0.3 && commaRatio < 1.5) {
      score += 10; // Good comma usage
    } else if (commaRatio > 2) {
      score -= 10; // Too many commas
    }
    
    // Check for variety in punctuation
    const hasSemicolon = text.includes(';');
    const hasColon = text.includes(':');
    const hasQuotes = text.includes('"') || text.includes("'");
    
    if (hasSemicolon) score += 2;
    if (hasColon) score += 2;
    if (hasQuotes) score += 3;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Analyze sentence structure
   */
  private analyzeStructure(text: string): number {
    const sentences = this.splitSentences(text);
    if (sentences.length === 0) return 50;
    
    let score = 70; // Base score
    
    // Calculate sentence length statistics
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const maxLength = Math.max(...lengths);
    const minLength = Math.min(...lengths);
    
    // Ideal average: 12-20 words per sentence
    if (avgLength >= 12 && avgLength <= 20) {
      score += 15;
    } else if (avgLength >= 8 && avgLength <= 25) {
      score += 10;
    } else if (avgLength < 5) {
      score -= 15; // Too choppy
    } else if (avgLength > 30) {
      score -= 10; // Too complex
    }
    
    // Check for sentence variety
    const lengthVariety = maxLength - minLength;
    if (lengthVariety > 5 && sentences.length > 1) {
      score += 10; // Good variety
    } else if (sentences.length > 3 && lengthVariety < 3) {
      score -= 5; // Too monotonous
    }
    
    // Check for complex sentence structures
    const hasComplexStructure = text.match(/,\s*which|,\s*who|,\s*that|because|although|while|since/gi);
    if (hasComplexStructure && hasComplexStructure.length > 0) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Analyze coherence and flow
   */
  private analyzeCoherence(text: string): number {
    const sentences = this.splitSentences(text);
    if (sentences.length < 2) return 70;
    
    let score = 70; // Base score
    
    // Count transitions
    const transitions = this.countTransitions(text);
    const transitionRatio = transitions / sentences.length;
    
    if (transitionRatio > 0.2) {
      score += 20; // Excellent use of transitions
    } else if (transitionRatio > 0.1) {
      score += 10; // Good use of transitions
    } else if (transitionRatio === 0 && sentences.length > 3) {
      score -= 10; // No transitions in multi-sentence text
    }
    
    // Check for pronoun usage (indicates coherence)
    const pronouns = text.match(/\b(he|she|it|they|this|that|these|those)\b/gi);
    if (pronouns && pronouns.length > 0) {
      const pronounRatio = pronouns.length / sentences.length;
      if (pronounRatio > 0.5 && pronounRatio < 2) {
        score += 5; // Good pronoun usage
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate improvement suggestions
   */
  private generateImprovements(
    sentenceCount: number,
    avgLength: number,
    transitions: number,
    punctScore: number,
    structScore: number
  ): string[] {
    const improvements: string[] = [];
    
    if (avgLength < 8) {
      improvements.push('Try combining some short sentences for better flow');
    }
    
    if (avgLength > 25) {
      improvements.push('Consider breaking long sentences into shorter ones for clarity');
    }
    
    if (transitions === 0 && sentenceCount > 2) {
      improvements.push('Use transition words (however, therefore, additionally) to connect ideas');
    }
    
    if (punctScore < 70) {
      improvements.push('Review punctuation usage for better readability');
    }
    
    if (structScore < 70) {
      improvements.push('Vary sentence length and structure for more engaging writing');
    }
    
    return improvements;
  }
  
  /**
   * Identify strengths
   */
  private identifyStrengths(
    sentenceCount: number,
    avgLength: number,
    transitions: number,
    punctScore: number,
    structScore: number,
    coherenceScore: number
  ): string[] {
    const strengths: string[] = [];
    
    if (avgLength >= 12 && avgLength <= 20) {
      strengths.push('Excellent sentence length balance');
    }
    
    if (transitions > 0 && sentenceCount > 1) {
      strengths.push('Good use of transition words');
    }
    
    if (punctScore >= 85) {
      strengths.push('Strong punctuation skills');
    }
    
    if (structScore >= 85) {
      strengths.push('Well-varied sentence structure');
    }
    
    if (coherenceScore >= 85) {
      strengths.push('Ideas flow smoothly and coherently');
    }
    
    return strengths;
  }
  
  /**
   * Analyze fluency using rule-based methods
   */
  async analyzeRuleBased(text: string): Promise<FluencyAnalysis> {
    try {
      const sentences = this.splitSentences(text);
      const words = text.split(/\s+/).filter(w => w.trim().length > 0);
      
      if (sentences.length === 0 || words.length === 0) {
        return this.getEmptyAnalysis('rule-based');
      }
      
      const avgSentenceLength = words.length / sentences.length;
      const transitions = this.countTransitions(text);
      const punctuationScore = this.analyzePunctuation(text);
      const structureScore = this.analyzeStructure(text);
      const coherenceScore = this.analyzeCoherence(text);
      
      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        punctuationScore * 0.25 +
        structureScore * 0.35 +
        coherenceScore * 0.40
      );

      let adjustedScore = overallScore;
      const transitionRatio = transitions / Math.max(1, sentences.length);

      if (avgSentenceLength >= 13 && avgSentenceLength <= 24) {
        adjustedScore += 6;
      } else if (avgSentenceLength < 7) {
        adjustedScore -= 6;
      }

      if (transitionRatio >= 0.25) {
        adjustedScore += 8;
      } else if (transitionRatio >= 0.15) {
        adjustedScore += 5;
      } else if (sentences.length > 4 && transitions === 0) {
        adjustedScore -= 8;
      }

      if (punctuationScore >= 85 && structureScore >= 85) {
        adjustedScore += 5;
      }

      if (words.length >= 120) {
        adjustedScore += 4;
      } else if (words.length < 25) {
        adjustedScore -= 5;
      }

      adjustedScore = Math.max(0, Math.min(100, adjustedScore));
      
      const improvements = this.generateImprovements(
        sentences.length,
        avgSentenceLength,
        transitions,
        punctuationScore,
        structureScore
      );
      
      const strengths = this.identifyStrengths(
        sentences.length,
        avgSentenceLength,
        transitions,
        punctuationScore,
        structureScore,
        coherenceScore
      );
      
      if (adjustedScore >= 90 && !improvements.some((tip) => tip.includes('fluency'))) {
        improvements.unshift('Your writing flows smoothly! Maintain this level of cohesion.');
      }

      logger.debug({ score: adjustedScore, baseScore: overallScore, method: 'rule-based' }, 'Fluency analysis complete');
      
      return {
        score: adjustedScore,
        sentenceCount: sentences.length,
        averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        transitionWords: transitions,
        punctuationScore: Math.round(punctuationScore),
        structureScore: Math.round(structureScore),
        coherenceScore: Math.round(coherenceScore),
        improvements: improvements.length > 0 ? improvements : ['Your fluency is good!'],
        strengths: strengths.length > 0 ? strengths : ['Keep practicing!'],
        method: 'rule-based',
      };
    } catch (error) {
      logger.error({ error }, 'Error analyzing fluency');
      return this.getEmptyAnalysis('rule-based');
    }
  }
  
  /**
   * Get empty analysis result
   */
  private getEmptyAnalysis(method: 'rule-based' | 'ai-assisted'): FluencyAnalysis {
    return {
      score: 70,
      sentenceCount: 0,
      averageSentenceLength: 0,
      transitionWords: 0,
      punctuationScore: 70,
      structureScore: 70,
      coherenceScore: 70,
      improvements: ['Enter some text to analyze fluency'],
      strengths: [],
      method,
    };
  }
}

// Singleton instance
export const fluencyScorer = new FluencyScorerService();

// Export state
export { LOCAL_TRANSFORMER_ENABLED };

// Export types
export type { FluencyAnalysis };
export default fluencyScorer;
