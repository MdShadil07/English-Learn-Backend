/**
 * AI Personalities Seed Data
 *
 * This file contains seed data for AI personalities that can be used
 * to populate the database with predefined AI characters for language practice.
 */
import { IAIPersonality } from '../models/index.js';
declare const personalitiesData: Partial<IAIPersonality>[];
/**
 * Seeds the database with AI personalities
 */
export declare function seedAIPersonalities(): Promise<void>;
/**
 * Clears all AI personalities from the database
 */
export declare function clearAIPersonalities(): Promise<void>;
/**
 * Gets the count of AI personalities in the database
 */
export declare function getAIPersonalitiesCount(): Promise<number>;
export { personalitiesData };
//# sourceMappingURL=aipersonalitiesSeed.d.ts.map