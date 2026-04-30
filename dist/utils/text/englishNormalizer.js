const ASCII_WORD_PATTERN = /[a-z]+/g;
const ING_DOUBLE_CONSONANT_PATTERN = /(.)\1ing$/;
const DOUBLE_CONSONANT_ED_PATTERN = /(.)\1ed$/;
const ES_PLURAL_ENDINGS = ['ches', 'shes', 'xes', 'zes', 'ges', 'ses'];
const SMART_SINGLE_QUOTES = /[’‘]/g;
const SMART_DOUBLE_QUOTES = /[“”]/g;
const CONTRACTION_SUFFIX_MAP = {
    "'re": ['are'],
    "'ve": ['have'],
    "'ll": ['will'],
    "'d": ['would', 'had'],
    "'m": ['am'],
    "'s": ['is', 'has'],
    "n't": ['not'],
};
const CONTRACTION_MAP = {
    "i'm": "i am",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'll": "i will",
    "you'll": "you will",
    "he'll": "he will",
    "she'll": "she will",
    "it'll": "it will",
    "we'll": "we will",
    "they'll": "they will",
    "i'd": "i would",
    "you'd": "you would",
    "he'd": "he would",
    "she'd": "she would",
    "it'd": "it would",
    "we'd": "we would",
    "they'd": "they would",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "won't": "will not",
    "wouldn't": "would not",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "can't": "cannot",
    "couldn't": "could not",
    "shouldn't": "should not",
    "mightn't": "might not",
    "mustn't": "must not",
    "let's": "let us",
    "that's": "that is",
    "who's": "who is",
    "what's": "what is",
    "where's": "where is",
    "when's": "when is",
    "why's": "why is",
    "how's": "how is",
};
export const expandContractions = (text) => {
    if (!text) {
        return '';
    }
    let expanded = text.toLowerCase();
    for (const [contraction, expansion] of Object.entries(CONTRACTION_MAP)) {
        const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
        expanded = expanded.replace(regex, expansion);
    }
    return expanded;
};
export const normalizeTypographicQuotes = (text) => {
    if (!text) {
        return '';
    }
    return text.replace(SMART_SINGLE_QUOTES, "'").replace(SMART_DOUBLE_QUOTES, '"');
};
export const tokenizeAsciiWords = (text) => {
    if (!text) {
        return [];
    }
    // Expand contractions before tokenization to handle didn't -> did not, I'm -> I am, etc.
    const expanded = expandContractions(text);
    const normalized = normalizeTypographicQuotes(expanded).toLowerCase().replace(/-/g, ' ');
    const matches = normalized.match(ASCII_WORD_PATTERN);
    if (!matches) {
        return [];
    }
    return matches.filter((word) => word.length > 0);
};
const pushCandidate = (candidates, seen, value) => {
    const cleaned = value.replace(/[^a-z]/g, '');
    if (!cleaned) {
        return;
    }
    if (!seen.has(cleaned)) {
        seen.add(cleaned);
        candidates.push(cleaned);
    }
};
export const normalizeEnglishToken = (word, dictionary) => {
    if (!word) {
        return '';
    }
    let normalized = word.toLowerCase();
    normalized = normalizeTypographicQuotes(normalized);
    normalized = normalized.replace(/[^a-z']/g, '');
    if (!normalized) {
        return '';
    }
    if (normalized.endsWith("'s")) {
        normalized = normalized.slice(0, -2);
    }
    if (normalized.startsWith("'")) {
        normalized = normalized.slice(1);
    }
    const base = normalized.replace(/'/g, '');
    if (!base) {
        return '';
    }
    const candidates = [];
    const seen = new Set();
    pushCandidate(candidates, seen, base);
    const apostropheIndex = normalized.indexOf("'");
    if (apostropheIndex > 0) {
        const root = normalized.slice(0, apostropheIndex);
        if (root.length > 1) {
            pushCandidate(candidates, seen, root);
        }
        const suffix = normalized.slice(apostropheIndex);
        const replacements = CONTRACTION_SUFFIX_MAP[suffix];
        if (replacements) {
            replacements.forEach((replacement) => pushCandidate(candidates, seen, replacement));
        }
        if (suffix === "'s" && root.length > 0) {
            pushCandidate(candidates, seen, `${root}s`);
        }
    }
    if (base.length > 4 && base.endsWith('ies')) {
        pushCandidate(candidates, seen, `${base.slice(0, -3)}y`);
    }
    if (base.length > 4 && base.endsWith('ves')) {
        pushCandidate(candidates, seen, `${base.slice(0, -3)}f`);
        pushCandidate(candidates, seen, `${base.slice(0, -3)}fe`);
    }
    if (base.length > 5 && base.endsWith('men')) {
        pushCandidate(candidates, seen, `${base.slice(0, -3)}man`);
    }
    if (base.length > 5 && base.endsWith('ing')) {
        const withoutIng = base.slice(0, -3);
        pushCandidate(candidates, seen, withoutIng);
        if (ING_DOUBLE_CONSONANT_PATTERN.test(base)) {
            pushCandidate(candidates, seen, withoutIng.slice(0, -1));
        }
        else if (withoutIng.endsWith('ie')) {
            pushCandidate(candidates, seen, `${withoutIng.slice(0, -2)}y`);
        }
    }
    if (base.length > 5 && base.endsWith('ied')) {
        pushCandidate(candidates, seen, `${base.slice(0, -3)}y`);
    }
    if (base.length > 4 && DOUBLE_CONSONANT_ED_PATTERN.test(base)) {
        pushCandidate(candidates, seen, base.slice(0, -3));
    }
    if (base.length > 4 && ES_PLURAL_ENDINGS.some((ending) => base.endsWith(ending))) {
        pushCandidate(candidates, seen, base.slice(0, -2));
    }
    if (base.length > 3 &&
        base.endsWith('s') &&
        !base.endsWith('ss') &&
        !base.endsWith('us') &&
        !base.endsWith('is')) {
        pushCandidate(candidates, seen, base.slice(0, -1));
    }
    if (dictionary) {
        for (const candidate of candidates) {
            if (dictionary.has(candidate)) {
                return candidate;
            }
        }
    }
    return candidates[0] ?? '';
};
//# sourceMappingURL=englishNormalizer.js.map