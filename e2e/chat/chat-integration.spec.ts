/**
 * CRITICAL: Chat + Editor Integration E2E Tests
 *
 * These tests verify that the chat sidebar appears on the actual editor page
 * from Phase 1 and integrates correctly with the document editing experience.
 *
 * Run with: npm run test:e2e e2e/chat/chat-integration.spec.ts
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat + Editor Integration', () => {
  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Navigate to actual editor page (Phase 1 component)
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  });

  test('CRITICAL: chat sidebar toggle appears on editor page', async ({ page }) => {
    // Verify the editor is loaded first
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // CRITICAL: Chat sidebar toggle should be present on editor page
    await expect(page.getByTestId('chat-sidebar-toggle')).toBeVisible();
  });

  test('CRITICAL: chat sidebar opens alongside editor', async ({ page }) => {
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open chat sidebar
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Editor should still be visible (not hidden by sidebar)
    await expect(page.getByTestId('document-editor')).toBeVisible();
  });

  test('should send chat message about document content', async ({ page, workerCtx }) => {
    // Mock the chat API to return a response
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Your document is about machine learning."}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Type some content in the editor
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('This is my research paper about machine learning.');

    // Open chat and ask about the content
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('What is my document about?');
    await page.getByTestId('chat-send-button').click();

    // Verify message was sent (appears in list)
    await expect(page.getByTestId('chat-message').first()).toContainText('What is my document about?');
  });

  test('should show mode indicator when typing in chat', async ({ page }) => {
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open chat sidebar
    await page.getByTestId('chat-sidebar-toggle').click();

    // Type a discussion message
    await page.getByTestId('chat-input').fill('What does this paragraph mean?');

    // Mode indicator should show discussion mode
    await expect(page.getByTestId('chat-mode-indicator')).toBeVisible();

    // Type a global edit message
    await page.getByTestId('chat-input').clear();
    await page.getByTestId('chat-input').fill('Change all headings to title case');

    // Mode indicator should update
    await expect(page.getByTestId('chat-mode-indicator')).toContainText(/edit/i);
  });

  test('should handle multiple messages in conversation', async ({ page }) => {
    let messageCount = 0;
    await page.route('**/api/ai/chat', async (route) => {
      messageCount++;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: {"type":"content","content":"Response ${messageCount}"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open chat
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send first message
    await page.getByTestId('chat-input').fill('First question');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Send second message
    await page.getByTestId('chat-input').fill('Follow up question');
    await page.getByTestId('chat-send-button').click();

    // Should have 4 messages now (2 user + 2 assistant)
    await expect(page.getByTestId('chat-message')).toHaveCount(4, { timeout: TIMEOUTS.API_CALL });
  });

  test('should clear chat history via dialog', async ({ page }) => {
    // Mock chat API
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Test response"}\n\ndata: {"type":"done"}\n\n',
      });
    });

    // Mock clear history API
    await page.route('**/api/chat/history', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      }
    });

    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open chat and send a message
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test message');
    await page.getByTestId('chat-send-button').click();

    // Wait for messages to appear
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Click clear history button
    await page.getByTestId('chat-clear-history').click();

    // Confirm dialog should appear
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByText('Clear Chat History')).toBeVisible();

    // Confirm clear
    await page.getByTestId('confirm-confirm').click();

    // Messages should be cleared
    await expect(page.getByTestId('chat-message')).toHaveCount(0);
    await expect(page.getByText('Start a conversation')).toBeVisible();
  });

  test('sidebar should not block editor interactions', async ({ page }) => {
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open chat sidebar
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Editor should still be interactive
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('New text while chat is open');

    // Verify text was typed
    await expect(editor).toContainText('New text while chat is open');
  });
});
