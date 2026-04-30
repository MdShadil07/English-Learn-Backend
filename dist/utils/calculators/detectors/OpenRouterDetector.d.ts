import { ICache } from '../core/interface.js';
export interface OpenRouterFluencyScore {
    score: number;
    reasoning: string;
    improvements: string[];
    strengths: string[];
    confidence: number;
    method: 'openrouter-mistral' | 'fallback';
}
/**
 * OpenRouter Fluency Detector
 * Uses free Mistral 7B Instruct model for fluency analysis
 * Falls back to basic scoring if API unavailable
 */
export declare class OpenRouterFluencyDetector {
    private apiKey;
    private cache;
    private model;
    private baseURL;
    constructor(apiKey: string, cache: ICache);
    analyzeFluency(text: string): Promise<OpenRouterFluencyScore>;
    isAvailable(): Promise<boolean>;
    /**
     * Fallback scoring when OpenRouter is unavailable
     * Uses basic heuristics
     */
    private getFallbackScore;
    getConfidence(): number;
}
//# sourceMappingURL=OpenRouterDetector.d.ts.map