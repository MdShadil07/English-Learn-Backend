export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptResult {
  text: string;
  language: string;
  confidence: number;
  duration: number;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }>;
  words?: WordTimestamp[];
}

export interface TranscriptionProvider {
  transcribe(audioPath: string, options?: { signal?: AbortSignal }): Promise<TranscriptResult>;
}