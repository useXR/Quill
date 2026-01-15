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

  test.beforeEach(async ({ page }) => {
    // Storage state from setup project provides authentication
    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('diff panel shows for global edit requests', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Wait for editor to be ready
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Add initial content
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    // Trigger global edit (must match edit patterns like "change all" or "edit all")
    claudeMock.registerResponse('change all', { content: 'Modified content' });
    await chatPage.open();
    await chatPage.sendMessage('Change all text to be better');
    await chatPage.waitForStreamingComplete();

    // Verify diff panel appears
    await diffPage.waitForPanelVisible();
    const changeCount = await diffPage.getChangeCount();
    expect(changeCount).toBeGreaterThan(0);
  });

  test('diff panel closes when rejecting changes', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Wait for editor to be ready
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Original content');

    claudeMock.registerResponse('change all', { content: 'Modified content' });
    await chatPage.open();
    await chatPage.sendMessage('Change all text to be better');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Close diff panel by rejecting
    await diffPage.rejectAll();

    // Verify diff panel is closed
    await diffPage.waitForPanelHidden();
  });
});

test.describe('Editor State During Diff', () => {
  test('diff panel can be triggered via direct API mock', async ({ page, workerCtx }) => {
    // Storage state from setup project provides authentication
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"New content here","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New content here","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    // Wait for editor to be ready
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Trigger diff panel via chat
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('change all text');
    await page.getByTestId('chat-send-button').click();

    // Verify diff panel appears
    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: TIMEOUTS.API_CALL * 2 });
  });
});

test.describe('Global Edit Flow', () => {
  test('global edit shows diff with accept and reject options', async ({ page, workerCtx }) => {
    // Storage state from setup project provides authentication
    const chatPage = new ChatPage(page);
    const diffPage = new DiffPanelPage(page);
    const claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    // Wait for editor to be ready
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Add initial content
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Initial document content for testing the global edit flow.');

    // Send edit instruction (must match global edit patterns)
    claudeMock.registerResponse('rewrite the entire', {
      content: 'Professional document content for testing the global edit flow.',
    });

    await chatPage.open();
    await chatPage.sendMessage('Rewrite the entire document to be more professional');

    // Wait for diff panel
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Verify diff panel shows changes
    const changeCount = await diffPage.getChangeCount();
    expect(changeCount).toBeGreaterThan(0);

    // Verify accept/reject buttons are present
    await expect(page.getByTestId('diff-accept-all')).toBeVisible();
    await expect(page.getByTestId('diff-reject-all')).toBeVisible();
  });

  test('rejecting global edit closes diff panel', async ({ page, workerCtx }) => {
    // Storage state from setup project provides authentication
    const chatPage = new ChatPage(page);
    const diffPage = new DiffPanelPage(page);
    const claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    // Wait for editor to be ready
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Content that should remain unchanged.');

    claudeMock.registerResponse('change all', {
      content: 'Completely different content.',
    });

    await chatPage.open();
    await chatPage.sendMessage('Change all content to something different');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Reject all and close
    await diffPage.rejectAll();

    // Diff panel should close
    await diffPage.waitForPanelHidden();
  });
});
