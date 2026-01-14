import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import { waitForFormReady } from './hydration';

/**
 * Log in a user via the login form.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await waitForFormReady(page);

  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LOGIN_REDIRECT });
}

/**
 * Log out the current user.
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login', { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Assert the user is logged in.
 */
export async function expectToBeLoggedIn(page: Page) {
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

/**
 * Assert the user is logged out.
 */
export async function expectToBeLoggedOut(page: Page) {
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
}

/**
 * Generate a unique email for test isolation.
 */
export function generateUniqueEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`;
}
