export const configureTransformers = (module) => {
    const { env } = module;
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    env.logLevel = 'fatal';
    const onnxBackend = env.backends?.onnx;
    if (!onnxBackend) {
        return;
    }
    onnxBackend.logLevel = 'fatal';
    onnxBackend.logSeverityLevel = 4;
    onnxBackend.logVerbosityLevel = 0;
    onnxBackend.debug = false;
    const sessionOptions = onnxBackend.sessionOptions ?? {};
    sessionOptions.logSeverityLevel = 4;
    sessionOptions.logVerbosityLevel = 0;
    if (typeof sessionOptions.graphOptimizationLevel === 'undefined') {
        sessionOptions.graphOptimizationLevel = 'disabled';
    }
    onnxBackend.sessionOptions = sessionOptions;
};
//# sourceMappingURL=configuration.js.map