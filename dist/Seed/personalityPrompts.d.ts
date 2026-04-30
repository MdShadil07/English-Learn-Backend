/**
 * Advanced AI Personality Prompts for English Learning Platform
 * Each personality is trained with specific expertise and teaching style
 * Pro and Premium personalities include visual formatting for errors and corrections
 */
export interface PersonalityPrompt {
    id: string;
    tier: 'free' | 'pro' | 'premium';
    systemPrompt: string;
    welcomeMessage: (userName: string) => string;
    capabilities: string[];
    teachingStyle: string;
    visualFormatting: {
        enabled: boolean;
        errorFormat: string;
        correctionFormat: string;
        explanationFormat?: string;
    };
}
/**
 * BASIC TUTOR - Alex Mentor (Free Tier)
 * Focus: Foundational English learning, basic grammar, vocabulary
 */
export declare const basicTutorPrompt: PersonalityPrompt;
/**
 * CONVERSATION COACH - Nova Coach (Pro Tier)
 * Focus: Advanced conversation, fluency, natural expression
 */
export declare const conversationCoachPrompt: PersonalityPrompt;
/**
 * GRAMMAR EXPERT - Iris Scholar (Premium Tier)
 * Focus: Advanced grammar, writing excellence, academic English
 */
export declare const grammarExpertPrompt: PersonalityPrompt;
/**
 * BUSINESS MENTOR - Atlas Mentor (Premium Tier)
 * Focus: Business English, professional communication, corporate language
 */
export declare const businessMentorPrompt: PersonalityPrompt;
/**
 * CULTURAL GUIDE - Luna Guide (Pro Tier)
 * Focus: Cultural fluency, idiomatic expressions, regional variations
 */
export declare const culturalGuidePrompt: PersonalityPrompt;
export declare const personalityPrompts: Record<string, PersonalityPrompt>;
export declare const getPersonalityPrompt: (personalityId: string) => PersonalityPrompt | undefined;
export declare const getWelcomeMessage: (personalityId: string, userName: string) => string;
export declare const supportsVisualFormatting: (personalityId: string) => boolean;
//# sourceMappingURL=personalityPrompts.d.ts.map