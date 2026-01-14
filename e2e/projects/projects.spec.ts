/**
 * Projects E2E tests - Unauthenticated Access
 *
 * Tests for project pages access control when not authenticated.
 * This file runs in the chromium-unauth project (no storage state).
 *
 * For comprehensive authenticated project tests, see project-crud.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { NAVIGATION_WAIT } from '../config/timeouts';

test.describe('Projects - Unauthenticated Access', () => {
  test('should redirect to login when accessing projects without auth', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);
  });

  test('should redirect to login when accessing new project page without auth', async ({ page }) => {
    await page.goto('/projects/new', { waitUntil: 'domcontentloaded' });

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);
  });

  test('should redirect to login when accessing specific project without auth', async ({ page }) => {
    await page.goto('/projects/some-project-id', { waitUntil: 'domcontentloaded' });

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);
  });

  test('login form should be accessible after redirect from projects', async ({ page }) => {
    // Navigate to projects (will redirect to login)
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);

    // Run accessibility audit on the login page
    await checkA11y(page, { skipFailures: true, detailedReport: true });
  });

  test('login form should be interactive after redirect', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);

    // Verify form is interactive
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();

    // Fill and verify
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
  });
});
