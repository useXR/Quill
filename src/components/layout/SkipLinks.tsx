'use client';

/**
 * Skip links for accessibility - allows keyboard users to bypass navigation
 * and jump directly to main content.
 */
export function SkipLinks() {
  return (
    <div className="sr-only-focusable">
      <a
        href="#main-content"
        className="sr-only sr-only-focusable fixed top-4 left-4 z-[100] bg-quill text-white px-4 py-2 rounded-md font-semibold shadow-warm-lg focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-all duration-150 motion-reduce:transition-none"
        data-testid="skip-to-main"
      >
        Skip to main content
      </a>
      <a
        href="#sidebar-nav"
        className="sr-only sr-only-focusable fixed top-4 left-4 z-[100] bg-quill text-white px-4 py-2 rounded-md font-semibold shadow-warm-lg focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2 transition-all duration-150 motion-reduce:transition-none"
        data-testid="skip-to-nav"
      >
        Skip to navigation
      </a>
    </div>
  );
}
