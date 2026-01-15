import { Spinner } from '@/components/ui/Spinner';

/**
 * Global loading page for Next.js app router.
 * Displayed during route transitions and data loading.
 */
export default function GlobalLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)]"
      data-testid="global-loading-page"
    >
      <Spinner size="lg" label="Loading page" />
      <p className="mt-4 text-[var(--color-ink-secondary)]">Loading...</p>
    </div>
  );
}
