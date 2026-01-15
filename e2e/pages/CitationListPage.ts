// e2e/pages/CitationListPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CitationListPage {
  readonly page: Page;
  readonly citationList: Locator;
  readonly emptyState: Locator;
  readonly deleteButtons: Locator;
  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.citationList = page.getByRole('list', { name: /citations/i });
    this.emptyState = page.getByText(/no citations yet/i);
    this.deleteButtons = page.getByRole('button', { name: /delete citation/i });
    // ConfirmDialog component (Best Practice: Phase 4)
    this.confirmDialog = page.getByRole('alertdialog');
    this.confirmDeleteButton = page.getByRole('button', { name: /^delete$/i });
    this.cancelDeleteButton = page.getByRole('button', { name: /cancel/i });
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/citations`);
  }

  async getCitationCount() {
    const items = await this.citationList.getByRole('listitem').all();
    return items.length;
  }

  // Use ConfirmDialog pattern (Best Practice: Phase 4)
  async deleteCitation(index: number) {
    const buttons = await this.deleteButtons.all();
    await buttons[index].click();
    // Wait for ConfirmDialog to appear
    await expect(this.confirmDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await this.confirmDeleteButton.click();
    // Wait for dialog to close
    await expect(this.confirmDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async cancelDelete(index: number) {
    const buttons = await this.deleteButtons.all();
    await buttons[index].click();
    await expect(this.confirmDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await this.cancelDeleteButton.click();
    await expect(this.confirmDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }
}
