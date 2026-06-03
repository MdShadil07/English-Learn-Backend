export type MouthAnimationSeverity = 'low' | 'medium' | 'high';

export type MouthAnimationCue = {
  word: string;
  phoneme: string;
  severity: MouthAnimationSeverity;
  animation: string;
  animationFile: string;
  mistake: string;
  practiceWords: string[];
  tonguePlacement: string;
  airflow: string;
};

const normalizePhoneme = (value: string) => String(value || '').toUpperCase().replace(/[0-2]/g, '').trim();

const ANIMATION_LIBRARY: Record<string, {
  animation: string;
  animationFile: string;
  mistake: string;
  practiceWords: string[];
  tonguePlacement: string;
  airflow: string;
}> = {
  TH: {
    animation: 'th-animation',
    animationFile: '/animations/th.json',
    mistake: 'TH Fronting',
    practiceWords: ['think', 'three', 'thirty'],
    tonguePlacement: 'Tongue slightly between the teeth.',
    airflow: 'Gentle and continuous airflow.',
  },
  DH: {
    animation: 'th-animation',
    animationFile: '/animations/th.json',
    mistake: 'TH Fronting',
    practiceWords: ['this', 'those', 'other'],
    tonguePlacement: 'Tongue slightly between the teeth.',
    airflow: 'Gentle and continuous airflow.',
  },
  R: {
    animation: 'r-animation',
    animationFile: '/animations/r.json',
    mistake: 'R Reduction',
    practiceWords: ['red', 'rain', 'road'],
    tonguePlacement: 'Pull the tongue back without touching the roof.',
    airflow: 'Keep the sound smooth and controlled.',
  },
  ER: {
    animation: 'r-animation',
    animationFile: '/animations/r.json',
    mistake: 'R Coloring',
    practiceWords: ['her', 'bird', 'turn'],
    tonguePlacement: 'Keep the tongue bunched or curled slightly back.',
    airflow: 'Hold the color of the vowel smoothly.',
  },
  L: {
    animation: 'l-animation',
    animationFile: '/animations/l.json',
    mistake: 'L Simplification',
    practiceWords: ['light', 'leaf', 'little'],
    tonguePlacement: 'Raise the tongue tip to the alveolar ridge.',
    airflow: 'Let air move around the sides of the tongue.',
  },
  V: {
    animation: 'v-animation',
    animationFile: '/animations/v.json',
    mistake: 'V Devoicing',
    practiceWords: ['very', 'voice', 'victory'],
    tonguePlacement: 'Touch the upper teeth lightly to the lower lip.',
    airflow: 'Keep a steady voiced airflow.',
  },
  W: {
    animation: 'w-animation',
    animationFile: '/animations/w.json',
    mistake: 'W Lip Rounding',
    practiceWords: ['water', 'window', 'warm'],
    tonguePlacement: 'Round the lips while keeping the tongue relaxed.',
    airflow: 'Release the sound smoothly into the vowel.',
  },
  SH: {
    animation: 'sh-animation',
    animationFile: '/animations/sh.json',
    mistake: 'SH Deaffrication',
    practiceWords: ['she', 'ship', 'shadow'],
    tonguePlacement: 'Lift the tongue blade slightly back from the ridge.',
    airflow: 'Keep the air narrow and soft.',
  },
  CH: {
    animation: 'sh-animation',
    animationFile: '/animations/sh.json',
    mistake: 'CH Fronting',
    practiceWords: ['chip', 'choose', 'cherry'],
    tonguePlacement: 'Start with the tongue near the ridge, then release into a hiss.',
    airflow: 'Release into a controlled burst.',
  },
  JH: {
    animation: 'sh-animation',
    animationFile: '/animations/sh.json',
    mistake: 'CH/JH Confusion',
    practiceWords: ['jump', 'juice', 'giant'],
    tonguePlacement: 'Use the same channel as SH, but keep it voiced.',
    airflow: 'Maintain a voiced fricative release.',
  },
  K: {
    animation: 'k-animation',
    animationFile: '/animations/k.json',
    mistake: 'Velar Fronting',
    practiceWords: ['keep', 'kite', 'cold'],
    tonguePlacement: 'Lift the back of the tongue toward the soft palate.',
    airflow: 'Hold the closure, then release cleanly.',
  },
  G: {
    animation: 'k-animation',
    animationFile: '/animations/k.json',
    mistake: 'Velar Fronting',
    practiceWords: ['go', 'green', 'give'],
    tonguePlacement: 'Lift the back of the tongue toward the soft palate.',
    airflow: 'Hold the closure, then release with voice.',
  },
  NG: {
    animation: 'k-animation',
    animationFile: '/animations/k.json',
    mistake: 'Velar Backing',
    practiceWords: ['sing', 'long', 'young'],
    tonguePlacement: 'Keep the tongue back and let the sound resonate through the nose.',
    airflow: 'Keep the release nasal and steady.',
  },
  P: {
    animation: 'p-animation',
    animationFile: '/animations/p.json',
    mistake: 'Lip Closure Timing',
    practiceWords: ['pen', 'paper', 'please'],
    tonguePlacement: 'Close both lips fully before release.',
    airflow: 'Release a short burst of air.',
  },
  B: {
    animation: 'p-animation',
    animationFile: '/animations/p.json',
    mistake: 'Lip Voicing Timing',
    practiceWords: ['bad', 'book', 'baby'],
    tonguePlacement: 'Close both lips fully before release.',
    airflow: 'Release with voice and controlled air.',
  },
  M: {
    animation: 'p-animation',
    animationFile: '/animations/p.json',
    mistake: 'Lip Closure Timing',
    practiceWords: ['man', 'more', 'make'],
    tonguePlacement: 'Close both lips and let the sound resonate through the nose.',
    airflow: 'Keep airflow nasal and steady.',
  },
  neutral: {
    animation: 'neutral-animation',
    animationFile: '/animations/neutral.json',
    mistake: 'General placement',
    practiceWords: ['slowly', 'clearly', 'carefully'],
    tonguePlacement: 'Keep the jaw and tongue relaxed.',
    airflow: 'Use smooth, even airflow.',
  },
};

