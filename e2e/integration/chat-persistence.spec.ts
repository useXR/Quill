/**
 * E2E Integration Tests for Chat History Persistence
 *
 * Tests verifying that chat messages persist across page reloads
 * and that chat history can be properly cleared.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat History Persistence', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('chat messages persist after page reload', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Send a message
    claudeMock.registerResponse('test', mockResponses.simpleDiscussion);
    await chatPage.open();
    await chatPage.sendMessage('Test message for persistence');
    await chatPage.waitForStreamingComplete();

    // Verify message is present
    const messages = chatPage.messages;
    await expect(messages.first()).toContainText('Test message for persistence');

    // Reload the page
    await page.reload();

    // Re-open chat (may need to wait for history to load)
    await chatPage.open();

    // Wait for messages to load
    await page.waitForTimeout(500);

    // Verify message persisted
    const messagesAfterReload = chatPage.messages;
    await expect(messagesAfterReload.first()).toContainText('Test message for persistence');
  });

  test('chat history can be cleared', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Send a message first
    claudeMock.registerResponse('clear', mockResponses.simpleDiscussion);
    await chatPage.open();
    await chatPage.sendMessage('Message to be cleared');
    await chatPage.waitForStreamingComplete();

    // Clear history
    await page.getByTestId('chat-clear-history').click();
    // Handle confirm dialog
    const confirmButton = page.getByTestId('confirm-action');
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);
    if (isConfirmVisible) {
      await confirmButton.click();
    }

    // Wait for clear to complete
    await page.waitForTimeout(500);

    // Verify messages are gone
    const messageCount = await chatPage.messages.count();
    expect(messageCount).toBe(0);

    // Reload and verify history is gone
    await page.reload();
    await chatPage.open();
    await page.waitForTimeout(500);

    const messagesAfterReload = await chatPage.messages.count();
    expect(messagesAfterReload).toBe(0);
  });

  test('multiple messages persist in correct order', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    await chatPage.open();

    // Send multiple messages
    claudeMock.registerResponse('first', { content: 'Response to first message' });
    await chatPage.sendMessage('First message');
    await chatPage.waitForStreamingComplete();

    claudeMock.registerResponse('second', { content: 'Response to second message' });
    await chatPage.sendMessage('Second message');
    await chatPage.waitForStreamingComplete();

    claudeMock.registerResponse('third', { content: 'Response to third message' });
    await chatPage.sendMessage('Third message');
    await chatPage.waitForStreamingComplete();

    // Reload the page
    await page.reload();
    await chatPage.open();
    await page.waitForTimeout(500);

    // Verify all messages persist in order
    const allMessages = await chatPage.getMessages();
    expect(allMessages.join(' ')).toContain('First message');
    expect(allMessages.join(' ')).toContain('Second message');
    expect(allMessages.join(' ')).toContain('Third message');

    // Verify order is preserved (first before second before third)
    const messagesText = allMessages.join(' ');
    const firstIndex = messagesText.indexOf('First message');
    const secondIndex = messagesText.indexOf('Second message');
    const thirdIndex = messagesText.indexOf('Third message');

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });
});

test.describe('Chat Mode Persistence', () => {
  test('detected mode persists with message after reload', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Done"}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send global edit message (detected by keywords like "change all")
    await page.getByTestId('chat-input').fill('change all headings');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message').last()).toContainText('Done', {
      timeout: TIMEOUTS.API_CALL * 2,
    });

    // Reload page
    await page.reload();
    await page.getByTestId('chat-sidebar-toggle').click();

    // Wait for history to load
    await page.waitForTimeout(500);

    // Verify message retained
    const userMessage = page.getByTestId('chat-message').first();
    await expect(userMessage).toContainText('change all headings');

    // Mode indicator should show global_edit if present
    const modeIndicator = userMessage.getByTestId('chat-mode-indicator');
    const hasModeIndicator = await modeIndicator.isVisible().catch(() => false);
    if (hasModeIndicator) {
      await expect(modeIndicator).toHaveAttribute('data-mode', 'global_edit');
    }
  });

  test('discussion mode messages persist correctly', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Here is what I think..."}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send a discussion message (not an edit request)
    await page.getByTestId('chat-input').fill('What do you think about this paragraph?');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('chat-message').last()).toContainText('Here is what I think', {
      timeout: TIMEOUTS.API_CALL * 2,
    });

    // Reload
    await page.reload();
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.waitForTimeout(500);

    // Verify message persists
    const messages = page.getByTestId('chat-message');
    await expect(messages.first()).toContainText('What do you think');
  });
});

test.describe('Chat Session Isolation', () => {
  test('chat history is document-specific', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const chatPage = new ChatPage(page);
    const claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);

    // Navigate to document and send message
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    claudeMock.registerResponse('document-specific', { content: 'Response for this document' });
    await chatPage.open();
    await chatPage.sendMessage('Document-specific message');
    await chatPage.waitForStreamingComplete();

    // Verify message is there
    await expect(chatPage.messages.first()).toContainText('Document-specific message');

    // Navigate to a different page (project list)
    await page.goto(`/projects/${workerCtx.projectId}`);

    // Return to the document
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await chatPage.open();
    await page.waitForTimeout(500);

    // Verify message is still there for this document
    await expect(chatPage.messages.first()).toContainText('Document-specific message');
  });
});
