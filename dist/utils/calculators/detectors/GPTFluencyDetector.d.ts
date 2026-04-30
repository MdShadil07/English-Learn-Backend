import { ICache } from '../core/interface.js';
import { GPTFluencyScore, AnalysisConfig } from '../core/types.js';
export declare class GPTFluencyDetector {
    private apiKey;
    private cache;
    constructor(apiKey: string, cache: ICache);
    analyzeFluency(text: string, config: AnalysisConfig): Promise<GPTFluencyScore>;
}
//# sourceMappingURL=GPTFluencyDetector.d.ts.map