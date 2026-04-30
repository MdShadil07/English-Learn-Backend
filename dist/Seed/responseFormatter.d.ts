/**
 * Response Formatter for AI Chat
 * Parses and formats AI responses with visual error/correction highlighting
 * Used by Pro and Premium personalities
 */
export interface FormattedSegment {
    type: 'text' | 'error' | 'correction' | 'explanation';
    content: string;
    originalText?: string;
}
export interface FormattedResponse {
    segments: FormattedSegment[];
    hasFormatting: boolean;
    rawText: string;
}
/**
 * Parse AI response and extract error/correction formatting
 * Supports tags: <error>text</error> and <correction>text</correction>
 */
export declare const parseFormattedResponse: (response: string) => FormattedResponse;
/**
 * Remove formatting tags and return plain text
 * Useful for text-to-speech or plain text display
 */
export declare const stripFormatting: (response: string) => string;
/**
 * Convert formatted response to HTML with styled spans
 * For rendering in web interface
 */
export declare const toHTML: (response: string) => string;
/**
 * Convert formatted response to Markdown
 * For rendering in Markdown-based interfaces
 */
export declare const toMarkdown: (response: string) => string;
/**
 * Extract all errors from a response
 */
export declare const extractErrors: (response: string) => string[];
/**
 * Extract all corrections from a response
 */
export declare const extractCorrections: (response: string) => string[];
/**
 * Count errors and corrections in a response
 */
export declare const countFormattedElements: (response: string) => {
    errors: number;
    corrections: number;
};
/**
 * Validate that error and correction tags are properly paired
 */
export declare const validateFormatting: (response: string) => {
    valid: boolean;
    issues: string[];
};
//# sourceMappingURL=responseFormatter.d.ts.map