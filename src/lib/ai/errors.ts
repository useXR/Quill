/**
 * Error categorization module for Claude CLI integration.
 *
 * Classifies CLI errors into actionable error codes, enabling intelligent
 * retry logic and user-friendly error messages.
 */
import type { ClaudeError, ClaudeErrorCode } from './types';

interface ErrorPattern {
  pattern: RegExp;
  code: ClaudeErrorCode;
  retryable: boolean;
  suggestion?: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /authentication failed|please.*login/i,
    code: 'AUTH_FAILURE',
    retryable: false,
    suggestion: 'Run "claude login" in your terminal to authenticate.',
  },
  {
    pattern: /rate limit|too many requests/i,
    code: 'RATE_LIMITED',
    retryable: true,
    suggestion: 'Please wait a moment before trying again.',
  },
  {
    pattern: /timeout|timed out/i,
    code: 'TIMEOUT',
    retryable: true,
    suggestion: 'Try a shorter prompt or simpler request.',
  },
  {
    pattern: /ENOENT|not found|command not found/i,
    code: 'CLI_NOT_FOUND',
    retryable: false,
    suggestion: 'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
  },
  {
    pattern: /context.*too.*long|token limit/i,
    code: 'CONTEXT_TOO_LONG',
    retryable: false,
    suggestion: 'Reduce the amount of context or document length.',
  },
  {
    pattern: /malformed|invalid json|parse error/i,
    code: 'MALFORMED_OUTPUT',
    retryable: true,
    suggestion: 'The response was corrupted. Please try again.',
  },
  {
    pattern: /crash|sigsegv|sigkill/i,
    code: 'PROCESS_CRASH',
    retryable: true,
    suggestion: 'The AI process crashed unexpectedly. Please try again.',
  },
];

/**
 * Extract retry delay from error message (e.g., "wait 60 seconds").
 */
function extractRetryAfter(message: string): number {
  const match = message.match(/(\d+)\s*seconds?/i);
  return match ? parseInt(match[1], 10) * 1000 : 60000; // Default to 60s
}

/**
 * Categorize an error message or Error object into a structured ClaudeError.
 *
 * @param error - The error message string or Error object
 * @param partialContent - Any partial content generated before the error
 * @returns A structured ClaudeError with code, message, and retry info
 */
export function categorizeError(error: string | Error, partialContent?: string): ClaudeError {
  const message = typeof error === 'string' ? error : error.message;

  for (const { pattern, code, retryable, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        code,
        message,
        retryable,
        suggestion,
        partialContent,
        retryAfterMs: code === 'RATE_LIMITED' ? extractRetryAfter(message) : undefined,
      };
    }
  }

  return {
    code: 'UNKNOWN',
    message,
    retryable: false,
    partialContent,
  };
}

/**
 * Check if an error can be retried.
 *
 * @param error - The ClaudeError to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: ClaudeError): boolean {
  return error.retryable;
}
