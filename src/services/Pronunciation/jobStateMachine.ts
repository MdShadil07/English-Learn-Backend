import { PracticeSession, PronunciationJob, PronunciationUploadSession } from '../../models/index.js';

export type PronunciationJobState =
  | 'uploaded'
  | 'preprocessing'
  | 'transcribing'
  | 'aligning'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'retry_required';

type SessionState = 'in_progress' | 'failed' | 'completed';

export function setAttemptState(target: { status?: string; processingStage?: string }, state: PronunciationJobState) {
  target.status = state;
  target.processingStage = state;
}

export async function setSessionProgress(sessionId: unknown, processingStage: PronunciationJobState) {
  await PracticeSession.findByIdAndUpdate(sessionId, {
    processingStage,
  });
}

export async function setSessionTerminalState(
  sessionId: unknown,
  state: SessionState,
  processingStage: PronunciationJobState
) {
  await PracticeSession.findByIdAndUpdate(sessionId, {
    status: state,
    processingStage,
    ...(state === 'in_progress' ? { startedAt: new Date() } : { completedAt: new Date() }),
  });
}

export async function createPronunciationJobRecord(payload: {
  attemptId: string;
  userId: unknown;
  sessionId: unknown;
  passageId: unknown;
  audioUrl: string;
  audioObjectKey?: string;
  audioMimeType?: string;
  transcript: string;
  attemptNumber: number;
  timeoutMs?: number;
}) {
  return PronunciationJob.findOneAndUpdate(
    { attemptId: payload.attemptId },
    {
      $setOnInsert: {
        attemptId: payload.attemptId,
        userId: payload.userId,
        sessionId: payload.sessionId,
        passageId: payload.passageId,
        audioUrl: payload.audioUrl,
        audioObjectKey: payload.audioObjectKey,
        audioMimeType: payload.audioMimeType,
        transcript: payload.transcript,
        attemptNumber: payload.attemptNumber,
        timeoutMs: payload.timeoutMs || 90000,
        retryCount: 0,
        maxRetries: 3,
        status: 'QUEUED',
        history: [
          {
            state: 'QUEUED',
            at: new Date(),
          },
        ],
      },
    },
    { upsert: true, new: true }
  );
}

export async function setPronunciationJobState(
  attemptId: string,
  state: 'QUEUED' | 'VALIDATING' | 'DOWNLOADING' | 'PREPROCESSING' | 'INFERENCE' | 'SCORING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'TIMED_OUT' | 'CANCELLED',
  options: { message?: string; workerId?: string; error?: Error | string; retryCount?: number } = {}
) {
  const errorPayload = options.error
    ? {
        message: options.error instanceof Error ? options.error.message : options.error,
        code: options.error instanceof Error && 'code' in options.error ? String((options.error as Error & { code?: string }).code || '') : undefined,
      }
    : undefined;

  return PronunciationJob.findOneAndUpdate(
    { attemptId },
    {
      $set: {
        status: state,
        ...(options.workerId ? { workerId: options.workerId } : {}),
        ...(typeof options.retryCount === 'number' ? { retryCount: options.retryCount } : {}),
        ...(errorPayload ? { lastError: { ...errorPayload, at: new Date() } } : {}),
      },
      $push: {
        history: {
          state,
          at: new Date(),
          ...(options.message ? { message: options.message } : {}),
          ...(options.workerId ? { workerId: options.workerId } : {}),
        },
      },
    },
    { new: true }
  );
}

export async function setUploadSessionState(
  uploadSessionId: unknown,
  patch: {
    status: string;
    errorMessage?: string;
    observability?: Record<string, unknown>;
  }
) {
  await PronunciationUploadSession.findByIdAndUpdate(uploadSessionId, {
    $set: {
      status: patch.status,
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.observability ? { observability: patch.observability } : {}),
      lastActivityAt: new Date(),
    },
  });
}
