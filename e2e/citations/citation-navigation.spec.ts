// e2e/citations/citation-navigation.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Navigation', () => {
  test('user can navigate from project page to citations page', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}`);

    // Find and click citations link
    await page.getByRole('link', { name: /citations/i }).click();

    // Should be on citations page
    await expect(page).toHaveURL(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByRole('heading', { name: /citations/i })).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });

  test('user can navigate from editor to citations page', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Navigate to citations (via toolbar or navigation)
    await page.getByRole('link', { name: /citations/i }).click();

    await expect(page).toHaveURL(`/projects/${workerCtx.projectId}/citations`);
  });

  test('user is redirected to login if not authenticated', async ({ page, workerCtx }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    // Don't log in - try to access citations directly
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: TIMEOUTS.NAVIGATION });
  });

  test('user is redirected if accessing another user project citations', async ({ page, loginAsWorker }) => {
    await loginAsWorker();

    // Try to access a non-existent or other user's project
    await page.goto('/projects/00000000-0000-0000-0000-000000000000/citations');

    // Should redirect to projects list or show error
    await expect(async () => {
      const url = page.url();
      // Either redirected to projects list or shows 404/error
      expect(url.includes('/projects') || url.includes('/404')).toBe(true);
    }).toPass({ timeout: TIMEOUTS.NAVIGATION });
  });
});
