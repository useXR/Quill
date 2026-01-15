// e2e/citations/citation-editor-integration.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { CitationEditorPage } from '../pages/CitationEditorPage';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Editor Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  test('user can insert citation into editor via toolbar picker', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Insert citation using the page object workflow
    await citationEditor.insertCitation('machine learning');

    // Verify citation is in editor
    await citationEditor.expectCitationInEditor();
  });

  test('inserted citation renders with correct cite element', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.insertCitation('neural networks');

    // Verify the cite element exists with proper attributes
    const citeElement = page.locator('cite[data-citation-id]');
    await expect(citeElement).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Check it has a citation ID
    const citationId = await citeElement.getAttribute('data-citation-id');
    expect(citationId).toBeTruthy();
  });

  test('citation displays correct format in editor', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.insertCitation('test paper');

    // Citation should display with some format (e.g., [1], superscript number, etc.)
    const citeElement = page.locator('cite[data-citation-id]');
    const text = await citeElement.textContent();
    expect(text).toBeTruthy();
  });

  test('hovering citation shows tooltip with details', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.insertCitation('hover test');

    // Hover over citation
    await citationEditor.hoverCitation(0);

    // Tooltip should show paper details
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('multiple citations can be inserted', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Insert first citation
    await citationEditor.insertCitation('first paper');

    // Insert second citation
    await citationEditor.insertCitation('second paper');

    // Should have 2 citations
    const count = await citationEditor.getCitationCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('citation picker can be closed without selecting', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Open and close picker without selecting
    await citationEditor.openCitationPicker();
    await citationEditor.closeCitationPicker();

    // No citation should be inserted
    const count = await citationEditor.getCitationCount();
    expect(count).toBe(0);
  });
});
