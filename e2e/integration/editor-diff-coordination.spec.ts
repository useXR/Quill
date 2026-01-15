/**
 * E2E Integration Tests for Editor + Diff Coordination
 *
 * Tests verifying that editor state is properly managed when
 * diff panel is shown/hidden, including disabled state and autosave pausing.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Editor + Diff Coordination', () => {
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

  test('editor is disabled during diff review', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Add initial content
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    // Trigger global edit
    claudeMock.registerResponse('edit', { content: 'Modified content' });
    await chatPage.open();
    await chatPage.sendMessage('Edit this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify editor is disabled (pointer-events: none or contenteditable: false)
    const editorElement = page.getByTestId('document-editor');
    // Check for disabled state indicator
    await expect(editorElement).toHaveCSS('opacity', '0.5');
  });

  test('editor is re-enabled after diff panel closes', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    claudeMock.registerResponse('edit', { content: 'Modified content' });
    await chatPage.open();
    await chatPage.sendMessage('Edit this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Close diff panel by rejecting
    await diffPage.rejectAll();

    // Editor should be editable again
    const editorElement = page.getByTestId('document-editor');
    await expect(editorElement).not.toHaveCSS('opacity', '0.5');

    // Verify we can type
    await editor.click();
    await editor.pressSequentially(' - edited after diff closed');
    expect(await editor.textContent()).toContain('edited after diff closed');
  });
});

test.describe('Editor State During Diff', () => {
  test('editor shows visual disabled state during diff review', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New","diff":[{"type":"add","value":"New","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor');

    // Trigger diff panel
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: TIMEOUTS.API_CALL * 2 });

    // Verify editor is visually disabled
    await expect(editor).toHaveAttribute('data-disabled', 'true');
    // CSS check for disabled state
    await expect(editor).toHaveCSS('opacity', '0.5');
    await expect(editor).toHaveCSS('pointer-events', 'none');
  });

  test('editor autosave pauses during diff review', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const saveRequests: string[] = [];

    await page.route('**/api/documents/**', async (route) => {
      saveRequests.push(route.request().method());
      await route.continue();
    });

    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New","diff":[{"type":"add","value":"New","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Open diff panel
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: TIMEOUTS.API_CALL * 2 });

    // Clear save tracking
    const initialSaveCount = saveRequests.length;

    // Wait to see if any saves occur during diff review
    await page.waitForTimeout(3000);

    // No additional saves should occur while diff panel is open
    expect(saveRequests.length).toBe(initialSaveCount);
  });
});

test.describe('Global Edit Flow', () => {
  test('complete flow: instruction -> diff -> accept -> apply', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const chatPage = new ChatPage(page);
    const diffPage = new DiffPanelPage(page);
    const claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Add initial content
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Initial document content for testing the global edit flow.');

    const originalContent = await editor.textContent();

    // Step 1: Send edit instruction
    claudeMock.registerResponse('make professional', {
      content: 'Professional document content for testing the global edit flow.',
    });

    await chatPage.open();
    await chatPage.sendMessage('Make this more professional');

    // Step 2: Wait for diff panel
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify diff panel shows changes
    const changeCount = await diffPage.getChangeCount();
    expect(changeCount).toBeGreaterThan(0);

    // Step 3: Accept changes
    await diffPage.acceptAll();

    // Step 4: Apply changes
    await diffPage.apply();
    await diffPage.waitForPanelHidden();

    // Verify editor content was updated
    const newContent = await editor.textContent();
    expect(newContent).not.toBe(originalContent);
    expect(newContent).toContain('Professional');
  });

  test('flow with rejection preserves original content', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const chatPage = new ChatPage(page);
    const diffPage = new DiffPanelPage(page);
    const claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Content that should remain unchanged.');

    const originalContent = await editor.textContent();

    claudeMock.registerResponse('change', {
      content: 'Completely different content.',
    });

    await chatPage.open();
    await chatPage.sendMessage('Change this');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Reject all and close
    await diffPage.rejectAll();

    // Content should be unchanged
    const finalContent = await editor.textContent();
    expect(finalContent).toBe(originalContent);
  });
});
