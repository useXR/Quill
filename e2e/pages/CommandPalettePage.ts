/**
 * Page Object Model for Command Palette.
 * Encapsulates selectors and actions for command palette testing.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CommandPalettePage {
  readonly page: Page;

  // Command Palette
  readonly commandPalette: Locator;
  readonly backdrop: Locator;
  readonly input: Locator;
  readonly list: Locator;
  readonly emptyState: Locator;

  // Navigation Items
  readonly projectsItem: Locator;
  readonly vaultItem: Locator;
  readonly citationsItem: Locator;

  // Actions Items
  readonly newProjectItem: Locator;

  constructor(page: Page) {
    this.page = page;

    // Command Palette elements
    this.commandPalette = page.getByTestId('command-palette');
    this.backdrop = page.getByTestId('command-palette-backdrop');
    this.input = page.getByTestId('command-palette-input');
    this.list = page.getByTestId('command-palette-list');
    this.emptyState = page.getByText('No results found.');

    // Navigation items
    this.projectsItem = page.getByTestId('command-item-projects');
    this.vaultItem = page.getByTestId('command-item-vault');
    this.citationsItem = page.getByTestId('command-item-citations');

    // Actions items
    this.newProjectItem = page.getByTestId('command-item-new-project');
  }

  /**
   * Navigate to a page that includes the command palette.
   */
  async goto(path: string = '/projects') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Open command palette with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
   */
  async open() {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+k`);
    await expect(this.commandPalette).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Close command palette with Escape key.
   */
  async closeWithEscape() {
    await this.page.keyboard.press('Escape');
    await expect(this.commandPalette).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Close command palette by clicking backdrop.
   */
  async closeWithBackdropClick() {
    // Click in the top-left corner of the backdrop (outside the dialog)
    await this.backdrop.click({ position: { x: 10, y: 10 } });
    await expect(this.commandPalette).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Toggle command palette closed with second Cmd+K / Ctrl+K.
   */
  async toggleClose() {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+k`);
    await expect(this.commandPalette).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Search for a command.
   */
  async search(query: string) {
    await this.input.fill(query);
  }

  /**
   * Clear search input.
   */
  async clearSearch() {
    await this.input.clear();
  }

  /**
   * Select an item by clicking it.
   */
  async selectItem(item: 'projects' | 'vault' | 'citations' | 'new-project') {
    const items = {
      projects: this.projectsItem,
      vault: this.vaultItem,
      citations: this.citationsItem,
      'new-project': this.newProjectItem,
    };
    await items[item].click();
  }

  /**
   * Select an item using keyboard navigation.
   */
  async selectItemWithKeyboard(item: 'projects' | 'vault' | 'citations' | 'new-project') {
    // Navigate to the item using arrow keys, then press Enter
    const itemOrder = ['projects', 'vault', 'citations', 'new-project'];
    const targetIndex = itemOrder.indexOf(item);

    for (let i = 0; i <= targetIndex; i++) {
      await this.page.keyboard.press('ArrowDown');
    }

    await this.page.keyboard.press('Enter');
  }

  /**
   * Wait for command palette to be ready.
   */
  async waitForReady() {
    await expect(this.commandPalette).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await expect(this.input).toBeFocused({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Check if command palette is visible.
   */
  async isVisible(): Promise<boolean> {
    return await this.commandPalette.isVisible().catch(() => false);
  }

  /**
   * Check if an item is visible.
   */
  async isItemVisible(item: 'projects' | 'vault' | 'citations' | 'new-project'): Promise<boolean> {
    const items = {
      projects: this.projectsItem,
      vault: this.vaultItem,
      citations: this.citationsItem,
      'new-project': this.newProjectItem,
    };
    return await items[item].isVisible().catch(() => false);
  }

  /**
   * Check if empty state is visible.
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false);
  }

  /**
   * Get the aria-label of the command palette dialog.
   */
  async getAriaLabel(): Promise<string | null> {
    return await this.commandPalette.getAttribute('aria-label');
  }

  /**
   * Get the placeholder text of the search input.
   */
  async getInputPlaceholder(): Promise<string | null> {
    return await this.input.getAttribute('placeholder');
  }

  /**
   * Check if input has focus.
   */
  async isInputFocused(): Promise<boolean> {
    return await this.input.evaluate((el) => document.activeElement === el);
  }

  /**
   * Get bounding box for touch target size verification.
   */
  async getItemBoundingBox(
    item: 'projects' | 'vault' | 'citations' | 'new-project'
  ): Promise<{ width: number; height: number } | null> {
    const items = {
      projects: this.projectsItem,
      vault: this.vaultItem,
      citations: this.citationsItem,
      'new-project': this.newProjectItem,
    };
    return await items[item].boundingBox();
  }
}
