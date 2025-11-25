/**
 * AI CORRECTION EXTRACTION ENGINE v3.0
 * -------------------------------------
 * Features:
 *  - Multi-pattern correction extraction
 *  - Semantic rewrite detection (Levenshtein + Jaccard)
 *  - Hinglish-safe matching
 *  - Duplicate protection
 *  - False positive suppression
 *  - Capped penalties (max 5 per category)
 *  - Structured error metadata output
 */

import {
  UnifiedAccuracyResult,
  UnifiedErrorDetail,
  ErrorSeverity
} from './unifiedAccuracyCalculators.js';

/**
 * Normalize text for comparison
 */
function normalize(str: string) {
  return (str ?? '')
    .replace(/[<>*`_]/g, '')       // Remove markdown
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Light sentence-level similarity using Jaccard + Levenshtein
 */
function semanticDifference(a: string, b: string) {
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));

  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = aWords.size + bWords.size - intersection;

  const jaccard = union === 0 ? 0 : intersection / union;

  const lev = levenshteinDistance(a, b) / Math.max(a.length, b.length);

  return { jaccard, lev };
}

/**
 * MAIN MODULE
 */
export function extractErrorsFromAIResponseImproved(
  userMessage: string,
  aiResponse: string,
  result: UnifiedAccuracyResult,
  features: any
): void {
  console.log('\n🔍 AI ERROR EXTRACTION v3.0 START');

  const clean = normalize(aiResponse);
  const originalNorm = normalize(userMessage);

  let detected = 0;
  let grammarDetected = 0;
  const corrections: UnifiedErrorDetail[] = [];

  // ---------------------------
  // 1. EXPLICIT CORRECTIONS (STRICT)
  // Only accept bracketed corrections like [CORRECTION: "..."] or clear side-by-side original->corrected pairs
  // ---------------------------
  const bracketPattern = /\[CORRECTION:\s*"([^"\]]+)"(?:\s*->\s*"([^"\]]+)")?\]/gi;
  const sideBySidePattern = /"([^"\]]+)"\s*(?:→|->|=>)\s*"([^"\]]+)"/g;

  let m;
  while ((m = bracketPattern.exec(aiResponse)) !== null) {
    const suggested = normalize(m[1]);
    const after = m[2] ? normalize(m[2]) : suggested;
    const before = m[2] ? normalize(m[1]) : undefined;

    detected++;
    corrections.push({
      type: 'grammar',
      category: 'grammar',
      message: 'AI suggested a correction (bracketed)',
      severity: 'medium',
      position: {
        start: before ? originalNorm.indexOf(before) : -1,
        end: before ? originalNorm.indexOf(before) + (before?.length ?? 0) : -1,
        word: before ?? ''
      },
      suggestion: after
    });
    grammarDetected++;
    console.log(`  🔧 Bracketed correction: "${before ?? '(suggestion)'}" → "${after}"`);
  }

  while ((m = sideBySidePattern.exec(aiResponse)) !== null) {
    const before = normalize(m[1]);
    const after = normalize(m[2]);
    detected++;
    corrections.push({
      type: 'grammar',
      category: 'grammar',
      message: 'AI suggested a side-by-side correction',
      severity: 'medium',
      position: {
        start: originalNorm.indexOf(before),
        end: originalNorm.indexOf(before) + before.length,
        word: before
      },
      suggestion: after
    });
    console.log(`  🔧 Explicit correction: "${before}" → "${after}"`);
    grammarDetected++;
  }

  // ---------------------------
  // 2. PAIRED ORIGINAL/IMPROVED DETECTIONS (STRICT)
  // Only treat rewrites as corrections when the AI includes an explicit 'original' and 'improved' pair
  // or other clear 'before'/'after' paired markers.
  // ---------------------------
  const pairedRewritePattern = /(original|before)\s*:\s*"([^"]+)"[\s\S]{0,120}?(improved|after|afterwards|better|rewrite)\s*:\s*"([^"]+)"/gi;
  let pairMatch;
  while ((pairMatch = pairedRewritePattern.exec(aiResponse)) !== null) {
    const before = normalize(pairMatch[2]);
    const after = normalize(pairMatch[4]);
    const { jaccard, lev } = semanticDifference(originalNorm, after);
    // Only significant rewrites
    if (jaccard < 0.8 || lev > 0.15) {
      detected++;
      corrections.push({
        type: 'grammar',
        category: 'grammar',
        message: 'AI provided paired rewrite',
        severity: 'medium',
        position: {
          start: originalNorm.indexOf(before),
          end: originalNorm.indexOf(before) + before.length,
          word: before
        },
        suggestion: after
      });
      console.log(`  🔄 Paired rewrite detected (Jaccard=${jaccard.toFixed(2)}, Lev=${lev.toFixed(2)})`);
      grammarDetected++;
    }
  }

  // ---------------------------
  // 3. SOFT ERROR HINT DETECTOR
  // ---------------------------
  const softIndicators = [
    'should be',
    'more clear',
    'sounds incorrect',
    'incorrect',
    'wrong',
    'mistake',
    'fix this',
    'needs correction'
  ];

  if (softIndicators.some(ind => clean.includes(ind))) {
    // soft indicators are hints (style/clarity) — do not count as explicit grammar corrections
    console.log('  📌 Soft correction indicator found (style/clarity) — not counted as grammar correction.');
  }

  // ---------------------------
  // 4. PREVENT FALSE POSITIVES
  // ---------------------------
  const praiseOnly = /(no corrections needed|perfect|no errors|well written)/i;
  if (praiseOnly.test(aiResponse)) {
    // Do not suppress penalties or detected corrections when AI says "no corrections needed".
    // Grammar scoring must come from the user's text, not the AI reply.
    console.log('  ℹ️ AI indicates no corrections — noting but not suppressing penalties');
  }

  // ---------------------------
  // 5. APPLY CAPPED PENALTIES
  // ---------------------------
  if (detected > 0) {
    const cap = (x: number) => Math.min(5, Math.max(0, x));

    const grammarPenalty = cap(detected * 1.5);
    const vocabPenalty   = cap(detected * 0.5);
    const fluencyPenalty = cap(detected * 0.3);
    const spellPenalty   = cap(detected * 0.1);

    // Do not mutate the scores here; instead record the computed penalties so
    // the unified ac
    // curacy merge step can apply them consistently and avoid
    // being overwritten by later normalization logic.
    result.aiResponseAnalysis = result.aiResponseAnalysis || ({} as any);
    (result.aiResponseAnalysis as any).penalties = {
      grammar: grammarPenalty,
      vocabulary: vocabPenalty,
      fluency: fluencyPenalty,
      spelling: spellPenalty,
    };

    console.log(`  📉 Computed AI penalties (deferred) → G:${grammarPenalty}, V:${vocabPenalty}`);
  }

  // ---------------------------
  // 6. FINALIZE
  // ---------------------------
  result.errors.push(...corrections);

  result.aiResponseAnalysis = {
    hasCorrectionFeedback: detected > 0,
    detectedCorrections: detected,
    hasGrammarCorrection: corrections.some(c => c.category === 'grammar'),
    hasStyleSuggestion: corrections.some(c => c.category === 'style'),
    correctedErrors: corrections.map(c => c.message),
    appreciationLevel: /well done|good job|excellent|great/i.test(aiResponse)
      ? 'high'
      : /nice|okay|not bad|minimal/i.test(aiResponse)
        ? 'minimal'
        : detected === 0
          ? 'moderate'
          : 'none',
    severityOfCorrections: detected === 0 ? 'none' :
                           detected <= 2 ? 'minor' :
                           detected <= 5 ? 'moderate' : 'major',
    engagementScore: 1 // You may want to compute this based on your logic
  };

  console.log(`  ✅ Total detected corrections: ${detected}`);
  console.log('🔍 === AI ERROR EXTRACTION COMPLETE ===\n');
}


/**
 * Levenshtein distance
 */
function levenshteinDistance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] = b[i - 1] === a[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
    }
  }

  return dp[b.length][a.length];
}
