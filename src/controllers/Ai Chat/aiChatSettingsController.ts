import { Request, Response } from 'express';
import aiChatSettingsService from '../../services/Ai Chat/aiChatSettingsService.js';
import { ResponseLanguage } from '../../models/AiChatSettings.js';

// Extend Request interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    _id: any;
    id: string;
    tier?: string;
  };
}

/**
 * AI Chat Settings Controller
 * Handles HTTP requests for AI chat settings
 */
class AiChatSettingsController {
  /**
   * Get user's AI chat settings
   * GET /api/ai-chat/settings
   */
  async getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Auth middleware sets req.user to the User document with _id property
      const userId = req.user?._id || req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const settings = await aiChatSettingsService.getUserSettings(userId.toString());

      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error getting AI chat settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI chat settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update response language
   * PUT /api/ai-chat/settings/language
   */
  async updateLanguage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.user?.id;
      const { language } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      if (!language) {
        res.status(400).json({
          success: false,
          message: 'Language is required'
        });
        return;
      }

      // Validate language
      const availableLanguages = aiChatSettingsService.getAvailableLanguages();
      const validLanguage = availableLanguages.find(lang => lang.code === language);
      
      if (!validLanguage) {
        res.status(400).json({
          success: false,
          message: 'Invalid language code',
          availableLanguages: availableLanguages.map(lang => lang.code)
        });
        return;
      }

      const settings = await aiChatSettingsService.updateResponseLanguage(
        userId.toString(),
        language as ResponseLanguage
      );

      res.status(200).json({
        success: true,
        message: `Response language updated to ${validLanguage.name}`,
        data: settings
      });
    } catch (error) {
      console.error('Error updating response language:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update response language',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update all settings
   * PUT /api/ai-chat/settings
   */
  async updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.user?.id;
      const {
        responseLanguage,
        useNativeLanguageForTranslations,
        autoDetectLanguage,
        alwaysShowEnglish
      } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      // Validate language if provided
      if (responseLanguage) {
        const availableLanguages = aiChatSettingsService.getAvailableLanguages();
        const validLanguage = availableLanguages.find(lang => lang.code === responseLanguage);
        
        if (!validLanguage) {
          res.status(400).json({
            success: false,
            message: 'Invalid language code',
            availableLanguages: availableLanguages.map(lang => lang.code)
          });
          return;
        }
      }

      const settings = await aiChatSettingsService.updateSettings(userId.toString(), {
        responseLanguage,
        useNativeLanguageForTranslations,
        autoDetectLanguage,
        alwaysShowEnglish
      });

      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: settings
      });
    } catch (error) {
      console.error('Error updating AI chat settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update AI chat settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get effective language settings
   * GET /api/ai-chat/settings/effective-language
   */
  async getEffectiveLanguage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const effectiveLanguage = await aiChatSettingsService.getEffectiveLanguage(userId.toString());

      res.status(200).json({
        success: true,
        data: effectiveLanguage
      });
    } catch (error) {
      console.error('Error getting effective language:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get effective language',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reset settings to default
   * POST /api/ai-chat/settings/reset
   */
  async resetSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const settings = await aiChatSettingsService.resetSettings(userId.toString());

      res.status(200).json({
        success: true,
        message: 'Settings reset to default',
        data: settings
      });
    } catch (error) {
      console.error('Error resetting AI chat settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset AI chat settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get available languages
   * GET /api/ai-chat/settings/languages
   */
  async getAvailableLanguages(req: Request, res: Response): Promise<void> {
    try {
      const languages = aiChatSettingsService.getAvailableLanguages();

      res.status(200).json({
        success: true,
        data: languages
      });
    } catch (error) {
      console.error('Error getting available languages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available languages',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new AiChatSettingsController();
