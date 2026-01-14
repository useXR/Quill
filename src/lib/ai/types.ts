/**
 * Core TypeScript type definitions for Claude CLI integration.
 *
 * These types provide the foundation for all AI-related code, ensuring
 * type safety across the entire AI subsystem.
 */

/**
 * Request object for Claude CLI invocations.
 */
export interface ClaudeRequest {
  /** The prompt to send to Claude */
  prompt: string;
  /** Optional context (document content, selection, etc.) */
  context?: string;
  /** Timeout in milliseconds (defaults to AI.DEFAULT_TIMEOUT_MS) */
  timeout?: number;
}

/**
 * Response object from Claude CLI.
 */
export interface ClaudeResponse {
  /** The generated content */
  content: string;
  /** Whether this is a partial response (during streaming) */
  partial?: boolean;
  /** Error information if the request failed */
  error?: ClaudeError;
}

/**
 * Error codes for categorizing CLI failures.
 */
export type ClaudeErrorCode =
  | 'CLI_NOT_FOUND'
  | 'CLI_VERSION_MISMATCH'
  | 'AUTH_FAILURE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'MALFORMED_OUTPUT'
  | 'PROCESS_CRASH'
  | 'CONTEXT_TOO_LONG'
  | 'UNKNOWN';

/**
 * Structured error information for Claude CLI failures.
 */
export interface ClaudeError {
  /** Error category for programmatic handling */
  code: ClaudeErrorCode;
  /** Human-readable error message */
  message: string;
  /** Whether this error can be retried */
  retryable: boolean;
  /** Suggested wait time before retry (for rate limits) */
  retryAfterMs?: number;
  /** Any partial content generated before the error */
  partialContent?: string;
  /** User-facing suggestion for resolution */
  suggestion?: string;
}

/**
 * CLI installation and authentication status.
 */
export interface CLIStatus {
  /** Current status of the CLI */
  status: 'ready' | 'not_installed' | 'outdated' | 'auth_required' | 'error';
  /** Installed version if available */
  version?: string;
  /** Additional status message */
  message?: string;
}

/**
 * Abstract AI provider interface for Claude CLI (or future Anthropic API).
 *
 * This interface enables future migration from CLI to direct API without
 * changing consumer code.
 */
export interface AIProvider {
  /** Generate a complete response */
  generate(request: ClaudeRequest): Promise<ClaudeResponse>;
  /** Stream response chunks */
  stream(request: ClaudeRequest): AsyncIterable<string>;
  /** Cancel any in-progress operation */
  cancel(): void;
  /** Check CLI status */
  getStatus(): Promise<CLIStatus>;
}
