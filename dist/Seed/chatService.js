/**
 * AI Chat Service Integration
 * Handles personality-based AI chat with OpenAI
 */
import { personalityPrompts, getPersonalityPrompt, getWelcomeMessage } from './personalityPrompts.js';
import { parseFormattedResponse, stripFormatting, validateFormatting } from './responseFormatter.js';
/**
 * Initialize a chat session with personality-specific system prompt
 */
export const initializeChatSession = (personalityId, userName, userTier) => {
    const personality = getPersonalityPrompt(personalityId);
    if (!personality) {
        throw new Error(`Invalid personality ID: ${personalityId}`);
    }
    // Verify user tier matches personality tier
    if (personality.tier === 'premium' && userTier === 'free') {
        throw new Error('Premium personality requires premium subscription');
    }
    if (personality.tier === 'pro' && userTier === 'free') {
        throw new Error('Pro personality requires pro or premium subscription');
    }
    // Initialize with system prompt
    const messages = [
        {
            role: 'system',
            content: personality.systemPrompt
        }
    ];
    return messages;
};
/**
 * Get welcome message for a personality
 */
export const getPersonalityWelcome = (personalityId, userName) => {
    return getWelcomeMessage(personalityId, userName);
};
/**
 * Process user message and get AI response
 * This would integrate with OpenAI API in production
 */
export const processUserMessage = async (config, userMessage) => {
    const personality = getPersonalityPrompt(config.personalityId);
    if (!personality) {
        throw new Error(`Invalid personality ID: ${config.personalityId}`);
    }
    // Verify tier access
    if (personality.tier === 'premium' && config.userTier !== 'premium') {
        throw new Error('This personality requires a premium subscription');
    }
    if (personality.tier === 'pro' && config.userTier === 'free') {
        throw new Error('This personality requires a pro or premium subscription');
    }
    // Add user message to history
    const messages = [
        ...config.conversationHistory,
        {
            role: 'user',
            content: userMessage
        }
    ];
    // Here you would call OpenAI API
    // For now, return a structured response
    // Example: const response = await openai.chat.completions.create({
    //   model: 'gpt-4',
    //   messages: messages,
    //   temperature: 0.7,
    //   max_tokens: 1000
    // });
    // Mock response for demonstration
    const mockResponse = `Thank you for your message! I'll help you improve your English.`;
    // Parse formatting if personality supports it
    let formattedContent;
    if (personality.visualFormatting.enabled) {
        const parsed = parseFormattedResponse(mockResponse);
        formattedContent = {
            segments: parsed.segments,
            hasFormatting: parsed.hasFormatting
        };
    }
    return {
        content: personality.visualFormatting.enabled ? mockResponse : stripFormatting(mockResponse),
        formattedContent,
        rawContent: mockResponse,
        tokensUsed: 0 // Would come from API response
    };
};
/**
 * Validate AI response formatting
 */
export const validateAIResponse = (response) => {
    return validateFormatting(response);
};
/**
 * Get personality capabilities
 */
export const getPersonalityCapabilities = (personalityId) => {
    const personality = getPersonalityPrompt(personalityId);
    return personality ? personality.capabilities : [];
};
/**
 * Check if user has access to personality
 */
export const hasPersonalityAccess = (personalityId, userTier) => {
    const personality = getPersonalityPrompt(personalityId);
    if (!personality)
        return false;
    // Free tier can only access free personalities
    if (userTier === 'free' && personality.tier !== 'free') {
        return false;
    }
    // Pro tier can access free and pro personalities
    if (userTier === 'pro' && personality.tier === 'premium') {
        return false;
    }
    // Premium tier can access all personalities
    return true;
};
/**
 * Get all personalities available to user tier
 */
export const getAvailablePersonalities = (userTier) => {
    return Object.entries(personalityPrompts)
        .filter(([_, personality]) => {
        if (userTier === 'free')
            return personality.tier === 'free';
        if (userTier === 'pro')
            return personality.tier !== 'premium';
        return true; // Premium gets all
    })
        .map(([id, personality]) => ({
        id,
        tier: personality.tier,
        capabilities: personality.capabilities,
        teachingStyle: personality.teachingStyle,
        hasVisualFormatting: personality.visualFormatting.enabled
    }));
};
/**
 * Example integration with OpenAI (commented out - requires API key)
 */
/*
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const getAIResponse = async (
  config: ChatSessionConfig,
  userMessage: string
): Promise<AIResponse> => {
  const personality = getPersonalityPrompt(config.personalityId);

  if (!personality) {
    throw new Error(`Invalid personality ID: ${config.personalityId}`);
  }

  // Build messages array
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: personality.systemPrompt
    },
    ...config.conversationHistory,
    {
      role: 'user',
      content: userMessage
    }
  ];

  // Call OpenAI API
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview', // or 'gpt-3.5-turbo' for free tier
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 1000,
    presence_penalty: 0.6,
    frequency_penalty: 0.3
  });

  const aiContent = response.choices[0].message.content || '';

  // Parse formatting if supported
  let formattedContent;
  if (personality.visualFormatting.enabled) {
    const parsed = parseFormattedResponse(aiContent);
    formattedContent = {
      segments: parsed.segments,
      hasFormatting: parsed.hasFormatting
    };
  }

  return {
    content: aiContent,
    formattedContent,
    rawContent: aiContent,
    tokensUsed: response.usage?.total_tokens
  };
};
*/
//# sourceMappingURL=chatService.js.map