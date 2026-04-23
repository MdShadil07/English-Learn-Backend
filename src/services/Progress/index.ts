/**
 * 📊 PROGRESS SERVICES INDEX
 * Progress tracking and optimization services
 */

// Export progress optimization service
export * from './progressOptimizationService.js';
export { default as progressOptimizationService } from './progressOptimizationService.js';

// Legacy alias to maintain backward compatibility with modules expecting
// the old computation service entry point.
export { progressOptimizationService as progressComputationService } from './progressOptimizationService.js';
export { progressOptimizationService as progressStateService } from './progressOptimizationService.js';

// Export batched progress service (for high-traffic scenarios)
export { default as batchedProgressService } from './batchedProgressService.js';
export { batchedProgressService as BatchedProgress } from './batchedProgressService.js';
