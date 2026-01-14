/**
 * Magic Link Authentication E2E Tests
 *
 * These tests verify the complete magic link authentication flow:
 * 1. User requests magic link via login form
 * 2. Email is delivered to Inbucket
 * 3. User clicks magic link
 * 4. Auth callback processes the token
 * 5. Session cookie is set
 * 6. User is redirected to authenticated area
 *
 * IMPORTANT: These tests require Supabase and Inbucket to be running locally.
 * Run with: pnpm test:e2e:chromium e2e/auth/magic-link.spec.ts
 */
import { test, expect } from '@playwright/test';
import { TIMEOUTS, NAVIGATION_WAIT } from '../config/timeouts';
import { LoginPage } from '../pages/LoginPage';
import { clearMailbox, waitForEmail, extractMagicLink, listMessages } from '../helpers/inbucket';
import { loginWithMagicLink, generateTestEmail, expectToBeLoggedIn } from '../helpers/auth';

test.describe('Magic Link Authentication Flow', () => {
  test.describe('Complete Login Flow', () => {
    test('should complete full magic link login flow', async ({ page }) => {
      const testEmail = generateTestEmail('magiclink');

      // Clear any existing emails
      await clearMailbox(testEmail);

      // Step 1: Go to login page and request magic link
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.requestMagicLink(testEmail);

      // Step 2: Verify success message appears
      await expect(loginPage.successMessage).toContainText(/check your email/i, {
        timeout: TIMEOUTS.API_CALL,
      });

      // Step 3: Wait for email to arrive in Inbucket
      const message = await waitForEmail(testEmail, {
        timeout: TIMEOUTS.EMAIL_DELIVERY,
      });

      expect(message).toBeDefined();
      expect(message.to).toContain(testEmail);

      // Step 4: Extract magic link from email
      const magicLink = extractMagicLink(message);
      expect(magicLink).toContain('token');

      // Step 5: Navigate to magic link
      await page.goto(magicLink);

      // Step 6: Verify redirect to projects page (authenticated area)
      await expect(page).toHaveURL(/\/projects/, { timeout: TIMEOUTS.LOGIN_REDIRECT });

      // Step 7: Verify we're actually logged in by accessing protected content
      await expectToBeLoggedIn(page);
    });

    test('should use loginWithMagicLink helper successfully', async ({ page }) => {
      const testEmail = generateTestEmail('helper');

      // Use the helper function that encapsulates the full flow
      await loginWithMagicLink(page, testEmail);

      // Should be on projects page
      await expect(page).toHaveURL(/\/projects/);
      await expectToBeLoggedIn(page);
    });
  });

  test.describe('Auth Callback Route', () => {
    test('should redirect to login with error when no code provided', async ({ page }) => {
      // Go directly to callback without code
      await page.goto('/auth/callback');

      // Should redirect to login with error
      await expect(page).toHaveURL(/\/login\?error=missing_code/, NAVIGATION_WAIT);
    });

    test('should redirect to login with error for invalid code', async ({ page }) => {
      // Go to callback with invalid code
      await page.goto('/auth/callback?code=invalid-code-12345');

      // Should redirect to login with error
      await expect(page).toHaveURL(/\/login\?error=auth_failed/, NAVIGATION_WAIT);
    });

    test('should preserve next parameter through login flow', async ({ page }) => {
      const testEmail = generateTestEmail('next');
      await clearMailbox(testEmail);

      // Try to access a specific protected page
      await page.goto('/projects/new');

      // Should be redirected to login with next parameter
      await expect(page).toHaveURL(/\/login\?next=/);

      // Now complete the login flow
      const loginPage = new LoginPage(page);
      await loginPage.requestMagicLinkAndWaitForSuccess(testEmail);

      const message = await waitForEmail(testEmail, {
        timeout: TIMEOUTS.EMAIL_DELIVERY,
      });

      const magicLink = extractMagicLink(message);
      await page.goto(magicLink);

      // Should redirect to the original destination (or projects if next validation fails)
      await expect(page).toHaveURL(/\/projects/, { timeout: TIMEOUTS.LOGIN_REDIRECT });
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session after login', async ({ page }) => {
      const testEmail = generateTestEmail('session');

      await loginWithMagicLink(page, testEmail);

      // Navigate to another protected page
      await page.goto('/projects/new');

      // Should not be redirected to login
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('should redirect authenticated users away from login page', async ({ page }) => {
      const testEmail = generateTestEmail('redirect');

      await loginWithMagicLink(page, testEmail);

      // Try to go to login page while authenticated
      await page.goto('/login');

      // Should be redirected to projects
      await expect(page).toHaveURL(/\/projects/, NAVIGATION_WAIT);
    });
  });

  test.describe('Magic Link Token Security', () => {
    test('should not allow reusing magic link', async ({ page }) => {
      const testEmail = generateTestEmail('reuse');
      await clearMailbox(testEmail);

      // Request and use magic link
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.requestMagicLinkAndWaitForSuccess(testEmail);

      const message = await waitForEmail(testEmail, {
        timeout: TIMEOUTS.EMAIL_DELIVERY,
      });

      const magicLink = extractMagicLink(message);

      // First use - should succeed
      await page.goto(magicLink);
      await expect(page).toHaveURL(/\/projects/, { timeout: TIMEOUTS.LOGIN_REDIRECT });

      // Clear cookies to simulate a new session
      await page.context().clearCookies();

      // Second use - should fail
      await page.goto(magicLink);
      await expect(page).toHaveURL(/\/login\?error=/, { timeout: TIMEOUTS.NAVIGATION });
    });
  });

  test.describe('Email Delivery', () => {
    test('should deliver email to Inbucket', async ({ page }) => {
      const testEmail = generateTestEmail('delivery');
      await clearMailbox(testEmail);

      // Request magic link
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.requestMagicLinkAndWaitForSuccess(testEmail);

      // Check that email was delivered
      const message = await waitForEmail(testEmail, {
        timeout: TIMEOUTS.EMAIL_DELIVERY,
      });

      expect(message).toBeDefined();
      expect(message.subject).toBeTruthy();
      expect(message.body.html || message.body.text).toBeTruthy();
    });

    test('should clear mailbox correctly', async ({ page }) => {
      const testEmail = generateTestEmail('clear');

      // Request a magic link first
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.requestMagicLinkAndWaitForSuccess(testEmail);

      // Wait for email
      await waitForEmail(testEmail, { timeout: TIMEOUTS.EMAIL_DELIVERY });

      // Clear mailbox
      await clearMailbox(testEmail);

      // Verify mailbox is empty
      const messages = await listMessages(testEmail);
      expect(messages).toHaveLength(0);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error for invalid email format', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Submit with invalid email
      await loginPage.requestMagicLink('invalid-email');

      // Should show validation error
      await expect(loginPage.errorMessage).toContainText(/valid email/i, {
        timeout: TIMEOUTS.API_CALL,
      });
    });

    test('should display error for empty email', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Submit without email
      await loginPage.submit();

      // Should show validation error
      await expect(loginPage.errorMessage).toContainText(/required/i);
    });
  });
});
