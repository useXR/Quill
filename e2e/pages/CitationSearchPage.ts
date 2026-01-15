// e2e/pages/CitationSearchPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CitationSearchPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly resultsContainer: Locator;
  readonly loadingIndicator: Locator;
  readonly errorAlert: Locator;
  readonly emptyState: Locator;
  readonly rateLimitMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search papers/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.resultsContainer = page.getByTestId('citation-results');
    this.loadingIndicator = page.getByRole('status');
    this.errorAlert = page.getByRole('alert');
    this.emptyState = page.getByText(/no papers found/i);
    this.rateLimitMessage = page.getByText(/rate limit|too many requests|try again/i);
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/citations`);
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  // Use expect().toPass() pattern for async operations (Best Practice: Phase 2)
  async waitForResults() {
    await expect(async () => {
      await expect(this.loadingIndicator).not.toBeVisible();
      await expect(this.resultsContainer).toBeVisible();
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  async getCitationCards() {
    await this.waitForResults();
    return this.resultsContainer.getByTestId('citation-card').all();
  }

  async addCitation(index: number) {
    const cards = await this.getCitationCards();
    await cards[index].getByRole('button', { name: /add/i }).click();
  }

  async expectError() {
    await expect(this.errorAlert).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }

  async expectNoResults() {
    await expect(this.emptyState).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }

  async expectRateLimited() {
    await expect(this.rateLimitMessage).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }
}
