import {
  UnifiedAccuracyCalculator,
  UnifiedAccuracyResult,
  UserTier,
  UserProficiencyLevel,
  HistoricalWeightingConfig,
  CategoryMetricMap,
  unifiedAccuracyCalculator,
} from '../../utils/calculators/unifiedAccuracyCalculators.js';
import { fastAccuracyCache, optimizedAccuracyTracker } from './index.js';
import { progressOptimizationService } from '../Progress/progressOptimizationService.js';
import Progress, { IAccuracyData } from '../../models/Progress.js';
import { enforcePenalty } from './penaltyEnforcer.js';
import { detectLanguage, type LanguageDetectionSummary } from '../NLP/languageDetectionService.js';

export interface AccuracyProcessingParams {
  userId?: string;
  userMessage: string;
  aiResponse?: string;
  userTier: UserTier;
  userLevel?: UserProficiencyLevel | string;
  previousAccuracy?: Partial<IAccuracyData> | null;
  historicalWeighting?: HistoricalWeightingConfig;
}

export interface AccuracyProcessingResult {
  analysis: UnifiedAccuracyResult;
  currentAccuracy: Partial<IAccuracyData>;
  weightedAccuracy: Partial<IAccuracyData>;
  categoryDetails?: CategoryMetricMap;
  languageContext: LanguageDetectionSummary;
  historicalControls?: {
    requested?: HistoricalWeightingConfig;
    applied?: {
      current: number;
      historical: number;
      decayFactorApplied?: number;
      baselinesApplied?: string[];
    };
  };
  cacheSummary?: {
    overall: number;
    grammar: number;
    vocabulary: number;
    spelling: number;
    fluency: number;
    messageCount: number;
    lastUpdated: string;
  } | null;
}

const calculator = unifiedAccuracyCalculator ?? new UnifiedAccuracyCalculator();

const toDate = (value: Date | string | undefined | null): Date | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const formatScore = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Number(value.toFixed(2));
};

const buildScoreLog = (label: string, accuracy?: Partial<IAccuracyData> | null) => {
  if (!accuracy) {
    return `${label}: n/a`;
  }
  return `${label}: overall=${formatScore(accuracy.overall)} grammar=${formatScore(accuracy.grammar)} vocabulary=${formatScore(accuracy.vocabulary)} spelling=${formatScore(accuracy.spelling)} fluency=${formatScore(accuracy.fluency)}`;
};

const EMPTY_ACCURACY_BASELINE: Readonly<Partial<IAccuracyData>> = {
  overall: 0,
  adjustedOverall: 0,
  grammar: 0,
  vocabulary: 0,
  spelling: 0,
  fluency: 0,
  punctuation: 0,
  capitalization: 0,
  syntax: 0,
  coherence: 0,
};

const clampScore = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
};

const computeAdaptiveHistoricalWeighting = (
  base: HistoricalWeightingConfig | undefined,
  messageCount: number,
  lastUpdated?: Date | null
): HistoricalWeightingConfig | undefined => {
  const needsAdaptiveWeights = !base?.currentWeightOverride || !base?.decayFactor;
  if (!needsAdaptiveWeights && base) {
    return base;
  }

  const activityCount = Math.max(0, messageCount);
  let historicalShare = 0.15;
  if (activityCount >= 200) {
    historicalShare = 0.4;
  } else if (activityCount >= 120) {
    historicalShare = 0.34;
  } else if (activityCount >= 60) {
    historicalShare = 0.28;
  } else if (activityCount >= 25) {
    historicalShare = 0.22;
  } else if (activityCount >= 10) {
    historicalShare = 0.18;
  } else if (activityCount >= 3) {
    historicalShare = 0.14;
  }

  const hoursSinceLast = lastUpdated
    ? (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60)
    : null;

  if (hoursSinceLast !== null) {
    if (hoursSinceLast > 168) {
      historicalShare *= 0.55;
    } else if (hoursSinceLast > 96) {
      historicalShare *= 0.65;
    } else if (hoursSinceLast > 48) {
      historicalShare *= 0.75;
    } else if (hoursSinceLast > 24) {
      historicalShare *= 0.85;
    }
  }

  const clampedHistorical = Math.max(0.08, Math.min(0.45, historicalShare));
  const currentWeight = Number((1 - clampedHistorical).toFixed(2));

  // Default decay factor tuned for increased sensitivity to recent messages
  let decayFactor = 0.92;
  if (activityCount >= 200) {
    decayFactor = 0.94;
  } else if (activityCount >= 120) {
    decayFactor = 0.9;
  } else if (activityCount >= 60) {
    decayFactor = 0.86;
  } else if (activityCount >= 25) {
    decayFactor = 0.83;
  } else if (activityCount >= 10) {
    decayFactor = 0.8;
  }

  const adaptiveConfig: HistoricalWeightingConfig = {
    ...(base ?? {}),
  };

  // Use user-provided overrides when present; otherwise use more-sensitive defaults
  // Use stronger preference for current message by default to avoid history overpowering new evidence.
  if (!base?.currentWeightOverride) {
    adaptiveConfig.currentWeightOverride = 0.70; // more weight to current message (safer default)
  } else {
    adaptiveConfig.currentWeightOverride = base.currentWeightOverride;
  }

  // Use a conservative decay factor by default so historical influence decays faster.
  if (!base?.decayFactor) {
    adaptiveConfig.decayFactor = 0.35;
  } else {
    adaptiveConfig.decayFactor = base.decayFactor;
  }

  return adaptiveConfig;
};

