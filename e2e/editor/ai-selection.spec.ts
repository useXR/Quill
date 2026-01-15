/**
 * AI Selection E2E tests
 *
 * Tests for the AI-powered text selection toolbar including:
 * - Selection toolbar visibility
 * - AI action buttons (Refine, Extend, Summarize, Simplify)
 * - Accept/Reject workflow
 * - Keyboard navigation
 * - Error handling
 *
 * Note: These tests mock the AI API responses to avoid actual Claude CLI calls.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';
import { EditorPage } from '../pages/EditorPage';

// Test data - stored per-worker to avoid race conditions
const testData: { projectId?: string; documentId?: string } = {};

// Helper to create a test project via API
async function createTestProject(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      title: `E2E AI Test ${Date.now()}`,
      description: 'Test project for AI selection E2E tests',
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()}`);
  }

  const project = await response.json();
  return project.id;
}

// Helper to create a test document via API with content
async function createTestDocument(
  page: import('@playwright/test').Page,
  projectId: string,
  content?: object
): Promise<string> {
  const response = await page.request.post('/api/documents', {
    data: {
      project_id: projectId,
      title: `E2E AI Document ${Date.now()}`,
      content: content || {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'This is some sample text that we can select for AI processing. It contains multiple words that can be refined, extended, summarized, or simplified.',
              },
            ],
          },
        ],
      },
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create document: ${response.status()}`);
  }

  const document = await response.json();
  return document.id;
}

// Mock AI API response helper
function mockAIResponse(page: import('@playwright/test').Page, response: string, delay = 100) {
  return page.route('**/api/ai/generate', async (route) => {
    // Simulate SSE streaming response
    const encoder = new TextEncoder();
    const chunks = response.split(' ');

    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await new Promise((resolve) => setTimeout(resolve, delay / chunks.length));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk + ' ' })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: Buffer.from(await new Response(stream).arrayBuffer()),
    });
  });
}

// Mock AI API error response
function mockAIError(page: import('@playwright/test').Page, errorMessage: string) {
  return page.route('**/api/ai/generate', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: errorMessage }),
    });
  });
}

