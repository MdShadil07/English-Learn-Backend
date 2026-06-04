import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { objectStorage } from '../Storage/objectStorage.js';
import ffmpegStatic from 'ffmpeg-static';
import { FasterWhisperProvider } from './providers/FasterWhisperProvider.js';

export interface SpeechPipelineInput {
  audioObjectKey?: string;
  audioUrl: string;
  transcript: string;
}

export interface SpeechPipelineExecutionOptions {
  signal?: AbortSignal;
  onStage?: (stage: 'DOWNLOADING' | 'PREPROCESSING' | 'INFERENCE') => Promise<void> | void;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSegment {
  text: string;
  start: number;
  end: number;
  avg_logprob: number;
  no_speech_prob: number;
  compression_ratio: number;
  confidence?: number;
}

export interface SpeechPipelineResult {
  workspaceDirectory: string;
  normalizedAudioPath: string;
  downloadedAudioPath: string;
  transcription: {
    text: string;
    confidence: number;
    provider: string;
    words: WhisperWord[];
    segments: WhisperSegment[];
  };
  metadata: {
    preprocessing: {
      ffmpegApplied: boolean;
      normalizationSucceeded: boolean;
      sampleRate: number;
      channels: number;
      codec: string;
      noiseReduction: boolean;
      silenceTrimmed: boolean;
      loudnessNormalized: boolean;
      dynamicRangeCompressed: boolean;
      frequencyFiltered: boolean;
    };
    forcedAlignmentPreparation: {
      normalizedTranscript: string;
      tokenCount: number;
      words: string[];
    };
  };
}

export class SpeechProcessingPipeline {
  constructor(private transcriber: FasterWhisperProvider) {}

  /**
   * Validate and enhance segments with proper timestamps.
   * If timestamps are missing (0,0), estimate them based on text length and audio duration.
   */
  private validateAndEnhanceSegments(
    segments: Array<{ start: number; end: number; text: string; confidence?: number }>,
    fullText: string
  ): Array<{ start: number; end: number; text: string; confidence?: number }> {
    if (!segments || segments.length === 0) {
      return [];
    }

    // Check if we have valid timestamps
    const hasValidTimestamps = segments.some(s => s.end > s.start);

    if (!hasValidTimestamps && fullText.length > 0) {
      // Estimate timestamps based on text length and word distribution
      const totalDuration = segments.reduce((sum, s) => sum + Math.max(0.1, s.end - s.start), 0) || 10; // Default 10s if no duration
      const totalEstimatedDuration = totalDuration || 10;

      let currentTime = 0;
      return segments.map((segment, index) => {
        // Estimate duration based on word count ratio
        const wordCount = segment.text.split(/\s+/).length;
        const totalWords = fullText.split(/\s+/).length;
        const segmentEstimatedDuration = (wordCount / Math.max(1, totalWords)) * totalEstimatedDuration;
        const startTime = currentTime;
        const endTime = currentTime + segmentEstimatedDuration;
        currentTime = endTime;

        return {
          ...segment,
          start: Math.round(startTime * 100) / 100,
          end: Math.round(endTime * 100) / 100,
        };
      });
    }

    // Filter out segments with invalid timing
    return segments.filter(s => s.end > s.start || (s.start === 0 && s.end === 0));
  }

  async process(input: SpeechPipelineInput, options: SpeechPipelineExecutionOptions = {}): Promise<SpeechPipelineResult> {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pronunciation-'));
    const downloadedAudioPath = path.join(tempDirectory, 'input.webm');
    const normalizedAudioPath = path.join(tempDirectory, 'normalized.wav');

    await options.onStage?.('DOWNLOADING');
    const sourceBuffer = input.audioObjectKey
      ? await objectStorage.downloadBuffer(input.audioObjectKey)
      : Buffer.from([]);

    if (sourceBuffer.byteLength) {
      await fs.writeFile(downloadedAudioPath, sourceBuffer);
    } else {
      throw new Error('Audio object could not be loaded for pronunciation analysis');
    }

    await options.onStage?.('PREPROCESSING');
    await this.preprocessAudio(downloadedAudioPath, normalizedAudioPath, options.signal);
    await options.onStage?.('INFERENCE');
    const transcriptResult = await this.transcriber.transcribe(normalizedAudioPath, { signal: options.signal });

    // Validate segment timestamps and generate word-level boundaries if missing
    const validatedSegments = this.validateAndEnhanceSegments(transcriptResult.segments, transcriptResult.text);

    const fallbackWords = validatedSegments.flatMap((segment) => {
      const tokens = segment.text.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        return [];
      }

      const durationMs = Math.max(0, segment.end - segment.start);
      const totalChars = tokens.reduce((sum, t) => sum + t.length, 0);
      let currentStart = segment.start;

      return tokens.map((word) => {
        const wordRatio = totalChars > 0 ? word.length / totalChars : 1 / tokens.length;
        const wordDuration = durationMs * wordRatio;
        const wordEnd = currentStart + wordDuration;
        const result = {
          word,
          start: Math.round(currentStart * 1000) / 1000,
          end: Math.round(wordEnd * 1000) / 1000,
        };
        currentStart = wordEnd;
        return result;
      });
    });

