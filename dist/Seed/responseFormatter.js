/**
 * Response Formatter for AI Chat
 * Parses and formats AI responses with visual error/correction highlighting
 * Used by Pro and Premium personalities
 */
/**
 * Parse AI response and extract error/correction formatting
 * Supports tags: <error>text</error> and <correction>text</correction>
 */
export const parseFormattedResponse = (response) => {
    const segments = [];
    let hasFormatting = false;
    // Regular expressions for parsing tags
    const errorRegex = /<error>(.*?)<\/error>/g;
    const correctionRegex = /<correction>(.*?)<\/correction>/g;
    let lastIndex = 0;
    let match;
    // Create a combined pattern to match both error and correction tags in order
    const combinedRegex = /<(error|correction)>(.*?)<\/(error|correction)>/g;
    while ((match = combinedRegex.exec(response)) !== null) {
        hasFormatting = true;
        // Add text before the tag as regular text
        if (match.index > lastIndex) {
            const textBefore = response.substring(lastIndex, match.index);
            if (textBefore.trim()) {
                segments.push({
                    type: 'text',
                    content: textBefore
                });
            }
        }
        // Add the tagged content
        const tagType = match[1];
        const content = match[2];
        segments.push({
            type: tagType,
            content: content
        });
        lastIndex = match.index + match[0].length;
    }
    // Add remaining text after last tag
    if (lastIndex < response.length) {
        const textAfter = response.substring(lastIndex);
        if (textAfter.trim()) {
            segments.push({
                type: 'text',
                content: textAfter
            });
        }
    }
    // If no formatting was found, treat entire response as text
    if (!hasFormatting) {
        segments.push({
            type: 'text',
            content: response
        });
    }
    return {
        segments,
        hasFormatting,
        rawText: response
    };
};
/**
 * Remove formatting tags and return plain text
 * Useful for text-to-speech or plain text display
 */
export const stripFormatting = (response) => {
    return response
        .replace(/<error>/g, '')
        .replace(/<\/error>/g, '')
        .replace(/<correction>/g, '')
        .replace(/<\/correction>/g, '');
};
/**
 * Convert formatted response to HTML with styled spans
 * For rendering in web interface
 */
export const toHTML = (response) => {
    return response
        .replace(/<error>(.*?)<\/error>/g, '<span class="ai-error">$1</span>')
        .replace(/<correction>(.*?)<\/correction>/g, '<span class="ai-correction">$1</span>');
};
/**
 * Convert formatted response to Markdown
 * For rendering in Markdown-based interfaces
 */
export const toMarkdown = (response) => {
    return response
        .replace(/<error>(.*?)<\/error>/g, '~~$1~~ ❌')
        .replace(/<correction>(.*?)<\/correction>/g, '**$1** ✅');
};
/**
 * Extract all errors from a response
 */
export const extractErrors = (response) => {
    const errors = [];
    const errorRegex = /<error>(.*?)<\/error>/g;
    let match;
    while ((match = errorRegex.exec(response)) !== null) {
        errors.push(match[1]);
    }
    return errors;
};
/**
 * Extract all corrections from a response
 */
export const extractCorrections = (response) => {
    const corrections = [];
    const correctionRegex = /<correction>(.*?)<\/correction>/g;
    let match;
    while ((match = correctionRegex.exec(response)) !== null) {
        corrections.push(match[1]);
    }
    return corrections;
};
/**
 * Count errors and corrections in a response
 */
export const countFormattedElements = (response) => {
    const errors = (response.match(/<error>/g) || []).length;
    const corrections = (response.match(/<correction>/g) || []).length;
    return { errors, corrections };
};
/**
 * Validate that error and correction tags are properly paired
 */
export const validateFormatting = (response) => {
    const issues = [];
    // Check for unclosed error tags
    const openErrors = (response.match(/<error>/g) || []).length;
    const closeErrors = (response.match(/<\/error>/g) || []).length;
    if (openErrors !== closeErrors) {
        issues.push(`Mismatched error tags: ${openErrors} opening, ${closeErrors} closing`);
    }
    // Check for unclosed correction tags
    const openCorrections = (response.match(/<correction>/g) || []).length;
    const closeCorrections = (response.match(/<\/correction>/g) || []).length;
    if (openCorrections !== closeCorrections) {
        issues.push(`Mismatched correction tags: ${openCorrections} opening, ${closeCorrections} closing`);
    }
    // Check for nested tags
    if (/<error>.*<error>/.test(response) || /<correction>.*<correction>/.test(response)) {
        issues.push('Nested tags detected');
    }
    return {
        valid: issues.length === 0,
        issues
    };
};
//# sourceMappingURL=responseFormatter.js.map