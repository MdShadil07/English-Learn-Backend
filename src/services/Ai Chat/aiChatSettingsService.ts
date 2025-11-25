import mongoose from 'mongoose';
import AiChatSettings, { IAiChatSettings, ResponseLanguage } from '../../models/AiChatSettings.js';
import UserProfile from '../../models/UserProfile.js';

/**
 * AI Chat Settings Service
 * Handles all AI chat settings operations
 */
class AiChatSettingsService {
  /**
   * Get user's AI chat settings
   */
  async getUserSettings(userId: string): Promise<IAiChatSettings> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const settings = await AiChatSettings.getOrCreateSettings(userObjectId);
      return settings;
    } catch (error) {
      throw new Error(`Failed to get user settings: ${error}`);
    }
  }

  /**
   * Update user's response language
   */
  async updateResponseLanguage(
    userId: string,
    language: ResponseLanguage
  ): Promise<IAiChatSettings> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      // Get or create settings
      let settings = await AiChatSettings.getOrCreateSettings(userObjectId);
      
      // Update language
      settings.responseLanguage = language;
      await settings.save();
      
      return settings;
    } catch (error) {
      throw new Error(`Failed to update response language: ${error}`);
    }
  }

  /**
   * Update all settings
   */
  async updateSettings(
    userId: string,
    updates: {
      responseLanguage?: ResponseLanguage;
      useNativeLanguageForTranslations?: boolean;
      autoDetectLanguage?: boolean;
      alwaysShowEnglish?: boolean;
    }
  ): Promise<IAiChatSettings> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      // Get or create settings
      let settings = await AiChatSettings.getOrCreateSettings(userObjectId);
      
      // Update fields
      if (updates.responseLanguage !== undefined) {
        settings.responseLanguage = updates.responseLanguage;
      }
      if (updates.useNativeLanguageForTranslations !== undefined) {
        settings.useNativeLanguageForTranslations = updates.useNativeLanguageForTranslations;
      }
      if (updates.autoDetectLanguage !== undefined) {
        settings.autoDetectLanguage = updates.autoDetectLanguage;
      }
      if (updates.alwaysShowEnglish !== undefined) {
        settings.alwaysShowEnglish = updates.alwaysShowEnglish;
      }
      
      await settings.save();
      return settings;
    } catch (error) {
      throw new Error(`Failed to update settings: ${error}`);
    }
  }

  /**
   * Get effective language for AI responses
   * This considers settings, profile, and auto-detection
   */
  async getEffectiveLanguage(userId: string): Promise<{
    responseLanguage: ResponseLanguage;
    translationLanguage: string | null;
    showEnglish: boolean;
  }> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      // Get settings
      const settings = await AiChatSettings.getOrCreateSettings(userObjectId);
      
      // Get user profile for native language
      const profile = await UserProfile.findOne({ userId: userObjectId });
      
      // Determine translation language
      let translationLanguage: string | null = null;
      if (settings.useNativeLanguageForTranslations && profile?.nativeLanguage) {
        translationLanguage = profile.nativeLanguage;
      }
      
      return {
        responseLanguage: settings.responseLanguage,
        translationLanguage,
        showEnglish: settings.alwaysShowEnglish
      };
    } catch (error) {
      throw new Error(`Failed to get effective language: ${error}`);
    }
  }

  /**
   * Reset settings to default
   */
  async resetSettings(userId: string): Promise<IAiChatSettings> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      // Delete existing settings
      await AiChatSettings.deleteOne({ userId: userObjectId });
      
      // Create new default settings
      const settings = await AiChatSettings.getOrCreateSettings(userObjectId);
      
      return settings;
    } catch (error) {
      throw new Error(`Failed to reset settings: ${error}`);
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): Array<{ code: ResponseLanguage; name: string; nativeName: string }> {
    return [
      { code: 'english', name: 'English', nativeName: 'English' },
      { code: 'hindi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'spanish', name: 'Spanish', nativeName: 'Español' },
      { code: 'french', name: 'French', nativeName: 'Français' },
      { code: 'german', name: 'German', nativeName: 'Deutsch' },
      { code: 'chinese', name: 'Chinese', nativeName: '中文' },
      { code: 'japanese', name: 'Japanese', nativeName: '日本語' },
      { code: 'korean', name: 'Korean', nativeName: '한국어' },
      { code: 'arabic', name: 'Arabic', nativeName: 'العربية' },
      { code: 'portuguese', name: 'Portuguese', nativeName: 'Português' },
      { code: 'russian', name: 'Russian', nativeName: 'Русский' },
      { code: 'italian', name: 'Italian', nativeName: 'Italiano' },
      { code: 'dutch', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'turkish', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'polish', name: 'Polish', nativeName: 'Polski' },
      { code: 'vietnamese', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'thai', name: 'Thai', nativeName: 'ไทย' },
      { code: 'indonesian', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      { code: 'bengali', name: 'Bengali', nativeName: 'বাংলা' },
      { code: 'urdu', name: 'Urdu', nativeName: 'اردو' }
    ];
  }
}

export default new AiChatSettingsService();
