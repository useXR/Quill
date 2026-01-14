/**
 * Centralized timeout constants for E2E tests.
 * NEVER hardcode timeout values in tests - import from here.
 */
export const TIMEOUTS = {
  // Page-level
  PAGE_LOAD: 60000, // Initial page load (includes build)
  NAVIGATION: 10000, // Between pages

  // Elements
  ELEMENT_VISIBLE: 3000, // Element visibility
  TOAST: 5000, // Toast/notification display
  DIALOG: 5000, // Modal/dialog animations

  // Forms & Input
  HYDRATION: 10000, // React hydration completion
  INPUT_STABLE: 2000, // Form input stabilization
  DEBOUNCE_SEARCH: 300, // Search input debounce

  // API & Auth
  API_CALL: 5000, // API request completion
  AUTH: 5000, // Auth operations
  LOGIN_REDIRECT: 30000, // Login to dashboard redirect

  // Autosave
  AUTOSAVE_DEBOUNCE: 2000, // Autosave debounce delay (matches AUTOSAVE.DEBOUNCE_MS)
  AUTOSAVE_WAIT: 2500, // Wait time for autosave to complete

  // Animations
  ANIMATION: 100, // Short CSS transitions
  ANIMATION_SETTLE: 600, // Longer animations (a11y testing)

  // DOM
  DOM_UPDATE: 100, // DOM update propagation
  POST_FILTER: 200, // Post-filter DOM updates
  SHORT: 2000, // Quick UI updates
} as const;

// Pre-built wait options for common patterns
export const NAVIGATION_WAIT = { timeout: TIMEOUTS.NAVIGATION };
export const VISIBILITY_WAIT = { timeout: TIMEOUTS.ELEMENT_VISIBLE };
export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST };
export const PAGE_LOAD_WAIT = { timeout: TIMEOUTS.PAGE_LOAD };
export const HYDRATION_WAIT = { timeout: TIMEOUTS.HYDRATION };
export const AUTOSAVE_WAIT_OPT = { timeout: TIMEOUTS.AUTOSAVE_WAIT };
