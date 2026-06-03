import { PhonemeTimelineEvent, PhonemeLevelPronunciationAnalysis } from '../alignment/types.js';

export type RegionalPattern = {
  name: string; // e.g. 'dentalization', 'vowel_insertion'
  description: string;
  evidenceCount?: number;
  weight?: number;
};

export type PhonologicalProfileResult = {
  patternScores: Record<string, number>; // normalized pattern strengths
  dominantPatterns: string[]; // top pattern keys
  confidence: number; // 0..1
  patterns: RegionalPattern[];
  suggestions: string[];
};

// Phonological profile extractor: returns neutral pattern labels rather than
// mapping to states or regions. This reduces mislabel risk and improves
// user trust by focusing on actionable patterns and suggestions.
export function analyzePhonologicalProfile(
  phonemeAnalysis: PhonemeLevelPronunciationAnalysis[],
  phonemeTimeline: PhonemeTimelineEvent[],
  options?: { asrConfidence?: number }
): PhonologicalProfileResult {
  const subs = phonemeAnalysis.filter((p) => p.issueType === 'substitution' || p.taxonomy === 'substitution');
  const omissions = phonemeAnalysis.filter((p) => p.issueType === 'deletion' || p.taxonomy === 'omission');

  const pairCount: Record<string, number> = {};
  subs.forEach((s) => {
    const key = `${s.expected || ''}->${s.actual || ''}`;
    pairCount[key] = (pairCount[key] || 0) + 1;
  });

  const patternSignal: Record<string, number> = {
    dentalization: 0, // TH → T/D or dental fricative -> stop
    vw_confusion: 0, // V↔W
    f_to_p: 0, // F→P
    l_r_confusion: 0, // L↔R
    sibilant_shift: 0, // SH↔S
    p_b_voicing: 0, // P↔B
    vowel_insertion: 0, // vowel insertion in clusters
    final_consonant_drop: 0,
    vowel_lengthening: 0,
    aspiration_variation: 0,
  };

  const suggestions: string[] = [];
  const patterns: RegionalPattern[] = [];

  const applyPair = (expected: string, actuals: string[], weight: number, patternKey: string, patternName: string, suggestion?: string) => {
    actuals.forEach((a) => {
      const k = `${expected}->${a}`;
      const count = pairCount[k] || 0;
      if (count > 0) {
        patternSignal[patternKey] = (patternSignal[patternKey] || 0) + count * weight;
        patterns.push({ name: patternName, description: `${expected} → ${a} (${count}×)`, evidenceCount: count, weight });
        if (suggestion) suggestions.push(suggestion);
      }
    });
  };

  applyPair('TH', ['T', 'D'], 1.4, 'dentalization', 'Dentalization (TH→T/D)', 'Try placing the tongue lightly between the teeth for TH to produce the fricative.');
  applyPair('V', ['W'], 1.0, 'vw_confusion', 'V/W confusion', 'Focus on upper teeth touching the lower lip to make V distinct.');
  applyPair('W', ['V'], 1.0, 'vw_confusion', 'W/V confusion', 'Practice labial rounding for W vs lip+teeth contact for V.');
  applyPair('F', ['P'], 1.2, 'f_to_p', 'F→P substitution', 'Practice using top teeth on bottom lip to produce F.');
  applyPair('L', ['R'], 0.9, 'l_r_confusion', 'L→R substitution', 'Practice lifting the tongue tip to touch the alveolar ridge for L.');
  applyPair('R', ['L'], 0.9, 'l_r_confusion', 'R→L substitution', 'For R, use a quick central tongue movement.');
  applyPair('SH', ['S'], 1.0, 'sibilant_shift', 'SH→S shift', 'Practice the SH sibilant channel vs S.');
  applyPair('S', ['SH'], 1.0, 'sibilant_shift', 'S→SH shift', 'Slightly flatten the tongue for SH.');
  applyPair('P', ['B'], 0.8, 'p_b_voicing', 'P→B voicing', 'Focus on voiceless burst for P vs voiced vibration for B.');
  applyPair('B', ['P'], 0.8, 'p_b_voicing', 'B→P voicing', 'Ensure vocal fold vibration for B.');

  const vowelInsertions = phonemeTimeline.filter((e) => e.issueType === 'insertion' && /[AEIOU]/i.test(e.actual || '')).length;
  if (vowelInsertions >= 2) {
    patternSignal.vowel_insertion += vowelInsertions * 0.7;
    patterns.push({ name: 'VowelInsertion', description: `Detected ${vowelInsertions} vowel insertions in clusters`, evidenceCount: vowelInsertions, weight: 0.7 });
    suggestions.push('Avoid inserting short vowels inside consonant clusters; slow practice of clusters helps.');
  }

  const vowelLengthening = Object.entries(pairCount).reduce((sum, [k, v]) => {
    if (/IH->IY|UH->UW|AH->AA|EH->EY/.test(k)) return sum + v;
    return sum;
  }, 0);
  if (vowelLengthening >= 2) {
    patternSignal.vowel_lengthening += vowelLengthening * 0.6;
    patterns.push({ name: 'VowelLengthening', description: `Short→long vowel substitutions ${vowelLengthening}×`, evidenceCount: vowelLengthening, weight: 0.6 });
    suggestions.push('Practice vowel duration contrasts, holding short vs long vowels distinctly.');
  }

  const finalConsonantDrops = omissions.filter((e) => e.expected && !/[AEIOU]/.test(e.expected)).length;
  if (finalConsonantDrops >= 1) {
    patternSignal.final_consonant_drop += finalConsonantDrops * 0.4;
    patterns.push({ name: 'FinalConsonantDropping', description: `Final consonant drop count ${finalConsonantDrops}`, evidenceCount: finalConsonantDrops, weight: 0.4 });
    suggestions.push('Work on releasing final consonants; hold the final consonant sound in slow repetition drills.');
  }

  // Aspiration and other small signals
  const aspirationSubs = Object.entries(pairCount).reduce((s, [k, v]) => (/P->PH|T->TH|K->KH/.test(k) ? s + v : s), 0);
  if (aspirationSubs >= 1) {
    patternSignal.aspiration_variation += aspirationSubs * 0.3;
    patterns.push({ name: 'AspirationVariation', description: `Aspiration changes ${aspirationSubs}×`, evidenceCount: aspirationSubs, weight: 0.3 });
    suggestions.push('Practice aspiration contrasts: short vs aspirated stop bursts.');
  }

  // Normalize pattern scores
  const totalSignal = Object.values(patternSignal).reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const patternScores: Record<string, number> = {};
  Object.keys(patternSignal).forEach((k) => {
    patternScores[k] = Number((patternSignal[k] / totalSignal).toFixed(2));
  });

  // dominant patterns: top 3
  const sorted = Object.entries(patternScores).sort((a, b) => b[1] - a[1]);
  const dominantPatterns = sorted.slice(0, 3).filter(([, v]) => v > 0.08).map(([k]) => k);

  const patternStrength = Math.min(1, totalSignal / 6);
  const asrFactor = options?.asrConfidence ?? 0.9;
  const confidence = Number((patternStrength * 0.7 + asrFactor * 0.3).toFixed(2));

  const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 6);

  return {
    patternScores,
    dominantPatterns,
    confidence,
    patterns,
    suggestions: uniqueSuggestions,
  };
}

export default analyzePhonologicalProfile;