const buildAccuracyFromAnalysis = (analysis: UnifiedAccuracyResult): Partial<IAccuracyData> => ({
  overall: clampScore(analysis.overall),
  adjustedOverall: clampScore(analysis.adjustedOverall ?? analysis.overall),
  grammar: clampScore(analysis.grammar),
  vocabulary: clampScore(analysis.vocabulary),
  spelling: clampScore(analysis.spelling),
  fluency: clampScore(analysis.fluency),
  punctuation: clampScore(analysis.punctuation),
  capitalization: clampScore(analysis.capitalization),
  syntax: clampScore(analysis.syntax),
  coherence: clampScore(analysis.coherence),
});

const buildLatestSnapshot = (accuracy: Partial<IAccuracyData>): IAccuracyData['latestSnapshot'] => ({
  overall: clampScore(accuracy.overall),
  grammar: clampScore(accuracy.grammar),
  vocabulary: clampScore(accuracy.vocabulary),
  spelling: clampScore(accuracy.spelling),
  fluency: clampScore(accuracy.fluency),
  punctuation: clampScore(accuracy.punctuation),
  capitalization: clampScore(accuracy.capitalization),
  syntax: clampScore(accuracy.syntax),
  coherence: clampScore(accuracy.coherence),
  recordedAt: new Date(),
});

const buildErrorsByType = (analysis: UnifiedAccuracyResult): IAccuracyData['errorsByType'] => ({
  grammar: analysis.statistics?.errorsByCategory?.grammar ?? 0,
  vocabulary: analysis.statistics?.errorsByCategory?.vocabulary ?? 0,
  spelling: analysis.statistics?.errorsByCategory?.spelling ?? 0,
  punctuation: analysis.statistics?.errorsByCategory?.punctuation ?? 0,
  capitalization: analysis.statistics?.errorsByCategory?.capitalization ?? 0,
  syntax: analysis.statistics?.errorsByCategory?.syntax ?? 0,
  style: analysis.statistics?.errorsByCategory?.style ?? 0,
  coherence: analysis.statistics?.errorsByCategory?.coherence ?? 0,
});

const buildProgressPayload = (
  accuracy: Partial<IAccuracyData>,
  analysis: UnifiedAccuracyResult,
  cacheSummary?: AccuracyProcessingResult['cacheSummary'],
  latestSnapshotAccuracy?: Partial<IAccuracyData>
): Partial<IAccuracyData> => {
  const cacheMetadata = cacheSummary
    ? {
        messageCount: Math.max(0, cacheSummary.messageCount ?? 0),
        lastUpdated: toDate(cacheSummary.lastUpdated) ?? null,
      }
    : undefined;

  const resolvedCalculationCount = cacheSummary?.messageCount ?? (accuracy as IAccuracyData)?.calculationCount ?? 1;
  const snapshotSource = latestSnapshotAccuracy ?? accuracy;

  const payload: Partial<IAccuracyData> = {
    ...accuracy,
    totalErrors: analysis.statistics?.errorCount ?? 0,
    criticalErrors: analysis.statistics?.criticalErrorCount ?? 0,
    errorsByType: buildErrorsByType(analysis),
    detectorContributions: analysis.nlpContributions as IAccuracyData['detectorContributions'],
    vocabularyLevel: analysis.vocabularyAnalysis?.level,
    lastCalculated: new Date(),
    calculationCount: resolvedCalculationCount,
    latestSnapshot: buildLatestSnapshot(snapshotSource),
  };

  if (cacheMetadata) {
    payload.cache = cacheMetadata;
  }

  return payload;
};

