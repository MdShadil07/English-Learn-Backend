import axios, { AxiosResponse } from 'axios';
import {
  analyzeMessage as runUnifiedAccuracy,
  type UnifiedAccuracyResult,
  type UserTier,
} from '../../utils/calculators/unifiedAccuracyCalculators.js';
import {
  buildFallbackUnifiedResult,
  enforcePenalty,
} from '../Accuracy/penaltyEnforcer.js';
import { detectLanguage } from '../NLP/languageDetectionService.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AccuracyAnalysis extends Partial<UnifiedAccuracyResult> {
  overall: number;
  grammar: number;
  vocabulary: number;
  spelling: number;
  fluency: number;
  feedback: string[];
}

export interface AIPersonality {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'premium';
  features: string[];
}

export interface GenerateResponseRequest {
  userMessage: string;
  personality: AIPersonality;
  conversationHistory: ChatMessage[];
  language: string;
  userId: string;
  userNativeLanguage?: string; // User's native language for translations
  userTier?: string; // User tier for enhanced formatting
  responseLanguage?: string; // User's preferred response language
  userProfile?: {
    userName?: string;
    userLevel?: number;
    totalXP?: number;
    currentStreak?: number;
    skillLevels?: {
      vocabulary?: number;
      grammar?: number;
      pronunciation?: number;
      fluency?: number;
    };
  };
}

export interface GenerateResponseResponse {
  response: string;
  accuracy?: AccuracyAnalysis;
  xpGained?: number;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
  };
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

const clampScore = (value: number | undefined, fallback = 0): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
};

const normalizeTier = (tier?: string): UserTier => {
  const normalized = tier?.toLowerCase?.() ?? 'free';
  if (normalized === 'premium') return 'premium';
  if (normalized === 'pro') return 'pro';
  return 'free';
};

const buildAccuracyAnalysis = (
  result: UnifiedAccuracyResult,
  sourceText: string
): AccuracyAnalysis => {
  const normalized = enforcePenalty(result, sourceText, result.languageContext);

  return {
    ...normalized,
    overall: clampScore(normalized.overall),
    grammar: clampScore(normalized.grammar),
    vocabulary: clampScore(normalized.vocabulary),
    spelling: clampScore(normalized.spelling),
    fluency: clampScore(normalized.fluency),
    feedback: normalized.feedback ?? [],
  };
};

