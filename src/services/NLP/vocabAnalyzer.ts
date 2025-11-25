/**
 * 📚 VOCABULARY ANALYZER SERVICE (FREE)
 * Analyzes vocabulary level using CEFR wordlist and word frequency
 * Zero-cost vocabulary sophistication analysis
 */

import { logger } from '../../utils/calculators/core/logger.js';
import { normalizeEnglishToken, tokenizeAsciiWords } from '../../utils/text/englishNormalizer.js';
import { semanticVocabCalibrator, type SemanticPromotion } from './vocab/semanticCalibrator.js';
import spellingChecker from './spellingChecker.js';

// Optional: use wink-lemmatizer when available to normalize words before CEFR lookup
let lemmatizeWord: ((w: string) => string) | null = null;
try {
  // dynamic require/import — don't crash if the package isn't installed
  // wink-lemmatizer commonly exports functions; try to import and use `.word` if available
  // We avoid top-level async import for compatibility; require via eval-style import
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // (Wrap in try/catch to keep fallback behavior if not installed)
  // Note: during runtime in ESM environments, `require` may be unavailable — this will be ignored.
  // We'll attempt dynamic import below inside analyze() as well just in case.
  // Keep a conservative, non-failing attempt here.
  // @ts-ignore
  const maybe = (typeof require === 'function') ? require('wink-lemmatizer') : null;
  if (maybe && typeof maybe.word === 'function') {
    lemmatizeWord = (w: string) => maybe.word(w.toLowerCase());
  }
} catch (e) {
  // ignore — we'll try dynamic import in analyze()
}

// CEFR Level word lists (Common English words by proficiency level)
export const CEFR_WORDLISTS = {
  A1: new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'the', 'a', 'an',
    'is', 'am', 'are', 'was', 'were', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'go', 'goes', 'went', 'come', 'came',
    'see', 'saw', 'make', 'made', 'get', 'got', 'give', 'gave',
    'take', 'took', 'know', 'knew', 'think', 'thought', 'say', 'said',
    'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
    'good', 'bad', 'big', 'small', 'long', 'short', 'hot', 'cold',
    'new', 'old', 'young', 'happy', 'sad', 'easy', 'hard', 'fast', 'slow',
    'like', 'want', 'need', 'help', 'work', 'play', 'eat', 'drink',
    'read', 'write', 'speak', 'listen', 'learn', 'teach', 'study',
    'home', 'school', 'work', 'friend', 'family', 'day', 'time', 'year',
    'man', 'woman', 'child', 'boy', 'girl', 'person', 'people', 'thing',
  ]),
  A2: new Set([
    'already', 'also', 'although', 'always', 'because', 'before', 'between',
    'both', 'during', 'either', 'enough', 'every', 'however', 'important',
    'interesting', 'less', 'different', 'difficult', 'beautiful', 'wonderful',
    'understand', 'explain', 'describe', 'remember', 'forget', 'believe',
    'decide', 'choose', 'prefer', 'hope', 'wish', 'enjoy', 'hate', 'love',
    'try', 'start', 'begin', 'finish', 'stop', 'continue', 'change', 'improve',
    'problem', 'question', 'answer', 'idea', 'information', 'example',
    'reason', 'result', 'situation', 'experience', 'opportunity', 'advantage',
  ]),
  B1: new Set([
    'achieve', 'appropriate', 'approximately', 'arrangement', 'assessment',
    'circumstances', 'colleague', 'communication', 'community', 'competition',
    'consequence', 'considerable', 'constantly', 'contribute', 'convenient',
    'conventional', 'corporation', 'definitely', 'demonstrate', 'development',
    'discovery', 'discussion', 'economic', 'effectively', 'efficient',
    'employment', 'environment', 'equipment', 'establish', 'estimate',
    'evidence', 'examination', 'excellent', 'expansion', 'experience',
    'feedback', 'concern', 'concerns',
    // User-requested additions to reduce false unknown penalties
    'report', 'reports', 'reporting', 'reported', 'explain', 'explained', 'explanation', 'suppose', 'supposed',
  ]),
  B2: new Set([
    'acknowledge', 'adequate', 'adjacent', 'advocate', 'aggregate', 'allocate',
    'ambiguous', 'amend', 'analogous', 'anticipate', 'arbitrary', 'aspiration',
    'assumption', 'attribute', 'capacity', 'circumstantial', 'coherent',
    'commodity', 'compatible', 'compile', 'complement', 'comprehensive',
    'comprise', 'concurrent', 'conducive', 'confer', 'configuration',
    'considerable', 'constitute', 'constrain', 'contemporary', 'controversy',
    'implementation', 'implement', 'implements', 'implementing', 'implemented',
    'critical', 'critically', 'confusion', 'frustration',
    // User-requested additions
    'postpone', 'postponed', 'postponing', 'postponement',
  ]),
  C1: new Set([
    'accommodate', 'acquaint', 'ambivalent', 'catalyst', 'complacent',
    'contemplate', 'contingent', 'corroborate', 'culminate', 'delineate',
    'deteriorate', 'diminish', 'discrepancy', 'divergent', 'empirical',
    'exemplify', 'formidable', 'imperative', 'inadvertent', 'inception',
    'inherent', 'instantaneous', 'intricate', 'juxtapose', 'paramount',
    'preclude', 'preliminary', 'proliferate', 'resilient', 'substantiate',
  ]),
  C2: new Set([
    'aberration', 'abstruse', 'accolade', 'ameliorate', 'anachronism',
    'apropos', 'assiduous', 'austere', 'bellwether', 'brusque', 'byzantine',
    'capricious', 'censure', 'chicanery', 'circumspect', 'coalesce',
    'cognizant', 'commensurate', 'complicit', 'conflagration', 'conundrum',
    'corroborate', 'dearth', 'deference', 'deleterious', 'denouement',
    'derivative', 'diatribe', 'dichotomy', 'dilettante', 'disparate',
  ]),
};

