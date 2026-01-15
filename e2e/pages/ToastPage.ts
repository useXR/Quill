/**
 * Page Object Model for toast notifications.
 * Encapsulates toast interaction and assertion methods.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, TOAST_AUTO_DISMISS_WAIT, VISIBILITY_WAIT } from '../config/timeouts';

export interface ToastInfo {
  id: string;
  message: string;
  title?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export class ToastPage {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId('toast-container');
  }

  /**
   * Get all visible toast elements.
   */
  async getToasts(): Promise<Locator[]> {
    const toasts = this.page.locator('[data-testid^="toast-toast-"]');
    return toasts.all();
  }

  /**
   * Get toast count.
   */
  async getToastCount(): Promise<number> {
    const toasts = await this.getToasts();
    return toasts.length;
  }

  /**
   * Get a specific toast by its ID.
   */
  getToastById(id: string): Locator {
    return this.page.getByTestId(`toast-${id}`);
  }

  /**
   * Get toast by message text.
   */
  getToastByMessage(message: string): Locator {
    return this.page.locator('[data-testid^="toast-toast-"]').filter({
      hasText: message,
    });
  }

  /**
   * Dismiss a toast by clicking its dismiss button.
   */
  async dismissToast(id: string): Promise<void> {
    const dismissButton = this.page.getByTestId(`toast-dismiss-${id}`);
    await dismissButton.click();
  }

  /**
   * Dismiss a toast by its message text.
   */
  async dismissToastByMessage(message: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    const dismissButton = toast.locator('button[aria-label="Dismiss notification"]');
    await dismissButton.click();
  }

  /**
   * Wait for a toast with specific message to appear.
   */
  async waitForToast(message: string): Promise<Locator> {
    const toast = this.getToastByMessage(message);
    await toast.waitFor({ state: 'visible', timeout: TIMEOUTS.TOAST });
    return toast;
  }

  /**
   * Wait for a toast to disappear.
   */
  async waitForToastToDisappear(message: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    await toast.waitFor({ state: 'hidden', ...TOAST_AUTO_DISMISS_WAIT });
  }

  /**
   * Wait for the toast container to appear.
   */
  async waitForContainer(): Promise<void> {
    await this.container.waitFor({ state: 'visible', ...VISIBILITY_WAIT });
  }

  /**
   * Wait for the toast container to disappear.
   */
  async waitForContainerToDisappear(): Promise<void> {
    await this.container.waitFor({ state: 'hidden', ...TOAST_AUTO_DISMISS_WAIT });
  }

  // ==================== Assertions ====================

  /**
   * Assert toast container exists with correct ARIA attributes.
   */
  async expectContainerAccessible(): Promise<void> {
    await expect(this.container).toHaveAttribute('role', 'status');
    await expect(this.container).toHaveAttribute('aria-live', 'polite');
    await expect(this.container).toHaveAttribute('aria-label', 'Notifications');
  }

  /**
   * Assert a toast is visible with the given message.
   */
  async expectToastVisible(message: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    await expect(toast).toBeVisible();
  }

  /**
   * Assert a toast is not visible.
   */
  async expectToastNotVisible(message: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    await expect(toast).not.toBeVisible();
  }

  /**
   * Assert toast has specific title.
   */
  async expectToastTitle(message: string, title: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    await expect(toast).toContainText(title);
  }

  /**
   * Assert toast has correct ARIA role.
   */
  async expectToastAccessible(message: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    await expect(toast).toHaveAttribute('role', 'alert');
  }

  /**
   * Assert toast dismiss button is accessible.
   */
  async expectDismissButtonAccessible(message: string): Promise<void> {
    const toast = this.getToastByMessage(message);
    const dismissButton = toast.locator('button[aria-label="Dismiss notification"]');
    await expect(dismissButton).toBeVisible();
    await expect(dismissButton).toHaveAttribute('type', 'button');
  }

  /**
   * Assert no toasts are visible.
   */
  async expectNoToasts(): Promise<void> {
    await expect(this.container).not.toBeVisible();
  }

  /**
   * Assert toast count.
   */
  async expectToastCount(count: number): Promise<void> {
    const toasts = this.page.locator('[data-testid^="toast-toast-"]');
    await expect(toasts).toHaveCount(count);
  }

  // ==================== Trigger Helpers ====================

  /**
   * Trigger a success toast via JS (for testing).
   * Requires the page to have useToastStore available.
   */
  async triggerSuccessToast(message: string, title?: string): Promise<void> {
    await this.page.evaluate(
      ({ message, title }) => {
        // @ts-expect-error - accessing global store from browser context
        const store = window.__TOAST_STORE__;
        if (store) {
          store.addToast(message, { type: 'success', title });
        }
      },
      { message, title }
    );
  }

  /**
   * Trigger an error toast via JS (for testing).
   */
  async triggerErrorToast(message: string, title?: string): Promise<void> {
    await this.page.evaluate(
      ({ message, title }) => {
        // @ts-expect-error - accessing global store from browser context
        const store = window.__TOAST_STORE__;
        if (store) {
          store.addToast(message, { type: 'error', title });
        }
      },
      { message, title }
    );
  }

  /**
   * Trigger a warning toast via JS (for testing).
   */
  async triggerWarningToast(message: string, title?: string): Promise<void> {
    await this.page.evaluate(
      ({ message, title }) => {
        // @ts-expect-error - accessing global store from browser context
        const store = window.__TOAST_STORE__;
        if (store) {
          store.addToast(message, { type: 'warning', title });
        }
      },
      { message, title }
    );
  }

  /**
   * Trigger an info toast via JS (for testing).
   */
  async triggerInfoToast(message: string, title?: string): Promise<void> {
    await this.page.evaluate(
      ({ message, title }) => {
        // @ts-expect-error - accessing global store from browser context
        const store = window.__TOAST_STORE__;
        if (store) {
          store.addToast(message, { type: 'info', title });
        }
      },
      { message, title }
    );
  }

  /**
   * Clear all toasts via JS.
   */
  async clearAllToasts(): Promise<void> {
    await this.page.evaluate(() => {
      // @ts-expect-error - accessing global store from browser context
      const store = window.__TOAST_STORE__;
      if (store) {
        store.clearToasts();
      }
    });
  }
}
