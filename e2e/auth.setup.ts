/**
 * Auth setup - creates authenticated storage state for other tests to reuse.
 *
 * This runs before authenticated test projects and saves the browser state
 * (cookies, localStorage) so tests don't need to log in every time.
 */
import { test as setup, expect } from '@playwright/test';
import { TIMEOUTS } from './config/timeouts';
import { clearMailbox, waitForEmail, extractMagicLink } from './helpers/inbucket';
import { LoginPage } from './pages/LoginPage';
import * as path from 'path';

const authFile = path.join(__dirname, '../.playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Mock rate limit check to allow submission
  await page.route('**/api/auth/check-rate-limit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true }),
    });
  });

  // Generate a unique test email for this auth session
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const testEmail = `auth_${timestamp}_${random}@test.local`;

  console.log(`[Auth Setup] Authenticating with email: ${testEmail}`);

  // Clear any existing emails
  await clearMailbox(testEmail);

  // Go to login page and request magic link
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.requestMagicLink(testEmail);

  // Wait for success message
  await expect(loginPage.successMessage).toContainText(/check your email/i, {
    timeout: TIMEOUTS.API_CALL,
  });

  console.log('[Auth Setup] Magic link requested, waiting for email...');

  // Wait for magic link email
  const message = await waitForEmail(testEmail, {
    timeout: TIMEOUTS.EMAIL_DELIVERY,
  });

  expect(message).toBeDefined();
  console.log(`[Auth Setup] Email received: ${message.subject}`);

  // Extract magic link (URL rewriting is handled by extractMagicLink)
  const magicLink = extractMagicLink(message);

  console.log('[Auth Setup] Navigating to magic link...');
  await page.goto(magicLink);

  // Wait for redirect to projects page (authenticated area)
  await expect(page).toHaveURL(/\/projects/, { timeout: TIMEOUTS.LOGIN_REDIRECT });
  console.log('[Auth Setup] Successfully authenticated!');

  // Verify we're actually logged in
  await expect(page.locator('body')).not.toBeEmpty();

  // Save storage state for other tests to reuse
  await page.context().storageState({ path: authFile });
  console.log(`[Auth Setup] Storage state saved to ${authFile}`);
});