const ADVANCED_VOCABULARY: Partial<Record<keyof typeof CEFR_WORDLISTS, string[]>> = {
  B1: [
    'collaborate',
    'collaborated',
    'collaborating',
    'collaborates',
    'collaboration',
    'collaborative',
    'opportunity',
    'opportunities',
    'strategic',
    'strategies',
    'strategize',
  ],
  B2: [
    'analytical',
    'analysis',
    'framework',
    'implementation',
    'integration',
    'integrated',
    'integrate',
    'innovative',
    'innovation',
    'innovations',
    'stakeholder',
    'stakeholders',
    'sustainable',
    'sustainability',
    'mechanism',
    'mechanisms',
    'precision',
    'nuance',
    'nuances',
  ],
  C1: [
    'indispensable',
    'indispensably',
    'resilience',
    'resilient',
    'comprehensive',
    'cohesive',
    'synthesis',
    'synergy',
    'synergies',
    'methodology',
    'methodologies',
    'paradigm',
    'paradigms',
    'contextual',
  'insight',
  'insights',
  'indicators',
  ],
};

Object.entries(ADVANCED_VOCABULARY).forEach(([level, words]) => {
  const list = CEFR_WORDLISTS[level as keyof typeof CEFR_WORDLISTS];
  if (!list || !words) {
    return;
  }
  words.forEach((word) => list.add(word));
});

// Hotfix: include a small set of common tokens that are often missed by static lists
// These reduce false 'unknown' penalties for short/simple inputs (user-reported cases)
const COMMON_FIXES: Record<keyof typeof CEFR_WORDLISTS, string[]> = {
  A1: [],
  A2: ['weary', 'pause', 'paused', 'continue', 'continued'],
  B1: ['explanation'],
  B2: [],
  C1: [],
  C2: [],
};

Object.entries(COMMON_FIXES).forEach(([level, words]) => {
  const list = CEFR_WORDLISTS[level as keyof typeof CEFR_WORDLISTS];
  if (!list) return;
  words.forEach((w) => list.add(w));
});

