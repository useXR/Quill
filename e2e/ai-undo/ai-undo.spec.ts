/**
 * E2E tests for AI Undo functionality
 *
 * Tests the AI undo button and history panel:
 * - Undo button behavior
 * - History panel display
 * - Restore functionality
 * - Content restoration
 */
import { test, expect } from '../fixtures/test-fixtures';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('AI Undo Button', () => {
  let diffPage: DiffPanelPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    diffPage = new DiffPanelPage(page);

    // Mock operations endpoint with sample data
    await page.route('**/api/ai/operations**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              id: 'op-1',
              operation_type: 'global_edit',
              input_summary: 'Made text more formal',
              snapshot_before: { content: 'Original content before edit' },
              status: 'accepted',
              created_at: new Date().toISOString(),
            },
            {
              id: 'op-2',
              operation_type: 'global_edit',
              input_summary: 'Fixed grammar issues',
              snapshot_before: { content: 'Even earlier content' },
              status: 'accepted',
              created_at: new Date(Date.now() - 3600000).toISOString(),
            },
          ]),
        });
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  });

  test('should display undo button with operation count', async ({ page }) => {
    const undoButton = page.getByTestId('ai-undo-button');
    await expect(undoButton).toBeVisible();

    // Should show count badge
    const countBadge = page.getByTestId('undo-count');
    await expect(countBadge).toHaveText('2');
  });

  test('should show tooltip with last operation summary', async ({ page }) => {
    const undoButton = page.getByTestId('ai-undo-button');
    const title = await undoButton.getAttribute('title');
    expect(title).toContain('Made text more formal');
  });

  test('should toggle history panel on dropdown click', async ({ page }) => {
    const historyToggle = page.getByTestId('ai-history-toggle');
    const historyPanel = page.getByTestId('ai-history-panel');

    // Initially hidden
    await expect(historyPanel).not.toBeVisible();

    // Click to open
    await historyToggle.click();
    await expect(historyPanel).toBeVisible();

    // Click to close
    await historyToggle.click();
    await expect(historyPanel).not.toBeVisible();
  });

  test('should display operations in history panel', async ({ page }) => {
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    const snapshots = page.getByTestId('ai-snapshot');
    await expect(snapshots).toHaveCount(2);

    // Check operation summaries
    await expect(snapshots.first()).toContainText('Made text more formal');
    await expect(snapshots.last()).toContainText('Fixed grammar issues');
  });

  test('should restore content when undo clicked', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Current content after edits');

    // Click undo button
    await page.getByTestId('ai-undo-button').click();

    // Wait for content restoration
    await page.waitForTimeout(500);

    // Content should be restored to snapshot
    const content = await editor.textContent();
    expect(content).toBe('Original content before edit');
  });

  test('should restore specific operation from history', async ({ page }) => {
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Current content');

    // Open history and restore older operation
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    const restoreButtons = page.getByTestId('restore-snapshot');
    await restoreButtons.last().click(); // Restore the older one

    // Wait for content restoration
    await page.waitForTimeout(500);

    // Content should be restored to older snapshot
    const content = await editor.textContent();
    expect(content).toBe('Even earlier content');
  });

  test('should close history panel after restore', async ({ page }) => {
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    await page.getByTestId('restore-snapshot').first().click();

    // Panel should close
    await expect(page.getByTestId('ai-history-panel')).not.toBeVisible();
  });
});

test.describe('AI Undo - Empty State', () => {
  test('should disable undo button when no operations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock empty operations
    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    const undoButton = page.getByTestId('ai-undo-button');
    await expect(undoButton).toBeDisabled();

    // No count badge
    await expect(page.getByTestId('undo-count')).not.toBeVisible();

    // History toggle also disabled
    await expect(page.getByTestId('ai-history-toggle')).toBeDisabled();
  });

  test('should show appropriate tooltip when no operations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    const undoButton = page.getByTestId('ai-undo-button');
    const title = await undoButton.getAttribute('title');
    expect(title).toBe('No AI operations to undo');
  });
});

test.describe('AI Undo - Error Handling', () => {
  test('should handle API errors gracefully', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock API error
    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Should still render, just disabled
    const undoButton = page.getByTestId('ai-undo-button');
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toBeDisabled();
  });

  test('should handle restore failure gracefully', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock operations but fail on PATCH
    await page.route('**/api/ai/operations**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              id: 'op-1',
              input_summary: 'Test op',
              snapshot_before: { content: 'Snapshot content' },
              status: 'accepted',
              created_at: new Date().toISOString(),
            },
          ]),
        });
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Failed to update' }),
        });
      }
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    const editor = page.getByTestId('document-editor').locator('.ProseMirror');
    await editor.click();
    await editor.fill('Current content');

    // Try to undo - should still restore content even if API fails
    await page.getByTestId('ai-undo-button').click();
    await page.waitForTimeout(500);

    // Content should still be restored (optimistic update)
    const content = await editor.textContent();
    expect(content).toBe('Snapshot content');
  });
});

test.describe('AI Undo - Keyboard Navigation', () => {
  test('history panel closes on Escape', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ id: 'op-1', input_summary: 'Test', created_at: new Date().toISOString() }]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ai-history-panel')).not.toBeVisible();
  });

  test('can navigate history with keyboard', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.route('**/api/ai/operations**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: 'op-1', input_summary: 'Op 1', created_at: new Date().toISOString() },
          { id: 'op-2', input_summary: 'Op 2', created_at: new Date().toISOString() },
        ]),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('ai-history-toggle').click();
    await expect(page.getByTestId('ai-history-panel')).toBeVisible();

    // Focus first restore button
    const restoreButtons = page.getByTestId('restore-snapshot');
    await restoreButtons.first().focus();
    await expect(restoreButtons.first()).toBeFocused();

    // Tab to next restore button
    await page.keyboard.press('Tab');
    // Could be in between elements, so tab again
    await page.keyboard.press('Tab');

    // Should be able to activate with Enter
    await page.keyboard.press('Enter');

    // Panel should close after restore
    await expect(page.getByTestId('ai-history-panel')).not.toBeVisible();
  });
});
