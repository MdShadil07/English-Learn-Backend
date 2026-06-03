import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { PronunciationLexiconService } from '../scoring/pronunciationLexiconService.js';
import { TextGridParser } from './textGridParser.js';
import type { ForcedAlignmentResult } from './types.js';
import type { WhisperWord } from '../speechProcessingPipeline.js';
import { normalizeAlignmentWord, tokenizeForAlignment } from './wordSequenceAligner.js';
import { telemetryService } from '../../telemetryService.js';

const normalizeTranscript = (text: string) => text.trim().replace(/\s+/g, ' ');

export class MontrealForcedAlignerService {
  private readonly parser = new TextGridParser();
  private readonly lexicon = new PronunciationLexiconService();

  isMfaConfigured() {
    return Boolean(process.env.MFA_BINARY && process.env.MFA_DICTIONARY_PATH && process.env.MFA_ACOUSTIC_MODEL_PATH);
  }

  /**
   * Primary alignment method.
   * Strategy (in priority order):
   *   1. MFA forced alignment (if installed and configured) — most accurate
   *   2. Whisper word-level timestamps — real speech alignment from ASR
   *   3. Synthetic fallback — evenly spaced, lowest quality
   */
  async alignAudioToTranscript(
    audioPath: string,
    transcript: string,
    workspaceDirectory: string,
    whisperWords?: WhisperWord[],
    options: { signal?: AbortSignal } = {}
  ): Promise<ForcedAlignmentResult> {
    const normalizedTranscript = normalizeTranscript(transcript);
    const mode = process.env.PRONUNCIATION_ALIGNMENT_STRICT === 'true' ? 'strict' : 'best_effort';

    // Strategy 1: Try MFA if configured
    if (this.isMfaConfigured()) {
      try {
        return await this.runMfa(audioPath, normalizedTranscript, workspaceDirectory, mode, options.signal);
      } catch (error) {
        if (mode === 'strict') {
          throw error;
        }
        console.warn('⚠️ MFA alignment failed, falling back to Whisper timestamps:', (error as Error).message);
      }
    }

    // Strategy 2: Use Whisper word timestamps (real speech alignment)
    if (whisperWords && whisperWords.length > 0) {
      return this.buildWhisperAlignment(normalizedTranscript, whisperWords, { mode });
    }

    // Strategy 3: Synthetic fallback (last resort)
    if (mode === 'strict') {
      throw new Error('No alignment method available (MFA not configured, no Whisper timestamps)');
    }

    console.warn('⚠️ Using synthetic fallback alignment — pronunciation scores will be approximate');
    return this.buildSyntheticFallback(normalizedTranscript, { mode });
  }

  /**
   * Builds alignment from Whisper word-level timestamps.
   * Whisper provides real start/end times for each word based on actual audio analysis,
   * which is far more accurate than synthetic evenly-spaced timing.
   */
  private async buildWhisperAlignment(
    transcript: string,
    whisperWords: WhisperWord[],
    metadata: { mode: 'strict' | 'best_effort' }
  ): Promise<ForcedAlignmentResult> {
    const transcriptWords = tokenizeForAlignment(transcript);
    const cleanWhisperWords = whisperWords
      .map((word) => ({
        ...word,
        word: word.word.trim(),
        normalized: normalizeAlignmentWord(word.word),
      }))
      .filter((word) => word.word && word.normalized && word.end >= word.start);

    const wordIntervals = await Promise.all(
      cleanWhisperWords.map(async (whisperWord, wordIndex) => {
        const expectedPhonemes = await this.lexicon.getPhonemesForWord(whisperWord.word, {
          sentence: transcript,
          wordIndex,
        });
        const startTimeMs = Math.round(whisperWord.start * 1000);
        const endTimeMs = Math.round(whisperWord.end * 1000);
        const durationMs = Math.max(0, endTimeMs - startTimeMs);

        // Distribute phonemes across the word's real time span
        const phoneDuration = Math.max(30, Math.floor(durationMs / Math.max(1, expectedPhonemes.length)));

        return {
          word: whisperWord.word,
          normalizedWord: whisperWord.normalized,
          startTime: startTimeMs,
          endTime: endTimeMs,
          durationMs,
          phonemes: expectedPhonemes.map((phoneme, index) => ({
            phoneme,
            startTime: startTimeMs + (index * phoneDuration),
            endTime: index === expectedPhonemes.length - 1 ? endTimeMs : startTimeMs + ((index + 1) * phoneDuration),
            durationMs: phoneDuration,
            source: 'whisper-estimated' as const,
          })),
        };
      })
    );

    return {
      provider: 'whisper-timestamps',
      transcript,
      normalizedTranscript: transcript,
      wordIntervals,
      metadata: {
        ...metadata,
        whisperWordCount: whisperWords.length,
        targetWordCount: transcriptWords.length,
        matchRate: Number((wordIntervals.filter((w) => w.durationMs > 0).length / Math.max(1, transcriptWords.length)).toFixed(2)),
        phoneCount: wordIntervals.reduce((sum, word) => sum + word.phonemes.length, 0),
        timingSource: 'whisper-word-timestamps',
        timingQuality: this.calculateTimingQuality(wordIntervals.map((word) => word.durationMs)),
      },
    };
  }