test.describe('AI Selection Toolbar', () => {
  // Create test project and document once for all tests in this worker
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    // Create project via API
    testData.projectId = await createTestProject(page);

    // Create document via API with sample content
    testData.documentId = await createTestDocument(page, testData.projectId);

    await context.close();
  });

  test.describe('Toolbar Visibility', () => {
    test('should not show selection toolbar without text selection', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Just click in editor without selecting
      await editorPage.editor.click();

      // Toolbar should not be visible
      const isVisible = await editorPage.isSelectionToolbarVisible();
      expect(isVisible).toBe(false);
    });

    test('should show selection toolbar when text is selected', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Select text
      await editorPage.selectAll();

      // Wait for toolbar to appear
      await editorPage.waitForSelectionToolbar();

      // Verify all action buttons are visible
      await expect(editorPage.refineButton).toBeVisible();
      await expect(editorPage.extendButton).toBeVisible();
      await expect(editorPage.summarizeButton).toBeVisible();
      await expect(editorPage.simplifyButton).toBeVisible();
    });

    test('should hide toolbar when selection is cleared', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Select text
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      // Clear selection by clicking elsewhere
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Toolbar should be hidden
      const isVisible = await editorPage.isSelectionToolbarVisible();
      expect(isVisible).toBe(false);
    });
  });

  test.describe('AI Actions', () => {
    test('should trigger refine action and show loading state', async ({ page }) => {
      // Mock the AI API
      await mockAIResponse(page, 'This is the refined text with improved clarity.', 500);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Select text and click refine
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');

      // Should show accept/reject buttons after completion
      await editorPage.waitForAIComplete();
      await expect(editorPage.acceptButton).toBeVisible();
      await expect(editorPage.rejectButton).toBeVisible();
    });

    test('should trigger extend action', async ({ page }) => {
      await mockAIResponse(page, 'Extended text with more detail and depth.', 300);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('extend');

      await editorPage.waitForAIComplete();
      await expect(editorPage.acceptButton).toBeVisible();
    });

    test('should trigger summarize action', async ({ page }) => {
      await mockAIResponse(page, 'Brief summary of the text.', 200);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('summarize');

      await editorPage.waitForAIComplete();
      await expect(editorPage.acceptButton).toBeVisible();
    });

    test('should trigger simplify action', async ({ page }) => {
      await mockAIResponse(page, 'Simpler version of the text.', 200);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('simplify');

      await editorPage.waitForAIComplete();
      await expect(editorPage.acceptButton).toBeVisible();
    });
  });

  test.describe('Accept/Reject Workflow', () => {
    test('should replace text when accepting AI suggestion', async ({ page }) => {
      const refinedText = 'This is the refined and improved text.';
      await mockAIResponse(page, refinedText, 200);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Get original content
      const originalContent = await editorPage.getTextContent();

      // Select all, refine, and accept
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');
      await editorPage.waitForAIComplete();
      await editorPage.acceptAISuggestion();

      // Wait for toolbar to close
      await page.waitForTimeout(200);

      // Content should be changed
      const newContent = await editorPage.getTextContent();
      expect(newContent).not.toBe(originalContent);
    });

    test('should keep original text when rejecting AI suggestion', async ({ page }) => {
      await mockAIResponse(page, 'New text that will be rejected.', 200);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Get original content
      const originalContent = await editorPage.getTextContent();

      // Select all, refine, and reject
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');
      await editorPage.waitForAIComplete();
      await editorPage.rejectAISuggestion();

      // Wait for toolbar to close
      await page.waitForTimeout(200);

      // Content should remain the same
      const newContent = await editorPage.getTextContent();
      expect(newContent).toBe(originalContent);
    });

    test('should dismiss toolbar with Escape key', async ({ page }) => {
      await mockAIResponse(page, 'Some refined text.', 200);

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      // Select text
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      // Press Escape
      await editorPage.dismissAIToolbar();
      await page.waitForTimeout(100);

      // Toolbar should be hidden
      const isVisible = await editorPage.isSelectionToolbarVisible();
      expect(isVisible).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('should show error state on API failure', async ({ page }) => {
      await mockAIError(page, 'AI service temporarily unavailable');

      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');

      // Should show error
      await editorPage.expectAIError();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate between action buttons with arrow keys', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      // Focus first button
      await editorPage.refineButton.focus();

      // Navigate right
      await page.keyboard.press('ArrowRight');
      await expect(editorPage.extendButton).toBeFocused();

      await page.keyboard.press('ArrowRight');
      await expect(editorPage.summarizeButton).toBeFocused();

      await page.keyboard.press('ArrowRight');
      await expect(editorPage.simplifyButton).toBeFocused();

      // Navigate left
      await page.keyboard.press('ArrowLeft');
      await expect(editorPage.summarizeButton).toBeFocused();
    });

    test('should navigate to first button with Home key', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      // Focus last button
      await editorPage.simplifyButton.focus();

      // Press Home
      await page.keyboard.press('Home');
      await expect(editorPage.refineButton).toBeFocused();
    });

    test('should navigate to last button with End key', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      // Focus first button
      await editorPage.refineButton.focus();

      // Press End
      await page.keyboard.press('End');
      await expect(editorPage.simplifyButton).toBeFocused();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on action buttons', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      // Check ARIA labels
      await expect(editorPage.refineButton).toHaveAttribute('aria-label', /refine.*improve/i);
      await expect(editorPage.extendButton).toHaveAttribute('aria-label', /extend.*expand/i);
      await expect(editorPage.summarizeButton).toHaveAttribute('aria-label', /summarize.*shorter/i);
      await expect(editorPage.simplifyButton).toHaveAttribute('aria-label', /simplify.*easier/i);
    });

    test('should have toolbar with proper role and orientation', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testData.projectId!, testData.documentId!);
      await editorPage.waitForEditorReady();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();

      await expect(editorPage.selectionToolbar).toHaveAttribute('role', 'toolbar');
      await expect(editorPage.selectionToolbar).toHaveAttribute('aria-orientation', 'horizontal');
    });
  });
});
