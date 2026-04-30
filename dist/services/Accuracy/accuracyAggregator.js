/**
 * 🎯 CENTRALIZED ACCURACY CALCULATOR
 * Single source of truth for accuracy calculations across the application
 *
 * Features:
 * - Cumulative weighted averaging (prevents overwriting)
 * - Consistent calculation logic
 * - Proper handling of first vs subsequent calculations
 * - Synchronization of duplicate fields
 */
import { enhancedWeightedAccuracyService } from '../../utils/calculators/enhancedWeightedAccuracy.js';
/**
 * Calculate cumulative weighted average
 * Formula: (old_value * old_count + new_value) / new_count
 *
 * @param oldValue - Previous cumulative value
 * @param newValue - New value to incorporate
 * @param count - Total number of calculations (including current)
 * @returns Rounded cumulative average
 */
function calculateWeightedAverage(oldValue, newValue, count) {
    if (count === 1) {
        // First calculation - no previous data
        return Math.round(newValue);
    }
    const oldWeight = count - 1;
    const cumulativeValue = ((oldValue * oldWeight) + newValue) / count;
    return Math.round(cumulativeValue);
}
/**
 * Calculate cumulative accuracy (SINGLE SOURCE OF TRUTH)
 *
 * This function ensures:
 * 1. Accuracy is NEVER overwritten (always cumulative)
 * 2. Consistent calculation across all services
 * 3. Proper synchronization between accuracyData and skills
 *
 * @param currentAccuracy - Current accuracy data from database
 * @param newAccuracy - New accuracy scores from latest message
 * @returns Calculation result with cumulative values and sync updates
 */
export function calculateCumulativeAccuracy(currentAccuracy, newAccuracy) {
    // Get current values (default to 0 if not exists)
    const current = currentAccuracy || {};
    const calculationCount = (current.calculationCount || 0) + 1;
    // Calculate cumulative for each metric
    const cumulativeAccuracy = {};
    const skillsUpdate = {};
    // Overall accuracy
    if (newAccuracy.overall !== undefined) {
        cumulativeAccuracy.overall = calculateWeightedAverage(current.overall || 0, newAccuracy.overall, calculationCount);
        // Synchronize skills fields
        skillsUpdate.accuracy = cumulativeAccuracy.overall;
        skillsUpdate.overallAccuracy = cumulativeAccuracy.overall;
    }
    // Grammar
    if (newAccuracy.grammar !== undefined) {
        cumulativeAccuracy.grammar = calculateWeightedAverage(current.grammar || 0, newAccuracy.grammar, calculationCount);
        skillsUpdate.grammar = cumulativeAccuracy.grammar;
    }
    // Vocabulary
    if (newAccuracy.vocabulary !== undefined) {
        cumulativeAccuracy.vocabulary = calculateWeightedAverage(current.vocabulary || 0, newAccuracy.vocabulary, calculationCount);
        skillsUpdate.vocabulary = cumulativeAccuracy.vocabulary;
    }
    // Spelling
    if (newAccuracy.spelling !== undefined) {
        cumulativeAccuracy.spelling = calculateWeightedAverage(current.spelling || 0, newAccuracy.spelling, calculationCount);
    }
    // Fluency
    if (newAccuracy.fluency !== undefined) {
        cumulativeAccuracy.fluency = calculateWeightedAverage(current.fluency || 0, newAccuracy.fluency, calculationCount);
        skillsUpdate.fluency = cumulativeAccuracy.fluency;
    }
    // Punctuation
    if (newAccuracy.punctuation !== undefined) {
        cumulativeAccuracy.punctuation = calculateWeightedAverage(current.punctuation || 0, newAccuracy.punctuation, calculationCount);
    }
    // Capitalization
    if (newAccuracy.capitalization !== undefined) {
        cumulativeAccuracy.capitalization = calculateWeightedAverage(current.capitalization || 0, newAccuracy.capitalization, calculationCount);
    }
    // Add metadata
    cumulativeAccuracy.calculationCount = calculationCount;
    cumulativeAccuracy.lastCalculated = new Date();
    return {
        cumulativeAccuracy,
        skillsUpdate,
        calculationCount,
        lastCalculated: new Date(),
    };
}
/**
 * Log cumulative accuracy update (for debugging)
 */
