import type { TransformersModule } from './types.js';

export const configureTransformers = (module: TransformersModule) => {
  const { env } = module;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  (env as unknown as { logLevel?: string }).logLevel = 'fatal';

  const onnxBackend = (env as unknown as { backends?: { onnx?: Record<string, unknown> } }).backends?.onnx;
  if (!onnxBackend) {
    return;
  }

  onnxBackend.logLevel = 'fatal';
  (onnxBackend as Record<string, unknown>).logSeverityLevel = 4;
  (onnxBackend as Record<string, unknown>).logVerbosityLevel = 0;
  (onnxBackend as Record<string, unknown>).debug = false;

  const sessionOptions = (onnxBackend as {
    sessionOptions?: { logSeverityLevel?: number; logVerbosityLevel?: number; graphOptimizationLevel?: string };
  }).sessionOptions ?? {};

  sessionOptions.logSeverityLevel = 4;
  sessionOptions.logVerbosityLevel = 0;

  if (typeof sessionOptions.graphOptimizationLevel === 'undefined') {
    sessionOptions.graphOptimizationLevel = 'disabled';
  }

  (onnxBackend as {
    sessionOptions?: { logSeverityLevel?: number; logVerbosityLevel?: number; graphOptimizationLevel?: string };
  }).sessionOptions = sessionOptions;
};
