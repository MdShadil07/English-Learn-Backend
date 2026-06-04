import SpeechProfile from '../../models/SpeechProfile.js';
import { telemetryService } from '../telemetryService.js';

type CoachLlmInput = {
  transcript: string;
  metrics: {
    wps: number;
    fillerCount: number;
    avgPauseMs: number;
    confidence: number;
  };
};

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_TIMEOUT_MS = Number(process.env.COACH_GEMINI_TIMEOUT_MS || 7000);
const COACH_MODELS = [
  process.env.COACH_GEMINI_MODEL || 'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro'
].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

type CoachGeminiResponse = {
  narrative: string;
  suggestions: string[];
  focus?: string;
  summary?: string;
};

async function generateGeminiCoachNarrative(input: CoachLlmInput): Promise<CoachGeminiResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const transcriptSnippet = input.transcript.slice(0, 1200);
  const prompt = [
    'You are a premium English speaking communication coach for adult learners.',
    'Return ONLY valid JSON. No markdown. No code fences. No extra text.',
    'Use exactly this schema:',
    '{"narrative":string,"suggestions":string[],"focus":string,"summary":string}',
    'The response must be specific, practical, and confident.',
    'Do not be generic. Mention one dominant speaking issue, one positive observation, and one drill recommendation.',
    'Keep narrative under 75 words.',
    'Suggestions must be short, actionable, and no more than 3 items.',
    `Transcript: ${transcriptSnippet}`,
    `Metrics: wps=${input.metrics.wps.toFixed(2)}, fillers=${input.metrics.fillerCount}, avgPauseMs=${Math.round(input.metrics.avgPauseMs)}, confidence=${input.metrics.confidence}`,
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 320,
      topP: 0.85,
      candidateCount: 1,
      responseMimeType: 'application/json',
    },
  };

  try {
    for (const model of COACH_MODELS) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          telemetryService.recordServiceCall('communication-coach', Date.now() - startTime, true);
          const errorText = await response.text().catch(() => '');
          console.warn('Gemini coach request failed', { model, status: response.status, errorText: errorText.slice(0, 200) });
          continue;
        }

        telemetryService.recordServiceCall('communication-coach', Date.now() - startTime, false);
        const payload: any = await response.json();
        const parts = payload?.candidates?.[0]?.content?.parts || [];
        const text = parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('\n').trim();

        if (!text && payload && typeof payload === 'object') {
          const directNarrative = typeof payload?.narrative === 'string' ? payload.narrative : '';
          const directSuggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
          if (directNarrative && directSuggestions.length) {
            return {
              narrative: directNarrative.trim().replace(/\s+/g, ' '),
              suggestions: directSuggestions.filter((item: unknown) => typeof item === 'string').slice(0, 3),
              focus: typeof payload?.focus === 'string' ? payload.focus.trim() : undefined,
              summary: typeof payload?.summary === 'string' ? payload.summary.trim() : undefined,
            };
          }
          continue;
        }

        const match = text.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : null;
        if (!parsed || typeof parsed.narrative !== 'string' || !Array.isArray(parsed.suggestions)) {
          continue;
        }

        return {
          narrative: parsed.narrative.trim().replace(/\s+/g, ' '),
          suggestions: parsed.suggestions.filter((item: unknown) => typeof item === 'string').slice(0, 3),
          focus: typeof parsed.focus === 'string' ? parsed.focus.trim() : undefined,
          summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : undefined,
        };
      } catch (error) {
        telemetryService.recordServiceCall('communication-coach', Date.now() - startTime, true);
        console.warn('Gemini coach attempt failed', { model, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildHeuristicCoachResponse(attempt: any, base: ReturnType<typeof analyzeCommunication>) {
  return {
    narrative: 'Service is not running or there is some issue.',
    suggestions: [],
    focus: 'service-issue',
    summary: 'Communication coach service is currently unavailable.',
    source: 'error-fallback',
  };
}

async function runGeminiCoachWithRetry(input: CoachLlmInput): Promise<CoachGeminiResponse | null> {
  const first = await generateGeminiCoachNarrative(input);
  if (first) {
    return first;
  }

  const retryInput: CoachLlmInput = {
    transcript: input.transcript,
    metrics: {
      ...input.metrics,
      confidence: Math.max(0, Math.min(1, input.metrics.confidence + 0.05)),
    },
  };

  return generateGeminiCoachNarrative(retryInput);
}

export function analyzeCommunication(attempt: any) {
  const transcript = (attempt.recognizedTranscript || attempt.transcript || '').toLowerCase();
  const words = transcript.split(/\s+/).filter(Boolean);
  const durationMs = attempt.durationMs || attempt.recordingDurationMs || attempt.metadata?.durationMs || 0;
  const wps = durationMs > 0 ? (words.length / (durationMs / 1000)) : 0;

  const fillerMatches = transcript.match(/\b(um+|uh+|erm|ah+|like|you know)\b/g) || [];
  const fillerCount = fillerMatches.length;

  const hesitationMs = attempt.metadata?.pauses?.length ? (attempt.metadata.pauses.reduce((a:any,b:any)=>a+b,0) / attempt.metadata.pauses.length) : (attempt.metadata?.avgPauseMs || 0);

  const confidence = attempt.metadata?.asrConfidence ?? attempt.metadata?.confidence ?? 0;

  const feedback: string[] = [];
  if (fillerCount === 0) feedback.push('You speak smoothly with few filler words.');
  else feedback.push(`You used ${fillerCount} filler words; try pausing briefly instead of saying 'um'.`);

  if (wps > 3.5) feedback.push('Pacing is brisk — consider slowing slightly to improve clarity on complex words.');
  else if (wps < 2) feedback.push('Pacing is slow; try grouping words into phrases to improve natural flow.');
  else feedback.push('Your pacing is within a natural conversational range.');

  if (hesitationMs > 400) feedback.push('Long hesitations detected before several words — practice chunking phrases.');

  const suggestion = [] as string[];
  if (fillerCount > 0) suggestion.push('Try silent pauses or breathing before difficult words.');
  suggestion.push('Record slow readings and mark stressed syllables with a clap.');

  const result = {
    metrics: { wps, fillerCount, avgPauseMs: hesitationMs, confidence },
    narrative: feedback.join(' '),
    suggestions: suggestion,
  };

  return result;
}

export async function analyzeCommunicationPremium(attempt: any) {
  const base = analyzeCommunication(attempt);
  const llm = await runGeminiCoachWithRetry({
    transcript: attempt.recognizedTranscript || attempt.transcript || '',
    metrics: base.metrics,
  });

  if (!llm) {
    return buildHeuristicCoachResponse(attempt, base);
  }

  return {
    ...base,
    narrative: llm.narrative,
    suggestions: llm.suggestions.length ? llm.suggestions : base.suggestions,
    focus: llm.focus || 'delivery',
    summary: llm.summary || 'Premium Gemini coach response generated successfully.',
    source: 'gemini-flash',
  };
}

export async function attachToProfile(userId: string, attempt: any) {
  if (!userId) return;
  const profile = await SpeechProfile.findOneAndUpdate(
    { userId },
    { $inc: { fillerCount: (attempt.fillerCount || 0) } },
    { upsert: true, new: true }
  );
  return profile;
}

export default { analyzeCommunication, attachToProfile };
