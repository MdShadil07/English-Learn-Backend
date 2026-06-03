import type { IPracticeAttempt, IPronunciationUploadSession } from '../../models/index.js';

const normalizeState = (status?: string, processingStage?: string) => {
  if (status === 'failed' && processingStage === 'transcription_failed') {
    return 'retry_required';
  }

  if (status === 'completed' && processingStage === 'completed') {
    return 'completed';
  }

  return status || processingStage || 'uploaded';
};

const isTerminalState = (state?: string) =>
  state === 'completed' || state === 'failed' || state === 'retry_required' || state === 'cancelled';

export function toPronunciationAttemptResponse(attempt: IPracticeAttempt | any) {
  const data = typeof attempt.toObject === 'function' ? attempt.toObject() : attempt;
  const workflowState = normalizeState(data.status, data.processingStage);
  return {
    ...data,
    workflowState,
    isTerminal: isTerminalState(workflowState),
    isRetryable: workflowState === 'retry_required' || workflowState === 'failed',
  };
}

export function toPronunciationUploadSessionResponse(session: IPronunciationUploadSession | any) {
  const data = typeof session.toObject === 'function' ? session.toObject() : session;
  const workflowState = normalizeState(data.status, data.status);
  return {
    ...data,
    workflowState,
    isTerminal: isTerminalState(workflowState),
  };
}
