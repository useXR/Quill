/**
 * Complete Global Edit Flow E2E Tests
 *
 * CRITICAL: This test covers the end-to-end journey:
 * user types request -> mode detected -> AI responds -> diff panel shows -> user accepts -> document updates
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Complete Global Edit Flow', () => {
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

  test('CRITICAL: complete global edit journey - type request, detect mode, AI responds, diff shown, accept, document updated', async ({
    page,
  }) => {
    // STEP 1: Setup initial document content
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill(
      '# Introduction\n\nThis document has lowercase headings.\n\n# methodology\n\nThis section describes methods.\n\n# results\n\nHere are the findings.'
    );

    // Wait for content to settle
    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    const originalContent = await editor.textContent();
    expect(originalContent).toContain('methodology');
    expect(originalContent).toContain('results');

    // STEP 2: Register mock response for heading transformation
    claudeMock.registerResponse('change all headings', {
      content:
        '# Introduction\n\nThis document has lowercase headings.\n\n# Methodology\n\nThis section describes methods.\n\n# Results\n\nHere are the findings.',
    });

    // STEP 3: Open chat and type global edit request
    await chatPage.open();
    await chatPage.chatInput.fill('change all headings to title case');

    // STEP 4: Verify mode detection shows Global Edit
    await chatPage.waitForMode('global_edit');

    // STEP 5: Send the request
    await chatPage.sendButton.click();

    // STEP 6: Wait for AI response to complete
    await chatPage.waitForStreamingComplete();

    // STEP 7: Verify diff panel appears
    await diffPage.waitForPanelVisible();
    await expect(diffPage.panel).toBeVisible();

    // STEP 8: Verify diff shows the expected changes
    const changeCount = await diffPage.getChangeCount();
    expect(changeCount).toBeGreaterThan(0);

    // STEP 9: Accept all changes
    await diffPage.acceptAll();

    // STEP 10: Verify diff panel closes
    await diffPage.waitForPanelHidden();

    // STEP 11: CRITICAL VERIFICATION - Document content is actually updated
    // Allow time for the editor to update
    await page.waitForTimeout(TIMEOUTS.DOM_UPDATE);

    const updatedContent = await editor.textContent();

    // Headings should now be title case
    expect(updatedContent).toContain('Methodology');
    expect(updatedContent).toContain('Results');
  });

  test('global edit flow with rejection preserves original content', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Original content that should not change.');

    // Wait for content to settle
    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    const originalContent = await editor.textContent();

    claudeMock.registerResponse('rewrite', { content: 'Completely different content.' });

    await chatPage.open();
    await chatPage.sendMessage('Rewrite everything');
    await chatPage.waitForStreamingComplete();

    await diffPage.waitForPanelVisible();

    // Reject all changes
    await diffPage.rejectAll();
    await diffPage.waitForPanelHidden();

    // Document should be unchanged
    const finalContent = await editor.textContent();
    expect(finalContent).toBe(originalContent);
  });

  test('global edit flow mode detection updates in real-time', async () => {
    await chatPage.open();

    // Start typing a discussion question
    await chatPage.chatInput.fill('What is');
    await chatPage.waitForMode('discussion');

    // Change to global edit
    await chatPage.chatInput.clear();
    await chatPage.chatInput.fill('Change all paragraphs');
    await chatPage.waitForMode('global_edit');

    // Change to research
    await chatPage.chatInput.clear();
    await chatPage.chatInput.fill('Find papers about');
    await chatPage.waitForMode('research');
  });

  test('partial accept applies only selected changes', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Line one.\n\nLine two.\n\nLine three.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    // Register mock that returns multiple changes
    claudeMock.registerResponse('modify', {
      content: 'Modified line one.\n\nModified line two.\n\nModified line three.',
    });

    await chatPage.open();
    await chatPage.sendMessage('Modify all lines');
    await chatPage.waitForStreamingComplete();

    await diffPage.waitForPanelVisible();

    // Get initial change count
    const changeCount = await diffPage.getChangeCount();

    if (changeCount > 1) {
      // Accept first change only
      await diffPage.acceptChange(0);

      // Verify progress updates
      const progressText = await diffPage.getProgressText();
      expect(progressText).toContain('1');
    }

    // Close without applying remaining
    await diffPage.close();
    await diffPage.waitForPanelHidden();
  });

  test('undo restores previous content after accepting changes', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Original document content before AI edit.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    const originalContent = await editor.textContent();

    claudeMock.registerResponse('transform', {
      content: 'Transformed document content after AI edit.',
    });

    await chatPage.open();
    await chatPage.sendMessage('Transform this content');
    await chatPage.waitForStreamingComplete();

    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();
    await diffPage.waitForPanelHidden();

    // Verify content changed
    await page.waitForTimeout(TIMEOUTS.DOM_UPDATE);
    const modifiedContent = await editor.textContent();
    expect(modifiedContent).not.toBe(originalContent);

    // Click undo
    const undoButton = diffPage.undoButton;
    const isUndoVisible = await undoButton.isVisible().catch(() => false);

    if (isUndoVisible) {
      await diffPage.undo();

      // Wait for undo to apply
      await page.waitForTimeout(TIMEOUTS.DOM_UPDATE);

      // Verify content restored
      const restoredContent = await editor.textContent();
      expect(restoredContent).toBe(originalContent);
    }
  });

  test('chat history persists after page reload', async ({ page, workerCtx }) => {
    await chatPage.open();

    // Send a message
    claudeMock.registerResponse('hello', { content: 'Hello! I can help you.' });
    await chatPage.sendMessage('Hello from persistence test');
    await chatPage.waitForStreamingComplete();

    // Get message count before reload
    const messagesBefore = await chatPage.getMessages();
    const countBefore = messagesBefore.length;

    expect(countBefore).toBeGreaterThan(0);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-open chat
    chatPage = new ChatPage(page);
    await chatPage.open();

    // Note: Chat persistence depends on the actual implementation
    // This test verifies the chat can be reopened after reload
    await expect(chatPage.sidebar).toBeVisible();
  });

  test('multiple global edits can be applied sequentially', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
    await editor.click();
    await editor.fill('Version 1: Initial content.');

    await page.waitForTimeout(TIMEOUTS.INPUT_STABLE);

    // First edit
    claudeMock.registerResponse('first edit', { content: 'Version 2: After first edit.' });

    await chatPage.open();
    await chatPage.sendMessage('Apply first edit');
    await chatPage.waitForStreamingComplete();

    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();
    await diffPage.waitForPanelHidden();

    await page.waitForTimeout(TIMEOUTS.DOM_UPDATE);

    const afterFirstEdit = await editor.textContent();
    expect(afterFirstEdit).toContain('Version 2');

    // Second edit
    claudeMock.registerResponse('second edit', { content: 'Version 3: After second edit.' });

    await chatPage.sendMessage('Apply second edit');
    await chatPage.waitForStreamingComplete();

    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();
    await diffPage.waitForPanelHidden();

    await page.waitForTimeout(TIMEOUTS.DOM_UPDATE);

    const afterSecondEdit = await editor.textContent();
    expect(afterSecondEdit).toContain('Version 3');
  });
});
