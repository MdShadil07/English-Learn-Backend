import mongoose, { Document, Model } from 'mongoose';
/**
 * Available response languages for AI Chat
 */
export type ResponseLanguage = 'english' | 'hindi' | 'spanish' | 'french' | 'german' | 'chinese' | 'japanese' | 'korean' | 'arabic' | 'portuguese' | 'russian' | 'italian' | 'dutch' | 'turkish' | 'polish' | 'vietnamese' | 'thai' | 'indonesian' | 'bengali' | 'urdu';
/**
 * AI Chat Settings Interface
 */
export interface IAiChatSettings extends Document {
    userId: mongoose.Types.ObjectId;
    responseLanguage: ResponseLanguage;
    useNativeLanguageForTranslations: boolean;
    autoDetectLanguage: boolean;
    alwaysShowEnglish: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Export Model
 */
export interface IAiChatSettingsModel extends Model<IAiChatSettings> {
    getOrCreateSettings(userId: mongoose.Types.ObjectId): Promise<IAiChatSettings>;
}
declare const AiChatSettings: IAiChatSettingsModel;
export default AiChatSettings;
//# sourceMappingURL=AiChatSettings.d.ts.map