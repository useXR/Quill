// e2e/citations/citation-search.spec.ts
// CRITICAL: Import from test-fixtures, NOT from @playwright/test (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { CitationSearchPage } from '../pages/CitationSearchPage';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  // Use workerCtx and loginAsWorker from fixtures (Best Practice: Phase 0)
  test('user can search for citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('machine learning');
    await citationSearch.waitForResults();

    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('shows empty state for no results', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__empty__');
    await citationSearch.expectNoResults();
  });

  test('shows error on API failure', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__error__');
    await citationSearch.expectError();
  });

  test('shows rate limit message', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');
    await citationSearch.expectRateLimited();
  });

  test('user can add citation from search results', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('test query');
    await citationSearch.waitForResults();
    await citationSearch.addCitation(0);

    // Button should change to "Added" or similar
    await expect(page.getByRole('button', { name: /added|already/i }).first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('shows verified badge for papers with DOI', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('test');
    await citationSearch.waitForResults();

    await expect(page.getByText(/verified/i).first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('search with Enter key works', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.searchInput.fill('keyboard search');
    await page.keyboard.press('Enter');

    await citationSearch.waitForResults();
    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });
});
