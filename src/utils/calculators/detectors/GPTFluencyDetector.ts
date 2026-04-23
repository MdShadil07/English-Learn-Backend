import axios from 'axios';
import { ICache } from '../core/interface.js';
import { GPTFluencyScore, AnalysisConfig } from '../core/types.js';
import { nlpLogger } from '../core/logger.js';
import { NLP_TIMEOUTS } from '../core/constants.js';

export class GPTFluencyDetector {
  private apiKey: string;
  private cache: ICache;
  
  constructor(apiKey: string, cache: ICache) {
    this.apiKey = apiKey;
    this.cache = cache;
  }
  
  async analyzeFluency(text: string, config: AnalysisConfig): Promise<GPTFluencyScore> {
    const cacheKey = `gpt:fluency:${Buffer.from(text).toString('base64').slice(0, 50)}`;
    
    const cached = await this.cache.get<GPTFluencyScore>(cacheKey);
    if (cached) {
      nlpLogger.debug({ cacheKey }, 'GPT cache hit');
      return cached;
    }
    
    const prompt = `Analyze the fluency of this English text on a scale of 0-100. Consider naturalness, flow, coherence, and readability.

Text: "${text}"

Respond in JSON format:
{
  "score": <0-100>,
  "reasoning": "<brief explanation>",
  "improvements": ["<suggestion 1>", "<suggestion 2>"],
  "strengths": ["<strength 1>", "<strength 2>"],
  "confidence": <0-1>
}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: NLP_TIMEOUTS.GPT,
        }
      );
      
      const result = JSON.parse(response.data.choices[0].message.content);
      
      await this.cache.set(cacheKey, result, 3600);
      
      nlpLogger.info({ score: result.score }, 'GPT fluency analysis complete');
      
      return result;
    } catch (error) {
      nlpLogger.error({ error }, 'GPT API error');
      return {
        score: 75,
        reasoning: 'Fallback score (API unavailable)',
        improvements: [],
        strengths: [],
        confidence: 0.5,
      };
    }
  }
}