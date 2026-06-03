/**
 * 📚 VOCABULARY ANALYZER SERVICE (FREE)
 * Analyzes vocabulary level using CEFR wordlist and word frequency
 * Zero-cost vocabulary sophistication analysis
 */
import { logger } from '../../utils/calculators/core/logger.js';
import { normalizeEnglishToken, tokenizeAsciiWords } from '../../utils/text/englishNormalizer.js';
import { semanticVocabCalibrator } from './vocab/semanticCalibrator.js';
import spellingChecker from './spellingChecker.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Load pre-built CEFR dataset for O(1) lookup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATASET_PATH = join(__dirname, '../../../data/cefr-final.json');
let cefrDataset = null;
function loadCEFRDataset() {
    try {
        if (existsSync(DATASET_PATH)) {
            const data = readFileSync(DATASET_PATH, 'utf-8');
            const parsed = JSON.parse(data);
            cefrDataset = new Map(Object.entries(parsed));
            logger.info(`✅ Loaded ${cefrDataset.size} words from CEFR dataset`);
        }
        else {
            logger.warn(`⚠️ CEFR dataset not found at ${DATASET_PATH}, using fallback wordlists`);
        }
    }
    catch (error) {
        logger.warn({ error }, '⚠️ Failed to load CEFR dataset, using fallback wordlists');
    }
}
// Load dataset on module initialization
loadCEFRDataset();
// Optional: use wink-lemmatizer when available to normalize words before CEFR lookup
let lemmatizeWord = null;
try {
    // @ts-ignore
    const maybe = (typeof require === 'function') ? require('wink-lemmatizer') : null;
    if (maybe && typeof maybe.verb === 'function') {
        lemmatizeWord = (w) => {
            const lower = w.toLowerCase();
            const v = maybe.verb(lower);
            if (v !== lower)
                return v;
            const n = maybe.noun(lower);
            if (n !== lower)
                return n;
            return maybe.adjective(lower);
        };
    }
}
catch (e) {
    // ignore
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
const ADVANCED_VOCABULARY = {
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
    const list = CEFR_WORDLISTS[level];
    if (!list || !words) {
        return;
    }
    words.forEach((word) => list.add(word));
});
// Hotfix: include a small set of common tokens that are often missed by static lists
// These reduce false 'unknown' penalties for short/simple inputs (user-reported cases)
const COMMON_FIXES = {
    A1: [],
    A2: ['weary', 'pause', 'paused', 'continue', 'continued'],
    B1: ['explanation'],
    B2: [],
    C1: [],
    C2: [],
};
Object.entries(COMMON_FIXES).forEach(([level, words]) => {
    const list = CEFR_WORDLISTS[level];
    if (!list)
        return;
    words.forEach((w) => list.add(w));
});
const CEFR_ACADEMIC_ENRICHMENTS = [
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
const ACADEMIC_SUFFIX_HINTS = [
    { pattern: /(tion|sion|ment|ance|ence|ancy|ency|ative|atory|ality|ship)$/i, level: 'B2' },
    { pattern: /(ability|ibility|ization|isation|logy|metric|phobic|philia|phile)$/i, level: 'C1' },
    { pattern: /(esque|eity|iality|icacy|iferous|itudinal|ological)$/i, level: 'C2' },
];
const ACADEMIC_PREFIX_HINTS = [
    { pattern: /^(inter|trans|multi|macro|micro|infra|ultra|meta)/i, level: 'B2' },
    { pattern: /^(counter|hyper|hetero|homo|para|proto|retro)/i, level: 'C1' },
    { pattern: /^(pan|apo|pseudo|tele|xeno)/i, level: 'C2' },
];
const CEFR_SYNONYM_GROUPS = [
    { base: 'good', level: 'A1', synonyms: ['excellent', 'outstanding', 'superb', 'exceptional', 'marvelous'] },
    { base: 'bad', level: 'A1', synonyms: ['terrible', 'awful', 'dreadful', 'appalling', 'atrocious'] },
    { base: 'happy', level: 'A1', synonyms: ['delighted', 'thrilled', 'ecstatic', 'elated', 'joyful'] },
    { base: 'sad', level: 'A1', synonyms: ['miserable', 'depressed', 'devastated', 'heartbroken', 'sorrowful'] },
    { base: 'big', level: 'A1', synonyms: ['enormous', 'massive', 'gigantic', 'colossal', 'substantial'] },
    { base: 'small', level: 'A1', synonyms: ['tiny', 'minuscule', 'compact', 'insignificant', 'microscopic'] },
    { base: 'very', level: 'A1', synonyms: ['extremely', 'exceptionally', 'exceedingly', 'remarkably', 'profoundly'] },
    { base: 'important', level: 'A1', synonyms: ['crucial', 'vital', 'essential', 'significant', 'paramount'] },
    { base: 'interesting', level: 'A1', synonyms: ['fascinating', 'captivating', 'intriguing', 'compelling', 'engaging'] },
    { base: 'say', level: 'A1', synonyms: ['state', 'declare', 'express', 'articulate', 'mention'] },
    { base: 'think', level: 'A1', synonyms: ['believe', 'consider', 'reckon', 'assume', 'presume'] },
    { base: 'look', level: 'A1', synonyms: ['observe', 'examine', 'inspect', 'glance', 'stare'] },
    { base: 'show', level: 'A1', synonyms: ['demonstrate', 'illustrate', 'display', 'reveal', 'exhibit'] },
    { base: 'use', level: 'A1', synonyms: ['utilize', 'employ', 'apply', 'implement', 'adopt'] },
    { base: 'help', level: 'A1', synonyms: ['assist', 'support', 'aid', 'facilitate', 'collaborate'] },
];
const CEFR_SYNONYM_LOOKUP = {};
CEFR_SYNONYM_GROUPS.forEach(({ base, level, synonyms }) => {
    const targetSet = CEFR_WORDLISTS[level];
    targetSet.add(base);
    synonyms.forEach((synonym) => targetSet.add(synonym));
    CEFR_SYNONYM_LOOKUP[base] = synonyms;
});
export const CEFR_COMBINED_WORDSET = (() => {
    const combined = new Set();
    Object.values(CEFR_WORDLISTS).forEach((wordSet) => {
        wordSet.forEach((word) => combined.add(word));
    });
    return combined;
})();
export const ACADEMIC_WORDS = new Set([
    'analyze', 'approach', 'area', 'assess', 'assume', 'authority', 'available',
    'benefit', 'concept', 'consistent', 'constitutional', 'context', 'contract',
    'create', 'data', 'define', 'derive', 'distribute', 'economy', 'environment',
    'establish', 'estimate', 'evidence', 'export', 'factors', 'finance', 'formula',
    'function', 'identify', 'income', 'indicate', 'individual', 'interpret', 'involve',
    'issue', 'labor', 'legal', 'legislate', 'major', 'method', 'occur', 'percent',
    'period', 'policy', 'principle', 'proceed', 'process', 'require', 'research',
    'respond', 'role', 'section', 'sector', 'significant', 'similar', 'source',
    'specific', 'structure', 'theory', 'vary', 'achieve', 'acquire', 'administrate',
    'affect', 'appropriate', 'aspect', 'assist', 'category', 'chapter', 'commission',
    'community', 'complex', 'compute', 'conclude', 'conduct', 'consequent', 'construct',
    'consume', 'credit', 'cultural', 'design', 'distinct', 'element', 'equation',
    'evaluate', 'feature', 'final', 'focus', 'impact', 'injure', 'institute',
    'invest', 'item', 'journal', 'maintain', 'normal', 'obtain', 'participate',
    'perceive', 'positive', 'potential', 'previous', 'primary', 'purchase', 'range',
    'region', 'regulate', 'relevant', 'reside', 'resource', 'restrict', 'secure',
    'seek', 'select', 'site', 'strategy', 'survey', 'text', 'tradition', 'transfer'
]);
class VocabularyAnalyzerService {
    /**
     * Determine CEFR level of a word
     */
    getWordLevel(word) {
        if (!word) {
            return 'unknown';
        }
        const candidateRoots = new Set();
        const pushCandidate = (token) => {
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
        const lemmaCandidates = new Set();
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
    lookupWordLevel(word) {
        if (!word) {
            return 'unknown';
        }
        // First check pre-built dataset for O(1) lookup
        if (cefrDataset && cefrDataset.size > 0) {
            const normalized = word.toLowerCase().replace(/[^a-z-]/g, '');
            const level = cefrDataset.get(normalized);
            if (level && CEFR_WORDLISTS[level]) {
                return level;
            }
        }
        if (CEFR_WORDLISTS.A1.has(word))
            return 'A1';
        if (CEFR_WORDLISTS.A2.has(word))
            return 'A2';
        if (CEFR_WORDLISTS.B1.has(word))
            return 'B1';
        if (CEFR_WORDLISTS.B2.has(word))
            return 'B2';
        if (CEFR_WORDLISTS.C1.has(word))
            return 'C1';
        if (CEFR_WORDLISTS.C2.has(word))
            return 'C2';
        return 'unknown';
    }
    generateLemmaCandidates(word) {
        if (!word || word.length <= 3) {
            return [];
        }
        const candidates = new Set();
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
    inferLevelFromMorphology(word) {
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
    calculateLexicalDiversity(words) {
        if (words.length === 0)
            return 0;
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        return uniqueWords.size / words.length;
    }
    /**
     * Determine overall CEFR level from distribution
     */
    determineOverallLevel(distribution) {
        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        if (total === 0)
            return 'A1';
        // Calculate weighted average
        const weights = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, unknown: 2 };
        let weightedSum = 0;
        Object.entries(distribution).forEach(([level, count]) => {
            const weight = weights[level] || 2;
            weightedSum += weight * count;
        });
        const avgWeight = weightedSum / total;
        if (avgWeight < 1.5)
            return 'A1';
        if (avgWeight < 2.5)
            return 'A2';
        if (avgWeight < 3.5)
            return 'B1';
        if (avgWeight < 4.5)
            return 'B2';
        if (avgWeight < 5.5)
            return 'C1';
        return 'C2';
    }
    /**
     * Analyze vocabulary level and sophistication
     */
    async analyze(text) {
        try {
            // Attempt dynamic import of wink-lemmatizer if not already available
            if (!lemmatizeWord) {
                try {
                    const mod = await import('wink-lemmatizer');
                    if (mod && typeof mod.verb === 'function') {
                        lemmatizeWord = (w) => {
                            const lower = w.toLowerCase();
                            const v = mod.verb(lower);
                            if (v !== lower)
                                return v;
                            const n = mod.noun(lower);
                            if (n !== lower)
                                return n;
                            return mod.adjective(lower);
                        };
                    }
                }
                catch (e) {
                    // not installed — continue with heuristic lemmatization
                    logger.debug('wink-lemmatizer not available, using heuristic lemmatization');
                }
            }
            // Extract words
            const rawWords = tokenizeAsciiWords(text);
            const normalizedWords = rawWords
                .map((word) => normalizeEnglishToken(word, CEFR_COMBINED_WORDSET))
                .filter((word) => word.length >= 2);
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
            const wordLevels = [];
            let misspelledCount = 0;
            for (const word of normalizedWords) {
                let level = 'unknown';
                let misspelled = false;
                try {
                    // If Typo.js is available, consult it. If not available, assume correctness
                    const checkerAvailable = spellingChecker.isAvailable ? spellingChecker.isAvailable() : true;
                    const isCorrect = checkerAvailable ? spellingChecker.check(word) : true;
                    if (!isCorrect) {
                        misspelled = true;
                        misspelledCount += 1;
                        // Try to recover via suggestion for vocabulary lookup
                        const suggestions = spellingChecker.suggest(word) || [];
                        if (suggestions.length > 0) {
                            const candidate = (lemmatizeWord ? lemmatizeWord(suggestions[0]) : suggestions[0]).toLowerCase();
                            level = this.getWordLevel(candidate);
                            // Count the suggested word's level, not as unknown
                            distribution[level]++;
                        }
                        else {
                            // If no suggestion available, skip counting this word for vocabulary
                            // It's a spelling error, not a vocabulary weakness
                            wordLevels.push({ word, level: 'unknown', misspelled });
                            continue;
                        }
                    }
                    else {
                        const candidate = lemmatizeWord ? lemmatizeWord(word) : word;
                        level = this.getWordLevel(candidate.toLowerCase());
                        distribution[level]++;
                    }
                }
                catch (err) {
                    // If spelling check fails unexpectedly, fall back to lookup
                    level = this.getWordLevel(word);
                    distribution[level]++;
                }
                wordLevels.push({ word, level, misspelled });
            }
            let semanticPromotions = [];
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
                ? rawWords.reduce((sum, token) => sum + token.length, 0) / totalWords
                : 0;
            const lexicalDiversity = this.calculateLexicalDiversity(normalizedWords);
            const complexWords = distribution.B2 + distribution.C1 + distribution.C2;
            let academicWordCount = 0;
            normalizedWords.forEach((w) => {
                if (ACADEMIC_WORDS.has(w.toLowerCase())) {
                    academicWordCount++;
                }
            });
            const academicWordUsage = totalWords > 0 ? (academicWordCount / totalWords) * 100 : 0;
            const rareWordUsage = totalWords > 0 ? ((distribution.C1 + distribution.C2) / totalWords) * 100 : 0;
            const overallLevel = this.determineOverallLevel(distribution);
            // Calculate score (0-100)
            // Re-calibrated for conversational English: Simple but correct vocabulary should yield a passing score.
            const levelScores = { A1: 65, A2: 75, B1: 85, B2: 92, C1: 96, C2: 100 };
            let baseScore = levelScores[overallLevel] || 65;
            const unknownRatio = distribution.unknown / normalizedWords.length;
            const advancedCount = distribution.B2 + distribution.C1 + distribution.C2;
            const advancedRatio = advancedCount / normalizedWords.length;
            const longWordCount = wordLevels.filter(({ word }) => word.length >= 8).length;
            let longWordRatio = longWordCount / normalizedWords.length;
            // Only apply the fallback CEFR 'boost' for longer texts — disable for short inputs
            if (unknownRatio > 0.6 && totalWords > 25) {
                const inferredAcademicDensity = wordLevels.filter(({ word, level }) => {
                    if (level !== 'unknown') {
                        return false;
                    }
                    return /(?:tion|sion|ment|ance|ence|ancy|ency|ive|ous|ing|ed)$/i.test(word) || word.length >= 9;
                }).length / Math.max(1, distribution.unknown);
                const fallbackScore = 65 +
                    Math.min(0.45, advancedRatio) * 60 +
                    Math.min(0.4, longWordRatio) * 30 +
                    inferredAcademicDensity * 20;
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
            }
            else {
                // Strict cap as requested
                if (diversityBonus > 6)
                    diversityBonus = 6;
            }
            // Allow up to 15% unknown words (names, slang, etc) without penalty
            const penaltyAllowance = 0.15;
            const effectiveUnknown = Math.max(0, adjustedUnknownCount - safeTokenCount * penaltyAllowance);
            const unknownPenalty = effectiveUnknown / safeTokenCount;
            // Reduced penalty severity
            let penaltyPoints = unknownPenalty * 30;
            // Cap unknown-word penalty to avoid exceeding -20 points
            if (penaltyPoints > 20)
                penaltyPoints = 20;
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
                // Debug: Show which words are classified at each level
                console.log(`  🔍 Word-level classification:`);
                const wordsByLevel = { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [], unknown: [] };
                wordLevels.forEach(({ word, level }) => {
                    wordsByLevel[level].push(word);
                });
                Object.entries(wordsByLevel).forEach(([level, words]) => {
                    if (words.length > 0) {
                        console.log(`     ${level}: ${words.join(', ')}`);
                    }
                });
                console.log(`  🎯 Scoring Breakdown:`);
                console.log(`     Overall level: ${overallLevel}`);
                console.log(`     Base score: ${levelScores[overallLevel]}`);
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
            logger.debug({
                level: overallLevel,
                score,
                totalWords,
                semanticPromotions: semanticPromotions.slice(0, 10).map(({ word, level, similarity }) => ({ word, level, similarity })),
            }, 'Vocabulary analysis complete');
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
                academicWordUsage: Math.round(academicWordUsage * 100) / 100,
                rareWordUsage: Math.round(rareWordUsage * 100) / 100,
            };
        }
        catch (error) {
            logger.error({ error }, 'Error analyzing vocabulary');
            return this.getEmptyAnalysis();
        }
    }
    /**
     * Generate improvement suggestions
     */
    generateSuggestions(distribution, diversity, level, normalizedWords) {
        const suggestions = [];
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
        let synonymHintCount = 0;
        for (const [base, synonyms] of Object.entries(CEFR_SYNONYM_LOOKUP)) {
            if (synonymHintCount >= 3)
                break; // Suggest up to 3 synonyms
            const baseUsed = normalizedSet.has(base);
            if (!baseUsed)
                continue;
            const unusedSynonyms = synonyms.filter((synonym) => !normalizedSet.has(synonym)).slice(0, 3);
            if (unusedSynonyms.length === 0)
                continue;
            suggestions.push(`Instead of "${base}", consider using advanced alternatives like: ${unusedSynonyms.join(', ')}.`);
            synonymHintCount += 1;
        }
        if (diversity > 0.7) {
            suggestions.push('Excellent vocabulary diversity! You use a wide range of unique words.');
        }
        else if (diversity < 0.4) {
            suggestions.push('Try using more varied vocabulary. Repeating the same words lowers your score.');
        }
        const academicPercentage = (distribution.B2 + distribution.C1 + distribution.C2) / Math.max(1, total) * 100;
        if (academicPercentage > 15) {
            suggestions.push('Great use of advanced academic words (B2-C2 levels). This shows strong proficiency.');
        }
        else if (academicPercentage < 5 && level !== 'A1') {
            suggestions.push('Try incorporating more advanced academic vocabulary to elevate your writing.');
        }
        return Array.from(new Set(suggestions));
    }
    /**
     * Get empty analysis result
     */
    getEmptyAnalysis() {
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
export default vocabAnalyzer;
//# sourceMappingURL=vocabAnalyzer.js.map