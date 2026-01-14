/**
 * Constants for AI (Claude CLI) integration.
 *
 * These values avoid magic numbers throughout the AI subsystem.
 */
export const AI = {
  // Timeouts
  DEFAULT_TIMEOUT_MS: 120000,
  HEARTBEAT_INTERVAL_MS: 5000,
  CLI_AUTH_TEST_TIMEOUT_MS: 10000,

  // Limits
  MAX_PROMPT_LENGTH: 50000,
  MAX_CONTEXT_SIZE: 100000,
  MAX_CONTEXT_TOKENS: 8000,

  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,

  // History
  MAX_OPERATION_HISTORY: 50,

  // CLI
  MINIMUM_CLI_VERSION: '1.0.0',

  // Rate limiting (per Phase 1 infrastructure patterns)
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 10,
    MAX_REQUESTS_PER_HOUR: 100,
    WINDOW_MS: 60000, // 1 minute window
  },
} as const;
