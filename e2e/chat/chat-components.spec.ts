/**
 * E2E tests for Chat Components
 *
 * NOTE: These tests depend on Task 4.8 (ChatSidebar) being implemented.
 * They test the integrated behavior of chat components in the browser.
 *
 * Run with: npm run test:e2e e2e/chat/chat-components.spec.ts
 */
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Chat Component E2E Tests', () => {
  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  });

  test.describe('ConfirmDialog', () => {
    test('should close when backdrop is clicked', async ({ page }) => {
      // Open chat and trigger clear history to show confirm dialog
      await page.getByTestId('chat-sidebar-toggle').click();
      await page.getByTestId('chat-clear-history').click();

      // Verify dialog is visible
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();

      // Click backdrop (outside dialog)
      await page.getByTestId('confirm-backdrop').click({ position: { x: 10, y: 10 } });

      // Dialog should be closed
      await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    });

    test('should close when Escape key is pressed', async ({ page }) => {
      // Open chat and trigger clear history to show confirm dialog
      await page.getByTestId('chat-sidebar-toggle').click();
      await page.getByTestId('chat-clear-history').click();

      // Verify dialog is visible
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();

      // Press Escape key
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    });
  });

  test.describe('ChatInput Keyboard Navigation', () => {
    test('should send message on Enter key', async ({ page }) => {
      await page.getByTestId('chat-sidebar-toggle').click();

      const input = page.getByTestId('chat-input');
      await input.fill('Test message via Enter');
      await input.press('Enter');

      // Message should appear in the list
      await expect(page.getByTestId('chat-message').first()).toContainText('Test message via Enter');
    });

    test('should NOT send message on Shift+Enter (allows newlines)', async ({ page }) => {
      await page.getByTestId('chat-sidebar-toggle').click();

      const input = page.getByTestId('chat-input');
      await input.fill('Line 1');
      await input.press('Shift+Enter');
      await input.type('Line 2');

      // Message should NOT be sent (still in input)
      await expect(input).toHaveValue('Line 1\nLine 2');
    });

    test('should focus input when sidebar opens', async ({ page }) => {
      await page.getByTestId('chat-sidebar-toggle').click();

      // Input should be focusable and ready for typing
      const input = page.getByTestId('chat-input');
      await expect(input).toBeVisible();
      await input.focus();
      await expect(input).toBeFocused();
    });
  });

  test.describe('ChatMessage Streaming States', () => {
    test('ChatMessage shows streaming cursor during AI response', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      // Mock slow streaming response
      await page.route('**/api/ai/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            // Send chunks slowly to observe streaming state
            for (let i = 0; i < 5; i++) {
              await new Promise((r) => setTimeout(r, 500));
              controller.enqueue(encoder.encode(`data: {"type":"content","content":"chunk ${i}"}\n\n`));
            }
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          },
        });
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: Buffer.from(await new Response(stream).arrayBuffer()),
        });
      });

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.getByTestId('chat-sidebar-toggle').click();
      await page.getByTestId('chat-input').fill('Test streaming');
      await page.getByTestId('chat-send-button').click();

      // Verify cursor animation visible during streaming
      const streamingMessage = page.getByTestId('chat-message').last();
      await expect(streamingMessage).toHaveAttribute('data-streaming', 'true');
    });

    test('ChatMessage retry button works after error', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      let callCount = 0;

      await page.route('**/api/ai/chat', async (route) => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
        } else {
          // Retry succeeds
          await route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'data: {"type":"content","content":"Success"}\n\ndata: {"type":"done"}\n\n',
          });
        }
      });

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.getByTestId('chat-sidebar-toggle').click();
      await page.getByTestId('chat-input').fill('Test retry');
      await page.getByTestId('chat-send-button').click();

      // Verify error state and retry button
      await expect(page.getByTestId('chat-retry')).toBeVisible();
      await page.getByTestId('chat-retry').click();

      // Verify retry succeeded
      await expect(page.getByTestId('chat-message').last()).toContainText('Success');
    });
  });

  test.describe('ModeIndicator Styling', () => {
    test('ModeIndicator shows correct color for each mode', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.getByTestId('chat-sidebar-toggle').click();

      // Test discussion mode (info colors)
      await page.getByTestId('chat-input').fill('explain this');
      const indicator = page.getByTestId('chat-mode-indicator');
      await expect(indicator).toHaveClass(/text-info-dark/);
      await expect(indicator).toHaveClass(/bg-info-light/);

      // Test global edit mode (warning colors)
      await page.getByTestId('chat-input').clear();
      await page.getByTestId('chat-input').fill('change all headings');
      await expect(indicator).toHaveClass(/text-warning-dark/);
      await expect(indicator).toHaveClass(/bg-warning-light/);

      // Test research mode (success colors)
      await page.getByTestId('chat-input').clear();
      await page.getByTestId('chat-input').fill('find papers on');
      await expect(indicator).toHaveClass(/text-success-dark/);
      await expect(indicator).toHaveClass(/bg-success-light/);
    });
  });
});
