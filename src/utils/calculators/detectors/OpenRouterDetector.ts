import axios from 'axios';
import { ICache } from '../core/interface.js';
import { nlpLogger } from '../core/logger.js';
import { NLP_TIMEOUTS } from '../core/constants.js';

export interface OpenRouterFluencyScore {
  score: number;
  reasoning: string;
  improvements: string[];
  strengths: string[];
  confidence: number;
  method: 'openrouter-mistral' | 'fallback';
}

/**
 * OpenRouter Fluency Detector
 * Uses free Mistral 7B Instruct model for fluency analysis
 * Falls back to basic scoring if API unavailable
 */
export class OpenRouterFluencyDetector {
  private apiKey: string;
  private cache: ICache;
  private model: string;
  private baseURL: string;
  
  constructor(apiKey: string, cache: ICache) {
    this.apiKey = apiKey;
    this.cache = cache;
    this.model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct';
    this.baseURL = 'https://openrouter.ai/api/v1';
  }
  
  async analyzeFluency(text: string): Promise<OpenRouterFluencyScore> {
    const cacheKey = `or:fluency:${Buffer.from(text).toString('base64').slice(0, 50)}`;
    
    // Check cache first
    const cached = await this.cache.get<OpenRouterFluencyScore>(cacheKey);
    if (cached) {
      nlpLogger.debug({ cacheKey }, 'OpenRouter cache hit');
      return cached;
    }
    
    const startTime = Date.now();
    
    try {
      const prompt = `You are an English fluency expert. Analyze the fluency of the following text and provide:
1. A fluency score from 0-100
2. Brief reasoning
3. Up to 3 improvements
4. Up to 3 strengths

Text: "${text}"

Respond in JSON format:
{
  "score": <0-100>,
  "reasoning": "<brief explanation>",
  "improvements": ["<suggestion 1>", "<suggestion 2>"],
  "strengths": ["<strength 1>", "<strength 2>"]
}`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.3,
          max_tokens: 300,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:8080',
            'X-Title': 'English Learning Platform',
          },
          timeout: process.env.OPENROUTER_TIMEOUT ? parseInt(process.env.OPENROUTER_TIMEOUT) : NLP_TIMEOUTS.GPT,
        }
      );
      
      const content = response.data.choices[0].message.content;
      let parsedResult;
      
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                         content.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, content];
        parsedResult = JSON.parse(jsonMatch[1] || content);
      } catch (parseError) {
        nlpLogger.warn({ content }, 'Failed to parse OpenRouter response, using fallback');
        return this.getFallbackScore(text);
      }
      
      const result: OpenRouterFluencyScore = {
        score: Math.min(100, Math.max(0, parsedResult.score || 75)),
        reasoning: parsedResult.reasoning || 'AI analysis completed',
        improvements: Array.isArray(parsedResult.improvements) 
          ? parsedResult.improvements.slice(0, 3) 
          : [],
        strengths: Array.isArray(parsedResult.strengths)
          ? parsedResult.strengths.slice(0, 3)
          : [],
        confidence: 0.80, // OpenRouter Mistral confidence
        method: 'openrouter-mistral',
      };
      
      // Cache for 1 hour
      await this.cache.set(cacheKey, result, 3600);
      
      const duration = Date.now() - startTime;
      nlpLogger.info(
        { score: result.score, duration, model: this.model },
        'OpenRouter fluency analysis complete'
      );
      
      return result;
    } catch (error: any) {
      nlpLogger.error(
        { 
          error: error.message, 
          status: error.response?.status,
          data: error.response?.data 
        }, 
        'OpenRouter API error, using fallback'
      );
      
      return this.getFallbackScore(text);
    }
  }
  
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 2000,
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Fallback scoring when OpenRouter is unavailable
   * Uses basic heuristics
   */
  private getFallbackScore(text: string): OpenRouterFluencyScore {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let score = 75; // Base score
    
    // Length check
    if (words.length >= 5 && words.length <= 100) {
      score += 5;
    }
    
    // Sentence count
    if (sentences.length >= 2) {
      score += 5;
    }
    
    // Average word length (indicates vocabulary)
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgWordLength >= 4 && avgWordLength <= 7) {
      score += 5;
    }
    
    // Check for basic punctuation
    if (/[,;:]/.test(text)) {
      score += 5;
    }
    
    return {
      score: Math.min(100, score),
      reasoning: 'Fallback scoring (OpenRouter unavailable)',
      improvements: ['Consider varying sentence structure', 'Use transition words'],
      strengths: ['Message is complete'],
      confidence: 0.50,
      method: 'fallback',
    };
  }
  
  getConfidence(): number {
    return 0.80; // Good confidence for Mistral 7B
  }
}
