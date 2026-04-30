/**
 * AI Chat Service Integration
 * Handles personality-based AI chat with OpenAI
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatSessionConfig {
    personalityId: string;
    userName: string;
    userTier: 'free' | 'pro' | 'premium';
    conversationHistory: ChatMessage[];
}
export interface AIResponse {
    content: string;
    formattedContent?: {
        segments: Array<{
            type: 'text' | 'error' | 'correction' | 'explanation';
            content: string;
            originalText?: string;
        }>;
        hasFormatting: boolean;
    };
    rawContent: string;
    tokensUsed?: number;
}
/**
 * Initialize a chat session with personality-specific system prompt
 */
export declare const initializeChatSession: (personalityId: string, userName: string, userTier: "free" | "pro" | "premium") => ChatMessage[];
/**
 * Get welcome message for a personality
 */
export declare const getPersonalityWelcome: (personalityId: string, userName: string) => string;
/**
 * Process user message and get AI response
 * This would integrate with OpenAI API in production
 */
export declare const processUserMessage: (config: ChatSessionConfig, userMessage: string) => Promise<AIResponse>;
/**
 * Validate AI response formatting
 */
export declare const validateAIResponse: (response: string) => {
    valid: boolean;
    issues: string[];
};
/**
 * Get personality capabilities
 */
export declare const getPersonalityCapabilities: (personalityId: string) => string[];
/**
 * Check if user has access to personality
 */
export declare const hasPersonalityAccess: (personalityId: string, userTier: "free" | "pro" | "premium") => boolean;
/**
 * Get all personalities available to user tier
 */
export declare const getAvailablePersonalities: (userTier: "free" | "pro" | "premium") => {
    id: string;
    tier: "free" | "pro" | "premium";
    capabilities: string[];
    teachingStyle: string;
    hasVisualFormatting: boolean;
}[];
/**
 * Example integration with OpenAI (commented out - requires API key)
 */
//# sourceMappingURL=chatService.d.ts.map