const CEFR_ACADEMIC_ENRICHMENTS: Array<{
  level: keyof typeof CEFR_WORDLISTS;
  words: string[];
}> = [
  {
    level: 'B2',
    words: [
      'appeal', 'appealing', 'appealed', 'appeals',
      'approach', 'approached', 'approaches',
      'arguably', 'articulate', 'articulated', 'articulates', 'articulating',
      'assess', 'assessed', 'assessing', 'assessment', 'assessments',
      'benchmark', 'benchmarks', 'capacity', 'capacities',
      'compelling', 'compliance', 'compliant', 'comprises', 'comprising',
      'component', 'components', 'computation', 'computational',
      'conclusive', 'conclusively', 'conducted', 'conducting',
      'conflict', 'conflicted', 'conflicting',
      'constraint', 'constraints', 'constructive',
      'credibility', 'credible', 'critique', 'critiques',
      'derives', 'deriving', 'differentiation',
      'emphasis', 'emphasize', 'emphasized', 'emphasizes', 'emphasizing',
      'envision', 'envisioned', 'ethical', 'evaluate', 'evaluated', 'evaluates', 'evaluating', 'evaluation',
      'feasible', 'feasibility', 'forecast', 'forecasted', 'forecasting', 'forecasts',
      'frameworks', 'infrastructure', 'insightful', 'insufficiency', 'insufficient',
      'integral', 'integrals', 'intensive', 'intervention', 'interventions',
      'metric', 'metrics', 'mitigate', 'mitigated', 'mitigates', 'mitigating', 'mitigation',
      'model', 'modeled', 'modeling', 'models', 'notable', 'notably',
      'outcome', 'outcomes', 'outperform', 'outperformed', 'outperforming', 'outperforms',
      'outweigh', 'outweighed', 'outweighing', 'outweighs',
      'parameter', 'parameters', 'predict', 'predicted', 'predicting', 'prediction', 'predictions', 'predictive',
      'project', 'projected', 'projecting', 'projective', 'projects', 'projection', 'projections',
      'prominent', 'prospective', 'prototype', 'prototypes',
      'reallocate', 'reallocated', 'reallocating', 'reallocation',
      'refine', 'refined', 'refinement', 'refinements',
      'regulate', 'regulated', 'regulating', 'regulation', 'regulatory',
      'reinforce', 'reinforced', 'reinforces', 'reinforcing', 'reinforcement',
      'reliable', 'reliably', 'reliance', 'robust', 'robustness',
      'scenario', 'scenarios', 'simulate', 'simulated', 'simulates', 'simulating', 'simulation', 'simulations',
      'sufficient', 'sufficiently', 'sustain', 'sustained', 'sustains', 'sustaining',
      'synthesizes', 'tangible', 'threshold', 'thresholds', 'validate', 'validated', 'validates', 'validating', 'validation',
    ],
  },
  {
    level: 'C1',
    words: [
      'acumen', 'aggregate', 'ambiguity', 'analytical', 'applicability', 'approximation',
      'capstone', 'catalyst', 'cohesion', 'comparative', 'compensate', 'compensating', 'compensation',
      'complementary', 'comprehensive', 'conceptual', 'conjecture', 'consortium', 'contextualize', 'contextualized',
      'contingency', 'correlation', 'corroborated', 'derivative', 'diagnostic', 'dichotomy', 'differential',
      'disproportionate', 'disseminate', 'disseminated', 'dissemination',
      'empirical', 'encapsulate', 'encapsulated', 'epistemic', 'equilibrium',
      'extrapolate', 'extrapolated', 'extrapolates', 'extrapolating', 'extrapolation',
      'formulation', 'hierarchical', 'hypothesis', 'hypothesize', 'hypothesized', 'hypothesizes', 'hypothesizing',
      'imperative', 'incidence', 'incremental', 'indicative', 'inequity', 'inference', 'inferential',
      'interpretive', 'interrelated', 'intricacy', 'longitudinal', 'methodical', 'methodological',
      'paramount', 'phenomenon', 'precedent', 'preliminary', 'probabilistic', 'propensity',
      'qualitative', 'quantifiable', 'quantitative', 'reciprocal', 'rectify', 'rectified', 'rectifies', 'rectifying',
      'redistribute', 'redistributed', 'redistributing', 'redistribution',
      'salient', 'signatory', 'standardized', 'stratification', 'subsequent', 'substantiate', 'substantive',
      'systemic', 'transitory', 'utilitarian', 'viability', 'viable',
    ],
  },
  {
    level: 'C2',
    words: [
      'apportion', 'axiomatic', 'commensurate', 'contemporaneous', 'deleterious', 'demarcation',
      'disambiguate', 'disambiguated', 'disambiguation', 'disproportionately', 'equivocal',
      'heuristic', 'idiosyncratic', 'imperceptible', 'incongruous', 'indeterminacy', 'indeterminate',
      'interlocutor', 'irreconcilable', 'monolithic', 'orthogonal', 'paradigmatic',
      'perfunctory', 'perspicacious', 'phenomenological', 'recapitulate', 'recapitulated', 'recapitulates',
      'recontextualize', 'recontextualized', 'recontextualizes', 'recontextualizing',
      'reconfigure', 'reconfigured', 'reconfigures', 'reconfiguring', 'reconfiguration',
      'reconvene', 'reconvened', 'singularity', 'specious', 'symbiotic',
      'transcendent', 'transmutation', 'unilateral', 'verisimilitude',
    ],
  },
];

