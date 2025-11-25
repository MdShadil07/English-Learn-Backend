/**
 * 🎯 SERVICES BARREL EXPORT
 * Centralized export point for all backend services
 * 
 * Service Categories:
 * - NLP: Natural Language Processing (spelling, vocabulary, fluency)
 * - Gamification: Leveling, streaks, achievements
 * - Progress: User progress tracking and analytics
 * - Profile: User profile management
 * - AI Chat: Gemini AI chat services
 * - WebSocket: Real-time communication
 * - Cron: Scheduled tasks and automation
 */

// NLP Services (Natural Language Processing)
export * from './NLP/fluencyScorer.js';
export * from './NLP/spellingChecker.js';
export * from './NLP/vocabAnalyzer.js';
export * from './NLP/languageDetectionService.js'; 

// Gamification Services (Leveling & Streaks)
export * from './Gamification/index.js';

// Progress Services (Analytics & Tracking)
export * from './Progress/index.js';

// Profile Services (User Management)

export * from './Profile/index.js';

// AI Chat Services (Gemini AI)
export * from './Ai Chat/geminiService.js';

// WebSocket Services (Real-time Communication)
export * from './WebSocket/index.js';

// Cron Services (Scheduled Tasks)
export * from './Cron/index.js';