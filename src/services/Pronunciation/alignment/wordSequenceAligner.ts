export interface WordAlignmentPair {
  targetWord: string | null;
  actualWord: string | null;
  targetIndex: number | null;
  actualIndex: number | null;
  normalizedTarget: string | null;
  normalizedActual: string | null;
  confidence: number;
  operation: 'match' | 'substitution' | 'deletion' | 'insertion';
}

const FILLER_WORDS = new Set(['um', 'uh', 'erm', 'hmm', 'mmm']);

export const normalizeAlignmentWord = (word: string) =>
  word
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z]/g, '');

export const stemAlignmentWord = (word: string) => {
  const normalized = normalizeAlignmentWord(word);

  if (normalized.length <= 3) {
    return normalized;
  }

  if (normalized.endsWith('ies') && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (normalized.endsWith('ing') && normalized.length > 5) {
    return stripDoubledFinalConsonant(normalized.slice(0, -3));
  }

  if (normalized.endsWith('ed') && normalized.length > 4) {
    return stripDoubledFinalConsonant(normalized.slice(0, -2));
  }

  if (normalized.endsWith('es') && normalized.length > 4) {
    return normalized.slice(0, -2);
  }

  if (normalized.endsWith('s') && normalized.length > 4) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

export const tokenizeForAlignment = (text: string) =>
  text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => {
      const normalized = normalizeAlignmentWord(word);
      return normalized && !FILLER_WORDS.has(normalized);
    });

export function alignWordSequences(targetWords: string[], actualWords: string[]): WordAlignmentPair[] {
  const targets = targetWords.map((word, index) => ({
    original: word,
    normalized: normalizeAlignmentWord(word),
    stem: stemAlignmentWord(word),
    index,
  }));
  const actuals = actualWords.map((word, index) => ({
    original: word,
    normalized: normalizeAlignmentWord(word),
    stem: stemAlignmentWord(word),
    index,
  }));

  const rows = targets.length + 1;
  const cols = actuals.length + 1;
  const gapPenalty = -0.72;
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const trace = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): 'diag' | 'up' | 'left' | null => null)
  );

  for (let i = 1; i < rows; i += 1) {
    matrix[i][0] = matrix[i - 1][0] + gapPenalty;
    trace[i][0] = 'up';
  }

  for (let j = 1; j < cols; j += 1) {
    matrix[0][j] = matrix[0][j - 1] + gapPenalty;
    trace[0][j] = 'left';
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const similarity = wordSimilarity(targets[i - 1].normalized, actuals[j - 1].normalized);
      const diagonalScore = matrix[i - 1][j - 1] + substitutionScore(similarity);
      const deletionScore = matrix[i - 1][j] + gapPenalty;
      const insertionScore = matrix[i][j - 1] + gapPenalty;
      const best = Math.max(diagonalScore, deletionScore, insertionScore);

      matrix[i][j] = best;
      trace[i][j] = best === diagonalScore ? 'diag' : best === deletionScore ? 'up' : 'left';
    }
  }

  const pairs: WordAlignmentPair[] = [];
  let i = targets.length;
  let j = actuals.length;

  while (i > 0 || j > 0) {
    const direction = trace[i][j];

    if (direction === 'diag' && i > 0 && j > 0) {
      const target = targets[i - 1];
      const actual = actuals[j - 1];
      const confidence = wordSimilarity(target.normalized, actual.normalized);
      pairs.unshift({
        targetWord: target.original,
        actualWord: actual.original,
        targetIndex: target.index,
        actualIndex: actual.index,
        normalizedTarget: target.normalized,
        normalizedActual: actual.normalized,
        confidence,
        operation: confidence >= 0.82 ? 'match' : 'substitution',
      });
      i -= 1;
      j -= 1;
    } else if ((direction === 'up' && i > 0) || j === 0) {
      const target = targets[i - 1];
      pairs.unshift({
        targetWord: target.original,
        actualWord: null,
        targetIndex: target.index,
        actualIndex: null,
        normalizedTarget: target.normalized,
        normalizedActual: null,
        confidence: 0,
        operation: 'deletion',
      });
      i -= 1;
    } else {
      const actual = actuals[j - 1];
      pairs.unshift({
        targetWord: null,
        actualWord: actual.original,
        targetIndex: null,
        actualIndex: actual.index,
        normalizedTarget: null,
        normalizedActual: actual.normalized,
        confidence: 0,
        operation: 'insertion',
      });
      j -= 1;
    }
  }

  return pairs;
}

export function calculateWordAlignmentConfidence(pairs: WordAlignmentPair[]) {
  const targetPairs = pairs.filter((pair) => pair.targetWord !== null);
  if (!targetPairs.length) {
    return 0;
  }

  const confidence = targetPairs.reduce((sum, pair) => sum + pair.confidence, 0) / targetPairs.length;
  return Number(confidence.toFixed(2));
}

function substitutionScore(similarity: number) {
  if (similarity >= 0.95) {
    return 1.28;
  }
  if (similarity >= 0.82) {
    return 1.02;
  }
  if (similarity >= 0.62) {
    return 0.24;
  }
  return -1.08;
}

function wordSimilarity(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftStem = stemAlignmentWord(left);
  const rightStem = stemAlignmentWord(right);
  if (leftStem && leftStem === rightStem) {
    return 0.82;
  }

  const charSimilarity = 1 - (levenshteinDistance(leftStem || left, rightStem || right) / Math.max(leftStem.length, rightStem.length, 1));
  const prefixBonus = leftStem[0] === rightStem[0] ? 0.03 : 0;
  const soundexBonus = soundex(leftStem) === soundex(rightStem) ? 0.04 : 0;

  return Number(Math.max(0, Math.min(0.99, charSimilarity + prefixBonus + soundexBonus)).toFixed(2));
}

function levenshteinDistance(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, () => Array.from({ length: right.length + 1 }, () => 0));

  for (let i = 0; i <= left.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[left.length][right.length];
}

function stripDoubledFinalConsonant(word: string) {
  if (word.length < 3) {
    return word;
  }
  const last = word[word.length - 1];
  const previous = word[word.length - 2];
  return last === previous && !'aeiou'.includes(last) ? word.slice(0, -1) : word;
}

function soundex(word: string) {
  const normalized = normalizeAlignmentWord(word);
  if (!normalized) {
    return '';
  }

  const codes: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  };
  const first = normalized[0].toUpperCase();
  let previous = codes[normalized[0]] || '';
  let tail = '';

  for (const char of normalized.slice(1)) {
    const code = codes[char] || '';
    if (code && code !== previous) {
      tail += code;
    }
    previous = code;
  }

  return `${first}${tail.padEnd(3, '0')}`.slice(0, 4);
}
