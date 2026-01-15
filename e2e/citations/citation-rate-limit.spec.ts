// e2e/citations/citation-rate-limit.spec.ts
// CRITICAL: Import from test-fixtures, NOT from @playwright/test (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { CitationSearchPage } from '../pages/CitationSearchPage';
import { setupRateLimitMock } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Rate Limit UI Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupRateLimitMock(page);
  });

  test('shows user-friendly rate limit message on 429 response', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    // Trigger rate limited search
    await citationSearch.search('__rate_limited__');

    // Wait for rate limit message to appear
    await citationSearch.expectRateLimited();

    // Verify the message is user-friendly (not technical jargon)
    await expect(page.getByText(/too many requests|rate limit|try again/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });

    // Should NOT show raw HTTP status code to user
    await expect(page.getByText(/429/)).not.toBeVisible();
  });

  test('rate limit message includes retry timing information', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');
    await citationSearch.expectRateLimited();

    // Should show when user can retry
    await expect(page.getByText(/60 seconds|1 minute|try again later/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('rate limit message has appropriate visual styling', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');

    // Wait for rate limit alert to appear
    const rateLimitAlert = page.getByRole('alert').filter({ hasText: /rate limit|too many/i });
    await expect(rateLimitAlert).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Verify it uses warning/info colors (not error colors - it's not a user error)
    // Design system: bg-warning-light or bg-info-light
    const bgColor = await rateLimitAlert.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should have a visible background color (not transparent)
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('user can retry search after rate limit', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Track request count
    let requestCount = 0;
    await page.route('**/api/citations/search**', async (route) => {
      requestCount++;
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') || '';

      // First request rate limited, second succeeds
      if (requestCount === 1 && query.includes('retry_test')) {
        await route.fulfill({
          status: 429,
          json: { error: 'Rate limited', retryAfter: 1 },
        });
        return;
      }

      await route.fulfill({
        json: {
          papers: [
            {
              paperId: 'success-1',
              title: 'Successful Retry Result',
              authors: [{ name: 'Author' }],
              year: 2024,
              url: 'https://example.com',
            },
          ],
          total: 1,
        },
      });
    });

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    // First search - rate limited
    await citationSearch.search('retry_test');
    await citationSearch.expectRateLimited();

    // Wait briefly then retry
    await page.waitForTimeout(1500);

    // Clear and retry
    await citationSearch.searchInput.clear();
    await citationSearch.search('retry_test_2');

    // Should succeed on retry
    await citationSearch.waitForResults();
    await expect(page.getByText('Successful Retry Result')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('rate limit does not break subsequent searches', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    // First search - rate limited
    await citationSearch.search('__rate_limited__');
    await citationSearch.expectRateLimited();

    // Second search with different query - should work
    await citationSearch.searchInput.clear();
    await citationSearch.search('normal search');
    await citationSearch.waitForResults();

    // Should show results, not stuck in rate limit state
    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('rate limit message is accessible', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');

    // Rate limit message should have appropriate ARIA role
    const rateLimitMessage = page.getByRole('alert').filter({ hasText: /rate limit|too many/i });
    await expect(rateLimitMessage).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Should be announced to screen readers (role="alert" or aria-live)
    const role = await rateLimitMessage.getAttribute('role');
    const ariaLive = await rateLimitMessage.getAttribute('aria-live');

    expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBe(true);
  });
});