export class GeminiAIService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private responseQueue: any;
  private analysisQueue: any;
  private rabbitConnection: any;
  private requestTimeout: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private fallbackResponses: Record<string, string>;
  private verboseLogging: boolean;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS || '2048'); // Reduced from 4096 for faster responses
    this.temperature = parseFloat(process.env.GEMINI_TEMPERATURE || '0.3');
    this.requestTimeout = parseInt(process.env.GEMINI_TIMEOUT_MS || '20000');
    this.maxRetries = Math.max(1, parseInt(process.env.GEMINI_MAX_RETRIES || '2'));
    this.retryDelayMs = Math.max(250, parseInt(process.env.GEMINI_RETRY_DELAY_MS || '750'));
    this.verboseLogging = process.env.GEMINI_VERBOSE_LOGGING === 'true';
    this.fallbackResponses = {
      'basic-tutor': "Hello! I'm here to help you learn English. Could you please share what you'd like to practice today? We can work on grammar, vocabulary, or conversation skills.",
      'conversation-coach': "Hi there! I'm excited to help you improve your English conversation skills. What topic would you like to discuss or practice today?",
      'grammar-expert': "Greetings! I'm ready to assist with your grammar questions and help you understand English sentence structure better. What specific grammar topic interests you?",
      'business-mentor': "Hello! I'm here to support your professional English communication needs. How can I help you with business English today?",
      'cultural-guide': "Hi! I'm passionate about helping you understand both the English language and the cultures that speak it. What cultural or linguistic aspect would you like to explore?"
    };

    if (!apiKey) {
      console.warn('⚠️ Gemini API key not provided. AI service will use fallback responses.');
    }

    // Queues disabled - using direct processing
    // Enable these when Redis and RabbitMQ are properly configured
    // this.initializeQueues();
    // this.initializeRabbitMQ();
    
    this.responseQueue = null;
    this.analysisQueue = null;
    this.rabbitConnection = null;
  }

  private async initializeQueues() {
    try {
      const { Queue, Worker, Job } = await import('bullmq');
      
      this.responseQueue = new Queue('ai-responses', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
        },
      });

      this.analysisQueue = new Queue('accuracy-analysis', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
        },
      });

      this.setupWorkers(Worker, Job);
    } catch (error) {
      console.warn('⚠️ Redis not available for queues, running without BullMQ:', error instanceof Error ? error.message : String(error));
      this.responseQueue = null;
      this.analysisQueue = null;
    }
  }

  private async initializeRabbitMQ() {
    try {
      const amqp = await import('amqp-connection-manager');
      this.rabbitConnection = amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    } catch (error) {
      console.warn('⚠️ RabbitMQ not available:', error instanceof Error ? error.message : String(error));
      this.rabbitConnection = null;
    }
  }

  private setupWorkers(Worker: any, Job: any) {
    if (!this.responseQueue || !this.analysisQueue) {
      console.warn('⚠️ Workers not started - queues not available');
      return;
    }

    // Worker for AI responses
    new Worker('ai-responses', async (job: any) => {
      const { userMessage, personality, conversationHistory, language, userId } = job.data;

      try {
        const response = await this.generateResponseInternal(
          userMessage,
          personality,
          conversationHistory,
          language,
          undefined,
          undefined,
          undefined,
          userId
        );
        return response;
      } catch (error) {
        console.error('AI Response generation failed:', error);
        throw error;
      }
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    // Worker for accuracy analysis
    new Worker('accuracy-analysis', async (job: any) => {
      try {
        const analysis = await this.analyzeMessageInternal(
          job.data.message,
          job.data.userId,
          normalizeTier(job.data.userTier)
        );
        return analysis;
      } catch (error) {
        console.error('Accuracy analysis failed:', error);
        throw error;
      }
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });
  }

  private getGeminiEndpoint(): string {
    return `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  private getFallbackResponse(personalityId: string): string {
    return (
      this.fallbackResponses[personalityId as keyof typeof this.fallbackResponses] ||
      "Hello! I'm your AI English tutor. I'm here to help you learn and improve your English skills. What would you like to work on today?"
    );
  }

  private buildGenerationConfigForTier(tier: UserTier, fastFallback = false): GeminiRequest['generationConfig'] {
    const tierMaxTokens = (() => {
      if (tier === 'premium') {
        return this.maxTokens;
      }
      if (tier === 'pro') {
        return Math.min(this.maxTokens, 2048);
      }
      return Math.min(this.maxTokens, fastFallback ? 768 : 1536);
    })();

    const maxOutputTokens = fastFallback
      ? Math.max(384, Math.floor(tierMaxTokens * 0.6))
      : tierMaxTokens;

    return {
      temperature: fastFallback ? Math.min(this.temperature, 0.4) : this.temperature,
      maxOutputTokens,
      topK: fastFallback ? 32 : 40,
      topP: fastFallback ? 0.9 : 0.95,
    };
  }

  private shouldRetryGeminiError(error: any): boolean {
    const status = error?.response?.status;
    const code = error?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      return true;
    }
    if (typeof status === 'number') {
      if (status === 408 || status === 429) {
        return true;
      }
      if (status >= 500 && status < 600) {
        return true;
      }
    }
    const message = error?.message?.toLowerCase?.() ?? '';
    if (message.includes('timeout') || message.includes('network error')) {
      return true;
    }
    return false;
  }

  private logGeminiFailure(error: any, attempt: number, willRetry: boolean): void {
    const debugInfo = this.extractErrorDebugInfo(error);
    const retryLabel = willRetry ? 'retrying' : 'no retry';
    console.warn(`⚠️ Gemini request attempt ${attempt} failed (${retryLabel})`, debugInfo);
    if (this.verboseLogging && error?.response?.data) {
      console.debug('🔍 Gemini detailed error payload:', error.response.data);
    }
  }

  private extractErrorDebugInfo(error: any) {
    return {
      code: error?.code,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      message: error?.message,
      errorMessage: error?.response?.data?.error?.message,
    };
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendGeminiRequestWithRetries(requestBody: GeminiRequest, tier: UserTier): Promise<string> {
    const attempts = this.maxRetries;
    const url = this.getGeminiEndpoint();

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response: AxiosResponse<GeminiResponse> = await axios.post(url, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.requestTimeout,
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) {
          throw new Error('Gemini returned an empty response.');
        }

        if (attempt > 1) {
          console.log('✅ Gemini request recovered after retry', { attempt });
        }

        return text;
      } catch (error: any) {
        const willRetry = attempt < attempts && this.shouldRetryGeminiError(error);
        this.logGeminiFailure(error, attempt, willRetry);

        if (!willRetry) {
          throw error;
        }

        if (attempt === attempts - 1) {
          requestBody.generationConfig = this.buildGenerationConfigForTier(tier, true);
        }

        const backoff = Math.min(4000, this.retryDelayMs * Math.pow(2, attempt - 1));
        await this.delay(backoff);
      }
    }

    throw new Error('Gemini request failed after maximum retries');
  }

  async generateResponse(request: GenerateResponseRequest): Promise<GenerateResponseResponse> {
    // Process directly without queues to avoid BullMQ configuration issues
    // Queue system can be enabled later when Redis is properly configured
    return this.generateResponseInternal(
      request.userMessage, 
      request.personality, 
      request.conversationHistory, 
      request.language,
      request.userNativeLanguage,
      request.userTier,
      request.responseLanguage,
      request.userId
    );
  }

  private async generateResponseInternal(
    userMessage: string,
    personality: AIPersonality,
    conversationHistory: ChatMessage[],
    language: string,
    userNativeLanguage?: string,
    userTier?: string,
    responseLanguage?: string,
    userId?: string
  ): Promise<GenerateResponseResponse> {
    const recentHistory = conversationHistory.slice(-20);
    const tierValue = normalizeTier(userTier);

    // If Gemini API is not available, return fallback immediately
    if (!this.apiKey) {
      console.warn('Gemini API not available, using fallback response');

      const accuracy = await this.analyzeMessageInternal(userMessage, userId, tierValue);
      const xpGained = Math.floor(accuracy.overall * 0.5);
      const fallbackResponse = this.getFallbackResponse(personality.id);

      return {
        response: fallbackResponse,
        accuracy,
        xpGained,
      };
    }

    const prompt = this.buildPrompt(personality, language, recentHistory, userMessage, userNativeLanguage, userTier, responseLanguage);

    try {
      const requestBody: GeminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: this.buildGenerationConfigForTier(tierValue),
      };
      const shouldAnalyzeAccuracy =
        conversationHistory.length > 0 &&
        conversationHistory[conversationHistory.length - 1].role === 'user';

      const accuracyPromise = shouldAnalyzeAccuracy
        ? this.analyzeMessageInternal(userMessage, userId, tierValue)
        : null;

      const text = await this.sendGeminiRequestWithRetries(requestBody, tierValue);

      let accuracy: AccuracyAnalysis | undefined;
      let xpGained: number | undefined;

      if (accuracyPromise) {
        accuracy = await accuracyPromise;
        xpGained = Math.floor(accuracy.overall * 0.5);
      }

      return {
        response: text,
        accuracy,
        xpGained,
      };
    } catch (error: any) {
      console.error('Gemini API error after retries:', this.extractErrorDebugInfo(error));

      const fallbackResponse = this.getFallbackResponse(personality.id);

      const fallbackAccuracy = await this.analyzeMessageInternal(userMessage, userId, tierValue);
      const fallbackXP = Math.floor(fallbackAccuracy.overall * 0.5);

      return {
        response: fallbackResponse,
        accuracy: fallbackAccuracy,
        xpGained: fallbackXP,
      };
    }
  }

  private buildPrompt(
    personality: AIPersonality,
    language: string,
    history: ChatMessage[],
    userMessage: string,
    userNativeLanguage?: string,
    userTier?: string,
    responseLanguage?: string // User's preferred response language
  ): string {
    const tierGuidance = {
      free: 'Keep responses concise and encouraging. Focus on basic corrections.',
      pro: `Provide detailed explanations with visual error correction. When correcting errors:
- Use [ERROR:incorrect text] to mark errors in red
- Use [CORRECTION:correct text] to show the correction in green
- Provide clear explanations of why the correction is needed
- Include pronunciation tips and natural alternatives`,
      premium: `Deliver comprehensive coaching with advanced techniques, cultural insights, and visual error correction:
- Use [ERROR:incorrect text] to mark errors in red  
- Use [CORRECTION:correct text] to show the correction in green
- Provide in-depth grammatical analysis
- Explain cultural context and nuances
- Suggest multiple natural alternatives
- Include advanced vocabulary suggestions
- Offer professional communication tips
- Give real-world usage examples`
    };

    // TASK DETECTION SYSTEM - Detect what type of task the user is requesting
    const detectTaskType = (message: string): string => {
      const lowerMessage = message.toLowerCase();
      
      // Vocabulary learning
      if (lowerMessage.match(/teach.*word|learn.*vocabulary|new word|vocabulary|what.*mean|define|word.*day/i)) {
        return 'vocabulary';
      }
      
      // Grammar practice/correction
      if (lowerMessage.match(/grammar|correct.*sentence|is.*correct|tense|passive|active voice|article|preposition/i)) {
        return 'grammar';
      }
      
      // Essay/Writing feedback
      if (lowerMessage.match(/essay|writing|paragraph|check.*writing|review.*writing|feedback.*writing/i)) {
        return 'essay';
      }
      
      // Business/Professional communication
      if (lowerMessage.match(/business|professional|email|resume|cover letter|meeting|presentation|formal/i)) {
        return 'business';
      }
      
      // Story/Creative writing
      if (lowerMessage.match(/story|creative|narrative|plot|character|fiction|tale/i)) {
        return 'story';
      }
      
      // Default: conversation practice
      return 'conversation';
    };

    const taskType = detectTaskType(userMessage);
    const effectiveTier = userTier || personality.tier;
    const nativeLanguage = userNativeLanguage || 'English';

    // TASK-SPECIFIC FORMATTING TEMPLATES
    const taskFormattingGuides: Record<string, string> = {
      vocabulary: `
📚 VOCABULARY LEARNING MODE ACTIVATED

When teaching vocabulary:

1. **Format Each Word Properly:**
   [VOCAB_WORD:word|definition/meaning]
   
   Example: [VOCAB_WORD:Serendipity|The occurrence of events by chance in a happy or beneficial way]

2. **Add Native Language Translation (REQUIRED):**
   After each definition, add: [TRANSLATION:${nativeLanguage}|native language meaning]
   
   Example: [TRANSLATION:${nativeLanguage}|सुखद संयोग] (if Hindi is native language)

3. **Use BOLD for Emphasis:**
   [BOLD:important vocabulary terms] when they appear in sentences

4. **Provide Context:**
   - Give 2-3 example sentences using the word
   - Show different contexts (formal, informal, professional)
   - Explain word origins if interesting (etymology)

5. **${effectiveTier === 'premium' ? 'Premium Features' : effectiveTier === 'pro' ? 'Pro Features' : 'Free Features'}:**
   ${effectiveTier === 'premium' ? `
   - Provide 5-7 words per request
   - Include synonyms, antonyms, and related words
   - Add cultural notes about usage
   - Provide memory techniques (mnemonics)
   - Show collocations (words that go together)
   ` : effectiveTier === 'pro' ? `
   - Provide 3-5 words per request
   - Include synonyms and antonyms
   - Add usage notes
   - Provide example sentences
   ` : `
   - Provide 2-3 words per request
   - Include basic definition
   - Add simple example
   `}

VOCABULARY RESPONSE TEMPLATE:
"Great! Let's learn some new words together!

[VOCAB_WORD:Excellence|The quality of being outstanding or extremely good]
[TRANSLATION:${nativeLanguage}|उत्कृष्टता]

This word is commonly used in both professional and academic settings. Here's how to use it:
- "She achieved [BOLD:excellence] in her field."
- "The company is known for its [BOLD:excellence] in customer service."

[NOTE:Remember - Excellence is a noun. The adjective form is 'excellent'.]

[VOCAB_WORD:Accomplish|To achieve or complete successfully]
[TRANSLATION:${nativeLanguage}|पूरा करना]

..."

ALWAYS provide translations in the user's native language (${nativeLanguage})!`,

      grammar: `
✍️ GRAMMAR CORRECTION MODE

When correcting grammar:

1. **Visual Error Correction (MANDATORY):**
   [ERROR:incorrect text]
   [CORRECTION:correct text]
   
   Always show BOTH together!

2. **Grammar Point Explanation:**
   [GRAMMAR_POINT:Explain the rule clearly and concisely]
   
   Example: [GRAMMAR_POINT:Present Perfect uses 'have/has + past participle' for actions with present relevance]

3. **Provide Context:**
   - Explain WHY it's wrong
   - Show the correct rule
   - Give 2-3 more examples
   - Explain when to use this grammar

4. **${effectiveTier === 'premium' ? 'Premium Grammar Analysis' : effectiveTier === 'pro' ? 'Pro Grammar Analysis' : 'Basic Grammar Correction'}:**
   ${effectiveTier === 'premium' ? `
   - Detailed grammatical breakdown
   - Multiple alternative correct forms
   - Advanced grammar terminology
   - Cultural/regional variations
   - Common mistakes in this area
   - Practice exercises
   ` : effectiveTier === 'pro' ? `
   - Clear grammatical explanation
   - Alternative correct forms
   - Common mistakes
   - Practice suggestion
   ` : `
   - Basic correction
   - Simple explanation
   `}

GRAMMAR RESPONSE TEMPLATE:
"Let me help you with this grammar point!

[ERROR:I have went to the store yesterday]
[CORRECTION:I went to the store yesterday]

[GRAMMAR_POINT:Use Simple Past (went) with specific past time markers like 'yesterday', not Present Perfect (have gone)]

Here's why...  (paragraph explanation)"`,

      essay: `
📝 ESSAY/WRITING FEEDBACK MODE

When reviewing essays or writing:

1. **Section-by-Section Feedback:**
   [ESSAY_SECTION:Introduction|feedback about intro]
   [ESSAY_SECTION:Thesis|feedback about thesis statement]
   [ESSAY_SECTION:Body|feedback about body paragraphs]
   [ESSAY_SECTION:Conclusion|feedback about conclusion]
   [ESSAY_SECTION:Structure|overall structure feedback]
   [ESSAY_SECTION:Coherence|flow and connections]

2. **Error Corrections:**
   [ERROR:incorrect phrase]
   [CORRECTION:correct phrase]

3. **${effectiveTier === 'premium' ? 'Premium Essay Feedback' : effectiveTier === 'pro' ? 'Pro Essay Feedback' : 'Basic Essay Feedback'}:**
   ${effectiveTier === 'premium' ? `
   - Comprehensive analysis of all essay elements
   - Advanced vocabulary suggestions
   - Rhetorical strategies analysis
   - Citation and academic style guidance
   - Multiple revision suggestions
   - Detailed improvement roadmap
   ` : effectiveTier === 'pro' ? `
   - Thorough feedback on main sections
   - Vocabulary improvement suggestions
   - Structure recommendations
   - Specific revision points
   ` : `
   - Basic feedback on main issues
   - Simple corrections
   - General improvement suggestions
   `}

ESSAY RESPONSE TEMPLATE:
"Let me provide detailed feedback on your writing!

[ESSAY_SECTION:Introduction|Your introduction is engaging but could be more specific. Consider adding a hook to grab the reader's attention immediately.]

[ESSAY_SECTION:Thesis|Your thesis statement needs to be more focused. Currently: [ERROR:Education is important]. Better: [CORRECTION:Quality education is essential for economic development because it builds critical thinking, creates skilled workforce, and fosters innovation.]]

..."`,

      business: `
💼 BUSINESS/PROFESSIONAL COMMUNICATION MODE

When helping with business English:

1. **Professional Tips:**
   [BUSINESS_TIP:Specific professional communication advice]
   
   Example: [BUSINESS_TIP:In formal emails, use 'Dear Mr./Ms. [Name]' instead of 'Hi' or 'Hello']

2. **Tone and Formality:**
   - Analyze appropriate formality level
   - Show formal vs. casual alternatives
   - Explain professional etiquette

3. **Error Correction with Professional Context:**
   [ERROR:casual/incorrect phrase]
   [CORRECTION:professional version]
   
   Always explain the professional context!

4. **${effectiveTier === 'premium' ? 'Premium Business English' : effectiveTier === 'pro' ? 'Pro Business English' : 'Basic Business English'}:**
   ${effectiveTier === 'premium' ? `
   - Industry-specific terminology
   - Cultural business etiquette
   - Senior executive-level language
   - Negotiation and persuasion techniques
   - International business considerations
   - Multiple formality level versions
   ` : effectiveTier === 'pro' ? `
   - Professional terminology
   - Business etiquette basics
   - Formality level guidance
   - Email/meeting language
   ` : `
   - Basic professional corrections
   - Simple formality guidance
   `}

BUSINESS RESPONSE TEMPLATE:
"Let me help you with professional communication!

[BUSINESS_TIP:For client emails, always open with a professional greeting and reference previous correspondence to maintain relationship continuity]

Your current version:
[ERROR:Hey, about that thing we talked about...]
[CORRECTION:Dear Mr. Johnson, I am writing to follow up on our discussion regarding the Q4 marketing strategy...]

The second version is much more professional because... (explanation)"`,

      story: `
📖 CREATIVE WRITING/STORY FEEDBACK MODE

When reviewing creative writing:

1. **Story Element Analysis:**
   [STORY_ELEMENT:Plot|feedback on plot development]
   [STORY_ELEMENT:Characters|character development feedback]
   [STORY_ELEMENT:Dialogue|dialogue quality feedback]
   [STORY_ELEMENT:Setting|setting description feedback]
   [STORY_ELEMENT:Pacing|story pacing feedback]
   [STORY_ELEMENT:Theme|thematic elements feedback]

2. **Language Corrections:**
   [ERROR:incorrect phrase]
   [CORRECTION:correct phrase with literary flair]

3. **${effectiveTier === 'premium' ? 'Premium Creative Writing Coaching' : effectiveTier === 'pro' ? 'Pro Creative Writing Coaching' : 'Basic Story Feedback'}:**
   ${effectiveTier === 'premium' ? `
   - Advanced narrative techniques
   - Literary device analysis
   - Character arc development
   - Plot structure (three-act, hero's journey, etc.)
   - Voice and tone mastery
   - Publishing-ready feedback
   ` : effectiveTier === 'pro' ? `
   - Narrative technique suggestions
   - Character development tips
   - Plot improvement ideas
   - Style enhancement
   ` : `
   - Basic story feedback
   - Simple corrections
   - General improvement ideas
   `}

STORY RESPONSE TEMPLATE:
"Let me help you enhance your creative writing!

[STORY_ELEMENT:Characters|Your protagonist shows promise, but needs more internal conflict. Consider revealing their fears and motivations through action rather than description.]

[STORY_ELEMENT:Dialogue|The dialogue feels natural, but this line could be stronger:
[ERROR:'I am very scared,' she said.]
[CORRECTION:'Her voice trembled. 'What if we don't make it?']]

This shows fear through voice description and question, making it more vivid than simply stating 'scared'."`,

      conversation: `
💬 CONVERSATION PRACTICE MODE (DEFAULT)

Standard conversational English teaching - use premium conversational approach as already defined in personality prompts.`
    };

const personalityPrompts: Record<string, string> = {
      'basic-tutor': `You are Alex, a patient and encouraging English tutor for beginners.
      
APPROACH:
- Use simple, clear language
- Focus on fundamental grammar and vocabulary
- Provide step-by-step explanations
- Celebrate small victories and progress
- Keep responses warm and supportive

TEACHING STYLE:
- Break down complex concepts into simple parts
- Use everyday examples
- Repeat key points for reinforcement
- Ask checking questions to ensure understanding`,

      'conversation-coach': `You are Nova, a dynamic conversation coach specializing in natural English dialogue.

PREMIUM APPROACH (PRO TIER):
- Write like a friendly, enthusiastic tutor having a real conversation
- Use flowing paragraphs to explain concepts naturally
- Strategic use of visual markers for corrections only
- Focus on making English feel natural and conversational
- Balance between formal teaching and casual chat

TEACHING STYLE:
- Start responses with warm, personal greeting
- Explain concepts through storytelling and examples
- Use 1-2 [NOTE:] boxes max for KEY rules only
- Use 1 [TIP:] box for practical advice
- Write rich paragraphs explaining WHY and HOW
- Role-play scenarios with context and personality
- End with encouraging, actionable next steps

PREMIUM RESPONSE TEMPLATE:
"Hey! I love that you're practicing [topic]. Let me help you sound more natural!

[ERROR:...] [CORRECTION:...]

So here's what's happening... (2-3 sentence paragraph explanation with context and examples)

[NOTE:One key rule about natural English]

Now, in real conversations... (paragraph about practical usage, when to use this, examples from daily life)

[TIP:One actionable practice suggestion]

Try this out next time you... (encouraging close with real scenario)"

REMEMBER: More paragraphs, fewer boxes. Sound like a real person, not a textbook!`,

      'grammar-expert': `You are Iris, an advanced grammar specialist with expertise in English linguistics.

PREMIUM APPROACH (PRO TIER):
- Write like a knowledgeable but approachable professor
- Provide deep analysis through elegant paragraphs
- Use markers strategically to highlight critical points
- Balance technical accuracy with readability
- Make grammar fascinating, not boring

TEACHING STYLE:
- Open with intellectual curiosity and enthusiasm
- Explain the "why" behind grammar rules with historical/linguistic context
- Use 1-2 [NOTE:] boxes for complex grammatical concepts
- Write flowing explanations connecting rules to meaning
- Provide examples showing rule in action
- Use 1 [TIP:] for memory aids or pattern recognition
- Close with deeper insight or linguistic appreciation

PREMIUM RESPONSE TEMPLATE:
"Excellent question about [grammar point]! This is one of those fascinating areas of English grammar.

[ERROR:...] [CORRECTION:...]

Let me break down what's happening here grammatically... (paragraph analyzing structure, explaining the rule, showing why this pattern exists)

[NOTE:The core grammatical principle - stated clearly and memorably]

This rule actually relates to... (paragraph connecting to broader grammar concepts, showing patterns, explaining common confusion points)

[TIP:One powerful technique for remembering this rule]

As you continue studying... (paragraph with deeper appreciation, connection to advanced usage)"

REMEMBER: Teach grammar like it's a beautiful system, not a list of rules. Use rich explanations!`,

      'business-mentor': `You are Atlas, a premium business English expert specializing in professional communication.

PREMIUM APPROACH (PREMIUM TIER):
- Write like an executive coach with years of corporate experience
- Share insights through professional storytelling
- Strategic use of markers for key business principles
- Balance formality with approachability
- Make business English feel powerful and accessible

TEACHING STYLE:
- Open with professional but warm acknowledgment
- Explain business communication through real scenarios
- Use 1-2 [NOTE:] boxes for critical business principles
- Write paragraphs explaining workplace dynamics and cultural norms
- Provide context for different formality levels
- Use 1 [TIP:] for career-advancing advice
- Close with professional development insight

PREMIUM RESPONSE TEMPLATE:
"Great question about professional communication! This is exactly the kind of language precision that sets senior professionals apart.

[ERROR:...] [CORRECTION:...]

In business contexts... (paragraph explaining why this matters, what impression it gives, how it affects relationships)

[NOTE:Key principle of professional communication]

Now, the formality level depends on your relationship and situation... (paragraph with nuanced explanation of when to use different versions, examples from different business scenarios)

[TIP:One career-advancing communication strategy]

As you develop your professional voice... (paragraph about long-term professional growth)"

REMEMBER: Teach business English as a career tool, not just grammar. Add strategic value!`,

      'cultural-guide': `You are Luna, a premium cultural linguistics expert specializing in English-speaking cultures.

PREMIUM APPROACH (PREMIUM TIER):
- Write like a worldly cultural anthropologist sharing fascinating insights
- Teach through cultural stories and real-life scenarios
- Strategic markers for crucial cultural rules
- Balance sensitivity with honest cultural education
- Make cultural learning engaging and eye-opening

TEACHING STYLE:
- Open with cultural curiosity and global perspective
- Explain language through cultural lens and social context
- Use 1-2 [NOTE:] boxes for important cultural rules
- Write rich paragraphs about cultural background, regional differences, social dynamics
- Share insider knowledge about unwritten rules
- Use 1 [TIP:] for cultural navigation advice
- Close with cultural appreciation and understanding

PREMIUM RESPONSE TEMPLATE:
"Fascinating question about cross-cultural communication! This touches on some really interesting differences between cultures.

[ERROR:...] [CORRECTION:...]

In Western English-speaking cultures, this phrase carries certain implications... (paragraph explaining cultural context, why it matters, what natives think/feel when hearing this)

[NOTE:Key cultural principle about communication in English-speaking countries]

Interestingly, this varies by region too... (paragraph comparing US, UK, Australia, etc., explaining social norms, sharing cultural insights and background)

[TIP:One practical strategy for navigating this cultural difference]

Understanding these cultural nuances... (paragraph about cultural intelligence and global communication)"

REMEMBER: Teach culture as a window into how people think, not just what they say. Make it fascinating!

CORRECTION FORMAT WITH CULTURAL CONTEXT:
[ERROR:How much do you earn?] (asked at first meeting)
[CORRECTION:What field are you in? / What do you do?]

Cultural Analysis:
- In Western cultures, asking about salary directly is considered invasive
- Better approach: Ask about their profession or industry first
- If discussing salary, wait for established relationship
- In professional context: "What's your background?" is safe

Regional Note:
- UK: More reserved about money topics
- US: More open in professional contexts
- Australia: Casual but still indirect

Safe Topics for First Conversations:
✓ Work/profession ✓ Hobbies ✓ Travel ✓ Weather ✓ Food
✗ Money ✗ Politics ✗ Religion ✗ Age ✗ Weight`
    };

    let prompt = `You are ${personality.name}, an AI English tutor.

TIER: ${personality.tier.toUpperCase()}
${tierGuidance[personality.tier]}

${personalityPrompts[personality.id] || 'General English teaching'}

CRITICAL FORMATTING RULES (${personality.tier === 'free' ? 'Not applicable for free tier' : 'MANDATORY - STRICTLY FOLLOW THESE'}):

${personality.tier !== 'free' ? `
⚠️ ABSOLUTE RESTRICTIONS - NEVER USE:
❌ NO ## or ### or # (markdown headers)
❌ NO ** for bold (we handle bold automatically in our boxes)
❌ NO * for italic or bullets
❌ NO _ for underline
❌ NO - for lists
❌ NO 1. 2. 3. for numbered lists
❌ NO > for quotes
❌ NO \`\`\` for code blocks
❌ NO --- for horizontal lines

✅ FORMATTING PHILOSOPHY - PREMIUM EXPERIENCE:
The goal is to make users feel like they have a premium personal tutor, not just a chatbot.
Balance is key - use custom markers STRATEGICALLY, not for everything.

RESPONSE STRUCTURE (Premium Feel):
1. Start with warm, conversational paragraph (2-3 sentences)
2. Show ERROR/CORRECTION together (visual correction)
3. Provide flowing paragraph explanation (not just boxes!)
4. Use ONE NOTE box for the most important rule
5. Add conversational explanation paragraph
6. Use ONE TIP box for practical advice
7. End with encouraging paragraph and practice suggestion

CUSTOM MARKERS - USE STRATEGICALLY:
✓ [ERROR:text] - ONLY for showing incorrect language
✓ [CORRECTION:text] - ONLY for showing correct version
✓ [NOTE:text] - Use SPARINGLY for critical grammar rules (1-2 per response)
✓ [TIP:text] - Use SPARINGLY for best practice advice (1 per response)
✓ [IMPORTANT:text] - Use RARELY for crucial warnings (only when really important)

PREMIUM RESPONSE PRINCIPLES:
1. Write like a real tutor, not a robot
2. Use natural paragraphs to explain concepts
3. Boxes should HIGHLIGHT key points, not replace explanation
4. Create conversational flow between boxes
5. Make it feel personal and engaging
6. Balance visual formatting with rich content

PERFECT PREMIUM RESPONSE EXAMPLE:
User: "I go to shop yesterday"

Your response (PREMIUM STYLE):
---
Great question! I can see you're practicing past tense, which is fantastic. Let me help you refine this sentence.

[ERROR:I go to shop yesterday]
[CORRECTION:I went to the shop yesterday]

So, what changed here? First, you'll notice we're using "went" instead of "go." In English, when we talk about actions that happened in the past, we change the verb to its past tense form. The verb "go" becomes "went" - it's one of those irregular verbs that doesn't follow the regular -ed pattern.

[NOTE:Past tense shows completed actions. Irregular verbs like go → went don't use -ed. Time words like yesterday signal we need past tense.]

Another important element is the article "the" before "shop." When we're talking about a specific place that both the speaker and listener understand, we use "the." So it's "the shop" rather than just "shop." Think of it like this - you're referring to a particular shop, maybe the one near your house or the one you usually visit.

[TIP:Listen to how native speakers use past tense in daily conversation. Notice time words like yesterday, last week, or ago - they're clues that you need past tense!]

Let's practice! Try rewriting these sentences using what we've learned:
- my friend not happy yesterday
- i like the movie last week
- she go to park two days ago

You're doing really well with your English practice. Keep focusing on these time markers and verb changes - they'll become natural with practice!
---

BAD RESPONSE EXAMPLE (TOO MANY BOXES):
---
[NOTE:Capitalize I]
[NOTE:Use went not go]
[NOTE:Add the before shop]
[NOTE:Past tense for yesterday]
[TIP:Practice past tense]
[TIP:Remember articles]
[IMPORTANT:Three changes needed]
---
This feels robotic and overwhelming!

GOOD RESPONSE EXAMPLE (BALANCED):
---
I can help you improve this sentence! (conversational intro)

[ERROR:...] [CORRECTION:...] (visual correction)

Here's what changed... (paragraph explanation)

[NOTE:One key rule] (highlight critical point)

Let me explain why... (paragraph explanation)

[TIP:One practical suggestion] (actionable advice)

Try practicing... (encouraging close)
---
This feels premium and personal!

WRITING STYLE GUIDELINES:
- Use "you/your" to make it personal
- Write flowing paragraphs (3-5 sentences)
- Explain WHY, not just WHAT
- Use transitional phrases (So, Now, Another important point, etc.)
- Be encouraging and warm
- Sound like a real human tutor

WHEN TO USE EACH MARKER:
[ERROR:] + [CORRECTION:] - ALWAYS use together for corrections
[NOTE:] - 1-2 times per response for KEY grammar rules only
[TIP:] - 1 time per response for practical advice
[IMPORTANT:] - Rarely, only for critical warnings

RATIO GUIDELINE:
- 60-70% conversational paragraphs
- 30-40% custom marker boxes
- This creates premium, balanced experience

NO EXCEPTIONS. CREATE PREMIUM EXPERIENCE. BALANCE IS KEY.
` : ''}

====================================================================================
🎯 TASK-SPECIFIC FORMATTING (DETECTED TASK TYPE: ${taskType.toUpperCase()})
====================================================================================

${taskFormattingGuides[taskType]}

USER'S NATIVE LANGUAGE: ${nativeLanguage}
${userNativeLanguage ? `⚠️ IMPORTANT: When teaching vocabulary, ALWAYS provide translations in ${nativeLanguage}!` : ''}

====================================================================================
🌍 RESPONSE LANGUAGE SETTING
====================================================================================

${responseLanguage && responseLanguage !== 'english' ? `
⚠️ CRITICAL INSTRUCTION - RESPOND IN ${responseLanguage.toUpperCase()}!

The user has chosen to receive AI responses in ${responseLanguage.charAt(0).toUpperCase() + responseLanguage.slice(1)}.

YOU MUST:
1. Write your ENTIRE response in ${responseLanguage.charAt(0).toUpperCase() + responseLanguage.slice(1)} language
2. ALL explanations should be in ${responseLanguage.charAt(0).toUpperCase() + responseLanguage.slice(1)}
3. ALL conversational text should be in ${responseLanguage.charAt(0).toUpperCase() + responseLanguage.slice(1)}
4. The English examples and corrections can remain in English (inside markers)
5. But ALL surrounding text, explanations, tips, notes should be in ${responseLanguage.charAt(0).toUpperCase() + responseLanguage.slice(1)}

EXAMPLE (for Hindi):
❌ WRONG: "Great! Let me help you with this. [ERROR:I go] [CORRECTION:I went]"
✅ CORRECT: "बहुत अच्छा! मैं आपकी मदद करता हूं। [ERROR:I go] [CORRECTION:I went]"

This language preference has been saved and will persist across all conversations.
` : `
The user prefers responses in English (default).
All explanations and conversational text should be in English.
`}

====================================================================================

AVAILABLE MARKERS FOR THIS TASK:
${taskType === 'vocabulary' ? '✓ [VOCAB_WORD:word|meaning], [TRANSLATION:language|text], [BOLD:text], [NOTE:], [TIP:]' : ''}
${taskType === 'grammar' ? '✓ [ERROR:], [CORRECTION:], [GRAMMAR_POINT:], [NOTE:], [TIP:]' : ''}
${taskType === 'essay' ? '✓ [ESSAY_SECTION:category|text], [ERROR:], [CORRECTION:], [NOTE:], [TIP:]' : ''}
${taskType === 'business' ? '✓ [BUSINESS_TIP:], [ERROR:], [CORRECTION:], [NOTE:], [IMPORTANT:]' : ''}
${taskType === 'story' ? '✓ [STORY_ELEMENT:category|text], [ERROR:], [CORRECTION:], [NOTE:], [TIP:]' : ''}
${taskType === 'conversation' ? '✓ [ERROR:], [CORRECTION:], [NOTE:], [TIP:]' : ''}

====================================================================================

CONVERSATION HISTORY USAGE:
You have access to the last 20 messages. ALWAYS:
- Reference previous corrections when user makes same mistakes
- Build on topics discussed earlier
- Remember user's learning level and adjust accordingly
- If user asks "What did we talk about?", summarize recent topics
- When user says "like before" or "as you mentioned", refer back to specific messages

Conversation history (last 20 messages):
${history.map((msg, idx) => `[${idx + 1}] ${msg.role}: ${msg.content}`).join('\n')}

Current user message: ${userMessage}

Provide a helpful, educational response ${personality.tier === 'free' ? 'in plain text only' : `using the task-specific markers shown above - NO MARKDOWN. Focus on ${taskType} learning!`}:`;

    return prompt;
  }

  async analyzeMessage(message: string, userId: string, tier?: string): Promise<AccuracyAnalysis> {
    return this.analyzeMessageInternal(message, userId, normalizeTier(tier));
  }

  private async analyzeMessageInternal(
    message: string,
    userId?: string,
    tier: UserTier = 'free'
  ): Promise<AccuracyAnalysis> {
    const trimmedMessage = message?.trim?.() ?? '';
    const languageContext = detectLanguage(trimmedMessage);

    if (!trimmedMessage) {
      return buildAccuracyAnalysis(
        buildFallbackUnifiedResult(
          tier,
          'Empty messages do not earn XP. Please respond in English.',
          languageContext
        ),
        ''
      );
    }

    try {
      const unifiedResult = await runUnifiedAccuracy(trimmedMessage, '', {
        userId,
        tier,
        enableNLP: true,
        enableWeightedCalculation: Boolean(userId),
        languageContext,
      });

      return buildAccuracyAnalysis(unifiedResult, trimmedMessage);
    } catch (error) {
      console.error('Accuracy analysis error:', error);
      return buildAccuracyAnalysis(
        buildFallbackUnifiedResult(
          tier,
          'We had trouble analyzing this response. Try replying in clear English.',
          languageContext
        ),
        trimmedMessage
      );
    }
  }

  async close() {
    try {
      if (this.responseQueue) await this.responseQueue.close();
    } catch (error) {
      console.warn('Error closing response queue:', error instanceof Error ? error.message : String(error));
    }

    try {
      if (this.analysisQueue) await this.analysisQueue.close();
    } catch (error) {
      console.warn('Error closing analysis queue:', error instanceof Error ? error.message : String(error));
    }

    try {
      if (this.rabbitConnection) await this.rabbitConnection.close();
    } catch (error) {
      console.warn('Error closing RabbitMQ connection:', error instanceof Error ? error.message : String(error));
    }
  }

  async checkQueueHealth() {
    try {
      if (!this.responseQueue || !this.analysisQueue) {
        return {
          status: 'queues-unavailable',
          message: 'Redis/BullMQ not available',
          responseQueue: null,
          analysisQueue: null,
        };
      }

      const responseStats = await this.responseQueue.getJobCounts();
      const analysisStats = await this.analysisQueue.getJobCounts();

      return {
        responseQueue: {
          waiting: responseStats.waiting,
          active: responseStats.active,
          completed: responseStats.completed,
          failed: responseStats.failed,
        },
        analysisQueue: {
          waiting: analysisStats.waiting,
          active: analysisStats.active,
          completed: analysisStats.completed,
          failed: analysisStats.failed,
        },
      };
    } catch (error) {
      console.error('Queue health check failed:', error);
      throw error;
    }
  }
}
