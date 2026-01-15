// e2e/citations/citation-accessibility.spec.ts
// CRITICAL: Import from test-fixtures (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  // Use axe-core for automated a11y testing (Best Practice: Phase 0)
  test('citation search page passes accessibility audit', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Run axe-core accessibility check
    await checkA11y(page);
  });

  test('citation search results pass accessibility audit', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Trigger search to load results
    await page.getByPlaceholder(/search papers/i).fill('test');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="citation-card"]', { timeout: TIMEOUTS.API_CALL });

    // Run axe-core on page with results
    await checkA11y(page);
  });

  test('search input is focusable via keyboard', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    await page.keyboard.press('Tab');
    const searchInput = page.getByPlaceholder(/search papers/i);
    await expect(searchInput).toBeFocused();
  });

  test('error alerts have proper role', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    await page.getByPlaceholder(/search/i).fill('__error__');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('alert')).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  });

  test('buttons have accessible names', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    const searchButton = page.getByRole('button', { name: /search/i });
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toBeEnabled();
  });

  test('citation cards are keyboard navigable', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    await page.getByPlaceholder(/search/i).fill('test');
    await page.keyboard.press('Enter');

    // Wait for results using toPass pattern (Best Practice: Phase 2)
    await expect(async () => {
      const cards = await page.getByTestId('citation-card').count();
      expect(cards).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });

    // Tab to first interactive element in results
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to activate with Enter
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(['button', 'a']).toContain(focusedElement);
  });

  test('loading state is announced to screen readers', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock slow response
    await page.route('**/api/citations/search**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: { papers: [], total: 0 } });
    });

    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await page.getByPlaceholder(/search/i).fill('slow query');
    await page.keyboard.press('Enter');

    // Loading indicator should have status role for screen reader announcement
    await expect(page.getByRole('status')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });
});
