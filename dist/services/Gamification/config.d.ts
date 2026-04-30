/**
 * 🎯 LEVELING SYSTEM CONFIGURATION
 * Centralized configuration for all leveling features
 */
import type { LevelingSystemConfig, XPCurveConfig, DecayConfig, MomentumConfig, PrestigeConfig, LevelingStorageKeys } from './type/index.js';
export declare const XP_CURVE_CONFIG: XPCurveConfig;
export declare const LEVEL_DIFFICULTY_MODIFIERS: {
    minLevel: number;
    modifier: number;
}[];
export declare const XP_PENALTY_RULES: {
    ERROR_WEIGHT: number;
    CRITICAL_ERROR_WEIGHT: number;
    LOW_ACCURACY_THRESHOLD: number;
    LOW_ACCURACY_WEIGHT: number;
    MAX_NEGATIVE_MULTIPLIER: number;
};
export declare const DECAY_CONFIG: DecayConfig;
export declare const MOMENTUM_CONFIG: MomentumConfig;
export declare const PRESTIGE_CONFIG: PrestigeConfig;
export declare const FEATURE_FLAGS: {
    SKILL_BRANCHING: boolean;
    ADAPTIVE_DIFFICULTY: boolean;
    PRESTIGE_SYSTEM: boolean;
    EVENT_SYSTEM: boolean;
    ANALYTICS: boolean;
    DECAY_SYSTEM: boolean;
    MOMENTUM_SYSTEM: boolean;
    LEADERBOARD: boolean;
    SOCIAL_FEATURES: boolean;
};
export declare const LEVELING_SYSTEM_CONFIG: LevelingSystemConfig;
export declare const STORAGE_KEYS: LevelingStorageKeys;
export declare const PROFICIENCY_THRESHOLDS: {
    Beginner: {
        min: number;
        max: number;
    };
    Intermediate: {
        min: number;
        max: number;
    };
    Advanced: {
        min: number;
        max: number;
    };
    Expert: {
        min: number;
        max: number;
    };
    Master: {
        min: number;
        max: number;
    };
};
export declare const ACCURACY_MULTIPLIERS: {
    threshold: number;
    multiplier: number;
    label: string;
}[];
export declare const STREAK_BONUSES: {
    days: number;
    multiplier: number;
    label: string;
}[];
export declare const MILESTONE_LEVELS: number[];
export declare const MILESTONE_REWARDS: Record<number, string[]>;
export declare const REWARD_RARITY_WEIGHTS: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
};
export declare const EVENT_TEMPLATES: {
    WEEKEND_BOOST: {
        name: string;
        multiplier: number;
        description: string;
    };
    CONSISTENCY_WEEK: {
        name: string;
        multiplier: number;
        description: string;
    };
    MILESTONE_MADNESS: {
        name: string;
        multiplier: number;
        description: string;
    };
    DOUBLE_XP: {
        name: string;
        multiplier: number;
        description: string;
    };
};
export declare const ANALYTICS_CONFIG: {
    HISTORY_RETENTION_DAYS: number;
    DAILY_XP_SAMPLES: number;
    PERFORMANCE_METRICS_COUNT: number;
    FORECAST_DAYS: number;
};
export declare const UI_CONFIG: {
    XP_ANIMATION_DURATION: number;
    LEVEL_UP_CELEBRATION_DURATION: number;
    PROGRESS_BAR_UPDATE_INTERVAL: number;
    NOTIFICATION_DISPLAY_TIME: number;
};
export declare const DEBUG_CONFIG: {
    ENABLE_CONSOLE_LOGS: boolean;
    ENABLE_XP_COMMANDS: boolean;
    FAST_LEVEL_UP: boolean;
    SKIP_DECAY: boolean;
};
export declare const VALIDATION_RULES: {
    MIN_XP_GAIN: number;
    MAX_XP_GAIN: number;
    MIN_ACCURACY: number;
    MAX_ACCURACY: number;
    MAX_STREAK: number;
    MIN_LEVEL: number;
    MAX_LEVEL: number;
};
export declare const CONFIG: {
    readonly SYSTEM: LevelingSystemConfig;
    readonly XP_CURVE: XPCurveConfig;
    readonly LEVEL_DIFFICULTY: {
        minLevel: number;
        modifier: number;
    }[];
    readonly XP_PENALTY: {
        ERROR_WEIGHT: number;
        CRITICAL_ERROR_WEIGHT: number;
        LOW_ACCURACY_THRESHOLD: number;
        LOW_ACCURACY_WEIGHT: number;
        MAX_NEGATIVE_MULTIPLIER: number;
    };
    readonly DECAY: DecayConfig;
    readonly MOMENTUM: MomentumConfig;
    readonly PRESTIGE: PrestigeConfig;
    readonly STORAGE: LevelingStorageKeys;
    readonly FEATURES: {
        SKILL_BRANCHING: boolean;
        ADAPTIVE_DIFFICULTY: boolean;
        PRESTIGE_SYSTEM: boolean;
        EVENT_SYSTEM: boolean;
        ANALYTICS: boolean;
        DECAY_SYSTEM: boolean;
        MOMENTUM_SYSTEM: boolean;
        LEADERBOARD: boolean;
        SOCIAL_FEATURES: boolean;
    };
    readonly PROFICIENCY: {
        Beginner: {
            min: number;
            max: number;
        };
        Intermediate: {
            min: number;
            max: number;
        };
        Advanced: {
            min: number;
            max: number;
        };
        Expert: {
            min: number;
            max: number;
        };
        Master: {
            min: number;
            max: number;
        };
    };
    readonly ACCURACY_MULTS: {
        threshold: number;
        multiplier: number;
        label: string;
    }[];
    readonly STREAK_BONUS: {
        days: number;
        multiplier: number;
        label: string;
    }[];
    readonly MILESTONES: Record<number, string[]>;
    readonly EVENTS: {
        WEEKEND_BOOST: {
            name: string;
            multiplier: number;
            description: string;
        };
        CONSISTENCY_WEEK: {
            name: string;
            multiplier: number;
            description: string;
        };
        MILESTONE_MADNESS: {
            name: string;
            multiplier: number;
            description: string;
        };
        DOUBLE_XP: {
            name: string;
            multiplier: number;
            description: string;
        };
    };
    readonly ANALYTICS: {
        HISTORY_RETENTION_DAYS: number;
        DAILY_XP_SAMPLES: number;
        PERFORMANCE_METRICS_COUNT: number;
        FORECAST_DAYS: number;
    };
    readonly UI: {
        XP_ANIMATION_DURATION: number;
        LEVEL_UP_CELEBRATION_DURATION: number;
        PROGRESS_BAR_UPDATE_INTERVAL: number;
        NOTIFICATION_DISPLAY_TIME: number;
    };
    readonly DEBUG: {
        ENABLE_CONSOLE_LOGS: boolean;
        ENABLE_XP_COMMANDS: boolean;
        FAST_LEVEL_UP: boolean;
        SKIP_DECAY: boolean;
    };
    readonly VALIDATION: {
        MIN_XP_GAIN: number;
        MAX_XP_GAIN: number;
        MIN_ACCURACY: number;
        MAX_ACCURACY: number;
        MAX_STREAK: number;
        MIN_LEVEL: number;
        MAX_LEVEL: number;
    };
};
export default CONFIG;
//# sourceMappingURL=config.d.ts.map