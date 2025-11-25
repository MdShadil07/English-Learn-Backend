/**
 * AI Personalities Seed Data
 *
 * This file contains seed data for AI personalities that can be used
 * to populate the database with predefined AI characters for language practice.
 */

import dotenv from 'dotenv';
import { AIPersonality, IAIPersonality } from '../models/index.js';
import { database } from '../config/database.js';

// Configure dotenv
dotenv.config();

// Define the AI personalities data matching the IAIPersonality interface
const personalitiesData: Partial<IAIPersonality>[] = [
  {
    name: 'alex',
    displayName: 'Alex',
    description: 'Friendly English Teacher specializing in conversational English and basic grammar. Patient, encouraging, and adaptive teaching approach.',
    avatar: '👨‍🏫',
    personalityType: 'friendly',
    teachingStyle: 'conversational',
    difficultyAdjustment: true,
    responseStyle: 'medium',
    languageFocus: ['conversation', 'vocabulary', 'basic grammar'],
    culturalContext: ['everyday situations', 'casual communication'],
    age: 28,
    gender: 'male',
    accent: 'neutral',
    isActive: true,
    isDefault: true,
    usageCount: 0,
    rating: 0,
  },
  {
    name: 'sarah',
    displayName: 'Sarah',
    description: 'Business English Coach focused on professional communication and corporate language. Professional, strategic, and detail-oriented.',
    avatar: '👩‍💼',
    personalityType: 'formal',
    teachingStyle: 'structured',
    difficultyAdjustment: true,
    responseStyle: 'detailed',
    languageFocus: ['business vocabulary', 'professional writing', 'presentations'],
    culturalContext: ['business etiquette', 'corporate culture'],
    age: 32,
    gender: 'female',
    accent: 'british',
    isActive: true,
    isDefault: false,
    usageCount: 0,
    rating: 0,
  },
  {
    name: 'james',
    displayName: 'James',
    description: 'Pronunciation Expert helping with accent reduction and phonetic accuracy. Detail-oriented, technical, and precise.',
    avatar: '🎙️',
    personalityType: 'patient',
    teachingStyle: 'explanatory',
    difficultyAdjustment: true,
    responseStyle: 'detailed',
    languageFocus: ['pronunciation', 'phonetics', 'accent reduction'],
    culturalContext: ['speech patterns', 'intonation'],
    age: 35,
    gender: 'male',
    accent: 'american',
    isActive: true,
    isDefault: false,
    usageCount: 0,
    rating: 0,
  },
  {
    name: 'maria',
    displayName: 'Maria',
    description: 'Cultural Guide providing context and cultural insights for English learning. Cultural, empathetic, and insightful.',
    avatar: '🌍',
    personalityType: 'encouraging',
    teachingStyle: 'interactive',
    difficultyAdjustment: true,
    responseStyle: 'medium',
    languageFocus: ['idioms', 'expressions', 'cultural references'],
    culturalContext: ['cross-cultural communication', 'social situations'],
    age: 30,
    gender: 'female',
    accent: 'neutral',
    isActive: true,
    isDefault: false,
    usageCount: 0,
    rating: 0,
  },
  {
    name: 'dr-smith',
    displayName: 'Dr. Smith',
    description: 'Exam Preparation Specialist with systematic approach to test strategies. Analytical, systematic, and results-focused.',
    avatar: '📚',
    personalityType: 'strict',
    teachingStyle: 'structured',
    difficultyAdjustment: true,
    responseStyle: 'detailed',
    languageFocus: ['test strategies', 'exam techniques', 'academic writing'],
    culturalContext: ['academic contexts', 'formal assessments'],
    age: 45,
    gender: 'neutral',
    accent: 'neutral',
    isActive: true,
    isDefault: false,
    usageCount: 0,
    rating: 0,
  },
];

/**
 * Seeds the database with AI personalities
 */
export async function seedAIPersonalities(): Promise<void> {
  try {
    console.log('🌱 Starting AI personalities seeding...');

    // Connect to database if not already connected
    if (!database.isConnected()) {
      await database.connect();
    }

    // Clear existing personalities
    await AIPersonality.deleteMany({});
    console.log('🗑️ Cleared existing AI personalities');

    // Insert new personalities
    const insertedPersonalities = await AIPersonality.insertMany(personalitiesData);
    console.log(`✅ Inserted ${insertedPersonalities.length} AI personalities`);

    console.log('\n📋 Available AI Personalities:');
    insertedPersonalities.forEach((personality, index) => {
      console.log(`${index + 1}. ${personality.displayName} (${personality.name}) - ${personality.personalityType} (${personality.teachingStyle})`);
    });

    console.log('\n🎉 AI Personalities seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding AI personalities:', error);
    throw error;
  }
}

/**
 * Clears all AI personalities from the database
 */
export async function clearAIPersonalities(): Promise<void> {
  try {
    console.log('🧹 Clearing AI personalities...');

    if (!database.isConnected()) {
      await database.connect();
    }

    await AIPersonality.deleteMany({});
    console.log('✅ AI personalities cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing AI personalities:', error);
    throw error;
  }
}

/**
 * Gets the count of AI personalities in the database
 */
export async function getAIPersonalitiesCount(): Promise<number> {
  try {
    if (!database.isConnected()) {
      await database.connect();
    }

    const count = await AIPersonality.countDocuments();
    return count;
  } catch (error) {
    console.error('❌ Error getting AI personalities count:', error);
    throw error;
  }
}

// Export the personalities data for reference
export { personalitiesData };