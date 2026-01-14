/**
 * Page Object Model for the login page.
 * Encapsulates selectors and actions for the magic link login form.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import { waitForFormReady } from '../helpers/hydration';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.submitButton = page.locator('[type="submit"]');
    // Use form-specific selector to avoid matching route announcer
    this.errorMessage = page.locator('[data-testid="login-form"] [role="alert"]');
    this.successMessage = page.locator('[data-testid="login-form"] [role="status"]');
  }

  async goto() {
    await this.page.goto('/login');
    await waitForFormReady(this.page);
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * Request a magic link for the given email.
   */
  async requestMagicLink(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }

  /**
   * Request magic link and wait for success message.
   */
  async requestMagicLinkAndWaitForSuccess(email: string) {
    await this.requestMagicLink(email);
    await expect(this.successMessage).toContainText(/check your email/i, {
      timeout: TIMEOUTS.API_CALL,
    });
  }

  async expectError(pattern: string | RegExp) {
    await expect(this.errorMessage).toContainText(pattern);
  }

  async expectSuccess(pattern: string | RegExp) {
    await expect(this.successMessage).toContainText(pattern);
  }

  async expectVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectLoading() {
    await expect(this.submitButton).toContainText(/sending/i);
    await expect(this.submitButton).toBeDisabled();
  }
}