export async function processAccuracyRequest(
  params: AccuracyProcessingParams
): Promise<AccuracyProcessingResult> {
  const {
    userId,
    userMessage,
    aiResponse = '',
    userTier,
    userLevel,
    previousAccuracy,
    historicalWeighting,
  } = params;

  if (!userMessage || typeof userMessage !== 'string') {
    throw new Error('userMessage is required for accuracy processing');
  }

  let baselineAccuracy = previousAccuracy ?? undefined;
  const messagePreview = userMessage.replace(/\s+/g, ' ').slice(0, 120);
  console.log('🎛️ [AccuracyProcessing] Start', {
    userId: userId ? `${userId.slice(0, 8)}…` : 'anonymous',
    tier: userTier,
    hasAIResponse: Boolean(aiResponse?.length),
    messagePreview,
  });

  const languageContext = detectLanguage(userMessage);
  const skipEnglishChecks = languageContext.shouldSkipEnglishChecks;
  console.log('🌐 [AccuracyProcessing] Language detection', {
    primary: languageContext.primaryLanguageName,
    englishRatio: formatScore(languageContext.englishRatio),
    skipEnglishChecks,
    notes: languageContext.analysisNotes?.slice(0, 3) ?? [],
  });

  let activitySnapshot: { messageCount: number; lastUpdated?: Date } | null = null;

  if (params.userId) {
    const cached = fastAccuracyCache.getAccuracy(params.userId);
    if (cached) {
      activitySnapshot = {
        messageCount: cached.messageCount,
        lastUpdated: toDate(cached.lastUpdated) ?? undefined,
      };
      console.log('💾 [AccuracyProcessing] Using cached activity snapshot', {
        messageCount: cached.messageCount,
        lastUpdated: cached.lastUpdated instanceof Date ? cached.lastUpdated.toISOString() : cached.lastUpdated,
      });
    }
  }

  if (userId) {
    await ensureProgressDocument(userId);

    if (!baselineAccuracy) {
      baselineAccuracy = await fetchPreviousAccuracy(userId);
    }

    if (!activitySnapshot) {
      try {
        const initialized = await fastAccuracyCache.initializeUser(userId);
        activitySnapshot = {
          messageCount: initialized.messageCount,
          lastUpdated: toDate(initialized.lastUpdated) ?? undefined,
        };
        console.log('🗄️ [AccuracyProcessing] Initialized cache snapshot', {
          messageCount: initialized.messageCount,
          lastUpdated: initialized.lastUpdated instanceof Date ? initialized.lastUpdated.toISOString() : initialized.lastUpdated,
        });
      } catch (initializationError) {
        console.warn('⚠️ Failed to initialize fast accuracy cache for adaptive weighting:', initializationError);
      }
    }
  }

  const resolvedHistoricalWeighting = computeAdaptiveHistoricalWeighting(
    historicalWeighting,
    activitySnapshot?.messageCount ?? (baselineAccuracy as { calculationCount?: number } | undefined)?.calculationCount ?? 0,
    activitySnapshot?.lastUpdated ?? null
  );
  if (resolvedHistoricalWeighting) {
    console.log('🧮 [AccuracyProcessing] Historical weighting applied', {
      currentWeightOverride: resolvedHistoricalWeighting.currentWeightOverride,
      decayFactor: resolvedHistoricalWeighting.decayFactor,
      categoryBaselines: resolvedHistoricalWeighting.categoryBaselines ? Object.keys(resolvedHistoricalWeighting.categoryBaselines) : undefined,
    });
  } else {
    console.log('🧮 [AccuracyProcessing] Using default weighting (no overrides)');
  }


  
const logAccuracySummary = (
  analysis: UnifiedAccuracyResult,
  options: { cacheHit?: boolean | null } = {}
): void => {
  const overallScore = `${formatScore(analysis.overall)}%`;
  const confidence = Number((analysis.insights?.confidence ?? 0.75).toFixed(2));

  const moduleScores: Array<{ name: string; score: number | undefined }> = [
    { name: 'grammar', score: analysis.grammar },
    { name: 'vocabulary', score: analysis.vocabulary },
    { name: 'spelling', score: analysis.spelling },
    { name: 'fluency', score: analysis.fluency },
    { name: 'punctuation', score: analysis.punctuation },
    { name: 'capitalization', score: analysis.capitalization },
  ];

  const stableModules = new Set<string>();
  const degradedModules = new Set<string>();

  moduleScores.forEach(({ name, score }) => {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      return;
    }
    if (score >= 75) {
      stableModules.add(name);
    } else if (score < 60) {
      degradedModules.add(name);
    }
  });

  if (options.cacheHit === true) {
    stableModules.add('cache');
  } else if (options.cacheHit === false) {
    degradedModules.add('cache');
  }

  // XP pipeline remains external but is healthy when analysis succeeds.
  stableModules.add('xp');

  console.log('📈 ACCURACY SUMMARY:', {
    overall: overallScore,
    confidence,
    stableModules: Array.from(stableModules),
    degradedModules: Array.from(degradedModules),
  });
};


  const rawAnalysis = await calculator.analyzeMessage(userMessage, aiResponse, {
    tier: userTier,
    proficiencyLevel: userLevel as UserProficiencyLevel | undefined,
    previousAccuracy: baselineAccuracy,
    userId,
    enableWeightedCalculation: Boolean(userId),
    enableNLP: !skipEnglishChecks,
    historicalWeighting: resolvedHistoricalWeighting,
    languageContext,
  });
  const analysis = enforcePenalty(rawAnalysis, userMessage, languageContext);
  console.log('📊 [AccuracyProcessing] Analyzer output', {
    overall: formatScore(analysis.overall),
    adjustedOverall: formatScore(analysis.adjustedOverall),
    grammar: formatScore(analysis.grammar),
    vocabulary: formatScore(analysis.vocabulary),
    spelling: formatScore(analysis.spelling),
    fluency: formatScore(analysis.fluency),
    penaltyNotes: analysis.feedback?.slice(0, 3) ?? [],
    statistics: {
      errors: analysis.statistics?.errorCount,
      criticalErrors: analysis.statistics?.criticalErrorCount,
      processingTime: analysis.statistics?.processingTime,
    },
  });

  // Always use the analyzer's live outputs for the authoritative current accuracy.
  // Do NOT trust `analysis.currentAccuracy` (may be populated from historical snapshots).
  const currentAccuracy = buildAccuracyFromAnalysis(analysis);
  const weightedAccuracy = analysis.weightedAccuracy ?? currentAccuracy;
  console.log(
    '📈 [AccuracyProcessing] Score snapshots',
    `${buildScoreLog('current', currentAccuracy)} | ${buildScoreLog('weighted', weightedAccuracy)}`
  );

  let cacheSummary: AccuracyProcessingResult['cacheSummary'] = null;

  if (userId) {
    // Decide which snapshot to persist.
    // Rule: persist the live/current analyzer snapshot unless the current overall is effectively perfect.
    // This prevents historical snapshots from overwriting real, recent analyzer outputs for non-perfect messages.
    const persistUsingWeighted = typeof currentAccuracy.overall === 'number' && currentAccuracy.overall >= 99;
    const snapshotToPersist = persistUsingWeighted ? weightedAccuracy : currentAccuracy;

    const cacheResult = await fastAccuracyCache.updateAccuracy(userId, {
      overall: clampScore(snapshotToPersist.overall ?? currentAccuracy.overall),
      grammar: clampScore(snapshotToPersist.grammar ?? currentAccuracy.grammar),
      vocabulary: clampScore(snapshotToPersist.vocabulary ?? currentAccuracy.vocabulary),
      spelling: clampScore(snapshotToPersist.spelling ?? currentAccuracy.spelling),
      fluency: clampScore(snapshotToPersist.fluency ?? currentAccuracy.fluency),
      punctuation: clampScore(snapshotToPersist.punctuation ?? currentAccuracy.punctuation),
      capitalization: clampScore(snapshotToPersist.capitalization ?? currentAccuracy.capitalization),
      syntax: clampScore(snapshotToPersist.syntax ?? currentAccuracy.syntax),
      coherence: clampScore(snapshotToPersist.coherence ?? currentAccuracy.coherence),
    });

    cacheSummary = {
      overall: cacheResult.overall,
      grammar: cacheResult.grammar,
      vocabulary: cacheResult.vocabulary,
      spelling: cacheResult.spelling,
      fluency: cacheResult.fluency,
      messageCount: cacheResult.messageCount,
      lastUpdated: (cacheResult.lastUpdated ?? new Date()).toISOString(),
    };
    console.log('🧠 [AccuracyProcessing] Cache updated (persisted snapshot)', {
      persisted: persistUsingWeighted ? 'weighted' : 'current',
      overall: cacheSummary.overall,
      grammar: cacheSummary.grammar,
      vocabulary: cacheSummary.vocabulary,
      spelling: cacheSummary.spelling,
      fluency: cacheSummary.fluency,
      messageCount: cacheSummary.messageCount,
      lastUpdated: cacheSummary.lastUpdated,
    });

    await optimizedAccuracyTracker.trackAccuracy({
      userId,
      overall: cacheResult.overall,
      grammar: cacheResult.grammar,
      vocabulary: cacheResult.vocabulary,
      spelling: cacheResult.spelling,
      fluency: cacheResult.fluency,
      latest: {
        overall: snapshotToPersist.overall ?? currentAccuracy.overall,
        adjustedOverall: snapshotToPersist.adjustedOverall ?? snapshotToPersist.overall,
        grammar: snapshotToPersist.grammar ?? currentAccuracy.grammar,
        vocabulary: snapshotToPersist.vocabulary ?? currentAccuracy.vocabulary,
        spelling: snapshotToPersist.spelling ?? currentAccuracy.spelling,
        fluency: snapshotToPersist.fluency ?? currentAccuracy.fluency,
        punctuation: snapshotToPersist.punctuation ?? currentAccuracy.punctuation,
        capitalization: snapshotToPersist.capitalization ?? currentAccuracy.capitalization,
        syntax: snapshotToPersist.syntax ?? currentAccuracy.syntax,
        coherence: snapshotToPersist.coherence ?? currentAccuracy.coherence,
        timestamp: new Date(),
      },
    });

    // Persist progress using the chosen snapshot (current vs weighted) to keep XP/Progress consistent with published cache.
    await progressOptimizationService.updateAccuracyData(
      userId,
      buildProgressPayload(snapshotToPersist, analysis),
      { priority: 'high' }
    );
  }

  const historicalControls: AccuracyProcessingResult['historicalControls'] = resolvedHistoricalWeighting
    ? {
        requested: historicalWeighting,
        applied: analysis.performance?.weightsUsed
          ? {
              current: analysis.performance.weightsUsed.current,
              historical: analysis.performance.weightsUsed.historical,
              decayFactorApplied: analysis.performance.decayFactorApplied,
              baselinesApplied: analysis.performance.baselinesApplied,
            }
          : undefined,
      }
    : analysis.performance?.weightsUsed
      ? {
          applied: {
            current: analysis.performance.weightsUsed.current,
            historical: analysis.performance.weightsUsed.historical,
            decayFactorApplied: analysis.performance.decayFactorApplied,
            baselinesApplied: analysis.performance.baselinesApplied,
          },
        }
      : undefined;

  return {
    analysis,
    currentAccuracy,
    weightedAccuracy,
    categoryDetails: analysis.categoryDetails,
    languageContext,
    historicalControls,
    cacheSummary,
  };
}

