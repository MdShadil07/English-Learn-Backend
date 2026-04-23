/**
 * 🎯 BACKWARD-COMPATIBILITY SHIM
 *
 * This module previously hosted standalone accuracy helpers. All logic now
 * lives in `services/Accuracy/centralizedAccuracyService`. We keep this file as
 * a thin passthrough so legacy imports continue working while the backend uses
 * the centralized implementation.
 */

export {
  calculateAccuracy,
  calculateCumulativeAccuracy,
  extractCurrentAccuracy,
  logAccuracyUpdate,
  centralizedAccuracyService,
} from '../services/Accuracy/centralizedAccuracyService.js';

export type {
  AccuracyCalculationResult,
  CurrentAccuracyData,
  AccuracyCalculationRequest,
  AccuracyCalculationResponse,
  RealTimeAccuracyUpdate,
} from '../services/Accuracy/centralizedAccuracyService.js';

// Convenience re-exports for cache + tracker utilities that historically lived here
export { fastAccuracyCache, optimizedAccuracyTracker } from '../services/Accuracy/index.js';
