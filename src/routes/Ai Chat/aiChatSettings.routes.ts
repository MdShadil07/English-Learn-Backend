import { Router } from 'express';
import { authenticate } from '../../middleware/auth/index.js';
import aiChatSettingsController from '../../controllers/Ai Chat/aiChatSettingsController.js';
import { body } from 'express-validator';

const router = Router();

/**
 * @route   GET /api/ai-chat/settings
 * @desc    Get user's AI chat settings
 * @access  Private
 */
router.get('/', authenticate, aiChatSettingsController.getSettings);

/**
 * @route   PUT /api/ai-chat/settings/language
 * @desc    Update response language
 * @access  Private
 */
router.put(
  '/language',
  authenticate,
  [
    body('language')
      .notEmpty()
      .withMessage('Language is required')
      .isString()
      .withMessage('Language must be a string')
      .isIn([
        'english',
        'hindi',
        'spanish',
        'french',
        'german',
        'chinese',
        'japanese',
        'korean',
        'arabic',
        'portuguese',
        'russian',
        'italian',
        'dutch',
        'turkish',
        'polish',
        'vietnamese',
        'thai',
        'indonesian',
        'bengali',
        'urdu'
      ])
      .withMessage('Invalid language code')
  ],
  aiChatSettingsController.updateLanguage
);

/**
 * @route   PUT /api/ai-chat/settings
 * @desc    Update all settings
 * @access  Private
 */
router.put(
  '/',
  authenticate,
  [
    body('responseLanguage')
      .optional()
      .isIn([
        'english',
        'hindi',
        'spanish',
        'french',
        'german',
        'chinese',
        'japanese',
        'korean',
        'arabic',
        'portuguese',
        'russian',
        'italian',
        'dutch',
        'turkish',
        'polish',
        'vietnamese',
        'thai',
        'indonesian',
        'bengali',
        'urdu'
      ])
      .withMessage('Invalid language code'),
    body('useNativeLanguageForTranslations')
      .optional()
      .isBoolean()
      .withMessage('useNativeLanguageForTranslations must be a boolean'),
    body('autoDetectLanguage')
      .optional()
      .isBoolean()
      .withMessage('autoDetectLanguage must be a boolean'),
    body('alwaysShowEnglish')
      .optional()
      .isBoolean()
      .withMessage('alwaysShowEnglish must be a boolean')
  ],
  aiChatSettingsController.updateSettings
);

/**
 * @route   GET /api/ai-chat/settings/effective-language
 * @desc    Get effective language settings (considering profile and settings)
 * @access  Private
 */
router.get('/effective-language', authenticate, aiChatSettingsController.getEffectiveLanguage);

/**
 * @route   POST /api/ai-chat/settings/reset
 * @desc    Reset settings to default
 * @access  Private
 */
router.post('/reset', authenticate, aiChatSettingsController.resetSettings);

/**
 * @route   GET /api/ai-chat/settings/languages
 * @desc    Get available languages
 * @access  Public
 */
router.get('/languages', aiChatSettingsController.getAvailableLanguages);

export default router;