CEFR_ACADEMIC_ENRICHMENTS.forEach(({ level, words }) => {
  const list = CEFR_WORDLISTS[level];
  words.forEach((word) => list.add(word));
});

const ACADEMIC_SUFFIX_HINTS: Array<{ pattern: RegExp; level: keyof typeof CEFR_WORDLISTS }> = [
  { pattern: /(tion|sion|ment|ance|ence|ancy|ency|ative|atory|ality|ship)$/i, level: 'B2' },
  { pattern: /(ability|ibility|ization|isation|logy|metric|phobic|philia|phile)$/i, level: 'C1' },
  { pattern: /(esque|eity|iality|icacy|iferous|itudinal|ological)$/i, level: 'C2' },
];

const ACADEMIC_PREFIX_HINTS: Array<{ pattern: RegExp; level: keyof typeof CEFR_WORDLISTS }> = [
  { pattern: /^(inter|trans|multi|macro|micro|infra|ultra|meta)/i, level: 'B2' },
  { pattern: /^(counter|hyper|hetero|homo|para|proto|retro)/i, level: 'C1' },
  { pattern: /^(pan|apo|pseudo|tele|xeno)/i, level: 'C2' },
];

const CEFR_SYNONYM_GROUPS: Array<{
  base: string;
  level: keyof typeof CEFR_WORDLISTS;
  synonyms: string[];
}> = [
  {
    base: 'offer',
    level: 'A2',
    synonyms: ['propose', 'present', 'provide', 'extend', 'tender', 'suggest'],
  },
  {
    base: 'taken',
    level: 'B1',
    synonyms: ['accepted', 'assumed', 'captured', 'seized', 'claimed', 'acquired'],
  },
  {
    base: 'would',
    level: 'A2',
    synonyms: ['might', 'could', 'should', 'intend', 'plan'],
  },
];

const CEFR_SYNONYM_LOOKUP: Record<string, string[]> = {};

CEFR_SYNONYM_GROUPS.forEach(({ base, level, synonyms }) => {
  const targetSet = CEFR_WORDLISTS[level];
  targetSet.add(base);
  synonyms.forEach((synonym) => targetSet.add(synonym));
  CEFR_SYNONYM_LOOKUP[base] = synonyms;
});

export const CEFR_COMBINED_WORDSET: Set<string> = (() => {
  const combined = new Set<string>();
  Object.values(CEFR_WORDLISTS).forEach((wordSet: Set<string>) => {
    wordSet.forEach((word: string) => combined.add(word));
  });
  return combined;
})();

interface VocabularyAnalysis {
  level: string; // A1, A2, B1, B2, C1, C2
  score: number; // 0-100
  averageWordLength: number;
  uniqueWords: number;
  totalWords: number;
  lexicalDiversity: number; // unique/total ratio
  complexWords: number;
  cefrDistribution: {
    A1: number;
    A2: number;
    B1: number;
    B2: number;
    C1: number;
    C2: number;
    unknown: number;
  };
  suggestions: string[];
}

class VocabularyAnalyzerService {
  /**
   * Determine CEFR level of a word
   */
  private getWordLevel(word: string): keyof typeof CEFR_WORDLISTS | 'unknown' {
    if (!word) {
      return 'unknown';
    }

    const candidateRoots = new Set<string>();
    const pushCandidate = (token: string | undefined | null): void => {
      if (!token) {
        return;
      }
      const cleaned = token.toLowerCase().replace(/[^a-z-]/g, '');
      if (cleaned) {
        candidateRoots.add(cleaned);
      }
    };

    pushCandidate(word);
    pushCandidate(normalizeEnglishToken(word, CEFR_COMBINED_WORDSET));

    for (const candidate of candidateRoots) {
      const level = this.lookupWordLevel(candidate);
      if (level !== 'unknown') {
        return level;
      }
    }

    const lemmaCandidates = new Set<string>();
    candidateRoots.forEach((root) => {
      this.generateLemmaCandidates(root).forEach((lemma) => {
        if (lemma) {
          lemmaCandidates.add(lemma);
        }
      });
    });

    for (const candidate of lemmaCandidates) {
      const level = this.lookupWordLevel(candidate);
      if (level !== 'unknown') {
        return level;
      }
    }

    for (const candidate of lemmaCandidates) {
      const inferred = this.inferLevelFromMorphology(candidate);
      if (inferred) {
        return inferred;
      }
    }

    for (const candidate of candidateRoots) {
      const inferred = this.inferLevelFromMorphology(candidate);
      if (inferred) {
        return inferred;
      }
    }

    return 'unknown';
  }

