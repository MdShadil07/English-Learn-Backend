import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth/auth.js';
type AuthenticatedRequest = AuthRequest;
/**
 * AI Chat Settings Controller
 * Handles HTTP requests for AI chat settings
 */
declare class AiChatSettingsController {
    /**
     * Get user's AI chat settings
     * GET /api/ai-chat/settings
     */
    getSettings(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update response language
     * PUT /api/ai-chat/settings/language
     */
    updateLanguage(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update all settings
     * PUT /api/ai-chat/settings
     */
    updateSettings(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get effective language settings
     * GET /api/ai-chat/settings/effective-language
     */
    getEffectiveLanguage(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Reset settings to default
     * POST /api/ai-chat/settings/reset
     */
    resetSettings(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get available languages
     * GET /api/ai-chat/settings/languages
     */
    getAvailableLanguages(req: Request, res: Response): Promise<void>;
}
declare const _default: AiChatSettingsController;
export default _default;
//# sourceMappingURL=aiChatSettingsController.d.ts.map