/**
 * CLI Streaming E2E Tests
 *
 * Tests for the rich CLI streaming features:
 * - Thinking section display
 * - Tool activity timeline
 * - Stats footer
 *
 * Run with: pnpm test:e2e e2e/chat/chat-cli-streaming.spec.ts
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('CLI Streaming Features', () => {
  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await expect(page.getByTestId('document-editor')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    // Open chat sidebar
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();
  });

  test('should display thinking section when Claude reasons', async ({ page }) => {
    // Mock the chat API with thinking content
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"type":"thinking","content":"Let me analyze this document..."}',
          'data: {"type":"content","content":"Based on my analysis, this document is about testing."}',
          'data: {"type":"done"}',
        ]
          .map((line) => line + '\n\n')
          .join(''),
      });
    });

    // Send a message
    await page.getByTestId('chat-input').fill('What is this document about?');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Thinking section should be visible (collapsed by default)
    const thinkingSection = page.getByTestId('thinking-section');
    await expect(thinkingSection).toBeVisible();

    // Click to expand
    await thinkingSection.click();

    // Thinking content should be visible
    await expect(page.getByText('Let me analyze this document...')).toBeVisible();
  });

  test('should display tool activity timeline during edits', async ({ page }) => {
    // Mock the chat API with tool calls
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"type":"tool_call","toolId":"tool_1","tool":"Read","input":{"file_path":"/tmp/doc.txt"}}',
          'data: {"type":"tool_result","toolId":"tool_1","tool":"Read","success":true,"message":"Read completed"}',
          'data: {"type":"tool_call","toolId":"tool_2","tool":"Edit","input":{"file_path":"/tmp/doc.txt"}}',
          'data: {"type":"tool_result","toolId":"tool_2","tool":"Edit","success":true,"message":"Edit completed"}',
          'data: {"type":"content","content":"I have updated the document."}',
          'data: {"type":"done"}',
        ]
          .map((line) => line + '\n\n')
          .join(''),
      });
    });

    // Send a message requesting edits
    await page.getByTestId('chat-input').fill('Fix the typos in my document');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Tool activity timeline should be visible
    const timeline = page.getByTestId('tool-activity-timeline');
    await expect(timeline).toBeVisible();

    // Should show tool items
    const toolItems = page.getByTestId('tool-activity-item');
    await expect(toolItems).toHaveCount(2);

    // Both should be successful (have success status)
    await expect(toolItems.first()).toHaveAttribute('data-status', 'success');
    await expect(toolItems.last()).toHaveAttribute('data-status', 'success');
  });

  test('should show tool activity with pending state during streaming', async ({ page }) => {
    // Use a delayed mock to simulate streaming
    await page.route('**/api/ai/chat', async (route) => {
      // Create a stream that sends events with delays
      const events = [
        'data: {"type":"tool_call","toolId":"tool_1","tool":"Read","input":{"file_path":"/tmp/doc.txt"}}',
      ];

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: events.map((line) => line + '\n\n').join(''),
      });
    });

    // Send message
    await page.getByTestId('chat-input').fill('Read my document');
    await page.getByTestId('chat-send-button').click();

    // Wait for at least one tool call to appear
    const toolItem = page.getByTestId('tool-activity-item');
    await expect(toolItem).toBeVisible({ timeout: TIMEOUTS.API_CALL });

    // Should be in pending state (no result yet)
    await expect(toolItem).toHaveAttribute('data-status', 'pending');
  });

  test('should display stats footer after completion', async ({ page }) => {
    // Mock the chat API with stats
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"type":"content","content":"Here is my response."}',
          'data: {"type":"stats","inputTokens":1500,"outputTokens":250,"durationMs":3200}',
          'data: {"type":"done"}',
        ]
          .map((line) => line + '\n\n')
          .join(''),
      });
    });

    // Send a message
    await page.getByTestId('chat-input').fill('Summarize this document');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Stats footer should be visible
    const statsFooter = page.getByTestId('stats-footer');
    await expect(statsFooter).toBeVisible();

    // Should show token count (1.8k = 1500 + 250)
    await expect(statsFooter).toContainText(/1\.8k tokens/i);

    // Should show duration
    await expect(statsFooter).toContainText(/3\.2s/);
  });

  test('should handle tool errors gracefully', async ({ page }) => {
    // Mock the chat API with a failed tool
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"type":"tool_call","toolId":"tool_1","tool":"Read","input":{"file_path":"/nonexistent.txt"}}',
          'data: {"type":"tool_result","toolId":"tool_1","tool":"Read","success":false,"message":"File not found"}',
          'data: {"type":"content","content":"I was unable to read the file."}',
          'data: {"type":"done"}',
        ]
          .map((line) => line + '\n\n')
          .join(''),
      });
    });

    // Send a message
    await page.getByTestId('chat-input').fill('Read a file');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Tool activity should show error state
    const toolItem = page.getByTestId('tool-activity-item');
    await expect(toolItem).toHaveAttribute('data-status', 'error');
  });

  test('should show multiple tool operations in order', async ({ page }) => {
    // Mock the chat API with multiple sequential tools
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"type":"tool_call","toolId":"tool_1","tool":"Read","input":{}}',
          'data: {"type":"tool_result","toolId":"tool_1","tool":"Read","success":true,"message":"Read completed"}',
          'data: {"type":"tool_call","toolId":"tool_2","tool":"Edit","input":{}}',
          'data: {"type":"tool_result","toolId":"tool_2","tool":"Edit","success":true,"message":"Edit completed"}',
          'data: {"type":"tool_call","toolId":"tool_3","tool":"Write","input":{}}',
          'data: {"type":"tool_result","toolId":"tool_3","tool":"Write","success":true,"message":"Write completed"}',
          'data: {"type":"content","content":"Done!"}',
          'data: {"type":"done"}',
        ]
          .map((line) => line + '\n\n')
          .join(''),
      });
    });

    // Send a message
    await page.getByTestId('chat-input').fill('Edit my document');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Should have 3 tool items
    const toolItems = page.getByTestId('tool-activity-item');
    await expect(toolItems).toHaveCount(3);

    // Verify tool names
    await expect(toolItems.nth(0)).toHaveAttribute('data-tool', 'Read');
    await expect(toolItems.nth(1)).toHaveAttribute('data-tool', 'Edit');
    await expect(toolItems.nth(2)).toHaveAttribute('data-tool', 'Write');
  });

  test('should not show thinking/stats for user messages', async ({ page }) => {
    // Mock the chat API
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"type":"thinking","content":"Analyzing..."}',
          'data: {"type":"content","content":"Response"}',
          'data: {"type":"stats","inputTokens":100,"outputTokens":50,"durationMs":1000}',
          'data: {"type":"done"}',
        ]
          .map((line) => line + '\n\n')
          .join(''),
      });
    });

    // Send a message
    await page.getByTestId('chat-input').fill('Hello');
    await page.getByTestId('chat-send-button').click();

    // Wait for response
    await expect(page.getByTestId('chat-message')).toHaveCount(2, { timeout: TIMEOUTS.API_CALL });

    // Get user message (first one)
    const userMessage = page.getByTestId('chat-message').first();
    await expect(userMessage).toHaveAttribute('data-role', 'user');

    // User message should not have thinking section or stats
    // (they should only be in assistant message)
    const thinkingSections = page.getByTestId('thinking-section');
    const statsFooters = page.getByTestId('stats-footer');

    // There should be exactly 1 of each (in the assistant message only)
    await expect(thinkingSections).toHaveCount(1);
    await expect(statsFooters).toHaveCount(1);
  });
});