  private lookupWordLevel(word: string): keyof typeof CEFR_WORDLISTS | 'unknown' {
    if (!word) {
      return 'unknown';
    }
    if (CEFR_WORDLISTS.A1.has(word)) return 'A1';
    if (CEFR_WORDLISTS.A2.has(word)) return 'A2';
    if (CEFR_WORDLISTS.B1.has(word)) return 'B1';
    if (CEFR_WORDLISTS.B2.has(word)) return 'B2';
    if (CEFR_WORDLISTS.C1.has(word)) return 'C1';
    if (CEFR_WORDLISTS.C2.has(word)) return 'C2';
    return 'unknown';
  }

  private generateLemmaCandidates(word: string): string[] {
    if (!word || word.length <= 3) {
      return [];
    }

    const candidates = new Set<string>();

    if (word.endsWith('ies') && word.length > 4) {
      candidates.add(`${word.slice(0, -3)}y`);
    }
    if (word.endsWith('ves') && word.length > 4) {
      candidates.add(`${word.slice(0, -3)}f`);
      candidates.add(`${word.slice(0, -3)}fe`);
    }
    if (word.endsWith('es') && word.length > 3) {
      candidates.add(word.slice(0, -2));
    }
    if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
      candidates.add(word.slice(0, -1));
    }
    if (word.endsWith('ing') && word.length > 4) {
      const withoutIng = word.slice(0, -3);
      candidates.add(withoutIng);
      if (withoutIng.length > 2 && withoutIng[withoutIng.length - 1] === withoutIng[withoutIng.length - 2]) {
        candidates.add(withoutIng.slice(0, -1));
      }
      candidates.add(`${withoutIng}e`);
    }
    if (word.endsWith('ed') && word.length > 4) {
      const withoutEd = word.slice(0, -2);
      candidates.add(withoutEd);
      if (withoutEd.length > 2 && withoutEd[withoutEd.length - 1] === withoutEd[withoutEd.length - 2]) {
        candidates.add(withoutEd.slice(0, -1));
      }
      candidates.add(`${withoutEd}e`);
    }

