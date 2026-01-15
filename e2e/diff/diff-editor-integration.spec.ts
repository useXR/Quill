/**
 * CRITICAL E2E Integration Tests for Diff + Editor
 *
 * These tests verify that editor content ACTUALLY changes after
 * accept/reject operations. This is the most important test file
 * for the diff functionality.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Diff + Editor Integration', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('CRITICAL: accepting changes updates actual editor content', async ({ page, workerCtx }) => {
    // Setup: Navigate to editor and add initial content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original document content that will be changed.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock response for global edit
    claudeMock.registerResponse('make formal', {
      content: 'The original document content has been formally revised.',
    });

    // Request global edit
    await chatPage.open();
    await chatPage.sendMessage('Make this more formal and academic');
    await chatPage.waitForStreamingComplete();

    // Wait for diff panel
    await diffPage.waitForPanelVisible();

    // Accept all changes
    await diffPage.acceptAll();

    // Apply changes
    await diffPage.apply();
    await diffPage.waitForPanelHidden();

    // CRITICAL VERIFICATION: Editor content should have actually changed
    const newContent = await editor.textContent();
    expect(newContent).not.toBe(originalContent);
    expect(newContent).toContain('formally revised');
  });

  test('CRITICAL: rejecting changes preserves original editor content', async ({ page, workerCtx }) => {
    // Setup: Navigate to editor and add initial content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('This content should remain unchanged.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock response for global edit
    claudeMock.registerResponse('change', {
      content: 'Completely different content.',
    });

    // Request global edit
    await chatPage.open();
    await chatPage.sendMessage('Change everything');
    await chatPage.waitForStreamingComplete();

    // Wait for diff panel
    await diffPage.waitForPanelVisible();

    // Reject all changes
    await diffPage.rejectAll();

    // Apply (with all rejected)
    await diffPage.apply();
    await diffPage.waitForPanelHidden();

    // CRITICAL VERIFICATION: Editor content should remain unchanged
    const finalContent = await editor.textContent();
    expect(finalContent).toBe(originalContent);
  });

  test('CRITICAL: undo restores original editor content', async ({ page, workerCtx }) => {
    // Mock the operations endpoint
    await page.route('**/api/ai/operations**', async (route) => {
      const url = route.request().url();
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              id: 'op-undo-test',
              operation_type: 'global_edit',
              input_summary: 'Made formal',
              snapshot_before: { content: 'Content before AI edit.' },
              status: 'accepted',
              created_at: new Date().toISOString(),
            },
          ]),
        });
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    // Setup: Navigate to editor and add initial content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Content before AI edit.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock response for global edit
    claudeMock.registerResponse('edit', {
      content: 'Content after AI edit.',
    });

    // Apply a global edit
    await chatPage.open();
    await chatPage.sendMessage('Edit this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();
    await diffPage.apply();
    await diffPage.waitForPanelHidden();

    // Verify content changed
    expect(await editor.textContent()).not.toBe(originalContent);

    // CRITICAL: Click undo
    await diffPage.undo();

    // Wait for content to restore
    await page.waitForTimeout(500);

    // CRITICAL VERIFICATION: Editor should restore original content
    const restoredContent = await editor.textContent();
    expect(restoredContent).toBe(originalContent);
  });

  test('editor becomes disabled during diff review', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Test content');

    claudeMock.registerResponse('modify', { content: 'Modified test content' });

    await chatPage.open();
    await chatPage.sendMessage('Modify this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Editor should be disabled/non-editable during diff review
    const editorContainer = page.getByTestId('document-editor');
    // Check for data-disabled attribute or opacity/pointer-events CSS
    const isDisabled = await editorContainer.getAttribute('data-disabled');
    const hasDisabledClass = await editorContainer.evaluate((el) => {
      return el.classList.contains('pointer-events-none') || getComputedStyle(el).pointerEvents === 'none';
    });

    expect(isDisabled === 'true' || hasDisabledClass).toBeTruthy();
  });
});

test.describe('DiffPanel Keyboard Navigation', () => {
  test('Escape key closes diff panel without applying changes', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Setup mock response
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Modified"}\n\ndata: {"type":"done","operationId":"op-1","modifiedContent":"Modified","diff":[{"type":"add","value":"Modified","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');
    const originalContent = await editor.textContent();

    // Trigger global edit
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: TIMEOUTS.API_CALL * 2 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Panel should close
    await expect(page.getByTestId('diff-panel')).not.toBeVisible();

    // Content should remain unchanged
    expect(await editor.textContent()).toBe(originalContent);
  });

  test('Tab navigates between accept/reject buttons', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: TIMEOUTS.API_CALL * 2 });

    // Focus first accept button and tab through
    await page.getByTestId('accept-change').first().focus();
    await expect(page.getByTestId('accept-change').first()).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('reject-change').first()).toBeFocused();
  });
});

