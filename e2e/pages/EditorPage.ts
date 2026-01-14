/**
 * Page Object Model for the document editor page.
 * Encapsulates selectors and actions for document editing.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

export class EditorPage {
  readonly page: Page;

  // Editor elements
  readonly editor: Locator;
  readonly toolbar: Locator;
  readonly wordCount: Locator;
  readonly charCount: Locator;
  readonly saveStatus: Locator;

  // Toolbar buttons
  readonly boldButton: Locator;
  readonly italicButton: Locator;
  readonly highlightButton: Locator;
  readonly heading1Button: Locator;
  readonly heading2Button: Locator;
  readonly bulletListButton: Locator;
  readonly numberedListButton: Locator;
  readonly alignLeftButton: Locator;
  readonly alignCenterButton: Locator;
  readonly alignRightButton: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;

  // Breadcrumb
  readonly breadcrumb: Locator;

  // Loading/error states
  readonly loadingIndicator: Locator;
  readonly errorAlert: Locator;
  readonly retryButton: Locator;

  // Title editing
  readonly documentTitle: Locator;
  readonly titleInput: Locator;
  readonly titleEditButton: Locator;
  readonly titleSavingIndicator: Locator;
  readonly titleError: Locator;

  constructor(page: Page) {
    this.page = page;

    // Editor elements
    this.editor = page.locator('[role="textbox"][aria-label="Document editor"]');
    this.toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    this.wordCount = page.getByTestId('word-count');
    this.charCount = page.getByTestId('char-count');
    this.saveStatus = page.getByTestId('save-status');

    // Toolbar buttons (by aria-label)
    this.boldButton = page.getByRole('button', { name: 'Bold' });
    this.italicButton = page.getByRole('button', { name: 'Italic' });
    this.highlightButton = page.getByRole('button', { name: 'Highlight' });
    this.heading1Button = page.getByRole('button', { name: 'Heading 1' });
    this.heading2Button = page.getByRole('button', { name: 'Heading 2' });
    this.bulletListButton = page.getByRole('button', { name: 'Bullet List' });
    this.numberedListButton = page.getByRole('button', { name: 'Numbered List' });
    this.alignLeftButton = page.getByRole('button', { name: 'Align Left' });
    this.alignCenterButton = page.getByRole('button', { name: 'Align Center' });
    this.alignRightButton = page.getByRole('button', { name: 'Align Right' });
    this.undoButton = page.getByRole('button', { name: 'Undo' });
    this.redoButton = page.getByRole('button', { name: 'Redo' });

    // Breadcrumb
    this.breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    // Loading/error states
    this.loadingIndicator = page.locator('text=Loading document...');
    this.errorAlert = page.locator('[role="alert"]');
    this.retryButton = page.getByRole('button', { name: /retry/i });

    // Title editing
    this.documentTitle = page.getByTestId('editable-title').getByRole('heading');
    this.titleInput = page.getByRole('textbox', { name: 'Document title' });
    this.titleEditButton = page.getByRole('button', { name: /edit title/i });
    this.titleSavingIndicator = page.getByTestId('editable-title').getByText(/saving/i);
    this.titleError = page.getByTestId('editable-title').getByRole('alert');
  }

  /**
   * Navigate to a document editor page.
   */
  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for the editor to be ready (loaded and interactive).
   */
  async waitForEditorReady() {
    // Wait for loading to complete
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAGE_LOAD });

    // Wait for editor to be visible
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await expect(this.toolbar).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Type text in the editor.
   */
  async type(text: string) {
    await this.editor.click();
    await this.page.keyboard.type(text);
  }

  /**
   * Clear the editor and type new text.
   */
  async clearAndType(text: string) {
    await this.editor.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(text);
  }

  /**
   * Select all text in the editor.
   */
  async selectAll() {
    await this.editor.click();
    await this.page.keyboard.press('Control+A');
  }

  /**
   * Get the current text content of the editor.
   */
  async getTextContent(): Promise<string> {
    return (await this.editor.textContent()) || '';
  }

  /**
   * Check if a toolbar button is active (aria-pressed="true").
   */
  async isButtonActive(button: Locator): Promise<boolean> {
    const pressed = await button.getAttribute('aria-pressed');
    return pressed === 'true';
  }

  /**
   * Toggle bold formatting.
   */
  async toggleBold() {
    await this.boldButton.click();
  }

  /**
   * Toggle italic formatting.
   */
  async toggleItalic() {
    await this.italicButton.click();
  }

  /**
   * Toggle highlight formatting.
   */
  async toggleHighlight() {
    await this.highlightButton.click();
  }

  /**
   * Set heading level 1.
   */
  async setHeading1() {
    await this.heading1Button.click();
  }

  /**
   * Set heading level 2.
   */
  async setHeading2() {
    await this.heading2Button.click();
  }

  /**
   * Toggle bullet list.
   */
  async toggleBulletList() {
    await this.bulletListButton.click();
  }

  /**
   * Toggle numbered list.
   */
  async toggleNumberedList() {
    await this.numberedListButton.click();
  }

  /**
   * Set text alignment.
   */
  async setAlignment(alignment: 'left' | 'center' | 'right') {
    const buttons = {
      left: this.alignLeftButton,
      center: this.alignCenterButton,
      right: this.alignRightButton,
    };
    await buttons[alignment].click();
  }

  /**
   * Undo last action.
   */
  async undo() {
    await this.undoButton.click();
  }

  /**
   * Redo last undone action.
   */
  async redo() {
    await this.redoButton.click();
  }

  /**
   * Wait for autosave to complete.
   */
  async waitForAutosave() {
    // Wait for the autosave debounce and save to complete
    await this.page.waitForTimeout(TIMEOUTS.AUTOSAVE_WAIT);

    // Check for save status indicator
    const status = await this.saveStatus.textContent();
    return status;
  }

  /**
   * Expect save status to show saved.
   */
  async expectSaved() {
    await expect(this.saveStatus).toContainText(/saved|autosaved/i, {
      timeout: TIMEOUTS.AUTOSAVE_WAIT + 1000,
    });
  }

  /**
   * Expect save status to show error.
   * Note: autosave has 3 retries with exponential backoff (1s, 2s, 4s)
   * so total time can be debounce(2s) + retries(7s) + buffer = ~15s
   */
  async expectSaveError() {
    await expect(this.saveStatus).toContainText(/error|failed/i, {
      timeout: 15000,
    });
  }

  /**
   * Get word count value.
   */
  async getWordCount(): Promise<number> {
    const text = await this.wordCount.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get character count value.
   */
  async getCharCount(): Promise<number> {
    const text = await this.charCount.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Check if editor contains formatted text (bold).
   */
  async containsBold(): Promise<boolean> {
    const strongElement = this.page.locator('.ProseMirror strong, .ProseMirror b');
    return await strongElement.isVisible().catch(() => false);
  }

  /**
   * Check if editor contains formatted text (italic).
   */
  async containsItalic(): Promise<boolean> {
    const emElement = this.page.locator('.ProseMirror em, .ProseMirror i');
    return await emElement.isVisible().catch(() => false);
  }

  /**
   * Check if editor contains a heading.
   */
  async containsHeading(level: 1 | 2): Promise<boolean> {
    const headingElement = this.page.locator(`.ProseMirror h${level}`);
    return await headingElement.isVisible().catch(() => false);
  }

  /**
   * Check if editor contains a bullet list.
   */
  async containsBulletList(): Promise<boolean> {
    const listElement = this.page.locator('.ProseMirror ul');
    return await listElement.isVisible().catch(() => false);
  }

  /**
   * Check if editor contains a numbered list.
   */
  async containsNumberedList(): Promise<boolean> {
    const listElement = this.page.locator('.ProseMirror ol');
    return await listElement.isVisible().catch(() => false);
  }

  /**
   * Click retry button if visible.
   */
  async retry() {
    await this.retryButton.click();
  }

  /**
   * Navigate via breadcrumb.
   */
  async clickBreadcrumbLink(text: string) {
    await this.breadcrumb.getByRole('link', { name: text }).click();
  }

  /**
   * Get the current document title.
   */
  async getDocumentTitle(): Promise<string> {
    return (await this.documentTitle.textContent()) || '';
  }

  /**
   * Edit the document title.
   */
  async editTitle(newTitle: string) {
    // Click title to enter edit mode
    await this.documentTitle.click();

    // Wait for input to appear
    await this.titleInput.waitFor({ state: 'visible', ...VISIBILITY_WAIT });

    // Clear and type new title
    await this.titleInput.clear();
    await this.titleInput.fill(newTitle);

    // Press Enter to save
    await this.page.keyboard.press('Enter');
  }

  /**
   * Cancel title editing with Escape.
   */
  async cancelTitleEdit() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Wait for title save to complete.
   */
  async waitForTitleSaved() {
    // Wait for input to disappear (means save completed)
    await this.titleInput.waitFor({ state: 'hidden', timeout: TIMEOUTS.API_CALL });
  }

  /**
   * Expect title to have specific value.
   */
  async expectTitle(expected: string) {
    await expect(this.documentTitle).toContainText(expected);
  }

  /**
   * Expect title save error.
   */
  async expectTitleError() {
    await expect(this.titleError).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }
}
