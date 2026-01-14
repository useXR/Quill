/**
 * Page Object Model for the Knowledge Vault page.
 * Encapsulates selectors and actions for vault file management and search.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class VaultPage {
  readonly page: Page;
  readonly uploadZone: Locator;
  readonly fileInput: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly searchResults: Locator;
  readonly emptyState: Locator;
  readonly noResultsMessage: Locator;
  readonly errorAlert: Locator;
  readonly pageTitle: Locator;
  readonly filesSection: Locator;
  readonly searchSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.uploadZone = page.locator('[data-testid="vault-upload-zone"]');
    this.fileInput = page.locator('[data-testid="vault-file-input"]');
    this.searchInput = page.locator('input[placeholder="Search your vault..."]');
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.searchResults = page.locator('[role="list"][aria-label="Search results"]');
    this.emptyState = page.locator('text=No files uploaded yet');
    this.noResultsMessage = page.locator('text=No results found');
    this.errorAlert = page.locator('[role="alert"]');
    this.pageTitle = page.getByRole('heading', { name: /knowledge vault/i, level: 1 });
    this.filesSection = page.locator('section[aria-labelledby="files-heading"]');
    this.searchSection = page.locator('section[aria-labelledby="search-heading"]');
  }

  /**
   * Navigate to the vault page for a specific project.
   */
  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/vault`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Upload a file to the vault using the file input.
   */
  async uploadFile(filePath: string) {
    // Use setInputFiles on the hidden file input
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Perform a search query.
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  /**
   * Get a vault item card by filename.
   */
  getItemCard(filename: string): Locator {
    return this.page
      .locator(`text="${filename}"`)
      .locator('xpath=ancestor::div[contains(@class, "flex items-center justify-between")]');
  }

  /**
   * Get the delete button for a specific file.
   */
  getDeleteButton(filename: string): Locator {
    return this.getItemCard(filename).locator('button[aria-label="Delete item"]');
  }

  /**
   * Delete a file from the vault.
   */
  async deleteFile(filename: string) {
    const deleteButton = this.getDeleteButton(filename);
    await deleteButton.click();
  }

  /**
   * Get the retry button for a specific file.
   */
  getRetryButton(filename: string): Locator {
    return this.getItemCard(filename).locator('button[aria-label="Retry extraction"]');
  }

  /**
   * Retry extraction for a failed file.
   */
  async retryExtraction(filename: string) {
    const retryButton = this.getRetryButton(filename);
    await retryButton.click();
  }

  /**
   * Get the extraction status for a specific file.
   */
  getFileStatus(filename: string): Locator {
    return this.getItemCard(filename)
      .locator('span')
      .filter({ hasText: /pending|downloading|extracting|chunking|embedding|success|failed|partial/i });
  }

  /**
   * Get a search result by index (0-based).
   */
  getSearchResult(index: number): Locator {
    return this.searchResults.locator('[role="listitem"]').nth(index);
  }

  /**
   * Get the similarity percentage from a search result.
   */
  getSearchResultSimilarity(index: number): Locator {
    return this.getSearchResult(index).locator('span').filter({ hasText: /%$/ });
  }

  /**
   * Get the filename from a search result.
   */
  getSearchResultFilename(index: number): Locator {
    return this.getSearchResult(index).locator('.truncate');
  }

  /**
   * Assert that a file is visible in the vault.
   */
  async expectFileVisible(filename: string) {
    await expect(this.page.locator(`text="${filename}"`).first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  /**
   * Assert that a file is not visible in the vault.
   */
  async expectFileNotVisible(filename: string) {
    await expect(this.page.locator(`text="${filename}"`)).not.toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  /**
   * Assert the number of search results displayed.
   */
  async expectSearchResultCount(count: number) {
    if (count === 0) {
      await expect(this.noResultsMessage).toBeVisible({
        timeout: TIMEOUTS.API_CALL,
      });
    } else {
      await expect(this.searchResults.locator('[role="listitem"]')).toHaveCount(count, {
        timeout: TIMEOUTS.API_CALL,
      });
    }
  }

  /**
   * Assert the upload zone is visible and ready.
   */
  async expectUploadZoneVisible() {
    await expect(this.uploadZone).toBeVisible();
    await expect(this.uploadZone).toHaveAttribute('aria-label', 'Upload files to vault');
  }

  /**
   * Assert the page is in empty state.
   */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Assert an error message is displayed.
   */
  async expectError(pattern: string | RegExp) {
    await expect(this.errorAlert).toContainText(pattern, {
      timeout: TIMEOUTS.TOAST,
    });
  }

  /**
   * Assert the page structure is correct.
   */
  async expectPageStructure() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.uploadZone).toBeVisible();
    await expect(this.searchSection).toBeVisible();
    await expect(this.filesSection).toBeVisible();
  }

  /**
   * Wait for file upload to complete (status changes from uploading).
   */
  async waitForUploadComplete() {
    // Wait for the uploading spinner to disappear
    await expect(this.uploadZone.locator('text=Uploading...')).not.toBeVisible({
      timeout: TIMEOUTS.API_CALL,
    });
  }

  /**
   * Wait for extraction to complete for a file.
   */
  async waitForExtractionComplete(filename: string) {
    // Wait for status to change to success, failed, or partial
    await expect(async () => {
      const statusText = await this.getFileStatus(filename).textContent();
      expect(['success', 'failed', 'partial']).toContain(statusText?.toLowerCase());
    }).toPass({
      timeout: TIMEOUTS.API_CALL * 2,
      intervals: [500, 1000, 2000],
    });
  }
}
