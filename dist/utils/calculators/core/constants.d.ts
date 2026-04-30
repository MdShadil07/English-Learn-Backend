import { CategoryWeights, WeightProfile } from './types.js';
export declare const DEFAULT_WEIGHTS: CategoryWeights;
export declare const WEIGHT_PROFILES: Record<string, WeightProfile>;
export declare const XP_CONFIG: {
    BASE_XP_PER_ACCURACY_POINT: number;
    WORD_BONUS: number;
    MIN_XP: number;
    MAX_XP: number;
    TIER_MULTIPLIERS: {
        free: number;
        pro: number;
        premium: number;
    };
    STREAK_BONUS_PER_DAY: number;
    PRECISION_STREAK_BONUS: number;
    MAX_STREAK_BONUS: number;
    PENALTY_SIGMOID_K: number;
    PENALTY_SIGMOID_X0: number;
};
export declare const LEVEL_CONFIG: {
    BASE_XP: number;
    EXPONENT: number;
    MAX_LEVEL: number;
};
export declare const NLP_TIMEOUTS: {
    LANGUAGETOOL: number;
    GPT: number;
    SPACY: number;
    TOTAL: number;
};
export declare const CACHE_TTL: {
    NLP_RESPONSE: number;
    USER_PROFILE: number;
    WEIGHT_PROFILE: number;
};
export declare const SEVERITY_WEIGHTS: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    suggestion: number;
};
declare const _default: {
    DEFAULT_WEIGHTS: CategoryWeights;
    WEIGHT_PROFILES: Record<string, WeightProfile>;
    XP_CONFIG: {
        BASE_XP_PER_ACCURACY_POINT: number;
        WORD_BONUS: number;
        MIN_XP: number;
        MAX_XP: number;
        TIER_MULTIPLIERS: {
            free: number;
            pro: number;
            premium: number;
        };
        STREAK_BONUS_PER_DAY: number;
        PRECISION_STREAK_BONUS: number;
        MAX_STREAK_BONUS: number;
        PENALTY_SIGMOID_K: number;
        PENALTY_SIGMOID_X0: number;
    };
    LEVEL_CONFIG: {
        BASE_XP: number;
        EXPONENT: number;
        MAX_LEVEL: number;
    };
    NLP_TIMEOUTS: {
        LANGUAGETOOL: number;
        GPT: number;
        SPACY: number;
        TOTAL: number;
    };
    CACHE_TTL: {
        NLP_RESPONSE: number;
        USER_PROFILE: number;
        WEIGHT_PROFILE: number;
    };
    SEVERITY_WEIGHTS: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        suggestion: number;
    };
};
export default _default;
//# sourceMappingURL=constants.d.ts.map