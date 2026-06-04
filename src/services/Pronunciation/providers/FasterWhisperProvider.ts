import axios, { AxiosError } from 'axios';
import { TranscriptionProvider, TranscriptResult } from './TranscriptionProvider.js';
import { logger } from '../../../utils/calculators/core/logger.js';
import { telemetryService } from '../../../services/telemetryService.js';

export class FasterWhisperProvider implements TranscriptionProvider {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl: string = process.env.SPEECH_WORKER_URL || 'http://localhost:8001', timeout: number = 90000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async transcribe(audioPath: string, options?: { signal?: AbortSignal }): Promise<TranscriptResult> {
    const startTime = Date.now();

    try {
      logger.info({ audioPath }, 'Starting transcription with FasterWhisper');

      const response = await axios.post(
        `${this.baseUrl}/transcribe`,
        { audioPath },
        {
          timeout: this.timeout,
          signal: options?.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const duration = Date.now() - startTime;
      telemetryService.recordServiceCall('whisper', duration, false);

      logger.info({
        audioPath,
        duration,
        confidence: response.data.confidence,
        textLength: response.data.text.length,
      }, 'Transcription completed');

      return {
        text: response.data.text,
        language: response.data.language,
        confidence: response.data.confidence,
        duration: response.data.duration,
        segments: response.data.segments,
      };

    } catch (error) {
      telemetryService.recordServiceCall('whisper', Date.now() - startTime, true);
      const duration = Date.now() - startTime;

      if (error instanceof AxiosError) {
        const responseData = error.response?.data;
        const errorDetail = responseData?.error || responseData?.detail || responseData?.message || error.message;
        
        logger.error({
          audioPath,
          duration,
          status: error.response?.status,
          statusText: error.response?.statusText,
          error: errorDetail,
          responseData: responseData,
        }, 'FasterWhisper transcription failed');

        // Classify error types for trust-aware handling
        if (error.response?.status === 404) {
          throw new Error(`AUDIO_FILE_NOT_FOUND: ${errorDetail}`);
        } else if (error.response?.status === 503) {
          throw new Error(`SPEECH_WORKER_UNAVAILABLE: ${errorDetail}`);
        } else if (error.response?.status && error.response.status >= 500) {
          throw new Error(`SPEECH_WORKER_ERROR: ${errorDetail}`);
        } else {
          throw new Error(`TRANSCRIPTION_FAILED: ${errorDetail}`);
        }
      }

      logger.error({
        audioPath,
        duration,
        error: error instanceof Error ? error.message : String(error),
      }, 'Unexpected error during transcription');

      throw new Error(`TRANSCRIPTION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.data.status === 'healthy' && response.data.model_loaded;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Speech worker health check failed');
      return false;
    }
  }

  async analyzeAcoustics(
    audioPath: string,
    phones: Array<{ phoneme: string; startTime: number; endTime: number }>
  ): Promise<any> {
    const startTime = Date.now();
    try {
      logger.info({ audioPath, phoneCount: phones.length }, 'Starting acoustic analysis with Python worker');
      const response = await axios.post(
        `${this.baseUrl}/acoustic/phonemes`,
        { audioPath, phones },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const duration = Date.now() - startTime;
      telemetryService.recordServiceCall('acoustic_analysis', duration, false);
      return response.data;
    } catch (error) {
      telemetryService.recordServiceCall('acoustic_analysis', Date.now() - startTime, true);
      logger.warn({
        audioPath,
        error: error instanceof Error ? error.message : String(error)
      }, 'Acoustic analysis failed, continuing without acoustic features');
      return null;
    }
  }
}