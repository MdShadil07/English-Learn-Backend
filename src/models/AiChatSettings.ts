import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Available response languages for AI Chat
 */
export type ResponseLanguage = 
  | 'english'
  | 'hindi'
  | 'spanish'
  | 'french'
  | 'german'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'arabic'
  | 'portuguese'
  | 'russian'
  | 'italian'
  | 'dutch'
  | 'turkish'
  | 'polish'
  | 'vietnamese'
  | 'thai'
  | 'indonesian'
  | 'bengali'
  | 'urdu';

/**
 * AI Chat Settings Interface
 */
export interface IAiChatSettings extends Document {
  userId: mongoose.Types.ObjectId;
  responseLanguage: ResponseLanguage;
  useNativeLanguageForTranslations: boolean; // Use native language from profile for vocabulary translations
  autoDetectLanguage: boolean; // Auto-detect user's preferred language from messages
  alwaysShowEnglish: boolean; // Always show English version along with translated version
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI Chat Settings Schema
 */
const AiChatSettingsSchema = new Schema<IAiChatSettings>(
  {
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
  },
  {
    timestamps: true,
    collection: 'aichatsettings'
  }
);

// Indexes
AiChatSettingsSchema.index({ userId: 1 }, { unique: true });
AiChatSettingsSchema.index({ createdAt: 1 });
AiChatSettingsSchema.index({ updatedAt: 1 });

/**
 * Get or create default settings for a user
 */
AiChatSettingsSchema.statics.getOrCreateSettings = async function(
  userId: mongoose.Types.ObjectId
): Promise<IAiChatSettings> {
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
  } catch (error) {
    throw new Error(`Failed to get or create AI chat settings: ${error}`);
  }
};

/**
 * Update user's response language
 */
AiChatSettingsSchema.methods.updateResponseLanguage = async function(
  language: ResponseLanguage
): Promise<IAiChatSettings> {
  this.responseLanguage = language;
  return await this.save();
};

/**
 * Get effective response language (considering auto-detect and profile)
 */
AiChatSettingsSchema.methods.getEffectiveLanguage = function(): ResponseLanguage {
  return this.responseLanguage;
};

/**
 * Export Model
 */
export interface IAiChatSettingsModel extends Model<IAiChatSettings> {
  getOrCreateSettings(userId: mongoose.Types.ObjectId): Promise<IAiChatSettings>;
}

const AiChatSettings = mongoose.model<IAiChatSettings, IAiChatSettingsModel>(
  'AiChatSettings',
  AiChatSettingsSchema
);

export default AiChatSettings;
