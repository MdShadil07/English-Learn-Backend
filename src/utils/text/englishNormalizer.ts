const ASCII_WORD_PATTERN = /[a-z]+/g;
const ING_DOUBLE_CONSONANT_PATTERN = /(.)\1ing$/;
const DOUBLE_CONSONANT_ED_PATTERN = /(.)\1ed$/;
const ES_PLURAL_ENDINGS = ['ches', 'shes', 'xes', 'zes', 'ges', 'ses'] as const;

const SMART_SINGLE_QUOTES = /[’‘]/g;
const SMART_DOUBLE_QUOTES = /[“”]/g;

const CONTRACTION_SUFFIX_MAP: Record<string, string[]> = {
  "'re": ['are'],
  "'ve": ['have'],
  "'ll": ['will'],
  "'d": ['would', 'had'],
  "'m": ['am'],
  "'s": ['is', 'has'],
  "n't": ['not'],
};

export const normalizeTypographicQuotes = (text: string): string => {
  if (!text) {
    return '';
  }
  return text.replace(SMART_SINGLE_QUOTES, "'").replace(SMART_DOUBLE_QUOTES, '"');
};

export const tokenizeAsciiWords = (text: string): string[] => {
  if (!text) {
    return [];
  }

  const normalized = normalizeTypographicQuotes(text).toLowerCase().replace(/-/g, ' ');
  const matches = normalized.match(ASCII_WORD_PATTERN);
  if (!matches) {
    return [];
  }

  return matches.filter((word) => word.length > 0);
};

const pushCandidate = (candidates: string[], seen: Set<string>, value: string): void => {
  const cleaned = value.replace(/[^a-z]/g, '');
  if (!cleaned) {
    return;
  }

  if (!seen.has(cleaned)) {
    seen.add(cleaned);
    candidates.push(cleaned);
  }
};

export const normalizeEnglishToken = (word: string, dictionary?: Set<string>): string => {
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

  const candidates: string[] = [];
  const seen = new Set<string>();

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
    } else if (withoutIng.endsWith('ie')) {
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

  if (
    base.length > 3 &&
    base.endsWith('s') &&
    !base.endsWith('ss') &&
    !base.endsWith('us') &&
    !base.endsWith('is')
  ) {
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
