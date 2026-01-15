/**
 * Page Object Model for the DiffPanel component.
 * Encapsulates selectors and actions for diff review.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class DiffPanelPage {
  readonly page: Page;

  // Panel elements
  readonly panel: Locator;
  readonly header: Locator;
  readonly progress: Locator;
  readonly changesList: Locator;

  // Buttons
  readonly acceptAllButton: Locator;
  readonly rejectAllButton: Locator;
  readonly closeButton: Locator;
  readonly applyButton: Locator;

  // Change cards
  readonly changeCards: Locator;
  readonly acceptChangeButtons: Locator;
  readonly rejectChangeButtons: Locator;

  // AI Undo
  readonly undoButton: Locator;
  readonly historyToggle: Locator;
  readonly historyPanel: Locator;
  readonly snapshotList: Locator;
  readonly restoreButtons: Locator;

  constructor(page: Page) {
    this.page = page;

    // Panel elements
    this.panel = page.getByTestId('diff-panel');
    this.header = this.panel.locator('h3');
    this.progress = page.getByTestId('diff-progress');
    this.changesList = this.panel.locator('.overflow-y-auto');

    // Buttons
    this.acceptAllButton = page.getByTestId('diff-accept-all');
    this.rejectAllButton = page.getByTestId('diff-reject-all');
    this.closeButton = page.getByTestId('diff-close');
    this.applyButton = page.getByRole('button', { name: /apply/i });

    // Change cards
    this.changeCards = page.getByTestId('diff-change');
    this.acceptChangeButtons = page.getByTestId('accept-change');
    this.rejectChangeButtons = page.getByTestId('reject-change');

    // AI Undo
    this.undoButton = page.getByTestId('ai-undo-button');
    this.historyToggle = page.getByTestId('ai-history-toggle');
    this.historyPanel = page.getByTestId('ai-history-panel');
    this.snapshotList = page.getByTestId('ai-snapshot-list');
    this.restoreButtons = page.getByTestId('restore-snapshot');
  }

  /**
   * Wait for diff panel to be visible.
   */
  async waitForPanelVisible() {
    await expect(this.panel).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }

  /**
   * Wait for diff panel to be hidden.
   */
  async waitForPanelHidden() {
    await expect(this.panel).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Accept all changes.
   */
  async acceptAll() {
    await this.acceptAllButton.click();
  }

  /**
   * Reject all changes.
   */
  async rejectAll() {
    await this.rejectAllButton.click();
  }

  /**
   * Close the panel without applying.
   */
  async close() {
    await this.closeButton.click();
  }

  /**
   * Apply accepted changes.
   */
  async apply() {
    await this.applyButton.click();
  }

  /**
   * Accept a specific change by index.
   */
  async acceptChange(index: number) {
    const button = this.acceptChangeButtons.nth(index);
    await button.click();
  }

  /**
   * Reject a specific change by index.
   */
  async rejectChange(index: number) {
    const button = this.rejectChangeButtons.nth(index);
    await button.click();
  }

  /**
   * Get the number of changes displayed.
   */
  async getChangeCount(): Promise<number> {
    return await this.changeCards.count();
  }

  /**
   * Get progress text.
   */
  async getProgressText(): Promise<string> {
    return (await this.progress.textContent()) || '';
  }

  /**
   * Check if Apply button is visible.
   */
  async isApplyVisible(): Promise<boolean> {
    return await this.applyButton.isVisible();
  }

  /**
   * Click undo button.
   */
  async undo() {
    await this.undoButton.click();
  }

  /**
   * Toggle history panel.
   */
  async toggleHistory() {
    await this.historyToggle.click();
  }

  /**
   * Wait for history panel to be visible.
   */
  async waitForHistoryPanel() {
    await expect(this.historyPanel).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Restore a specific snapshot by index.
   */
  async restoreSnapshot(index: number) {
    const button = this.restoreButtons.nth(index);
    await button.click();
  }

  /**
   * Get the number of snapshots in history.
   */
  async getSnapshotCount(): Promise<number> {
    await this.waitForHistoryPanel();
    return await this.page.getByTestId('ai-snapshot').count();
  }
}
