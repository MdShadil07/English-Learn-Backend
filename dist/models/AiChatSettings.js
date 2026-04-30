import mongoose, { Schema } from 'mongoose';
/**
 * AI Chat Settings Schema
 */
const AiChatSettingsSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    responseLanguage: {
        type: String,
        enum: [
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
        ],
        default: 'english',
        required: true
    },
    useNativeLanguageForTranslations: {
        type: Boolean,
        default: true // By default, use native language from profile
    },
    autoDetectLanguage: {
        type: Boolean,
        default: false // Disabled by default
    },
    alwaysShowEnglish: {
        type: Boolean,
        default: true // Show both English and translation
    }
}, {
    timestamps: true,
    collection: 'aichatsettings'
});
// Indexes
AiChatSettingsSchema.index({ userId: 1 }, { unique: true });
AiChatSettingsSchema.index({ createdAt: 1 });
AiChatSettingsSchema.index({ updatedAt: 1 });
/**
 * Get or create default settings for a user
 */
AiChatSettingsSchema.statics.getOrCreateSettings = async function (userId) {
    try {
        let settings = await this.findOne({ userId });
        if (!settings) {
            // Create default settings
            settings = await this.create({
                userId,
                responseLanguage: 'english',
                useNativeLanguageForTranslations: true,
                autoDetectLanguage: false,
                alwaysShowEnglish: true
            });
        }
        return settings;
    }
    catch (error) {
        throw new Error(`Failed to get or create AI chat settings: ${error}`);
    }
};
/**
 * Update user's response language
 */
AiChatSettingsSchema.methods.updateResponseLanguage = async function (language) {
    this.responseLanguage = language;
    return await this.save();
};
/**
 * Get effective response language (considering auto-detect and profile)
 */
AiChatSettingsSchema.methods.getEffectiveLanguage = function () {
    return this.responseLanguage;
};
const AiChatSettings = mongoose.model('AiChatSettings', AiChatSettingsSchema);
export default AiChatSettings;
//# sourceMappingURL=AiChatSettings.js.map