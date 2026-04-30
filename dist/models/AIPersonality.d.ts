import mongoose, { Document, Model } from 'mongoose';
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
declare const AIPersonality: Model<IAIPersonality>;
export default AIPersonality;
//# sourceMappingURL=AIPersonality.d.ts.map