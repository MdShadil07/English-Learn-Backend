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
export * from './NLP/fluencyScorer.js';
export * from './NLP/spellingChecker.js';
export * from './NLP/vocabAnalyzer.js';
export * from './NLP/languageDetectionService.js';
export * from './Gamification/index.js';
export * from './Progress/index.js';
export * from './Profile/index.js';
export * from './Auth/index.js';
export * from './Ai Chat/geminiService.js';
export * from './WebSocket/index.js';
export * from './Cron/index.js';
//# sourceMappingURL=index.d.ts.map