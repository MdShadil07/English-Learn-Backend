import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAIPersonality extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  displayName: string;
  description: string;
  avatar: string;
  personalityType: 'friendly' | 'strict' | 'encouraging' | 'casual' | 'formal' | 'humorous' | 'patient';
  teachingStyle: 'conversational' | 'structured' | 'interactive' | 'explanatory' | 'challenging';
  difficultyAdjustment: boolean;
  responseStyle: 'short' | 'medium' | 'detailed';
  languageFocus: string[];
  culturalContext: string[];
  age: number;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  isActive: boolean;
  isDefault: boolean;
  usageCount: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAIPersonalityModel extends Model<IAIPersonality> {
  findActive(): Promise<IAIPersonality[]>;
  findByPersonalityType(personalityType: string): Promise<IAIPersonality[]>;
  findDefault(): Promise<IAIPersonality | null>;
}

const aiPersonalitySchema = new Schema<IAIPersonality>(
  {
    name: {
      type: String,
      required: [true, 'AI personality name is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [100, 'Display name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    avatar: {
      type: String,
      required: [true, 'Avatar is required'],
      trim: true,
    },
    personalityType: {
      type: String,
      required: [true, 'Personality type is required'],
      enum: ['friendly', 'strict', 'encouraging', 'casual', 'formal', 'humorous', 'patient'],
    },
    teachingStyle: {
      type: String,
      required: [true, 'Teaching style is required'],
      enum: ['conversational', 'structured', 'interactive', 'explanatory', 'challenging'],
    },
    difficultyAdjustment: {
      type: Boolean,
      default: true,
    },
    responseStyle: {
      type: String,
      required: [true, 'Response style is required'],
      enum: ['short', 'medium', 'detailed'],
    },
    languageFocus: [{
      type: String,
      trim: true,
    }],
    culturalContext: [{
      type: String,
      trim: true,
    }],
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [18, 'Age must be at least 18'],
      max: [100, 'Age cannot exceed 100'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['male', 'female', 'neutral'],
    },
    accent: {
      type: String,
      required: [true, 'Accent is required'],
      trim: true,
      maxlength: [50, 'Accent cannot exceed 50 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
aiPersonalitySchema.index({ personalityType: 1 });
aiPersonalitySchema.index({ teachingStyle: 1 });
aiPersonalitySchema.index({ isActive: 1 });
aiPersonalitySchema.index({ isDefault: 1 });
aiPersonalitySchema.index({ rating: -1 });
aiPersonalitySchema.index({ usageCount: -1 });

// Static methods
aiPersonalitySchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

aiPersonalitySchema.statics.findByPersonalityType = function (personalityType: string) {
  return this.find({ personalityType, isActive: true });
};

aiPersonalitySchema.statics.findDefault = function () {
  return this.findOne({ isDefault: true, isActive: true });
};

// Ensure only one default personality
aiPersonalitySchema.pre('save', async function (next) {
  if (this.isDefault) {
    await (this.constructor as IAIPersonalityModel).updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

const AIPersonality: Model<IAIPersonality> = mongoose.model<IAIPersonality>('AIPersonality', aiPersonalitySchema);

export default AIPersonality;
