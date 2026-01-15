/**
 * AI module barrel export.
 *
 * Provides factory for creating AI providers and re-exports streaming utilities.
 */
import { ClaudeCLIProvider } from './claude-cli';
import type { AIProvider } from './types';

/**
 * Factory for creating AI providers.
 *
 * Currently returns ClaudeCLIProvider, but designed to support
 * future Anthropic API migration when ANTHROPIC_API_KEY is available.
 */
export function createAIProvider(): AIProvider {
  // Future: check for ANTHROPIC_API_KEY and return AnthropicAPIProvider
  return new ClaudeCLIProvider();
}

// Re-export streaming for direct use
export { ClaudeStream, streamClaude } from './streaming';
export type { StreamChunk, StreamCallbacks } from './streaming';

// Re-export intent detection
export { detectChatMode, isDestructiveEdit } from './intent-detection';
export type { ChatMode, ModeDetectionResult } from './intent-detection';

// Re-export diff utilities
export { generateDiff, getDiffStats, applyDiffChanges } from './diff-generator';
export type { DiffChange } from './diff-generator';

// Re-export other utilities
export { invokeClaude, cancelClaude, validateClaudeCLI } from './claude-cli';
export { categorizeError } from './errors';
export { sanitizePrompt, sanitizeContext, SanitizationError } from './sanitize';
export { formatContextForPrompt, buildPromptWithContext, estimateTokens } from './context-builder';
export type { AIContext } from './context-builder';

// Re-export types
export type { AIProvider, ClaudeRequest, ClaudeResponse, ClaudeError, CLIStatus } from './types';
