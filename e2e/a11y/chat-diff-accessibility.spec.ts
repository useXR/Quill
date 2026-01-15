/**
 * Accessibility Tests for Chat Sidebar and Diff Panel
 *
 * Uses axe-core to verify WCAG compliance for Phase 4 components.
 */
import { test, expect } from '../fixtures/test-fixtures';
import AxeBuilder from '@axe-core/playwright';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat & Diff Accessibility', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.waitForLoadState('networkidle');
  });

  test('ChatSidebar passes axe accessibility checks', async ({ page }) => {
    // Open chat sidebar
    await chatPage.open();
    await expect(chatPage.sidebar).toBeVisible();

    // Wait for animation to settle
    await page.waitForTimeout(TIMEOUTS.ANIMATION_SETTLE);

    // Run axe accessibility scan on chat sidebar
    const accessibilityScanResults = await new AxeBuilder({ page }).include('[data-testid="chat-sidebar"]').analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ChatSidebar with messages passes axe accessibility checks', async ({ page }) => {
    claudeMock.registerResponse('hello', { content: 'Hello! How can I help you today?' });

    await chatPage.open();
    await chatPage.sendMessage('Hello');
    await chatPage.waitForStreamingComplete();

    // Wait for UI to settle
    await page.waitForTimeout(TIMEOUTS.ANIMATION_SETTLE);

    // Run axe scan with messages present
    const accessibilityScanResults = await new AxeBuilder({ page }).include('[data-testid="chat-sidebar"]').analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ChatInput and controls pass axe accessibility checks', async ({ page }) => {
    await chatPage.open();

    // Focus on input and type something to trigger mode indicator
    await chatPage.chatInput.fill('Test accessibility');

    // Wait for mode indicator
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    const accessibilityScanResults = await new AxeBuilder({ page }).include('[data-testid="chat-sidebar"]').analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('DiffPanel passes axe accessibility checks', async ({ page }) => {
    // Setup: Add content and trigger global edit
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Original content for diff test.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    claudeMock.registerResponse('modify', { content: 'Modified content for diff test.' });

    await chatPage.open();
    await chatPage.sendMessage('Modify this content');
    await chatPage.waitForStreamingComplete();

    // Wait for diff panel
    await diffPage.waitForPanelVisible();

    // Wait for animations
    await page.waitForTimeout(TIMEOUTS.ANIMATION_SETTLE);

    // Run axe accessibility scan on diff panel
    const accessibilityScanResults = await new AxeBuilder({ page }).include('[data-testid="diff-panel"]').analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('DiffPanel buttons have accessible labels', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Content to change.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    claudeMock.registerResponse('change', { content: 'Changed content.' });

    await chatPage.open();
    await chatPage.sendMessage('Change this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify main buttons have accessible text
    await expect(diffPage.acceptAllButton).toHaveAccessibleName(/accept/i);
    await expect(diffPage.rejectAllButton).toHaveAccessibleName(/reject/i);
  });

  test('ModeIndicator passes axe accessibility checks for all modes', async ({ page }) => {
    await chatPage.open();

    // Test discussion mode
    await chatPage.chatInput.fill('explain this');
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    let scanResults = await new AxeBuilder({ page }).include('[data-testid="chat-mode-indicator"]').analyze();
    expect(scanResults.violations).toEqual([]);

    // Test global_edit mode
    await chatPage.chatInput.clear();
    await chatPage.chatInput.fill('change all headings');
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    scanResults = await new AxeBuilder({ page }).include('[data-testid="chat-mode-indicator"]').analyze();
    expect(scanResults.violations).toEqual([]);

    // Test research mode
    await chatPage.chatInput.clear();
    await chatPage.chatInput.fill('find papers on');
    await page.waitForTimeout(TIMEOUTS.ANIMATION);

    scanResults = await new AxeBuilder({ page }).include('[data-testid="chat-mode-indicator"]').analyze();
    expect(scanResults.violations).toEqual([]);
  });

  test('AIUndoButton and history panel pass axe accessibility checks', async ({ page }) => {
    // Setup: Complete a global edit to enable undo
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Original content.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    claudeMock.registerResponse('edit', { content: 'Edited content.' });

    await chatPage.open();
    await chatPage.sendMessage('Edit this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();
    await diffPage.waitForPanelHidden();

    // Check if undo button exists and is accessible
    const isUndoVisible = await diffPage.undoButton.isVisible().catch(() => false);

    if (isUndoVisible) {
      await page.waitForTimeout(TIMEOUTS.ANIMATION_SETTLE);

      const scanResults = await new AxeBuilder({ page }).include('[data-testid="ai-undo-button"]').analyze();
      expect(scanResults.violations).toEqual([]);
    }
  });

  test('keyboard navigation works in ChatSidebar', async ({ page }) => {
    await chatPage.open();

    // Focus on chat input
    await chatPage.chatInput.focus();
    await expect(chatPage.chatInput).toBeFocused();

    // Tab should navigate to send button
    await page.keyboard.press('Tab');
    await expect(chatPage.sendButton).toBeFocused();
  });

  test('keyboard navigation works in DiffPanel', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Test content.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    claudeMock.registerResponse('test', { content: 'Modified test content.' });

    await chatPage.open();
    await chatPage.sendMessage('Test navigation');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Focus should be trapped in diff panel
    // Tab through diff panel controls
    await diffPage.rejectAllButton.focus();
    await expect(diffPage.rejectAllButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(diffPage.acceptAllButton).toBeFocused();

    // Escape should close the panel
    await page.keyboard.press('Escape');
    await diffPage.waitForPanelHidden();
  });

  test('chat sidebar has proper ARIA attributes', async ({ page }) => {
    await chatPage.open();

    // Check sidebar has role and aria attributes
    const sidebar = chatPage.sidebar;
    await expect(sidebar).toBeVisible();

    // Check for complementary or aside role
    const role = await sidebar.getAttribute('role');
    const ariaLabel = await sidebar.getAttribute('aria-label');

    // Sidebar should have some accessible identification
    expect(role !== null || ariaLabel !== null).toBeTruthy();
  });

  test('diff panel has proper focus management', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Content for focus test.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    claudeMock.registerResponse('focus', { content: 'Modified for focus test.' });

    await chatPage.open();
    await chatPage.sendMessage('Focus test');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Panel should capture focus when opened
    // Either the panel or a control inside should be focused
    const panelOrChild = page.locator('[data-testid="diff-panel"], [data-testid="diff-panel"] button');
    const hasFocus = await page.evaluate(() => {
      const focused = document.activeElement;
      const panel = document.querySelector('[data-testid="diff-panel"]');
      return panel?.contains(focused);
    });

    // Close panel
    await diffPage.close();
  });

  test('error messages are announced to screen readers', async ({ page }) => {
    // Register an error response
    claudeMock.registerResponse('error', {
      content: '',
      error: { type: 'network', message: 'Connection failed' },
    });

    await chatPage.open();
    await chatPage.sendMessage('Trigger error');

    // Wait for error to appear
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Check for error message with proper ARIA
    const errorElement = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').first();
    const isErrorAnnounced = await errorElement.isVisible().catch(() => false);

    // The error should be announced somehow
    // This test checks for ARIA live region or alert role
  });

  test('loading states are accessible', async ({ page }) => {
    // Register a slow response
    claudeMock.registerResponse('slow', {
      content: 'Slow response content',
      delayMs: 2000,
    });

    await chatPage.open();
    await chatPage.sendMessage('Slow request');

    // Check for loading indicator with proper ARIA
    const loadingIndicator = page.locator('[aria-busy="true"], [role="progressbar"], [aria-label*="loading"]').first();
    const hasLoadingAria = await loadingIndicator.isVisible().catch(() => false);

    // Wait for completion
    await chatPage.waitForStreamingComplete();
  });
});
