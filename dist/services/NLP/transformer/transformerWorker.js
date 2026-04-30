import { parentPort } from 'node:worker_threads';
import { configureTransformers } from './configuration.js';
if (!parentPort) {
    throw new Error('Transformer worker must run inside a worker thread');
}
await import('../../../config/ortLogging.js');
let transformerResourcesPromise = null;
const getTransformerResources = async () => {
    if (!transformerResourcesPromise) {
        transformerResourcesPromise = (async () => {
            const transformers = (await import('@xenova/transformers'));
            configureTransformers(transformers);
            const { AutoTokenizer, AutoModelForCausalLM } = transformers;
            const [tokenizer, model] = await Promise.all([
                AutoTokenizer.from_pretrained('Xenova/gpt2'),
                AutoModelForCausalLM.from_pretrained('Xenova/gpt2', { quantized: true }),
            ]);
            return { tokenizer, model };
        })().catch((error) => {
            transformerResourcesPromise = null;
            throw error;
        });
    }
    return transformerResourcesPromise;
};
const computePerplexity = async (text) => {
    const normalized = text.trim().replace(/\s+/g, ' ');
    if (!normalized) {
        return { perplexity: Number.POSITIVE_INFINITY, tokenCount: 0 };
    }
    const { tokenizer, model } = await getTransformerResources();
    const inputs = await tokenizer(normalized, {
        return_tensors: 'np',
        max_length: 256,
        truncation: true,
    });
    const inputIds = inputs.input_ids;
    if (!inputIds) {
        return { perplexity: Number.POSITIVE_INFINITY, tokenCount: 0 };
    }
    const outputs = await model({ ...inputs });
    const logits = outputs.logits;
    const vocabSize = logits.dims[logits.dims.length - 1];
    const sequenceLength = logits.dims[1];
    const logitsData = logits.data;
    const rawTargetIds = Array.from(inputIds.data);
    const targetIds = rawTargetIds.map((value) => Number(value));
    let logLikelihood = 0;
    let tokenCount = 0;
    for (let index = 0; index < sequenceLength - 1; index += 1) {
        const offset = index * vocabSize;
        let maxLogit = -Infinity;
        for (let j = 0; j < vocabSize; j += 1) {
            const value = logitsData[offset + j];
            if (value > maxLogit) {
                maxLogit = value;
            }
        }
        let sumExp = 0;
        for (let j = 0; j < vocabSize; j += 1) {
            sumExp += Math.exp(logitsData[offset + j] - maxLogit);
        }
        const logSumExp = maxLogit + Math.log(sumExp);
        const nextTokenId = targetIds[index + 1];
        if (Number.isFinite(nextTokenId) && nextTokenId >= 0 && nextTokenId < vocabSize) {
            const tokenLogProb = logitsData[offset + nextTokenId] - logSumExp;
            logLikelihood += tokenLogProb;
            tokenCount += 1;
        }
    }
    if (tokenCount === 0) {
        return { perplexity: Number.POSITIVE_INFINITY, tokenCount };
    }
    const avgNegLogLikelihood = -logLikelihood / tokenCount;
    const perplexity = Math.exp(avgNegLogLikelihood);
    return { perplexity, tokenCount };
};
const emitResponse = (response) => {
    parentPort.postMessage(response);
};
const handleRequest = async (request) => {
    if (request.type !== 'compute') {
        return;
    }
    try {
        const result = await computePerplexity(request.text);
        emitResponse({ id: request.id, status: 'ok', result });
    }
    catch (error) {
        const normalizedError = error instanceof Error ? error : new Error('Unknown transformer worker error');
        emitResponse({
            id: request.id,
            status: 'error',
            error: {
                message: normalizedError.message,
                stack: normalizedError.stack,
            },
        });
    }
};
parentPort.on('message', (message) => {
    void handleRequest(message);
});
//# sourceMappingURL=transformerWorker.js.map