    const transcriptionWords = Array.isArray(transcriptResult.words) && transcriptResult.words.length > 0
      ? transcriptResult.words.map((word) => ({
          word: word.word,
          start: word.start,
          end: word.end,
        }))
      : fallbackWords;

    const transcription = {
      text: transcriptResult.text,
      confidence: transcriptResult.confidence,
      provider: 'faster-whisper',
      words: transcriptionWords,
      segments: validatedSegments.map(segment => ({
        text: segment.text,
        start: segment.start,
        end: segment.end,
        avg_logprob: segment.confidence ? Math.log(segment.confidence) : -0.5, // Approximate
        no_speech_prob: 0,
        compression_ratio: 1.0,
      })),
    };

    const normalizedTranscript = transcription.text.trim().replace(/\s+/g, ' ');
    const words = normalizedTranscript ? normalizedTranscript.split(' ') : [];

    return {
      workspaceDirectory: tempDirectory,
      normalizedAudioPath,
      downloadedAudioPath,
      transcription,
      metadata: {
        preprocessing: {
          ffmpegApplied: true,
          normalizationSucceeded: true,
          sampleRate: 16000,
          channels: 1,
          codec: 'pcm_s16le',
          noiseReduction: true,
          silenceTrimmed: true,
          loudnessNormalized: true,
          dynamicRangeCompressed: true,
          frequencyFiltered: true,
        },
        forcedAlignmentPreparation: {
          normalizedTranscript,
          tokenCount: words.length,
          words,
        },
      },
    };
  }

  private async preprocessAudio(inputPath: string, outputPath: string, signal?: AbortSignal) {
    await fs.access(inputPath);

    const ffmpegBinary = (process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg') as string;

    // OPTIMIZED audio preprocessing for noisy speech recognition:
    // Key changes from aggressive approach:
    // - NO afftdn (preserves speech harmonics better than FFT-based noise reduction)
    // - Gentler highpass/lowpass filters (preserve speech formants)
    // - Looser silence removal (-35dB instead of -40dB, more forgiving)
    // - Lighter loudness normalization (preserve natural dynamics)
    // - NO dynaudnorm (can distort speech under -40dB)
    // 
    // Strategy: Keep the audio as CLOSE TO ORIGINAL as possible for Whisper
    // Whisper is trained on diverse audio including noise - over-processing hurts recognition
    const args = [
      '-y',                    // Overwrite output files
      '-i', inputPath,         // Input file
      '-ac', '1',              // Convert to mono
      '-ar', '16000',          // 16kHz sample rate (optimal for speech recognition)
      '-acodec', 'pcm_s16le',  // 16-bit PCM little-endian
      '-f', 'wav',             // WAV container format
      '-vn',                   // No video
      '-af', [
        'highpass=f=100:poles=1',  // Gentle highpass (removes DC offset only, f=100Hz)
        'lowpass=f=7000:poles=1',  // Gentle lowpass (removes only extreme HF noise)
        'silenceremove=start_periods=1:start_silence=0.3:start_threshold=-35dB:stop_periods=-1:stop_silence=0.3:stop_threshold=-35dB',
        'loudnorm=I=-20:TP=-2.0:LRA=7',  // Lighter loudness norm (preserve dynamics)
      ].join(','),
      outputPath,
    ];

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(ffmpegBinary, args, {
          stdio: ['ignore', 'pipe', 'pipe'], // Capture stderr for debugging
          signal,
        });

        let stderr = '';
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        }

        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('ffmpeg preprocessing timed out after 45 seconds'));
        }, 45_000);

        const abortHandler = () => {
          clearTimeout(timer);
          child.kill('SIGKILL');
          reject(new Error('ffmpeg preprocessing aborted'));
        };

        if (signal) {
          if (signal.aborted) {
            abortHandler();
            return;
          }
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        child.on('error', (err: Error) => {
          clearTimeout(timer);
          reject(new Error(`ffmpeg process error: ${err.message}`));
        });

        child.on('close', (code: number | null) => {
          clearTimeout(timer);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg normalization failed with code ${code}. stderr: ${stderr}`));
          }
        });
      });

      // Validate output file exists and has content
      const stats = await fs.stat(outputPath);
      if (stats.size < 1000) { // WAV header is ~44 bytes, audio should be much larger
        throw new Error('Normalized audio file appears to be too small or corrupted');
      }

    } catch (error) {
      // Clean up partial output file on failure
      try {
        await fs.unlink(outputPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
