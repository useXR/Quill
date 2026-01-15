/**
 * Input sanitization module to prevent CLI injection attacks.
 *
 * This security-critical module ensures user input cannot escape
 * the Claude CLI command boundaries.
 */
import { AI } from '@/lib/constants/ai';

/**
 * Error thrown when input sanitization fails.
 */
export class SanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizationError';
  }
}

/**
 * Sanitize a prompt before sending to Claude CLI.
 *
 * - Removes control characters (except newlines, tabs, carriage returns)
 * - Rejects prompts starting with CLI flags
 * - Enforces length limits
 *
 * @param prompt - The user's prompt string
 * @returns The sanitized prompt
 * @throws SanitizationError if the prompt is invalid
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    throw new SanitizationError('Prompt must be a non-empty string');
  }

  // Remove control characters except newlines (\x0A), tabs (\x09), and carriage returns (\x0D)
  const sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Reject empty prompts (after sanitization and trimming)
  if (!sanitized.trim()) {
    throw new SanitizationError('Prompt must be a non-empty string');
  }

  // Check for CLI flag injection attempts (prompt starts with - or --)
  if (/^-{1,2}\w/.test(sanitized.trim())) {
    throw new SanitizationError('Prompt cannot start with CLI flags');
  }

  // Length validation
  if (sanitized.length > AI.MAX_PROMPT_LENGTH) {
    throw new SanitizationError(`Prompt exceeds maximum length: ${sanitized.length} > ${AI.MAX_PROMPT_LENGTH}`);
  }

  return sanitized;
}

/**
 * Sanitize context before sending to Claude CLI.
 *
 * - Removes control characters
 * - Truncates oversized context with indicator
 *
 * Unlike sanitizePrompt, this function is more lenient:
 * - Empty context is allowed (returns empty string)
 * - Oversized context is truncated rather than rejected
 *
 * @param context - The document context string
 * @returns The sanitized (and possibly truncated) context
 */
export function sanitizeContext(context: string): string {
  if (!context) return '';

  // Remove control characters except newlines, tabs, and carriage returns
  let sanitized = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Length validation with truncation (not rejection)
  if (sanitized.length > AI.MAX_CONTEXT_SIZE) {
    sanitized = sanitized.slice(0, AI.MAX_CONTEXT_SIZE - 50) + '\n\n[Context truncated...]';
  }

  return sanitized;
}
