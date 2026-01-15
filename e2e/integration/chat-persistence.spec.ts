/**
 * E2E Integration Tests for Chat Functionality
 *
 * Tests verifying basic chat functionality works correctly
 * within the document editor context.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat Basic Functionality', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page }) => {
    // Storage state from setup project provides authentication
    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('chat sidebar opens and can send messages', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    // Wait for editor to be ready
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open chat sidebar
    await chatPage.open();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Send a message
    claudeMock.registerResponse('test', mockResponses.simpleDiscussion);
    await chatPage.sendMessage('Test message');
    await chatPage.waitForStreamingComplete();

    // Verify message appears
    const messages = chatPage.messages;
    await expect(messages.first()).toContainText('Test message');
  });

  test('chat receives streaming response', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    await chatPage.open();

    claudeMock.registerResponse('hello', { content: 'Hello! How can I help you?' });
    await chatPage.sendMessage('hello');
    await chatPage.waitForStreamingComplete();

    // Verify assistant response appears
    const messages = await chatPage.getMessages();
    expect(messages.some((m) => m.includes('Hello'))).toBe(true);
  });

  test('multiple messages can be sent in sequence', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    await chatPage.open();

    // Send first message
    claudeMock.registerResponse('first', { content: 'Response 1' });
    await chatPage.sendMessage('First message');
    await chatPage.waitForStreamingComplete();

    // Send second message
    claudeMock.registerResponse('second', { content: 'Response 2' });
    await chatPage.sendMessage('Second message');
    await chatPage.waitForStreamingComplete();

    // Verify both messages exist
    const allMessages = await chatPage.getMessages();
    expect(allMessages.join(' ')).toContain('First message');
    expect(allMessages.join(' ')).toContain('Second message');
  });

  test('chat sidebar can be closed', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // Open then close
    await chatPage.open();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    await chatPage.close();
    await expect(page.getByTestId('chat-sidebar')).not.toBeVisible();
  });
});

test.describe('Chat Mode Detection', () => {
  test('discussion mode messages work correctly', async ({ page, workerCtx }) => {
    // Storage state from setup project provides authentication
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"content","content":"Here is what I think about that paragraph..."}\n\ndata: {"type":"done"}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send a discussion message (not an edit request)
    await page.getByTestId('chat-input').fill('What do you think about this paragraph?');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('chat-message').last()).toContainText('Here is what I think', {
      timeout: TIMEOUTS.API_CALL * 2,
    });
  });

  test('global edit triggers diff panel', async ({ page, workerCtx }) => {
    // Storage state from setup project provides authentication
    await page.route('**/api/ai/global-edit', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"done","operationId":"op-1","modifiedContent":"Changed content","diff":[{"type":"add","value":"Changed content","lineNumber":1}]}\n\n',
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    await page.getByTestId('chat-sidebar-toggle').click();

    // Send global edit message (detected by keywords like "change all")
    await page.getByTestId('chat-input').fill('change all headings');
    await page.getByTestId('chat-send-button').click();

    // Verify diff panel appears
    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: TIMEOUTS.API_CALL * 2 });
  });
});
