import SpeechProfile from '../../models/SpeechProfile.js';

import { telemetryService } from '../telemetryService.js';
import axios from 'axios';

type CoachLlmInput = {
  transcript: string;
  metrics: {
    wps: number;
    fillerCount: number;
    avgPauseMs: number;
    confidence: number;
  };
  pronunciationIssues?: string[];
};

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_TIMEOUT_MS = Number(process.env.COACH_GEMINI_TIMEOUT_MS || 7000);
const COACH_MODELS = [
  process.env.COACH_GEMINI_MODEL || 'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

type CoachGeminiResponse = {
  narrative: string;
  suggestions: string[];
  focus?: string;
  summary?: string;
  drillWords?: string[];
};

async function generateGeminiCoachNarrative(input: CoachLlmInput, maxRetries = 3): Promise<CoachGeminiResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key is missing. Skipping coach analysis.');
    return null;
  }

  const transcriptSnippet = input.transcript.slice(0, 1200);
  const prompt = [
    'You are a premium English speaking communication coach for adult learners.',
    'You must be STRICT and directly point out exactly where the user is lacking. No sugarcoating.',
    'Return ONLY valid JSON. No markdown. No code fences. No extra text.',
    'Use exactly this schema:',
    '{"narrative":string,"suggestions":string[],"focus":string,"summary":string,"drillWords":string[]}',
    'The response must be specific, practical, and confident.',
    'Do not be generic. Mention their dominant speaking issues based on the provided metrics and pronunciation issues.',
    'Keep narrative under 75 words, but ensure it is strict and clear about what they did wrong.',
    'Suggestions must be short, actionable, and no more than 3 items.',
    'drillWords must be an array of 3 to 5 words that contain similar phonetic patterns to their pronunciation issues, so they can practice them right away.',
    `Transcript: ${transcriptSnippet}`,
    `Metrics: wps=${input.metrics.wps.toFixed(2)}, fillers=${input.metrics.fillerCount}, avgPauseMs=${Math.round(input.metrics.avgPauseMs)}, confidence=${input.metrics.confidence}`,
    input.pronunciationIssues && input.pronunciationIssues.length > 0 ? `Pronunciation Issues Detected by MFA: ${input.pronunciationIssues.join('; ')}` : '',
  ].filter(Boolean).join('\n');

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

  const retryDelayMs = Math.max(250, parseInt(process.env.GEMINI_RETRY_DELAY_MS || '750'));

  for (const model of COACH_MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: GEMINI_TIMEOUT_MS,
        });

        telemetryService.recordServiceCall('communication-coach', Date.now() - startTime, false);
        
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) {
          throw new Error('Gemini returned an empty response.');
        }

        const match = text.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : null;
        if (!parsed || typeof parsed.narrative !== 'string' || !Array.isArray(parsed.suggestions)) {
          throw new Error('Failed to parse valid JSON from Gemini response.');
        }

        return {
          narrative: parsed.narrative.trim().replace(/\s+/g, ' '),
          suggestions: parsed.suggestions.filter((item: unknown) => typeof item === 'string').slice(0, 3),
          focus: typeof parsed.focus === 'string' ? parsed.focus.trim() : undefined,
          summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : undefined,
          drillWords: Array.isArray(parsed.drillWords) ? parsed.drillWords.filter((w:any) => typeof w === 'string').slice(0, 5) : undefined,
        };
      } catch (error: any) {
        telemetryService.recordServiceCall('communication-coach', Date.now() - startTime, true);
        
        const status = error?.response?.status;
        const isRateLimitOrTimeout = status === 429 || status === 408 || error?.code === 'ECONNABORTED';
        const willRetry = attempt < maxRetries && isRateLimitOrTimeout;
        
        console.warn(`⚠️ Gemini coach request failed [${model}] attempt ${attempt} (${willRetry ? 'retrying' : 'moving to next model/fallback'})`, {
          status,
          message: error?.message,
        });

        if (!willRetry) {
          break; // Move to the next model in COACH_MODELS if it's a hard error (e.g., 404, 400) or we ran out of retries
        }

        const backoff = Math.min(4000, retryDelayMs * Math.pow(2, attempt - 1));
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  return null;
}

function buildHeuristicCoachResponse(attempt: any, base: ReturnType<typeof analyzeCommunication>) {
  return {
    ...base,
    focus: 'delivery',
    summary: 'Using heuristic analysis due to coach service unavailability.',
    source: 'heuristic-fallback',
  };
}

async function runGeminiCoachWithRetry(input: CoachLlmInput): Promise<CoachGeminiResponse | null> {
  // Now generateGeminiCoachNarrative handles its own robust backoff/retries natively!
  return generateGeminiCoachNarrative(input, 3);
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
  
  // Extract pronunciation issues from attempt
  const pronunciationIssues: string[] = [];
  if (attempt.wordAnalysis && Array.isArray(attempt.wordAnalysis)) {
    const weakWords = attempt.wordAnalysis.filter((w: any) => w.score < 80);
    for (const w of weakWords) {
      const issue = (w.componentScores?.vowelQuality || 100) < 80 ? 'vowels' : (w.componentScores?.consonantCompletion || 100) < 80 ? 'consonants' : 'articulation';
      pronunciationIssues.push(`Word "${w.word}" (score ${w.score}): poor ${issue}`);
    }
  }
  if (attempt.phonologicalProfile && attempt.phonologicalProfile.dominantPatterns) {
    pronunciationIssues.push(`Dominant patterns: ${attempt.phonologicalProfile.dominantPatterns.join(', ')}`);
  }

  const llm = await runGeminiCoachWithRetry({
    transcript: attempt.recognizedTranscript || attempt.transcript || '',
    metrics: base.metrics,
    pronunciationIssues: pronunciationIssues.slice(0, 10),
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
    drillWords: llm.drillWords || [],
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
