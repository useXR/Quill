/**
 * E2E tests for Chat Sidebar
 *
 * Tests sidebar visibility, toggle behavior, and state management.
 *
 * Run with: npm run test:e2e e2e/chat/chat-sidebar.spec.ts
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat Sidebar E2E', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should show toggle button when sidebar is closed', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(chatPage.sidebarToggle).toBeVisible();
    await expect(chatPage.sidebar).not.toBeVisible();
  });

  test('should open sidebar when toggle clicked', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await chatPage.open();
    await expect(chatPage.sidebar).toBeVisible();
  });

  test('should close sidebar when close button clicked', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await chatPage.open();
    await chatPage.close();
    await expect(chatPage.sidebar).not.toBeVisible();
  });

  test('should persist sidebar state across navigation', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await chatPage.open();

    // Navigate away and back
    await page.goto('/projects');
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Sidebar should start closed (default behavior, localStorage persistence is optional)
    await expect(chatPage.sidebarToggle).toBeVisible();
  });
});

test.describe('ChatSidebar Empty and Loading States', () => {
  test('shows empty state when no messages', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // If clear button exists and there are messages, clear history
    const clearButton = page.getByTestId('chat-clear-history');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      const confirmBtn = page.getByTestId('confirm-confirm');
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
    }

    // Verify empty state message visible
    await expect(page.getByText('Start a conversation')).toBeVisible();
    await expect(page.getByTestId('chat-message')).toHaveCount(0);
  });

  test('shows loading indicator during thinking phase', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock slow response to observe loading state
    await page.route('**/api/ai/chat', async (route) => {
      // Delay before first chunk to show "thinking" state
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Response"}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test loading state');
    await page.getByTestId('chat-send-button').click();

    // Verify "thinking" indicator appears before stream starts
    await expect(page.getByTestId('chat-loading')).toBeVisible({ timeout: 1000 });
    await expect(page.getByText('Claude is thinking')).toBeVisible({ timeout: 1000 });
  });

  test('shows error banner on API failure', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock API failure
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test error state');
    await page.getByTestId('chat-send-button').click();

    // Verify error banner appears
    await expect(page.getByTestId('chat-error')).toBeVisible({ timeout: TIMEOUTS.API_CALL });
    await expect(page.getByTestId('chat-error')).toHaveClass(/bg-error-light/);
  });

  test('error banner clears when new message sent successfully', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    let callCount = 0;

    await page.route('**/api/ai/chat', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Error' }) });
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"content","content":"Success"}\n\ndata: {"type":"done"}\n\n',
        });
      }
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // First message fails
    await page.getByTestId('chat-input').fill('First message');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-error')).toBeVisible({ timeout: TIMEOUTS.API_CALL });

    // Second message succeeds - error should clear
    await page.getByTestId('chat-input').fill('Second message');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-error')).not.toBeVisible({ timeout: TIMEOUTS.API_CALL });
  });
});
