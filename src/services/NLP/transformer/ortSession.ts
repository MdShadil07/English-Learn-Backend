/**
 * Singleton ONNX Runtime session helper
 * Ensures the ONNX session is created once per process and reused.
 */
// ONNX runtime native module is optional in this project; avoid strict typing so
// the main build won't fail when the native package isn't installed.
let sessionCache: any | null = null;

export async function getOrtSession(modelPath: string, options?: Partial<{
  executionProviders: string[];
  graphOptimizationLevel: string | number;
  logSeverityLevel: number;
}>): Promise<any> {
  if (sessionCache) return sessionCache;

  // Lazy import to avoid requiring the native module unless needed
  let ort: any;
  // Use a dynamic import via Function to avoid TypeScript/static module
  // resolution errors when the optional native package isn't installed.
  const dynamicImport: (m: string) => Promise<any> = (m: string) => {
    // eslint-disable-next-line no-new-func
    return (new Function('m', 'return import(m);') as any)(m);
  };

  try {
    ort = await dynamicImport('onnxruntime-node');
  } catch (e) {
    try {
      ort = await dynamicImport('onnxruntime');
    } catch (err) {
      throw new Error('ONNX Runtime is not available in this environment');
    }
  }

  const execProviders = options?.executionProviders ?? ['cpu'];
  const graphLevel = options?.graphOptimizationLevel ?? 'all';
  const logSeverity = typeof options?.logSeverityLevel === 'number' ? options!.logSeverityLevel : 4;

  const createOptions: any = {
    executionProviders: execProviders,
    graphOptimizationLevel: graphLevel,
    logSeverityLevel: logSeverity,
  };

  // Try to reduce ONNX runtime logging if the API is present
  try {
    if (ort && ort.logging && typeof ort.logging.setLoggingLevel === 'function') {
      try { ort.logging.setLoggingLevel('warning'); } catch {}
    }
    if (ort && ort.logging && typeof ort.logging.setLogLevel === 'function') {
      try { ort.logging.setLogLevel('warning'); } catch {}
    }
  } catch {
    // Not critical; continue
  }

  sessionCache = await ort.InferenceSession.create(modelPath, createOptions as any);
  return sessionCache;
}

export function clearOrtSession() {
  sessionCache = null;
}
