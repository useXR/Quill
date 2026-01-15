import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useBreakpoint, useIsMobile, usePrefersReducedMotion, breakpoints } from '../useMediaQuery';

describe('useMediaQuery', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let mockMediaQueryList: {
    matches: boolean;
    media: string;
    onchange: ((ev: MediaQueryListEvent) => void) | null;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };
  let changeCallback: (() => void) | null = null;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;

    mockMediaQueryList = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') {
          changeCallback = handler as () => void;
        }
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn((handler) => {
        changeCallback = handler;
      }),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        mockMediaQueryList.media = query;
        return mockMediaQueryList;
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    changeCallback = null;
    vi.clearAllMocks();
  });

  describe('useMediaQuery', () => {
    it('should return false when media query does not match', () => {
      mockMediaQueryList.matches = false;
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(false);
    });

    it('should return true when media query matches', () => {
      mockMediaQueryList.matches = true;
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(true);
    });

    it('should update when media query changes', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(result.current).toBe(false);

      // Update the mock and trigger change
      act(() => {
        mockMediaQueryList.matches = true;
        if (changeCallback) {
          changeCallback();
        }
      });

      expect(result.current).toBe(true);
    });

    it('should call addEventListener with correct arguments', () => {
      renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      unmount();

      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should update when query changes', () => {
      const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
        initialProps: { query: '(min-width: 768px)' },
      });

      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');

      rerender({ query: '(min-width: 1024px)' });

      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    });

    it('should use addListener fallback for older browsers', () => {
      // Remove addEventListener to simulate older browser
      mockMediaQueryList.addEventListener = undefined as unknown as ReturnType<typeof vi.fn>;
      mockMediaQueryList.removeEventListener = undefined as unknown as ReturnType<typeof vi.fn>;

      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(mockMediaQueryList.addListener).toHaveBeenCalled();

      unmount();

      expect(mockMediaQueryList.removeListener).toHaveBeenCalled();
    });
  });

  describe('useBreakpoint', () => {
    it('should check if viewport is at or above breakpoint', () => {
      mockMediaQueryList.matches = true;
      const { result } = renderHook(() => useBreakpoint('lg'));

      expect(window.matchMedia).toHaveBeenCalledWith(`(min-width: ${breakpoints.lg})`);
      expect(result.current).toBe(true);
    });

    it('should work with all breakpoints', () => {
      const breakpointKeys: Array<keyof typeof breakpoints> = ['sm', 'md', 'lg', 'xl', '2xl'];

      breakpointKeys.forEach((key) => {
        renderHook(() => useBreakpoint(key));
        expect(window.matchMedia).toHaveBeenCalledWith(`(min-width: ${breakpoints[key]})`);
      });
    });
  });

  describe('useIsMobile', () => {
    it('should return true when viewport is below md breakpoint', () => {
      mockMediaQueryList.matches = true;
      const { result } = renderHook(() => useIsMobile());

      expect(window.matchMedia).toHaveBeenCalledWith(`(max-width: calc(${breakpoints.md} - 1px))`);
      expect(result.current).toBe(true);
    });

    it('should return false when viewport is at or above md breakpoint', () => {
      mockMediaQueryList.matches = false;
      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe('usePrefersReducedMotion', () => {
    it('should check for reduced motion preference', () => {
      mockMediaQueryList.matches = true;
      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(result.current).toBe(true);
    });

    it('should return false when reduced motion is not preferred', () => {
      mockMediaQueryList.matches = false;
      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(false);
    });
  });

  describe('breakpoints', () => {
    it('should export correct breakpoint values', () => {
      expect(breakpoints.sm).toBe('640px');
      expect(breakpoints.md).toBe('768px');
      expect(breakpoints.lg).toBe('1024px');
      expect(breakpoints.xl).toBe('1280px');
      expect(breakpoints['2xl']).toBe('1536px');
    });
  });
});
