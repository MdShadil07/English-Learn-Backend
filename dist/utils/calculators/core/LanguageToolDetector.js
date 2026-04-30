import axios from 'axios';
import qs from 'qs';
import { nlpLogger } from './logger.js';
import { NLP_TIMEOUTS } from './constants.js';
const CRITICAL_RULE_PATTERNS = [
    /\bsubject[-_\s]?verb\b/, // subject-verb agreement
    /\bverb[-_\s]?agreement\b/,
    /\bsva\b/,
    /\bauxili(?:ary|aries)\b/,
    /\bmissing[-_\s]?aux\b/,
    /\bmodal\b.*\bbase\b/,
];
const MAJOR_RULE_PATTERNS = [
    /\bverb[-_\s]?form\b/,
    /\bwrong[-_\s]?tense\b/,
    /\bverb\b.*\btense\b/,
    /\btense(s|d)?\b/,
    /\bmodal[-_\s]?verb\b/,
];
const HIGH_RULE_PATTERNS = [
    /\bpronoun\b/,
    /\bpreposition\b/,
];
const CRITICAL_CONTEXT_PATTERNS = [
    /\b(?:i|he|she|they|we)\s+goes\b/,
    /\bi\s+not\s+\w+/,
    /\bshould\s+went\b/,
    /\bwe\s+was\s+\w+/,
];
export class LanguageToolDetector {
    name = 'LanguageTool';
    priority = 1;
    baseURL;
    cache;
    circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
    };
    CIRCUIT_BREAKER_THRESHOLD = 5;
    CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
    constructor(baseURL = process.env.LANGUAGETOOL_URL || 'http://localhost:8081/v2', cache) {
        // ✅ Remove accidental /check suffix and trailing slashes
        this.baseURL = baseURL.replace(/\/check\/?$/, '').replace(/\/+$/, '');
        this.cache = cache;
        nlpLogger.info({ baseURL: this.baseURL }, 'LanguageTool detector initialized');
    }
    async detect(text, config) {
        const cacheKey = `lt:${Buffer.from(text).toString('base64').slice(0, 50)}`;
        // 🔹 Step 1: Check cache
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            nlpLogger.debug({ cacheKey }, 'LanguageTool cache hit');
            return cached;
        }
        // 🔹 Step 2: Check circuit breaker
        if (this.circuitBreaker.isOpen) {
            const now = Date.now();
            if (now < this.circuitBreaker.nextAttemptTime) {
                nlpLogger.warn('LanguageTool circuit breaker is open, skipping API call');
                return [];
            }
            else {
                // Attempt to reset circuit breaker
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failureCount = 0;
                nlpLogger.info('LanguageTool circuit breaker reset, attempting API call');
            }
        }
        const startTime = Date.now();
        try {
            // ✅ LanguageTool requires URL-encoded form data
            const formData = qs.stringify({
                text,
                language: config?.language || 'en-US',
                enabledOnly: false,
            });
            const response = await axios.post(`${this.baseURL}/check`, formData, {
                timeout: NLP_TIMEOUTS.LANGUAGETOOL || 5000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const matches = response.data.matches || [];
            const errors = matches.map(match => this.convertToErrorDetail(match));
            // 🔹 Cache results for 1 hour
            await this.cache.set(cacheKey, errors, 3600);
            // Reset circuit breaker on success
            this.circuitBreaker.failureCount = 0;
            this.circuitBreaker.isOpen = false;
            const duration = Date.now() - startTime;
            nlpLogger.info({ errorCount: errors.length, duration }, 'LanguageTool detection complete');
            return errors;
        }
        catch (error) {
            // Update circuit breaker state
            this.circuitBreaker.failureCount++;
            this.circuitBreaker.lastFailureTime = Date.now();
            if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
                this.circuitBreaker.isOpen = true;
                this.circuitBreaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
                nlpLogger.error({ failureCount: this.circuitBreaker.failureCount, nextAttemptIn: this.CIRCUIT_BREAKER_TIMEOUT }, 'LanguageTool circuit breaker opened');
            }
            // ✅ Clean logging of errors
            const url = `${this.baseURL}/check`;
            nlpLogger.error({ url, message: error.message, code: error.code, status: error.response?.status, failureCount: this.circuitBreaker.failureCount }, 'LanguageTool API error');
            return [];
        }
    }
    async isAvailable() {
        try {
            const res = await axios.get(`${this.baseURL}/languages`, { timeout: 2000 });
            return Array.isArray(res.data);
        }
        catch {
            return false;
        }
    }
    getConfidence() {
        return 0.9; // High confidence in LanguageTool
    }
    convertToErrorDetail(match) {
        return {
            // Preserve the raw LanguageTool category id so callers can make category-aware decisions
            type: this.mapCategoryToType(match.rule.category.id),
            // Preserve the raw LanguageTool category id; cast to ErrorCategory for typing compatibility
            category: match.rule.category?.id || 'correctness',
            message: match.shortMessage || match.message,
            explanation: match.message,
            position: {
                start: match.offset,
                end: match.offset + match.length,
                word: match.context.text.slice(match.context.offset, match.context.offset + match.context.length),
                context: match.context.text,
            },
            severity: this.mapIssueSeverity(match.rule.issueType, match.rule.id, match.rule.category?.id, match.message, match.context?.text),
            suggestion: match.replacements[0]?.value || '',
            alternatives: match.replacements.slice(1, 4).map(r => r.value),
            rule: match.rule.id,
            examples: [],
            confidence: 0.9,
            source: 'languagetool',
        };
    }
    mapCategoryToType(categoryId) {
        const mapping = {
            GRAMMAR: 'grammar',
            TYPOS: 'spelling',
            CASING: 'capitalization',
            PUNCTUATION: 'punctuation',
            STYLE: 'style',
            SEMANTICS: 'semantic',
        };
        return mapping[categoryId] || 'grammar';
    }
    mapIssueSeverity(issueType, ruleId, categoryId, message, contextText) {
        const normalizedIssue = (issueType || '').toLowerCase();
        const normalizedRule = (ruleId || '').toLowerCase();
        const normalizedCategory = (categoryId || '').toLowerCase();
        const normalizedMessage = (message || '').toLowerCase();
        const normalizedContext = (contextText || '').toLowerCase();
        const targets = [normalizedRule, normalizedCategory, normalizedMessage].map((value) => value.replace(/[_-]+/g, ' '));
        const matchesPattern = (patterns, additionalTarget) => {
            const allTargets = additionalTarget ? [...targets, additionalTarget] : targets;
            return allTargets.some((target) => target && patterns.some((pattern) => pattern.test(target)));
        };
        if (matchesPattern(CRITICAL_RULE_PATTERNS, normalizedContext)) {
            return 'critical';
        }
        if (matchesPattern(MAJOR_RULE_PATTERNS, normalizedContext)) {
            return 'major';
        }
        if (matchesPattern(HIGH_RULE_PATTERNS)) {
            return 'high';
        }
        if (normalizedContext && CRITICAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalizedContext))) {
            return 'critical';
        }
        switch (normalizedIssue) {
            case 'misspelling':
                return 'high';
            case 'grammar':
                return normalizedRule ? 'high' : 'medium';
            case 'punctuation':
                return 'medium';
            case 'inconsistency':
            case 'wordchoice':
            case 'confused':
                return 'low';
            case 'style':
            case 'typographical':
            case 'duplication':
                return 'suggestion';
            case 'uncategorized':
                return 'medium';
            default:
                return 'medium';
        }
    }
}
//# sourceMappingURL=LanguageToolDetector.js.map