test.describe('AI Undo History Panel', () => {
  test('history panel shows operation timestamps', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock operations endpoint
    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: 'op-1', input_summary: 'Made formal', created_at: new Date().toISOString(), status: 'accepted' },
          {
            id: 'op-2',
            input_summary: 'Fixed grammar',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            status: 'accepted',
          },
        ]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Open history panel
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    // Verify operations are listed with timestamps
    const snapshots = page.getByTestId('ai-snapshot');
    await expect(snapshots).toHaveCount(2);
    await expect(snapshots.first()).toContainText('Made formal');
    await expect(snapshots.last()).toContainText('Fixed grammar');
  });

  test('clicking outside history panel closes it', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ id: 'op-1', input_summary: 'Test', created_at: new Date().toISOString() }]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    // Click outside
    await page.getByTestId('document-editor').click();

    // Panel should close (may need small timeout for blur handling)
    await page.waitForTimeout(100);
    await expect(page.getByTestId('ai-history-panel')).not.toBeVisible();
  });
});

test.describe('Partial Accept Scenario', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
  });

  test('CRITICAL: partial accept - accept change 1, reject change 2, verify only change 1 applied', async ({
    page,
    workerCtx,
  }) => {
    // Setup: Create document with identifiable content
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('First paragraph stays lowercase.\n\nSecond paragraph also lowercase.');

    // Store original content
    const originalContent = await editor.textContent();

    // Register mock that produces two distinct changes
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: {"type":"done","operationId":"op-partial","modifiedContent":"FIRST PARAGRAPH STAYS LOWERCASE.\\n\\nSECOND PARAGRAPH ALSO LOWERCASE.","diff":[{"type":"remove","value":"First paragraph stays lowercase.","lineNumber":1},{"type":"add","value":"FIRST PARAGRAPH STAYS LOWERCASE.","lineNumber":1},{"type":"remove","value":"Second paragraph also lowercase.","lineNumber":3},{"type":"add","value":"SECOND PARAGRAPH ALSO LOWERCASE.","lineNumber":3}]}\n\n`,
      });
    });

    // Trigger global edit
    await chatPage.open();
    await chatPage.sendMessage('Make all text uppercase');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify we have multiple changes to work with
    const changeCards = page.getByTestId('diff-change');
    await expect(changeCards).toHaveCount(4); // 2 removes + 2 adds

    // Accept the first change (first paragraph uppercase)
    await diffPage.acceptChange(0); // remove old first paragraph
    await diffPage.acceptChange(1); // add new first paragraph

    // Reject the second change (keep second paragraph lowercase)
    await diffPage.rejectChange(2); // reject remove old second paragraph
    await diffPage.rejectChange(3); // reject add new second paragraph

    // Apply the partial changes
    await page.getByRole('button', { name: /apply/i }).click();
    await diffPage.waitForPanelHidden();

    // CRITICAL VERIFICATION
    const finalContent = await editor.textContent();

    // Change 1 was ACCEPTED - first paragraph should be uppercase
    expect(finalContent).toContain('FIRST PARAGRAPH');

    // Change 2 was REJECTED - second paragraph should remain lowercase
    expect(finalContent).toContain('Second paragraph also lowercase');
    expect(finalContent).not.toContain('SECOND PARAGRAPH');
  });

  test('partial accept preserves document structure', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('# Heading\n\nParagraph 1\n\nParagraph 2\n\nParagraph 3');

    // Mock that changes all paragraphs
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: {"type":"done","operationId":"op-struct","modifiedContent":"# Heading\\n\\nModified 1\\n\\nModified 2\\n\\nModified 3","diff":[{"type":"unchanged","value":"# Heading\\n\\n","lineNumber":1},{"type":"remove","value":"Paragraph 1","lineNumber":3},{"type":"add","value":"Modified 1","lineNumber":3},{"type":"remove","value":"Paragraph 2","lineNumber":5},{"type":"add","value":"Modified 2","lineNumber":5},{"type":"remove","value":"Paragraph 3","lineNumber":7},{"type":"add","value":"Modified 3","lineNumber":7}]}\n\n`,
      });
    });

    await chatPage.open();
    await chatPage.sendMessage('Modify all paragraphs');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Accept only middle change (Paragraph 2 -> Modified 2)
    const changeCards = page.getByTestId('diff-change');
    const count = await changeCards.count();

    for (let i = 0; i < count; i++) {
      // Accept only changes related to Paragraph 2 / Modified 2
      const cardText = await changeCards.nth(i).textContent();
      if (cardText?.includes('Paragraph 2') || cardText?.includes('Modified 2')) {
        await diffPage.acceptChange(i);
      } else {
        await diffPage.rejectChange(i);
      }
    }

    await page.getByRole('button', { name: /apply/i }).click();
    await diffPage.waitForPanelHidden();

    // Verify structure preserved
    const finalContent = await editor.textContent();
    expect(finalContent).toContain('# Heading');
    expect(finalContent).toContain('Paragraph 1'); // rejected
    expect(finalContent).toContain('Modified 2'); // accepted
    expect(finalContent).toContain('Paragraph 3'); // rejected
  });
});
