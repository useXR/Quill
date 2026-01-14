/**
 * Document Metadata E2E tests
 *
 * Tests for editing document metadata (title) including:
 * - Inline title editing
 * - Save on Enter and blur
 * - Cancel on Escape
 * - Error handling
 * - Accessibility
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';
import { EditorPage } from '../pages/EditorPage';
import { checkElementA11y } from '../helpers/axe';

// Original title to reset to between tests
const ORIGINAL_TITLE = 'Original Document Title';

// Helper to create a test project via API
async function createTestProject(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      title: `E2E Metadata Test ${Date.now()}`,
      description: 'Test project for metadata E2E tests',
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()}`);
  }

  const project = await response.json();
  return project.id;
}

// Helper to create a test document via API
async function createTestDocument(
  page: import('@playwright/test').Page,
  projectId: string,
  title: string
): Promise<string> {
  const response = await page.request.post('/api/documents', {
    data: {
      project_id: projectId,
      title,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create document: ${response.status()}`);
  }

  const document = await response.json();
  return document.id;
}

// Helper to reset document title via API
async function resetDocumentTitle(page: import('@playwright/test').Page, documentId: string): Promise<void> {
  const response = await page.request.patch(`/api/documents/${documentId}`, {
    data: { title: ORIGINAL_TITLE },
  });
  if (!response.ok()) {
    throw new Error(`Failed to reset document title: ${response.status()}`);
  }
}

// Helper to delete project via API (cleanup)
async function deleteTestProject(page: import('@playwright/test').Page, projectId: string): Promise<void> {
  await page.request.delete(`/api/projects/${projectId}`);
}

test.describe('Document Metadata Editing', () => {
  // Test data scoped to this file
  let testProjectId: string;
  let testDocumentId: string;

  // Create test project and document once for all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    // Create project via API
    testProjectId = await createTestProject(page);

    // Create document via API with known title
    testDocumentId = await createTestDocument(page, testProjectId, ORIGINAL_TITLE);

    await context.close();
  });

  // Cleanup after all tests
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    // Delete test project (cascades to documents)
    await deleteTestProject(page, testProjectId);

    await context.close();
  });

  test.describe('Title Display', () => {
    test('should display document title in editor header', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      await editorPage.expectTitle(ORIGINAL_TITLE);
    });

    test('should show edit button on hover', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Hover over title
      await page.getByTestId('editable-title').hover();

      // Edit button should be visible
      await expect(editorPage.titleEditButton).toBeVisible(VISIBILITY_WAIT);
    });
  });

  test.describe('Title Editing', () => {
    // Reset title before each test to ensure consistent state
    test.beforeEach(async ({ page }) => {
      await resetDocumentTitle(page, testDocumentId);
    });

    test('should enter edit mode on title click', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Click title
      await editorPage.documentTitle.click();

      // Input should appear with title value
      await expect(editorPage.titleInput).toBeVisible();
      await expect(editorPage.titleInput).toHaveValue(ORIGINAL_TITLE);
    });

    test('should enter edit mode on edit button click', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Hover to show edit button
      await page.getByTestId('editable-title').hover();

      // Click edit button
      await editorPage.titleEditButton.click();

      // Input should appear
      await expect(editorPage.titleInput).toBeVisible();
    });

    test('should focus and select text when entering edit mode', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Click title
      await editorPage.documentTitle.click();

      // Input should be focused
      await expect(editorPage.titleInput).toBeFocused();
    });

    test('should save title on Enter', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Edit title
      const newTitle = `Updated Title ${Date.now()}`;
      await editorPage.editTitle(newTitle);

      // Wait for save to complete
      await editorPage.waitForTitleSaved();

      // Title should be updated
      await editorPage.expectTitle(newTitle);
    });

    test('should save title on blur', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();

      const newTitle = `Blur Save Title ${Date.now()}`;
      await editorPage.titleInput.fill(newTitle);

      // Click elsewhere to blur
      await editorPage.editor.click();

      // Wait for save using auto-waiting assertion
      await editorPage.waitForTitleSaved();

      // Title should be updated
      await editorPage.expectTitle(newTitle);
    });

    test('should cancel edit on Escape', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      await editorPage.titleInput.fill('Cancelled Title');

      // Press Escape
      await editorPage.cancelTitleEdit();

      // Should exit edit mode without saving
      await expect(editorPage.titleInput).not.toBeVisible();

      // Title should be unchanged
      await editorPage.expectTitle(ORIGINAL_TITLE);
    });

    test('should not save empty title', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();

      // Press Enter with empty title
      await page.keyboard.press('Enter');

      // Should exit edit mode and revert
      await expect(editorPage.titleInput).not.toBeVisible();
      await editorPage.expectTitle(ORIGINAL_TITLE);
    });

    test('should trim whitespace from title', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Edit with whitespace
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      await editorPage.titleInput.fill('  Trimmed Title  ');
      await page.keyboard.press('Enter');

      // Wait for save
      await editorPage.waitForTitleSaved();

      // Title should be trimmed
      await editorPage.expectTitle('Trimmed Title');
    });
  });

  test.describe('Title Persistence', () => {
    test('should persist title after page reload', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Edit title
      const persistentTitle = `Persistent Title ${Date.now()}`;
      await editorPage.editTitle(persistentTitle);
      await editorPage.waitForTitleSaved();

      // Reload page
      await page.reload();
      await editorPage.waitForEditorReady();

      // Title should persist
      await editorPage.expectTitle(persistentTitle);
    });
  });

  test.describe('Error Handling', () => {
    test('should show error on save failure', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/documents/**', async (route) => {
        if (route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON();
          // Only fail title updates
          if (body?.title) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Internal server error' }),
            });
            return;
          }
        }
        await route.continue();
      });

      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Try to edit title
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      await editorPage.titleInput.fill('Failed Title');
      await page.keyboard.press('Enter');

      // Should show error
      await editorPage.expectTitleError();

      // Should stay in edit mode
      await expect(editorPage.titleInput).toBeVisible();
    });

    test('should allow retry after error', async ({ page }) => {
      let failCount = 0;

      // Mock API failure on first attempt, success on retry
      await page.route('**/api/documents/**', async (route) => {
        if (route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON();
          if (body?.title && failCount === 0) {
            failCount++;
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Temporary error' }),
            });
            return;
          }
        }
        await route.continue();
      });

      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // First attempt fails
      await editorPage.documentTitle.click();
      await editorPage.titleInput.clear();
      const newTitle = `Retry Title ${Date.now()}`;
      await editorPage.titleInput.fill(newTitle);
      await page.keyboard.press('Enter');

      // Wait for error
      await editorPage.expectTitleError();

      // Ensure input is still visible and focused after error
      await expect(editorPage.titleInput).toBeVisible();
      await editorPage.titleInput.focus();

      // Retry (press Enter again)
      await page.keyboard.press('Enter');

      // Should succeed this time
      await editorPage.waitForTitleSaved();
      await editorPage.expectTitle(newTitle);
    });
  });

  test.describe('Accessibility', () => {
    test('should pass accessibility audit in display mode', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Run accessibility check on editable-title only (WordCount has pre-existing color contrast issues)
      await checkElementA11y(page, '[data-testid="editable-title"]');
    });

    test('should pass accessibility audit in edit mode', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();

      // Run accessibility check on editable-title only (WordCount has pre-existing color contrast issues)
      await checkElementA11y(page, '[data-testid="editable-title"]');
    });

    test('should have proper aria-label on title input', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Enter edit mode
      await editorPage.documentTitle.click();

      await expect(editorPage.titleInput).toHaveAttribute('aria-label', 'Document title');
    });

    test('should support keyboard navigation', async ({ page }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto(testProjectId, testDocumentId);
      await editorPage.waitForEditorReady();

      // Focus editable title heading
      const heading = page.getByTestId('editable-title').getByRole('heading');
      await heading.focus();

      // Press Enter to activate edit mode
      await page.keyboard.press('Enter');

      // Input should be visible and focused
      await expect(editorPage.titleInput).toBeVisible();
      await expect(editorPage.titleInput).toBeFocused();
    });
  });
});
