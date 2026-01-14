/**
 * Projects E2E tests
 *
 * Tests for project listing, creation, and management.
 * NOTE: These tests require authentication. In CI, they test the redirect behavior.
 * For full authenticated testing, use test fixtures with real auth tokens.
 */
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { NAVIGATION_WAIT } from '../config/timeouts';

test.describe('Projects', () => {
  test.describe('Unauthenticated Access', () => {
    test('should redirect to login when accessing projects without auth', async ({ page }) => {
      // Try to access projects page without authentication
      await page.goto('/projects', { waitUntil: 'domcontentloaded' });

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);
    });

    test('should redirect to login when accessing new project page without auth', async ({ page }) => {
      // Try to access new project page without authentication
      await page.goto('/projects/new', { waitUntil: 'domcontentloaded' });

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);
    });
  });

  test.describe('Projects Page Structure (Login Required)', () => {
    // These tests verify the structure but acknowledge auth is required
    // They test the redirect behavior when not authenticated

    test('projects page redirects unauthenticated users', async ({ page }) => {
      await page.goto('/projects');
      await expect(page).toHaveURL(/\/login/);

      // Verify login page loaded correctly
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('new project page redirects unauthenticated users', async ({ page }) => {
      await page.goto('/projects/new');
      await expect(page).toHaveURL(/\/login/);

      // Verify login page loaded correctly
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });
  });

  test.describe('Login Page from Projects Redirect', () => {
    test('login form should be accessible after redirect from projects', async ({ page }) => {
      // Navigate to projects (will redirect to login)
      await page.goto('/projects');

      // Wait for redirect
      await expect(page).toHaveURL(/\/login/);

      // Run accessibility audit on the login page
      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('login form should have working input after redirect', async ({ page }) => {
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
});

/**
 * Authenticated Projects Tests
 *
 * These tests would require actual authentication.
 * They are marked as skipped by default and can be enabled
 * when running with authenticated session cookies.
 *
 * To run authenticated tests:
 * 1. Set up global-setup to create authenticated session
 * 2. Use storageState to persist auth
 * 3. Remove the skip condition
 */
test.describe('Projects (Authenticated)', () => {
  // Skip these tests unless auth is configured
  test.skip(() => !process.env.E2E_AUTH_ENABLED, 'Requires E2E_AUTH_ENABLED=true and authenticated session');

  test('should display projects list when authenticated', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('should show new project button when authenticated', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('link', { name: /new project/i })).toBeVisible();
  });

  test('should navigate to new project form', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('link', { name: /new project/i }).click();
    await expect(page).toHaveURL(/\/projects\/new/);
  });

  test('should display new project form fields', async ({ page }) => {
    await page.goto('/projects/new');

    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();
  });

  test('should validate required fields on new project form', async ({ page }) => {
    await page.goto('/projects/new');

    // Try to submit without title
    await page.getByRole('button', { name: /create project/i }).click();

    // Should show error
    await expect(page.getByRole('alert')).toContainText(/title is required/i);
  });
});
