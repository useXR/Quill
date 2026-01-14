import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

export class ProjectSidebarPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly backLink: Locator;
  readonly documentsLink: Locator;
  readonly vaultLink: Locator;
  readonly documentsList: Locator;
  readonly vaultCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('nav[aria-label="Project navigation"]');
    this.backLink = page.getByRole('link', { name: /all projects/i });
    this.documentsLink = page.getByRole('link', { name: /^documents$/i });
    this.vaultLink = page.getByRole('link', { name: /vault/i });
    this.documentsList = page.getByRole('list', { name: /documents/i });
    // Vault count badge is inside the vault link with aria-label like "12 items"
    this.vaultCount = this.vaultLink.locator('[aria-label$="items"]');
  }

  async expectVisible() {
    await expect(this.sidebar).toBeVisible(VISIBILITY_WAIT);
  }

  async navigateToDocuments() {
    await this.documentsLink.click();
    await this.page.waitForURL('**/projects/*', { timeout: TIMEOUTS.NAVIGATION });
  }

  async navigateToVault() {
    await this.vaultLink.click();
    await this.page.waitForURL('**/vault', { timeout: TIMEOUTS.NAVIGATION });
  }

  async navigateToDocument(title: string) {
    // Use exact match within the documents list to avoid matching partial titles
    const docLink = this.documentsList.getByRole('link', { name: title, exact: true });
    await docLink.click();
    await this.page.waitForURL('**/documents/**', { timeout: TIMEOUTS.NAVIGATION });
  }

  async expectDocumentsActive() {
    await expect(this.documentsLink).toHaveAttribute('aria-current', 'page');
  }

  async expectVaultActive() {
    await expect(this.vaultLink).toHaveAttribute('aria-current', 'page');
  }

  async getVaultItemCount(): Promise<number> {
    const text = await this.vaultCount.textContent();
    return text ? parseInt(text, 10) : 0;
  }

  async expectDocumentInList(title: string) {
    const doc = this.documentsList.getByRole('link', { name: title, exact: true });
    await expect(doc).toBeVisible(VISIBILITY_WAIT);
  }
}
