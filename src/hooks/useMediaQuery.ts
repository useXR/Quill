'use client';

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Predefined breakpoints matching Tailwind CSS defaults
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Hook to detect if a media query matches.
 * Uses useSyncExternalStore for correct concurrent rendering behavior.
 *
 * @param query - Media query string (e.g., '(min-width: 768px)')
 * @returns Boolean indicating if the query matches
 *
 * @example
 * // Use with raw media query
 * const isLargeScreen = useMediaQuery('(min-width: 1024px)');
 *
 * @example
 * // Use with breakpoint helper
 * const isMobile = useMediaQuery(`(max-width: ${breakpoints.md})`);
 */
export function useMediaQuery(query: string): boolean {
  // Subscribe to media query changes
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {};
      }

      const mediaQueryList = window.matchMedia(query);

      // Modern browsers support addEventListener
      if (mediaQueryList.addEventListener) {
        mediaQueryList.addEventListener('change', callback);
        return () => {
          mediaQueryList.removeEventListener('change', callback);
        };
      }

      // Fallback for older browsers (Safari < 14)
      mediaQueryList.addListener(callback);
      return () => {
        mediaQueryList.removeListener(callback);
      };
    },
    [query]
  );

  // Get current snapshot of media query state
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  // Server snapshot (always false during SSR)
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook to check if viewport is at or above a breakpoint.
 *
 * @param breakpoint - Breakpoint name ('sm', 'md', 'lg', 'xl', '2xl')
 * @returns Boolean indicating if viewport >= breakpoint
 *
 * @example
 * const isDesktop = useBreakpoint('lg');
 * // Returns true when viewport >= 1024px
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${breakpoints[breakpoint]})`);
}

/**
 * Hook to check if viewport is below a breakpoint.
 *
 * @param breakpoint - Breakpoint name ('sm', 'md', 'lg', 'xl', '2xl')
 * @returns Boolean indicating if viewport < breakpoint
 *
 * @example
 * const isMobile = useIsMobile();
 * // Returns true when viewport < 768px (md breakpoint)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: calc(${breakpoints.md} - 1px))`);
}

/**
 * Hook to check if user prefers reduced motion.
 *
 * @returns Boolean indicating if reduced motion is preferred
 *
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 * // Use to disable animations
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
