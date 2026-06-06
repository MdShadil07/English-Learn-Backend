import type { PhonemeTimelineEvent, PhonemeLevelPronunciationAnalysis } from '../alignment/types.js';
import type { WordLevelPronunciationAnalysis } from '../scoring/../alignment/types.js';
import { logger } from '../../../utils/calculators/core/logger.js';
import visuals from './visuals.js';

export type Phenomenon = {
  id: string;
  name: string;
  description: string;
  affectedSounds: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  practiceDrills: Array<{ type: string; instruction: string }>;
  visualKey?: string;
};

export type PhenomenonResult = {
  id: string;
  name: string;
  confidence: number; // 0..1
  evidence: string[]; // human readable evidence items
  affectedSounds: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  drills: Array<{ type: string; instruction: string }>;
  visual?: { key: string; svg?: string; instruction: string };
  affectedWords?: string[];
};

function sumPairCounts(subs: Record<string, number>, patterns: string[]) {
  return patterns.reduce((s, p) => s + (subs[p] || 0), 0);
}

function getWords(items: any[], limit = 3) {
  const words = [...new Set(items.map(i => i.word).filter(Boolean))];
  if (words.length === 0) return '';
  if (words.length <= limit) return ` in "${words.join('", "')}"`;
  return ` in "${words.slice(0, limit).join('", "')}" and others`;
}

