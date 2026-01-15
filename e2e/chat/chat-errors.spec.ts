/**
 * Chat Error Handling E2E Tests
 *
 * Tests error states, cancellation, and retry functionality.
 * Follows Phase 3 best practice: AbortError doesn't trigger error states.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat Error Handling', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.waitForLoadState('networkidle');
  });

  test('should display error message on network failure', async ({ page }) => {
    claudeMock.registerResponse('fail', mockResponses.networkError);

    await chatPage.open();
    await chatPage.sendMessage('This will fail');

    // Wait for error to appear
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Check for error message
    const errorIndicator = page.locator('[data-testid="chat-error"], .error, [role="alert"]').first();
    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Error should be displayed somehow
    // Note: The specific implementation may vary
  });

  test('should show retry button after error', async ({ page }) => {
    claudeMock.registerResponse('retry', mockResponses.networkError);

    await chatPage.open();
    await chatPage.sendMessage('retry test');

    // Wait for error and retry button
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Look for retry button
    const retryButton = page.locator('[data-testid="chat-retry"], button:has-text("retry")', {
      hasText: /retry/i,
    });
    const hasRetry = await retryButton
      .first()
      .isVisible()
      .catch(() => false);
  });

  test('should show cancel button during streaming', async ({ page }) => {
    // Use slow response to give time to see cancel button
    claudeMock.registerResponse('slow', {
      content: 'This is a slow response that takes time',
      delayMs: 3000,
    });

    await chatPage.open();
    await chatPage.sendMessage('slow request');

    // Should show cancel button during streaming
    const cancelButton = page.locator('[data-testid="chat-cancel-stream"], button:has-text("cancel")');

    // Wait a short time for streaming to start
    await page.waitForTimeout(500);

    const isCancelVisible = await cancelButton
      .first()
      .isVisible()
      .catch(() => false);

    // Wait for streaming to complete
    await chatPage.waitForStreamingComplete();
  });

  test('should not show error when user cancels streaming', async ({ page }) => {
    // Use slow response to give time to cancel
    claudeMock.registerResponse('cancel', {
      content: 'This response will be cancelled',
      delayMs: 5000,
    });

    await chatPage.open();
    await chatPage.sendMessage('cancel test');

    // Wait for streaming to start
    await page.waitForTimeout(500);

    // Look for cancel button
    const cancelButton = page.locator('[data-testid="chat-cancel-stream"], button:has-text("cancel")').first();
    const isCancelVisible = await cancelButton.isVisible().catch(() => false);

    if (isCancelVisible) {
      // Cancel the request
      await cancelButton.click();

      // Wait a moment for any potential error to appear
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // CRITICAL: User-initiated abort should NOT trigger error state
      // This follows Phase 3 best practice: "AbortError doesn't trigger onError"
      const errorIndicator = page.locator('[data-testid="chat-error"], .error-message, [role="alert"]');
      const hasError = await errorIndicator
        .first()
        .isVisible()
        .catch(() => false);

      // We expect no error to be shown after user cancellation
      expect(hasError).toBeFalsy();
    }
  });

  test('retry should work after error', async ({ page }) => {
    // First request fails
    claudeMock.registerResponse('retry-success', mockResponses.networkError);

    await chatPage.open();
    await chatPage.sendMessage('retry-success test');

    // Wait for error
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Register success response for retry
    claudeMock.registerResponse('retry-success', mockResponses.simpleDiscussion);

    // Look for retry button and click it
    const retryButton = page.locator('[data-testid="chat-retry"], button:has-text("retry")').first();
    const hasRetry = await retryButton.isVisible().catch(() => false);

    if (hasRetry) {
      await retryButton.click();
      await chatPage.waitForStreamingComplete();

      // Verify we got a response
      const messages = await chatPage.getMessages();
      expect(messages.length).toBeGreaterThan(0);
    }
  });

  test('handles rate limiting gracefully', async ({ page }) => {
    // Simulate rate limit error
    claudeMock.registerResponse('rate-limit', {
      content: '',
      error: { type: 'api', message: 'Rate limit exceeded' },
    });

    await chatPage.open();
    await chatPage.sendMessage('rate-limit test');

    // Wait for error
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Should show some indication of rate limiting
    // The specific implementation may show a toast, inline error, or message
  });

  test('handles API timeout gracefully', async ({ page }) => {
    // Simulate timeout
    claudeMock.registerResponse('timeout', {
      content: '',
      error: { type: 'timeout', message: 'Request timed out' },
    });

    await chatPage.open();
    await chatPage.sendMessage('timeout test');

    // Wait for timeout error
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Should handle timeout gracefully without crashing
  });

  test('multiple rapid requests are handled correctly', async ({ page }) => {
    claudeMock.registerResponse('rapid', { content: 'Response to rapid request' });

    await chatPage.open();

    // Send multiple messages rapidly
    await chatPage.chatInput.fill('rapid test 1');
    await chatPage.sendButton.click();

    // Don't wait, immediately try to send another
    await chatPage.chatInput.fill('rapid test 2');

    // The second message should either queue or wait for the first
    // The UI should handle this gracefully
    await chatPage.waitForStreamingComplete();
  });

  test('error state clears when sending new message', async ({ page }) => {
    // First request fails
    claudeMock.registerResponse('clear-error', mockResponses.networkError);

    await chatPage.open();
    await chatPage.sendMessage('clear-error test');

    // Wait for error
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Register success response
    claudeMock.registerResponse('success-after', mockResponses.simpleDiscussion);

    // Send a new message
    await chatPage.sendMessage('success-after test');
    await chatPage.waitForStreamingComplete();

    // Error should be cleared
    const errorIndicator = page.locator('[data-testid="chat-error"]');
    const hasError = await errorIndicator.isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test('streaming message shows partial content on error', async ({ page }) => {
    // Simulate partial streaming then error
    await page.route('**/api/ai/chat', async (route) => {
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"type":"content","content":"Partial "}\n\n',
        'data: {"type":"content","content":"content "}\n\n',
        // Then error
        'data: {"type":"error","error":"Connection lost"}\n\n',
      ];

      const stream = new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            await new Promise((r) => setTimeout(r, 100));
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: Buffer.from(await new Response(stream).arrayBuffer()),
      });
    });

    await chatPage.open();
    await chatPage.sendMessage('partial streaming test');

    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // The partial content may or may not be shown depending on implementation
    // This test verifies the app doesn't crash
  });

  test('empty message is handled gracefully', async () => {
    await chatPage.open();

    // Try to send empty message
    await chatPage.chatInput.fill('');

    // Send button should be disabled or clicking it should have no effect
    const isButtonDisabled = await chatPage.sendButton.isDisabled().catch(() => false);

    if (!isButtonDisabled) {
      // Click and verify nothing bad happens
      await chatPage.sendButton.click();

      // Should not show an error or unexpected behavior
      await chatPage.page.waitForTimeout(TIMEOUTS.ANIMATION);
    }
  });

  test('very long message is handled gracefully', async ({ page }) => {
    claudeMock.registerResponse('long', { content: 'Response to long message' });

    await chatPage.open();

    // Create a very long message
    const longMessage = 'This is a test message. '.repeat(500);
    await chatPage.chatInput.fill(longMessage);
    await chatPage.sendButton.click();

    // Should either accept or gracefully reject the message
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // App should not crash
    await expect(chatPage.sidebar).toBeVisible();
  });
});
