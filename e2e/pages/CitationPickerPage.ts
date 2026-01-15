// e2e/pages/CitationPickerPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CitationPickerPage {
  readonly page: Page;
  readonly triggerButton: Locator;
  readonly dialog: Locator;
  readonly searchInput: Locator;
  readonly citationList: Locator;
  readonly closeButton: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.triggerButton = page.getByRole('button', { name: /add citation/i });
    this.dialog = page.getByRole('dialog');
    this.searchInput = page.getByRole('dialog').getByPlaceholder(/search/i);
    this.citationList = page.getByRole('dialog').getByRole('list');
    this.closeButton = page.getByRole('button', { name: /close/i });
    this.loadingIndicator = page.getByRole('dialog').getByRole('status');
  }

  async open() {
    await this.triggerButton.click();
    await expect(this.dialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  // Use expect().toPass() pattern (Best Practice: Phase 2)
  async waitForSearchResults() {
    await expect(async () => {
      await expect(this.loadingIndicator).not.toBeVisible();
      const items = await this.citationList.getByRole('listitem').count();
      expect(items).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  async selectCitation(index: number) {
    const items = await this.citationList.getByRole('listitem').all();
    await items[index].click();
    // Dialog should close after selection
    await expect(this.dialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async close() {
    await this.closeButton.click();
    await expect(this.dialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }
}