  /**
   * Runs Montreal Forced Aligner for the most accurate phoneme-level alignment.
   */
  private async runMfa(
    audioPath: string,
    normalizedTranscript: string,
    workspaceDirectory: string,
    mode: 'strict' | 'best_effort',
    signal?: AbortSignal
  ): Promise<ForcedAlignmentResult> {
    const startTime = Date.now();
    const corpusDir = path.join(workspaceDirectory, 'mfa-corpus');
    const outputDir = path.join(workspaceDirectory, 'mfa-output');
    await fs.mkdir(corpusDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const baseName = 'utterance';
    const corpusAudioPath = path.join(corpusDir, `${baseName}.wav`);
    const corpusLabelPath = path.join(corpusDir, `${baseName}.lab`);
    const outputTextGridPath = path.join(outputDir, `${baseName}.TextGrid`);

    await fs.copyFile(audioPath, corpusAudioPath);
    await fs.writeFile(corpusLabelPath, `${normalizedTranscript}\n`, 'utf8');

    const mfaBinary = process.env.MFA_BINARY || 'mfa';
    const acousticModelPath = process.env.MFA_ACOUSTIC_MODEL_PATH!;
    const dictionaryPath = process.env.MFA_DICTIONARY_PATH!;
    const args = [
      'align',
      corpusDir,
      dictionaryPath,
      acousticModelPath,
      outputDir,
      '--clean',
      '--single_speaker',
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(mfaBinary, args, { stdio: 'ignore', signal });
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('MFA alignment timed out after 60 seconds'));
      }, 60_000);

      const abortHandler = () => {
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(new Error('MFA alignment aborted'));
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      child.on('error', (err) => {
        clearTimeout(timer);
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`MFA align exited with code ${code}`));
        }
      });
    }).then(() => telemetryService.recordServiceCall('mfa', Date.now() - startTime, false))
      .catch((err) => {
        telemetryService.recordServiceCall('mfa', Date.now() - startTime, true);
        throw err;
      });

    const parsed = await this.parser.parseFile(outputTextGridPath);
    return {
      provider: 'mfa',
      transcript: normalizedTranscript,
      normalizedTranscript,
      wordIntervals: parsed.words,
      metadata: {
        textGridPath: outputTextGridPath,
        dictionaryPath,
        acousticModelPath,
        mode,
        phoneCount: parsed.phones.length,
        targetWordCount: normalizedTranscript.split(/\s+/).filter(Boolean).length,
        matchRate: Number((parsed.words.filter((word) => word.durationMs > 0 && word.phonemes.length > 0).length / Math.max(1, parsed.words.length)).toFixed(2)),
        timingSource: 'mfa-textgrid',
        timingQuality: this.calculateTimingQuality(parsed.words.map((word) => word.durationMs)),
      },
    };
  }

  /**
   * Synthetic fallback alignment — creates evenly-spaced phoneme intervals.
   * Used ONLY when both MFA and Whisper timestamps are unavailable.
   */
  private async buildSyntheticFallback(
    transcript: string,
    metadata: { mode: 'strict' | 'best_effort' }
  ): Promise<ForcedAlignmentResult> {
    const words = transcript.split(/\s+/).filter(Boolean);
    let cursorMs = 0;
    const wordIntervals = await Promise.all(
      words.map(async (word, wordIndex) => {
        const expectedPhonemes = await this.lexicon.getPhonemesForWord(word, {
          sentence: transcript,
          wordIndex,
        });
        const startTime = cursorMs;
        const durationMs = Math.max(180, expectedPhonemes.length * 90);
        const endTime = startTime + durationMs;
        cursorMs = endTime;
        const phoneDuration = Math.max(50, Math.floor(durationMs / Math.max(1, expectedPhonemes.length)));

        return {
          word,
          normalizedWord: normalizeAlignmentWord(word),
          startTime,
          endTime,
          durationMs,
          phonemes: expectedPhonemes.map((phoneme, index) => ({
            phoneme,
            startTime: startTime + (index * phoneDuration),
            endTime: index === expectedPhonemes.length - 1 ? endTime : startTime + ((index + 1) * phoneDuration),
            durationMs: phoneDuration,
            source: 'synthetic' as const,
          })),
        };
      })
    );

    return {
      provider: 'fallback',
      transcript,
      normalizedTranscript: transcript,
      wordIntervals,
      metadata: {
        ...metadata,
        phoneCount: wordIntervals.reduce((sum, word) => sum + word.phonemes.length, 0),
        timingSource: 'synthetic',
        timingQuality: this.calculateTimingQuality(wordIntervals.map((word) => word.durationMs)),
      },
    };
  }

  private calculateTimingQuality(durations: number[]) {
    const usable = durations.filter((duration) => duration > 0);
    if (usable.length < 2) {
      return usable.length ? 0.5 : 0;
    }

    const mean = usable.reduce((sum, duration) => sum + duration, 0) / usable.length;
    const variance = usable.reduce((sum, duration) => sum + ((duration - mean) ** 2), 0) / usable.length;
    const coefficientOfVariation = Math.sqrt(variance) / Math.max(1, mean);
    return Number(Math.max(0, Math.min(1, coefficientOfVariation / 0.45)).toFixed(2));
  }
}
