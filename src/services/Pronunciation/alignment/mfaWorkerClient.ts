/**
 * mfaWorkerClient.ts — HTTP client for the MFA Deep Alignment Worker microservice.
 *
 * Called by MontrealForcedAlignerService when:
 *   - MFA_DEEP_ANALYSIS_ENABLED=true   (feature flag)
 *   - MFA_WORKER_URL is set            (remote service URL)
 *   - The user is premium              (tier gate, enforced in pronunciationService)
 *
 * The MFA worker runs on a separate Linux server with Kaldi + conda-forge MFA.
 * It accepts base64-encoded WAV audio + transcript and returns a TextGrid-derived
 * word/phoneme interval structure that maps 1:1 to ForcedAlignmentResult.
 */

import * as fs from 'fs/promises';
import type { ForcedAlignmentResult, AlignmentWordInterval, AlignmentPhoneInterval } from './types.js';
import { logger } from '../../../utils/calculators/core/logger.js';

// ─── Configuration ─────────────────────────────────────────────────────────
const MFA_WORKER_URL = process.env.MFA_WORKER_URL || 'http://localhost:8002';
const MFA_WORKER_TIMEOUT_MS = Number(process.env.MFA_WORKER_TIMEOUT_MS || '95000');
const MFA_DEEP_ANALYSIS_ENABLED = process.env.MFA_DEEP_ANALYSIS_ENABLED === 'true';

// ─── Types (matching the Python schemas) ───────────────────────────────────
interface MfaPhonemeInterval {
  phoneme: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  source: string;
}

interface MfaWordInterval {
  word: string;
  normalized_word: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  phonemes: MfaPhonemeInterval[];
}

interface MfaAlignResponse {
  provider: string;
  transcript: string;
  normalized_transcript: string;
  word_intervals: MfaWordInterval[];
  metadata: {
    phone_count: number;
    target_word_count: number;
    match_rate: number;
    timing_source: string;
    duration_ms: number;
    mfa_version?: string;
  };
}

interface MfaHealthResponse {
  status: 'healthy' | 'degraded';
  mfa_version?: string;
  models_available: string[];
  message?: string;
}

// ─── Client ────────────────────────────────────────────────────────────────

export class MfaWorkerClient {
  /**
   * Returns true if the MFA deep analysis path is enabled and configured.
   * Does NOT make a network call — purely env-driven.
   */
  isEnabled(): boolean {
    return MFA_DEEP_ANALYSIS_ENABLED && Boolean(MFA_WORKER_URL);
  }

  /**
   * Health check — fast probe to confirm the MFA worker is reachable and models are loaded.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${MFA_WORKER_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const body = await res.json() as MfaHealthResponse;
      return body.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Send audio + transcript to the MFA worker and get back forced alignment.
   *
   * @param audioPath  Path to the local WAV file (fallback if URL missing)
   * @param audioUrl   Direct URL to the audio file (e.g. AWS S3)
   * @param transcript Expected passage text
   * @param jobId      Optional job reference for server-side logging
   * @param signal     AbortSignal for cancellation
   */
  async align(
    audioPath: string,
    audioUrl: string | undefined,
    audioObjectKey: string | undefined,
    transcript: string,
    jobId?: string,
    signal?: AbortSignal
  ): Promise<ForcedAlignmentResult> {
    let audioBase64: string | undefined;
    
    // If we don't have a URL AND no object key, fallback to reading and base64-encoding the local file
    if (!audioUrl && !audioObjectKey && audioPath) {
      const audioBuffer = await fs.readFile(audioPath);
      audioBase64 = audioBuffer.toString('base64');
    }

    const body = JSON.stringify({
      audio_url: audioUrl,
      audio_base64: audioBase64,
      audio_object_key: audioObjectKey,
      bucket: process.env.OBJECT_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || 'uploads',
      transcript,
      language: 'english_us_arpa',
      job_id: jobId,
    });

    logger.info(
      { jobId, audioPath, transcriptLength: transcript.length },
      '[MFA Worker] Sending alignment request'
    );

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(new Error(`MFA worker timeout after ${MFA_WORKER_TIMEOUT_MS}ms`)),
      MFA_WORKER_TIMEOUT_MS
    );
    // Chain external signal with our timeout signal
    signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });

    let response: Response;
    try {
      response = await fetch(`${MFA_WORKER_URL}/align`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `MFA worker returned HTTP ${response.status}: ${errorBody.slice(0, 2000)}`
      );
    }

    const mfaResult = await response.json() as MfaAlignResponse;

    logger.info(
      {
        jobId,
        words: mfaResult.word_intervals.length,
        phones: mfaResult.metadata.phone_count,
        matchRate: mfaResult.metadata.match_rate,
        durationMs: mfaResult.metadata.duration_ms,
      },
      '[MFA Worker] Alignment complete'
    );

    return this.toForcedAlignmentResult(mfaResult);
  }

  // ─── Private: schema translation ──────────────────────────────────────────

  private toForcedAlignmentResult(raw: MfaAlignResponse): ForcedAlignmentResult {
    const wordIntervals: AlignmentWordInterval[] = raw.word_intervals.map((w) => ({
      word: w.word,
      normalizedWord: w.normalized_word,
      startTime: w.start_ms,
      endTime: w.end_ms,
      durationMs: w.duration_ms,
      phonemes: w.phonemes.map(
        (p): AlignmentPhoneInterval => ({
          phoneme: p.phoneme,
          startTime: p.start_ms,
          endTime: p.end_ms,
          durationMs: p.duration_ms,
          source: 'mfa',
        })
      ),
    }));

    return {
      provider: 'mfa',
      transcript: raw.transcript,
      normalizedTranscript: raw.normalized_transcript,
      wordIntervals,
      metadata: {
        mode: 'best_effort',
        phoneCount: raw.metadata.phone_count,
        targetWordCount: raw.metadata.target_word_count,
        matchRate: raw.metadata.match_rate,
        timingSource: 'mfa-textgrid',
        timingQuality: raw.metadata.match_rate, // use match rate as a proxy
      },
    };
  }
}

export const mfaWorkerClient = new MfaWorkerClient();
