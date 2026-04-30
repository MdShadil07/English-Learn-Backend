import { IAiChatSettings, ResponseLanguage } from '../../models/AiChatSettings.js';
/**
 * AI Chat Settings Service
 * Handles all AI chat settings operations
 */
declare class AiChatSettingsService {
    /**
     * Get user's AI chat settings
     */
    getUserSettings(userId: string): Promise<IAiChatSettings>;
    /**
     * Update user's response language
     */
    updateResponseLanguage(userId: string, language: ResponseLanguage): Promise<IAiChatSettings>;
    /**
     * Update all settings
     */
    updateSettings(userId: string, updates: {
        responseLanguage?: ResponseLanguage;
        useNativeLanguageForTranslations?: boolean;
        autoDetectLanguage?: boolean;
        alwaysShowEnglish?: boolean;
    }): Promise<IAiChatSettings>;
    /**
     * Get effective language for AI responses
     * This considers settings, profile, and auto-detection
     */
    getEffectiveLanguage(userId: string): Promise<{
        responseLanguage: ResponseLanguage;
        translationLanguage: string | null;
        showEnglish: boolean;
    }>;
    /**
     * Reset settings to default
     */
    resetSettings(userId: string): Promise<IAiChatSettings>;
    /**
     * Get available languages
     */
    getAvailableLanguages(): Array<{
        code: ResponseLanguage;
        name: string;
        nativeName: string;
    }>;
}
declare const _default: AiChatSettingsService;
export default _default;
//# sourceMappingURL=aiChatSettingsService.d.ts.map