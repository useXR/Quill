// e2e/pages/CitationEditorPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for citation interactions within the document editor.
 * Encapsulates all citation-related editor operations for consistent test patterns.
 *
 * Usage:
 *   const citationEditor = new CitationEditorPage(page);
 *   await citationEditor.goto(projectId, documentId);
 *   await citationEditor.insertCitation('machine learning');
 *   await citationEditor.hoverCitation(0);
 */
export class CitationEditorPage {
  readonly page: Page;
  readonly editor: Locator;
  readonly citationPickerButton: Locator;
  readonly citationPickerDialog: Locator;
  readonly pickerSearchInput: Locator;
  readonly pickerSearchButton: Locator;
  readonly pickerResults: Locator;
  readonly pickerCloseButton: Locator;
  readonly citationMarks: Locator;
  readonly citationTooltip: Locator;
  readonly rateLimitMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editor = page.locator('[role="textbox"]');
    this.citationPickerButton = page.getByRole('button', { name: /insert citation/i });
    this.citationPickerDialog = page.getByRole('dialog');
    this.pickerSearchInput = page.getByRole('dialog').getByPlaceholder(/search/i);
    this.pickerSearchButton = page.getByRole('dialog').getByRole('button', { name: /search/i });
    this.pickerResults = page.getByRole('dialog').getByTestId('citation-results');
    this.pickerCloseButton = page.getByRole('dialog').getByRole('button', { name: /close/i });
    this.citationMarks = page.locator('cite[data-citation-id]');
    this.citationTooltip = page.getByRole('tooltip');
    this.rateLimitMessage = page.getByText(/rate limit|too many requests|try again/i);
  }

  /**
   * Navigate to the document editor page
   */
  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  }

  /**
   * Open the citation picker modal from the toolbar
   */
  async openCitationPicker() {
    await this.citationPickerButton.click();
    await expect(this.citationPickerDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Search for papers within the citation picker
   */
  async searchInPicker(query: string) {
    await this.pickerSearchInput.fill(query);
    await this.pickerSearchButton.click();
    // Wait for results to load using toPass pattern (Best Practice: Phase 2)
    await expect(async () => {
      const cards = await this.pickerResults.getByTestId('citation-card').count();
      expect(cards).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  /**
   * Select a citation from picker results by index
   */
  async selectCitationFromPicker(index: number) {
    const addButtons = this.pickerResults.getByRole('button', { name: /add/i });
    await addButtons.nth(index).click();
    // Dialog should close after selection
    await expect(this.citationPickerDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Close the citation picker without selecting
   */
  async closeCitationPicker() {
    await this.pickerCloseButton.click();
    await expect(this.citationPickerDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Verify a citation exists in the editor
   */
  async expectCitationInEditor(citationId?: string) {
    if (citationId) {
      await expect(this.page.locator(`cite[data-citation-id="${citationId}"]`)).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    } else {
      await expect(this.citationMarks.first()).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    }
  }

  /**
   * Get count of citations in the editor
   */
  async getCitationCount(): Promise<number> {
    return await this.citationMarks.count();
  }

  /**
   * Hover over a citation to show tooltip
   */
  async hoverCitation(index: number = 0) {
    await this.citationMarks.nth(index).hover();
    await expect(this.citationTooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Click "View Paper" link in citation tooltip
   * Returns the URL that would be opened
   */
  async clickViewPaperLink(): Promise<string> {
    const viewPaperLink = this.citationTooltip.getByRole('link', { name: /view paper/i });
    const href = await viewPaperLink.getAttribute('href');
    // Verify link opens in new tab
    const target = await viewPaperLink.getAttribute('target');
    expect(target).toBe('_blank');
    return href || '';
  }

  /**
   * Complete workflow: open picker, search, select citation
   */
  async insertCitation(searchQuery: string, resultIndex: number = 0) {
    await this.openCitationPicker();
    await this.searchInPicker(searchQuery);
    await this.selectCitationFromPicker(resultIndex);
    await this.expectCitationInEditor();
  }

  /**
   * Expect rate limit message to be visible
   */
  async expectRateLimitMessage() {
    await expect(this.rateLimitMessage).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Wait for editor to be ready (hydrated)
   */
  async waitForEditorReady() {
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    // Wait for form hydration (Best Practice: Phase 1)
    await expect(async () => {
      const hydrated = await this.page.locator('form[data-hydrated="true"]').count();
      expect(hydrated).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.HYDRATION });
  }
}