const PHONEME_PRIORITY: Record<string, string[]> = {
  TH: ['TH', 'DH'],
  R: ['R', 'ER'],
  L: ['L'],
  V: ['V', 'F'],
  W: ['W'],
  SH: ['SH', 'CH', 'JH', 'ZH'],
  K: ['K', 'G', 'NG'],
  P: ['P', 'B', 'M'],
};

const findAnimationKey = (phonemes: string[]) => {
  const normalized = phonemes.map(normalizePhoneme).filter(Boolean);
  for (const [key, matches] of Object.entries(PHONEME_PRIORITY)) {
    if (normalized.some((phoneme) => matches.includes(phoneme))) {
      return key;
    }
  }
  return 'neutral';
};

export const resolveMouthAnimationCue = (input: {
  word: string;
  expectedPhonemes?: string[];
  actualPhonemes?: string[];
  issueType?: string;
  score?: number;
}): MouthAnimationCue => {
  const expected = (input.expectedPhonemes || []).map(normalizePhoneme).filter(Boolean);
  const actual = (input.actualPhonemes || []).map(normalizePhoneme).filter(Boolean);
  const primaryPhoneme = expected[0] || actual[0] || 'NEUTRAL';
  const animationKey = findAnimationKey([...expected, ...actual]);
  const resolved = ANIMATION_LIBRARY[animationKey] || ANIMATION_LIBRARY.neutral;
  const severity: MouthAnimationSeverity = typeof input.score === 'number'
    ? input.score < 60
      ? 'high'
      : input.score < 80
      ? 'medium'
      : 'low'
    : input.issueType === 'omission' || input.issueType === 'substitution'
    ? 'medium'
    : 'low';

  return {
    word: input.word,
    phoneme: primaryPhoneme,
    severity,
    animation: resolved.animation,
    animationFile: resolved.animationFile,
    mistake: resolved.mistake,
    practiceWords: resolved.practiceWords,
    tonguePlacement: resolved.tonguePlacement,
    airflow: resolved.airflow,
  };
};

export const MOUTH_ANIMATION_LIBRARY = ANIMATION_LIBRARY;