export function logAccuracyUpdate(calculationCount, currentAccuracy, newAccuracy, cumulativeAccuracy) {
    const current = currentAccuracy || {};
    console.log(`📊 Cumulative Accuracy Update (Calc #${calculationCount}):`);
    if (newAccuracy.overall !== undefined) {
        console.log(`  Overall: ${current.overall || 0}% → ${cumulativeAccuracy.overall || 0}% (new: ${Math.round(newAccuracy.overall)}%)`);
    }
    if (newAccuracy.grammar !== undefined) {
        console.log(`  Grammar: ${current.grammar || 0}% → ${cumulativeAccuracy.grammar || 0}% (new: ${Math.round(newAccuracy.grammar)}%)`);
    }
    if (newAccuracy.vocabulary !== undefined) {
        console.log(`  Vocabulary: ${current.vocabulary || 0}% → ${cumulativeAccuracy.vocabulary || 0}% (new: ${Math.round(newAccuracy.vocabulary)}%)`);
    }
    if (newAccuracy.spelling !== undefined) {
        console.log(`  Spelling: ${current.spelling || 0}% → ${cumulativeAccuracy.spelling || 0}% (new: ${Math.round(newAccuracy.spelling)}%)`);
    }
    if (newAccuracy.fluency !== undefined) {
        console.log(`  Fluency: ${current.fluency || 0}% → ${cumulativeAccuracy.fluency || 0}% (new: ${Math.round(newAccuracy.fluency)}%)`);
    }
}
/**
 * Helper to extract accuracy data from MongoDB document
 */
export function extractCurrentAccuracy(accuracyData) {
    if (!accuracyData)
        return {};
    return {
        overall: accuracyData.overall,
        grammar: accuracyData.grammar,
        vocabulary: accuracyData.vocabulary,
        spelling: accuracyData.spelling,
        fluency: accuracyData.fluency,
        punctuation: accuracyData.punctuation,
        capitalization: accuracyData.capitalization,
        calculationCount: accuracyData.calculationCount || 0,
    };
}
/**
 * Calculate current message accuracy and a weighted combined accuracy
 * using advanced weighted calculation with historical context.
 *
 * Features:
 * - Advanced weighted averaging with historical context
 * - Prevents accuracy flow disruption (no sudden jumps)
 * - Configurable weight strategies based on user progression
 * - Integration with Redis for optimized performance
 *
 * @param currentAccuracy - Current accuracy scores from latest message
 * @param previousAccuracy - Previous accuracy object (legacy support)
 * @param userId - User ID for historical context (optional but recommended)
 * @returns Object with current accuracy and updated weighted accuracy
 */
export async function calculateAccuracy(currentAccuracy, previousAccuracy, userId) {
    // If userId is provided, use advanced weighted calculation
    if (userId) {
        try {
            const result = await enhancedWeightedAccuracyService.calculateEnhancedWeightedAccuracy(userId, currentAccuracy);
            return {
                currentAccuracy: result.current,
                updatedOverallAccuracy: result.weighted,
            };
        }
        catch (error) {
            console.error('⚠️ Advanced weighted calculation failed, falling back to simple calculation:', error);
            // Fall back to simple calculation below
        }
    }
    // Legacy simple weighted calculation (fallback)
    const weightOld = 0.4;
    const weightNew = 0.6;
    // Ensure numeric values and round current values where present
    const norm = (v) => (typeof v === 'number' && !Number.isNaN(v) ? Math.round(v) : undefined);
    const curr = {
        overall: norm(currentAccuracy.overall),
        grammar: norm(currentAccuracy.grammar),
        vocabulary: norm(currentAccuracy.vocabulary),
        spelling: norm(currentAccuracy.spelling),
        fluency: norm(currentAccuracy.fluency),
        punctuation: norm(currentAccuracy.punctuation),
        capitalization: norm(currentAccuracy.capitalization),
    };
    // If no previous provided, updated is same as current (fast path)
    if (!previousAccuracy) {
        return { currentAccuracy: curr, updatedOverallAccuracy: { ...curr } };
    }
    const prev = previousAccuracy || {};
    const merged = {};
    // Helper to merge two optional numeric scores using configured weights
    const merge = (p, c) => {
        if (typeof c !== 'number' && typeof p !== 'number')
            return undefined;
        // If current missing, fall back to previous
        if (typeof c !== 'number')
            return typeof p === 'number' ? Math.round(p) : undefined;
        if (typeof p !== 'number')
            return Math.round(c);
        return Math.round((p * weightOld) + (c * weightNew));
    };
    merged.overall = merge(prev.overall, curr.overall);
    merged.grammar = merge(prev.grammar, curr.grammar);
    merged.vocabulary = merge(prev.vocabulary, curr.vocabulary);
    merged.spelling = merge(prev.spelling, curr.spelling);
    merged.fluency = merge(prev.fluency, curr.fluency);
    merged.punctuation = merge(prev.punctuation, curr.punctuation);
    merged.capitalization = merge(prev.capitalization, curr.capitalization);
    return {
        currentAccuracy: curr,
        updatedOverallAccuracy: merged,
    };
}
//# sourceMappingURL=accuracyAggregator.js.map