/**
 * E2E tests for DiffPanel component
 *
 * Tests the diff review functionality including:
 * - Accept/reject individual changes
 * - Accept/reject all changes
 * - Progress tracking
 * - Apply button behavior
 */
import { test, expect } from '../fixtures/test-fixtures';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ChatPage } from '../pages/ChatPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('DiffPanel', () => {
  let diffPage: DiffPanelPage;
  let chatPage: ChatPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    diffPage = new DiffPanelPage(page);
    chatPage = new ChatPage(page);
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  });

  test.describe('Panel Display', () => {
    test('should display diff panel when global edit triggered', async ({ page }) => {
      // Mock the global edit response
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-test","modifiedContent":"Modified content","diff":[{"type":"remove","value":"Original","lineNumber":1},{"type":"add","value":"Modified content","lineNumber":1}]}\n\n',
        });
      });

      // Set up initial content
      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Original content');

      // Trigger global edit via chat
      await chatPage.open();
      await chatPage.sendMessage('Change everything');
      await chatPage.waitForStreamingComplete();

      // Verify panel is shown
      await diffPage.waitForPanelVisible();
      expect(await diffPage.getChangeCount()).toBeGreaterThan(0);
    });

    test('should show stats in header', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-stats","modifiedContent":"New line 1\\nNew line 2","diff":[{"type":"remove","value":"Old line 1","lineNumber":1},{"type":"add","value":"New line 1","lineNumber":1},{"type":"add","value":"New line 2","lineNumber":2}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Old line 1');

      await chatPage.open();
      await chatPage.sendMessage('Add more lines');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      // Header should show stats
      const headerText = await diffPage.header.textContent();
      expect(headerText).toContain('Review Changes');
    });

    test('should close panel on close button click', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-close","modifiedContent":"Test","diff":[{"type":"add","value":"Test","lineNumber":1}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Original');

      await chatPage.open();
      await chatPage.sendMessage('Change it');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      await diffPage.close();
      await diffPage.waitForPanelHidden();
    });

    test('should close panel on Escape key', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-esc","modifiedContent":"Test","diff":[{"type":"add","value":"Test","lineNumber":1}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Original');

      await chatPage.open();
      await chatPage.sendMessage('Change it');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      await page.keyboard.press('Escape');
      await diffPage.waitForPanelHidden();
    });
  });

  test.describe('Accept/Reject Changes', () => {
    test('should update progress when accepting changes', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-prog","modifiedContent":"New","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New","lineNumber":1}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Old');

      await chatPage.open();
      await chatPage.sendMessage('Change');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      // Initial progress
      const initialProgress = await diffPage.getProgressText();
      expect(initialProgress).toContain('0 /');

      // Accept first change
      await diffPage.acceptChange(0);

      // Progress should update
      const updatedProgress = await diffPage.getProgressText();
      expect(updatedProgress).toContain('1 /');
    });

    test('should show Apply button when all changes decided', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-apply","modifiedContent":"New","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New","lineNumber":1}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Old');

      await chatPage.open();
      await chatPage.sendMessage('Change');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      // Apply should not be visible yet
      expect(await diffPage.isApplyVisible()).toBe(false);

      // Accept all changes
      await diffPage.acceptAll();

      // Apply should now be visible
      await expect(diffPage.applyButton).toBeVisible();
    });

    test('Accept All should mark all changes as accepted', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-all","modifiedContent":"New 1\\nNew 2","diff":[{"type":"remove","value":"Old 1","lineNumber":1},{"type":"add","value":"New 1","lineNumber":1},{"type":"remove","value":"Old 2","lineNumber":2},{"type":"add","value":"New 2","lineNumber":2}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Old 1\nOld 2');

      await chatPage.open();
      await chatPage.sendMessage('Change all');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      const changeCount = await diffPage.getChangeCount();
      expect(changeCount).toBe(4);

      await diffPage.acceptAll();

      // Progress should show all reviewed
      const progress = await diffPage.getProgressText();
      expect(progress).toContain(`${changeCount} / ${changeCount}`);
    });

    test('Reject All should mark all changes as rejected', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-rej","modifiedContent":"New","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New","lineNumber":1}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Old');

      await chatPage.open();
      await chatPage.sendMessage('Change');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      await diffPage.rejectAll();

      // Apply should be visible (all decided)
      await expect(diffPage.applyButton).toBeVisible();

      // Progress should show all reviewed
      const progress = await diffPage.getProgressText();
      expect(progress).toContain('2 / 2');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('Tab navigates between buttons', async ({ page }) => {
      await page.route('**/api/ai/global-edit', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"done","operationId":"op-tab","modifiedContent":"New","diff":[{"type":"remove","value":"Old","lineNumber":1},{"type":"add","value":"New","lineNumber":1}]}\n\n',
        });
      });

      const editor = page.getByTestId('document-editor').locator('.ProseMirror');
      await editor.click();
      await editor.fill('Old');

      await chatPage.open();
      await chatPage.sendMessage('Change');
      await chatPage.waitForStreamingComplete();
      await diffPage.waitForPanelVisible();

      // Focus the first accept button
      await diffPage.acceptChangeButtons.first().focus();
      await expect(diffPage.acceptChangeButtons.first()).toBeFocused();

      // Tab to reject button
      await page.keyboard.press('Tab');
      await expect(diffPage.rejectChangeButtons.first()).toBeFocused();
    });
  });
});
