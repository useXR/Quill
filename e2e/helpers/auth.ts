/**
 * Authentication helpers for E2E tests.
 * Supports magic link authentication flow via Inbucket.
 */
import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import { clearMailbox, waitForEmail, extractMagicLink } from './inbucket';
import { LoginPage } from '../pages/LoginPage';

/**
 * Complete magic link login flow.
 * 1. Clears the mailbox
 * 2. Submits email on login form
 * 3. Waits for magic link email
 * 4. Navigates to magic link
 * 5. Waits for redirect to projects page
 */
export async function loginWithMagicLink(page: Page, email: string): Promise<void> {
  // Clear mailbox to ensure we get a fresh email
  await clearMailbox(email);

  // Go to login page and request magic link
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.requestMagicLinkAndWaitForSuccess(email);

  // Wait for email and extract magic link
  const message = await waitForEmail(email, {
    subject: /magic link|sign in|log in|confirm/i,
    timeout: TIMEOUTS.EMAIL_DELIVERY,
  });

  // Extract magic link (URL rewriting is handled by extractMagicLink)
  const magicLink = extractMagicLink(message);

  // Navigate to magic link (this completes the auth flow)
  await page.goto(magicLink);

  // Wait for redirect to projects page (authenticated area)
  await page.waitForURL('**/projects', { timeout: TIMEOUTS.LOGIN_REDIRECT });
}

/**
 * Log out the current user.
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button in user menu or directly visible
  const userMenu = page.locator('[data-testid="user-menu"]');
  const logoutButton = page.locator('[data-testid="logout-button"]');

  if (await userMenu.isVisible()) {
    await userMenu.click();
  }

  await logoutButton.click();
  await page.waitForURL('**/login', { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Assert the user is logged in by checking for authenticated UI elements.
 */
export async function expectToBeLoggedIn(page: Page): Promise<void> {
  // Check we're on an authenticated page (not login)
  await expect(page).not.toHaveURL(/\/login/);

  // Could also check for user-specific elements when they exist
  // await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

/**
 * Assert the user is logged out.
 */
export async function expectToBeLoggedOut(page: Page): Promise<void> {
  // Should be on login page or redirected there
  await expect(page).toHaveURL(/\/login/);
}

/**
 * Generate a unique email for test isolation.
 * Uses timestamp and random string to ensure uniqueness.
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}@test.local`;
}

/**
 * Check if user is currently authenticated.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Try to access a protected route
  const currentUrl = page.url();
  await page.goto('/projects');

  // If we're redirected to login, user is not authenticated
  const wasRedirected = page.url().includes('/login');

  // Go back to original URL
  if (currentUrl !== page.url()) {
    await page.goto(currentUrl);
  }

  return !wasRedirected;
}