    return Array.from(candidates).filter((candidate) => candidate && candidate !== word);
  }

  private inferLevelFromMorphology(word: string): keyof typeof CEFR_WORDLISTS | null {
    if (!word) {
      return null;
    }

    for (const { pattern, level } of ACADEMIC_SUFFIX_HINTS) {
      if (pattern.test(word)) {
        return level;
      }
    }

    for (const { pattern, level } of ACADEMIC_PREFIX_HINTS) {
      if (pattern.test(word)) {
        return level;
      }
    }

    if (word.includes('-') && word.length >= 8) {
      return 'B2';
    }

    if (word.length >= 12) {
      return 'C1';
    }

    if (word.length >= 9) {
      return 'B2';
    }

    return null;
  }
  
  /**
   * Calculate lexical diversity (Type-Token Ratio)
   */
  private calculateLexicalDiversity(words: string[]): number {
    if (words.length === 0) return 0;
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    return uniqueWords.size / words.length;
  }
  
  /**
   * Determine overall CEFR level from distribution
   */
  private determineOverallLevel(distribution: VocabularyAnalysis['cefrDistribution']): string {
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'A1';
    
    // Calculate weighted average
    const weights = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, unknown: 2 };
    let weightedSum = 0;
    
    Object.entries(distribution).forEach(([level, count]) => {
      const weight = weights[level as keyof typeof weights] || 2;
      weightedSum += weight * count;
    });
    
    const avgWeight = weightedSum / total;
    
    if (avgWeight < 1.5) return 'A1';
    if (avgWeight < 2.5) return 'A2';
    if (avgWeight < 3.5) return 'B1';
    if (avgWeight < 4.5) return 'B2';
    if (avgWeight < 5.5) return 'C1';
    return 'C2';
  }
  
  /**
   * Analyze vocabulary level and sophistication
   */
  async analyze(text: string): Promise<VocabularyAnalysis> {
    try {
      // Attempt dynamic import of wink-lemmatizer if not already available
      if (!lemmatizeWord) {
        try {
          const mod = await import('wink-lemmatizer');
          if (mod && typeof (mod as any).word === 'function') {
            lemmatizeWord = (w: string) => (mod as any).word(w.toLowerCase());
          }
        } catch (e) {
          // not installed — continue with heuristic lemmatization
          logger.debug('wink-lemmatizer not available, using heuristic lemmatization');
        }
      }
      // Extract words
      const rawWords: string[] = tokenizeAsciiWords(text);
      const normalizedWords: string[] = rawWords
        .map((word: string) => normalizeEnglishToken(word, CEFR_COMBINED_WORDSET))
        .filter((word: string) => word.length >= 2);

      if (normalizedWords.length === 0) {
        return this.getEmptyAnalysis();
      }
      
      // Calculate distribution
      const distribution = {
        A1: 0,
        A2: 0,
        B1: 0,
        B2: 0,
        C1: 0,
        C2: 0,
        unknown: 0,
      };
      
      const wordLevels: Array<{ word: string; level: keyof typeof CEFR_WORDLISTS | 'unknown'; misspelled?: boolean }> = [];
      let misspelledCount = 0;

      for (const word of normalizedWords) {
        let level: keyof typeof CEFR_WORDLISTS | 'unknown' = 'unknown';
        let misspelled = false;

        try {
          // If Typo.js is available, consult it. If not available, assume correctness
          const checkerAvailable = (spellingChecker as any).isAvailable ? (spellingChecker as any).isAvailable() : true;
          const isCorrect = checkerAvailable ? spellingChecker.check(word) : true;

          if (!isCorrect) {
            misspelled = true;
            misspelledCount += 1;
            // Try to recover via suggestion for vocabulary lookup
            const suggestions = spellingChecker.suggest(word) || [];
            if (suggestions.length > 0) {
              const candidate = (lemmatizeWord ? lemmatizeWord(suggestions[0]) : suggestions[0]).toLowerCase();
              level = this.getWordLevel(candidate);
            } else {
              // leave as unknown for now
              level = 'unknown';
            }
          } else {
            const candidate = lemmatizeWord ? lemmatizeWord(word) : word;
            level = this.getWordLevel(candidate.toLowerCase());
          }
        } catch (err) {
          // If spelling check fails unexpectedly, fall back to lookup
          level = this.getWordLevel(word);
        }

        distribution[level]++;
        wordLevels.push({ word, level, misspelled });
      }

      let semanticPromotions: SemanticPromotion[] = [];
      if (distribution.unknown > 0 && normalizedWords.length >= 12) {
        const candidates = wordLevels
          .filter(({ level }) => level === 'unknown')
          .map(({ word }) => word);

        semanticPromotions = await semanticVocabCalibrator.promote(candidates);

        if (semanticPromotions.length > 0) {
          semanticPromotions.forEach(({ word, level }) => {
            let occurrences = 0;
            wordLevels.forEach((entry) => {
              if (entry.level === 'unknown' && entry.word === word) {
                entry.level = level;
                occurrences += 1;
              }
            });

            if (occurrences > 0) {
              distribution.unknown -= occurrences;
              distribution[level] += occurrences;
            }
          });
        }
      }
      
      // Calculate metrics
      const totalWords = rawWords.length;
      const uniqueWords = new Set(normalizedWords);
      const averageWordLength = totalWords > 0
        ? rawWords.reduce((sum: number, token: string) => sum + token.length, 0) / totalWords
        : 0;
    const lexicalDiversity = this.calculateLexicalDiversity(normalizedWords);
    const complexWords = distribution.B2 + distribution.C1 + distribution.C2;
      const overallLevel = this.determineOverallLevel(distribution);
      
      // Calculate score (0-100) with stricter unknown word penalty
      const levelScores = { A1: 40, A2: 55, B1: 70, B2: 80, C1: 90, C2: 95 };
      let baseScore = levelScores[overallLevel as keyof typeof levelScores] || 50;
      
      // Heavy penalty for unknown words (not in any CEFR list)
      const unknownRatio = distribution.unknown / normalizedWords.length;
      const advancedCount = distribution.B2 + distribution.C1 + distribution.C2;
      const advancedRatio = advancedCount / normalizedWords.length;
      const longWordCount = wordLevels.filter(({ word }) => word.length >= 8).length;
      let longWordRatio = longWordCount / normalizedWords.length;

      if (unknownRatio > 0.82) {
        // 82%+ unknown = critically low vocabulary (32-42 range)
        baseScore = Math.max(32, 52 - (unknownRatio * 38));
      } else if (unknownRatio > 0.65) {
        // 65-82% unknown = very low vocabulary (45-58 range)
        baseScore = Math.max(45, 68 - (unknownRatio * 30));
      } else if (unknownRatio > 0.4) {
        // 40-65% unknown = moderate penalty
        baseScore = baseScore * (1 - (Math.max(0, unknownRatio - 0.25) * 0.22));
      }

      // Only apply the fallback CEFR 'boost' for longer texts — disable for short inputs
      if (unknownRatio > 0.6 && totalWords > 25) {
        const inferredAcademicDensity = wordLevels.filter(({ word, level }) => {
          if (level !== 'unknown') {
            return false;
          }
          return /(?:tion|sion|ment|ance|ence|ancy|ency|ive|ous|ing|ed)$/i.test(word) || word.length >= 9;
        }).length / Math.max(1, distribution.unknown);

        const fallbackScore =
          58 +
          Math.min(0.45, advancedRatio) * 70 +
          Math.min(0.4, longWordRatio) * 40 +
          inferredAcademicDensity * 24;

        baseScore = Math.max(baseScore, Math.min(95, fallbackScore));
      }
      
      const unknownCount = distribution.unknown;
      const safeTokenCount = Math.max(1, normalizedWords.length);
      // Reduce unknown-word penalty for tokens that were only unknown due to misspelling
      const adjustedUnknownCount = Math.max(0, unknownCount - misspelledCount);
      // Adjust for lexical diversity (now capped to limit over-inflation)
      let diversityBonus = lexicalDiversity * 15;
      // Drop diversity bonus for short texts (<= 25 tokens)
      if (safeTokenCount <= 25) {
        diversityBonus = 0;
        // Also ignore long-word signal for very short texts
        longWordRatio = 0;
      } else {
        // Strict cap as requested
        if (diversityBonus > 6) diversityBonus = 6;
      }
      const penaltyAllowance = 0.35;
      const effectiveUnknown = Math.max(0, adjustedUnknownCount - safeTokenCount * penaltyAllowance);
      const unknownPenalty = effectiveUnknown / safeTokenCount;
        // Increase unknown-word penalty severity (points)
        let penaltyPoints = unknownPenalty * 60;
        // Cap unknown-word penalty to avoid exceeding -30 points
        if (penaltyPoints > 30) penaltyPoints = 30;

      const rawScore = baseScore + diversityBonus - penaltyPoints;
  const score = Math.max(0, Math.min(100, rawScore));
      
      // Generate suggestions
      const suggestions = this.generateSuggestions(distribution, lexicalDiversity, overallLevel, normalizedWords);
      
      // Development console logs
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📚 2.2: Vocabulary Analysis (CEFR)...`);
        console.log(`  📄 Analyzing text: "${text}"`);
        console.log(`  📊 Vocabulary Metrics:`);
        console.log(`     Total words: ${totalWords}`);
        console.log(`     Unique words: ${uniqueWords.size}`);
        console.log(`     Lexical diversity: ${lexicalDiversity.toFixed(2)}`);
        console.log(`     Average word length: ${averageWordLength.toFixed(1)}`);
    console.log(`     Complex words (B2+): ${complexWords}`);
        console.log(`  📈 CEFR Distribution:`);
        console.log(`     A1: ${distribution.A1} words`);
        console.log(`     A2: ${distribution.A2} words`);
        console.log(`     B1: ${distribution.B1} words`);
        console.log(`     B2: ${distribution.B2} words`);
        console.log(`     C1: ${distribution.C1} words`);
        console.log(`     C2: ${distribution.C2} words`);
        console.log(`     Unknown: ${distribution.unknown} words (${(unknownRatio * 100).toFixed(1)}%)`);
        console.log(`  🎯 Scoring Breakdown:`);
        console.log(`     Overall level: ${overallLevel}`);
        console.log(`     Base score: ${levelScores[overallLevel as keyof typeof levelScores]}`);
        console.log(`     Unknown penalty applied: ${unknownRatio > 0.25 ? 'Yes' : 'No'}`);
        // Only report fallback boost when the input is sufficiently long (avoid noisy logs for short text)
        if (unknownRatio > 0.5 && totalWords > 25) {
          console.log(`     Fallback boost active: Yes (advancedRatio ${(advancedRatio * 100).toFixed(1)}%, longWordRatio ${(longWordRatio * 100).toFixed(1)}%)`);
        }
        if (semanticPromotions.length > 0) {
          const details = semanticPromotions
            .slice(0, 6)
            .map(({ word, level, similarity }) => `${word}→${level} (${similarity.toFixed(2)})`)
            .join(', ');
          console.log(`     Semantic promotions: ${details}`);
        }
  console.log(`     Diversity bonus: +${diversityBonus.toFixed(1)}`);
  console.log(`     Unknown penalty: -${penaltyPoints.toFixed(1)} (${(unknownPenalty * 100).toFixed(1)}% tokens)`);
        console.log(`     Final score: ${Math.round(score)}`);
      }
      
      logger.debug(
        {
          level: overallLevel,
          score,
          totalWords,
          semanticPromotions: semanticPromotions.slice(0, 10).map(({ word, level, similarity }) => ({ word, level, similarity })),
        },
        'Vocabulary analysis complete',
      );
      
      return {
        level: overallLevel,
        score: Math.round(score),
        averageWordLength: Math.round(averageWordLength * 10) / 10,
        uniqueWords: uniqueWords.size,
        totalWords,
        lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
        complexWords,
        cefrDistribution: distribution,
        suggestions,
      };
    } catch (error) {
      logger.error({ error }, 'Error analyzing vocabulary');
      return this.getEmptyAnalysis();
    }
  }
  
  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(
    distribution: VocabularyAnalysis['cefrDistribution'],
    diversity: number,
    level: string,
    normalizedWords: string[]
  ): string[] {
    const suggestions: string[] = [];
    const normalizedSet = new Set(normalizedWords.map((word) => word.toLowerCase()));
    
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const a1Percentage = (distribution.A1 / total) * 100;
    
    if (a1Percentage > 70) {
      suggestions.push('Try using more varied vocabulary - many words are very basic');
    }
    
    if (diversity < 0.4) {
      suggestions.push('Increase word variety - you\'re repeating the same words often');
    }
    
    if (distribution.B2 + distribution.C1 + distribution.C2 === 0 && total > 10) {
      suggestions.push('Consider using some more advanced vocabulary to express ideas precisely');
    }
    
    if (level === 'A1' || level === 'A2') {
      suggestions.push('Good start! Try incorporating intermediate-level words (B1) to improve');
    }
    
    if (diversity > 0.7) {
      suggestions.push('Excellent word variety! Your vocabulary is diverse');
    }

    let synonymHintCount = 0;
    for (const [base, synonyms] of Object.entries(CEFR_SYNONYM_LOOKUP)) {
      if (synonymHintCount >= 2) {
        break;
      }

      const baseUsed = normalizedSet.has(base);
      const synonymUsed = synonyms.some((synonym) => normalizedSet.has(synonym));
      if (!baseUsed && !synonymUsed) {
        continue;
      }

      const unusedSynonyms = synonyms.filter((synonym) => !normalizedSet.has(synonym)).slice(0, 3);
      if (unusedSynonyms.length === 0) {
        continue;
      }

      suggestions.push(`Try alternatives for "${base}" such as ${unusedSynonyms.join(', ')}.`);
      synonymHintCount += 1;
    }

    return Array.from(new Set(suggestions));
    
  }
  
  /**
   * Get empty analysis result
   */
  private getEmptyAnalysis(): VocabularyAnalysis {
    return {
      level: 'A1',
      score: 50,
      averageWordLength: 0,
      uniqueWords: 0,
      totalWords: 0,
      lexicalDiversity: 0,
      complexWords: 0,
      cefrDistribution: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0 },
      suggestions: ['Enter some text to analyze vocabulary level'],
    };
  }
}

// Singleton instance
export const vocabAnalyzer = new VocabularyAnalyzerService();

// Export types
export type { VocabularyAnalysis };
export default vocabAnalyzer;
