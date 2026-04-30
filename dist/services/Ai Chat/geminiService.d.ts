import { type UnifiedAccuracyResult } from '../../utils/calculators/unifiedAccuracyCalculators.js';
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
export interface AccuracyAnalysis extends Partial<UnifiedAccuracyResult> {
    overall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    feedback: string[];
}
export interface AIPersonality {
    id: string;
    name: string;
    tier: 'free' | 'pro' | 'premium';
    features: string[];
}
export interface GenerateResponseRequest {
    userMessage: string;
    personality: AIPersonality;
    conversationHistory: ChatMessage[];
    language: string;
    userId: string;
    userNativeLanguage?: string;
    userTier?: string;
    responseLanguage?: string;
    userProfile?: {
        userName?: string;
        userLevel?: number;
        totalXP?: number;
        currentStreak?: number;
        skillLevels?: {
            vocabulary?: number;
            grammar?: number;
            pronunciation?: number;
            fluency?: number;
        };
    };
}
export interface GenerateResponseResponse {
    response: string;
    accuracy?: AccuracyAnalysis;
    xpGained?: number;
}
export interface GeminiContent {
    role: 'user' | 'model';
    parts: {
        text: string;
    }[];
}
export interface GeminiRequest {
    contents: GeminiContent[];
    generationConfig?: {
        temperature?: number;
        maxOutputTokens?: number;
        topK?: number;
        topP?: number;
    };
}
export interface GeminiResponse {
    candidates: {
        content: {
            parts: {
                text: string;
            }[];
        };
    }[];
}
export declare class GeminiAIService {
    private apiKey;
    private baseUrl;
    private model;
    private maxTokens;
    private temperature;
    private responseQueue;
    private analysisQueue;
    private rabbitConnection;
    private requestTimeout;
    private maxRetries;
    private retryDelayMs;
    private fallbackResponses;
    private verboseLogging;
    constructor(apiKey: string);
    private initializeQueues;
    private initializeRabbitMQ;
    private setupWorkers;
    private getGeminiEndpoint;
    private getFallbackResponse;
    private buildGenerationConfigForTier;
    private shouldRetryGeminiError;
    private logGeminiFailure;
    private extractErrorDebugInfo;
    private delay;
    private sendGeminiRequestWithRetries;
    generateResponse(request: GenerateResponseRequest): Promise<GenerateResponseResponse>;
    private generateResponseInternal;
    private buildPrompt;
    analyzeMessage(message: string, userId: string, tier?: string): Promise<AccuracyAnalysis>;
    private analyzeMessageInternal;
    close(): Promise<void>;
    checkQueueHealth(): Promise<{
        status: string;
        message: string;
        responseQueue: null;
        analysisQueue: null;
    } | {
        responseQueue: {
            waiting: any;
            active: any;
            completed: any;
            failed: any;
        };
        analysisQueue: {
            waiting: any;
            active: any;
            completed: any;
            failed: any;
        };
        status?: undefined;
        message?: undefined;
    }>;
}
//# sourceMappingURL=geminiService.d.ts.map