// Detects phonological phenomena from phoneme-level analysis and phoneme timeline.
export function detectPhenomena(
  phonemeAnalysis: PhonemeLevelPronunciationAnalysis[],
  phonemeTimeline: PhonemeTimelineEvent[],
  wordAnalysis: any[],
  options?: { asrConfidence?: number }
): PhenomenonResult[] {
  const subs = phonemeAnalysis.filter((p) => p.issueType === 'substitution' || p.taxonomy === 'substitution');
  const omissions = phonemeAnalysis.filter((p) => p.issueType === 'deletion' || p.taxonomy === 'omission');
  const insertions = phonemeAnalysis.filter((p) => p.issueType === 'insertion' || p.taxonomy === 'insertion');

  const pairCount: Record<string, number> = {};
  subs.forEach((s) => {
    const k = `${s.expected || ''}->${s.actual || ''}`;
    pairCount[k] = (pairCount[k] || 0) + 1;
  });

  const results: PhenomenonResult[] = [];

  // 1) Schwa insertion (schwa often shows as AH/AX or a short vowel insertion inside clusters)
  const schwaInsertions = phonemeTimeline.filter((e) => (e.actual === 'AH' || e.actual === 'AX' || e.actual === 'AH0') && e.issueType === 'insertion').length;
  if (schwaInsertions >= 1) {
    results.push({
      id: 'schwa_insertion',
      name: 'Schwa insertion',
      confidence: Math.min(0.95, 0.25 * schwaInsertions + (options?.asrConfidence || 0) * 0.1),
      evidence: [`Detected ${schwaInsertions} inserted schwa-like segments in consonant clusters.`],
      affectedSounds: ['schwa', 'AH', 'AX'],
      difficulty: 'medium',
      drills: [
        { type: 'cluster-reduction', instruction: 'Slowly practice target clusters (e.g., "school") by isolating the cluster without inserting a vowel: s-k-oo-l.' },
      ],
      visual: { key: 'tongue_retract', svg: visuals.tongue_retract, instruction: 'Keep the tongue body slightly retracted; do not lower to create a vowel between consonants.' },
      affectedWords: [...new Set(phonemeTimeline.filter((e) => (e.actual === 'AH' || e.actual === 'AX' || e.actual === 'AH0') && e.issueType === 'insertion').map(e => (e as any).word).filter(Boolean))] as string[],
    });
  }

  // 2) Consonant cluster simplification (e.g., initial cluster -> vowel insertion or dropping)
  const clusterVowelInsertions = phonemeTimeline.filter((e) => e.issueType === 'insertion' && /[AEIOU]/.test(String(e.actual || ''))).length;
  if (clusterVowelInsertions >= 2) {
    results.push({
      id: 'cluster_simplification',
      name: 'Consonant cluster simplification',
      confidence: Math.min(0.95, 0.2 * clusterVowelInsertions + (options?.asrConfidence || 0) * 0.1),
      evidence: [`Detected ${clusterVowelInsertions} vowel insertions in consonant clusters (e.g., "iskool" pattern).`],
      affectedSounds: ['clusters', 'epenthetic vowels'],
      difficulty: 'hard',
      drills: [
        { type: 'cluster_slow_repeat', instruction: 'Repeat clusters slowly and then accelerate: start with s-k, then add vowel: sk, skoo, iskool -> skool.' },
      ],
      visual: { key: 'cluster_maintain', svg: visuals.cluster_maintain, instruction: 'Keep the tongue and lips ready for the consonant cluster; avoid releasing into a vowel.' },
      affectedWords: [...new Set(phonemeTimeline.filter((e) => e.issueType === 'insertion' && /[AEIOU]/.test(String(e.actual || ''))).map(e => (e as any).word).filter(Boolean))] as string[],
    });
  }

  // 3) Aspiration mismatch (P->PH, T->TH, K->KH or vice versa)
  const aspirationPatterns = ['P->PH', 'T->TH', 'K->KH', 'PH->P', 'TH->T', 'KH->K'];
  const aspirationCount = sumPairCounts(pairCount, aspirationPatterns);
  if (aspirationCount >= 1) {
    const affected = subs.filter(s => aspirationPatterns.includes(`${s.expected || ''}->${s.actual || ''}`));
    results.push({
      id: 'aspiration_mismatch',
      name: 'Aspiration mismatch',
      confidence: Math.min(0.95, 0.3 * aspirationCount + (options?.asrConfidence || 0) * 0.05),
      evidence: [`Found ${aspirationCount} aspiration substitutions (e.g., P↔PH)${getWords(affected)}.`],
      affectedSounds: ['p', 't', 'k', 'aspirated stops'],
      difficulty: 'medium',
      drills: [
        { type: 'aspiration_practice', instruction: 'Practice aspirated vs unaspirated stops: say "pin" vs "spin" and feel the burst of air.' },
      ],
      visual: { key: 'aspiration_burst', svg: visuals.aspiration_burst, instruction: 'Notice the small puff of air for aspirated stops; place a finger in front of your mouth to feel it.' },
      affectedWords: [...new Set(affected.map(i => i.word).filter(Boolean))] as string[],
    });
  }

  const finalDropItems = omissions.filter((o) => o.expected && !/[AEIOU]/.test(o.expected.replace(/[0-2]/g, '')));
  const finalDrops = finalDropItems.length;
  if (finalDrops >= 1) {
    results.push({
      id: 'final_consonant_dropping',
      name: 'FINAL_CONSONANT_DROPPING',
      confidence: Math.min(0.9, 0.25 * finalDrops + (options?.asrConfidence || 0) * 0.05),
      evidence: [`Detected ${finalDrops} omitted final consonants${getWords(finalDropItems)}.`],
      affectedSounds: ['final consonants'],
      difficulty: 'easy',
      drills: [
        { type: 'final_release', instruction: 'Speak target words while holding the final consonant for 1 second: "cat..." then release.' },
      ],
      visual: { key: 'final_release', svg: visuals.final_release, instruction: 'Hold the articulatory closure for the final consonant before releasing.' },
      affectedWords: [...new Set(finalDropItems.map(i => i.word).filter(Boolean))] as string[],
    });
  }
  
  // 4.5) TH Substitution
  const thPairs = ['TH->T', 'TH->D', 'TH->S', 'TH->Z', 'DH->D', 'DH->Z'];
  const thCount = sumPairCounts(pairCount, thPairs);
  if (thCount >= 1) {
    const affected = subs.filter(s => thPairs.includes(`${s.expected || ''}->${s.actual || ''}`));
    results.push({
      id: 'th_substitution',
      name: 'TH_SUBSTITUTION',
      confidence: Math.min(0.95, 0.3 * thCount + (options?.asrConfidence || 0) * 0.05),
      evidence: [`Found ${thCount} TH substitutions (e.g., TH->T or DH->D)${getWords(affected)}.`],
      affectedSounds: ['TH', 'DH'],
      difficulty: 'medium',
      drills: [
        { type: 'th_practice', instruction: 'Place the tip of your tongue between your teeth and blow air to create the TH sound.' },
      ],
      affectedWords: [...new Set(affected.map(i => i.word).filter(Boolean))] as string[],
    });
  }

  // 5) Stress displacement / syllable clipping
  const stressIssues = (wordAnalysis || []).filter((w: any) => (w.componentScores?.stressCorrectness || 100) < 75).length;
  const syllableClips = (wordAnalysis || []).filter((w: any) => (w.expectedSyllables || 0) - ((w.actualPhonemes || []).filter((p: string) => /[AEIOU]/.test(p)).length || 0) >= 1).length;
  if (stressIssues >= 1) {
    results.push({
      id: 'stress_displacement',
      name: 'Stress displacement',
      confidence: Math.min(0.95, 0.2 * stressIssues + (options?.asrConfidence || 0) * 0.1),
      evidence: [`${stressIssues} words show low stress-correctness scores.`],
      affectedSounds: ['stress patterns', 'syllable prominence'],
      difficulty: 'medium',
      drills: [
        { type: 'stress_marking', instruction: 'Mark sentence-level stress by tapping the beat on stressed syllables and reading aloud.' },
      ],
      visual: { key: 'stress_wave', svg: visuals.stress_wave, instruction: 'Aim for a clear higher pitch and louder intensity on the stressed syllable.' },
      affectedWords: [...new Set((wordAnalysis || []).filter((w: any) => (w.componentScores?.stressCorrectness || 100) < 75).map(w => w.word).filter(Boolean))] as string[],
    });
  }
  if (syllableClips >= 1) {
    results.push({
      id: 'syllable_clipping',
      name: 'Syllable clipping',
      confidence: Math.min(0.9, 0.2 * syllableClips + (options?.asrConfidence || 0) * 0.05),
      evidence: [`${syllableClips} words appear to have fewer realized syllables than expected.`],
      affectedSounds: ['vowels', 'syllable nuclei'],
      difficulty: 'medium',
      drills: [
        { type: 'syllable_extension', instruction: 'Read words slowly, elongating vowels in each syllable to notice missing syllable nuclei.' },
      ],
      visual: { key: 'syllable_clips', svg: visuals.syllable_clips, instruction: 'Lengthen the vowel in clipped syllables to restore the syllable count.' },
    });
  }

  // 6) Vowel neutralization / vowel stretching
  const vowelNeutralPairs = Object.entries(pairCount).filter(([k]) => /AE->AH|EH->AH|IH->AH|IY->IH|AA->AH/.test(k));
  if (vowelNeutralPairs.length) {
    const count = vowelNeutralPairs.reduce((s, [, v]) => s + v as any, 0) as number;
    const affectedVowels = subs.filter(s => /AE->AH|EH->AH|IH->AH|IY->IH|AA->AH/.test(`${s.expected || ''}->${s.actual || ''}`));
    results.push({
      id: 'vowel_neutralization',
      name: 'Vowel neutralization / stretching',
      confidence: Math.min(0.95, 0.2 * count + (options?.asrConfidence || 0) * 0.05),
      evidence: [`Detected vowel neutralization patterns: ${vowelNeutralPairs.map(([k]) => k).join(', ')}`],
      affectedSounds: ['vowels'],
      difficulty: 'medium',
      drills: [
        { type: 'vowel_contrast', instruction: 'Practice minimal pairs that contrast target vowels (e.g., "bit" vs "beat").' },
      ],
      visual: { key: 'vowel_space', svg: visuals.vowel_space, instruction: 'Ensure your tongue and jaw are clearly positioned for the target vowel, avoiding the central schwa space.' },
      affectedWords: [...new Set(affectedVowels.map(i => i.word).filter(Boolean))] as string[],
    });
  }

  // Filter low confidence results
  const filtered = results.map((r) => ({ ...r, confidence: Number((r.confidence || 0).toFixed(2)) })).filter((r) => r.confidence > 0.12);

  if ((filtered || []).length && process.env.PRONUNCIATION_DEBUG === 'true') {
    logger.info({ phenomena: filtered }, 'Detected phenomena');
  }

  return filtered;
}

export default detectPhenomena;
