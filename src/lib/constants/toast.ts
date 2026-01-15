/**
 * Toast notification configuration constants.
 */
export const TOAST = {
  /** Default timeout for success/info/warning toasts (5 seconds) */
  DEFAULT_TIMEOUT_MS: 5000,
  /** Extended timeout for error toasts (10 seconds, per WCAG 2.2.1) */
  ERROR_TIMEOUT_MS: 10000,
  /** Maximum number of visible toasts at once */
  MAX_VISIBLE: 5,
} as const;
