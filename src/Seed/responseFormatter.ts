/**
 * Response Formatter for AI Chat
 * Parses and formats AI responses with visual error/correction highlighting
 * Used by Pro and Premium personalities
 */

export interface FormattedSegment {
  type: 'text' | 'error' | 'correction' | 'explanation';
  content: string;
  originalText?: string; // For corrections, stores the original error
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
export const parseFormattedResponse = (response: string): FormattedResponse => {
  const segments: FormattedSegment[] = [];
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
    const tagType = match[1] as 'error' | 'correction';
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
export const stripFormatting = (response: string): string => {
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
export const toHTML = (response: string): string => {
  return response
    .replace(/<error>(.*?)<\/error>/g, '<span class="ai-error">$1</span>')
    .replace(/<correction>(.*?)<\/correction>/g, '<span class="ai-correction">$1</span>');
};

/**
 * Convert formatted response to Markdown
 * For rendering in Markdown-based interfaces
 */
export const toMarkdown = (response: string): string => {
  return response
    .replace(/<error>(.*?)<\/error>/g, '~~$1~~ ❌')
    .replace(/<correction>(.*?)<\/correction>/g, '**$1** ✅');
};

/**
 * Extract all errors from a response
 */
export const extractErrors = (response: string): string[] => {
  const errors: string[] = [];
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
export const extractCorrections = (response: string): string[] => {
  const corrections: string[] = [];
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
export const countFormattedElements = (response: string): { errors: number; corrections: number } => {
  const errors = (response.match(/<error>/g) || []).length;
  const corrections = (response.match(/<correction>/g) || []).length;

  return { errors, corrections };
};

/**
 * Validate that error and correction tags are properly paired
 */
export const validateFormatting = (response: string): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];

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