async function ensureProgressDocument(userId: string): Promise<void> {
  const exists = await Progress.exists({ userId });
  if (exists) {
    return;
  }

  await Progress.create({
    userId,
    totalXP: 0,
    currentLevel: 1,
    currentLevelXP: 0,
    xpToNextLevel: 100,
    overallAccuracy: 0,
    proficiencyLevel: 'beginner',
  });
}

async function fetchPreviousAccuracy(userId: string): Promise<Partial<IAccuracyData> | undefined> {
  const progressDoc = await Progress.findOne({ userId })
    .select('accuracyData')
    .lean();

  const accuracyData = (progressDoc as { accuracyData?: Partial<IAccuracyData> } | null)?.accuracyData;

  if (!accuracyData) {
    return { ...EMPTY_ACCURACY_BASELINE };
  }

  return {
    overall: accuracyData.overall ?? 0,
    adjustedOverall: accuracyData.adjustedOverall ?? accuracyData.overall ?? 0,
    grammar: accuracyData.grammar ?? 0,
    vocabulary: accuracyData.vocabulary ?? 0,
    spelling: accuracyData.spelling ?? 0,
    fluency: accuracyData.fluency ?? 0,
    punctuation: accuracyData.punctuation ?? 0,
    capitalization: accuracyData.capitalization ?? 0,
    syntax: accuracyData.syntax ?? 0,
    coherence: accuracyData.coherence ?? 0,
  };
}
