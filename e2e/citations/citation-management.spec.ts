// e2e/citations/citation-management.spec.ts
// CRITICAL: Import from test-fixtures (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { CitationListPage } from '../pages/CitationListPage';
import { setupCitationListMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Management', () => {
  test('shows empty state when no citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await setupCitationListMocks(page, []);

    const citationList = new CitationListPage(page);
    await citationList.goto(workerCtx.projectId);

    await citationList.expectEmpty();
  });

  test('displays list of citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const mockCitations = [
      { id: '1', title: 'First Citation', authors: 'Author 1', year: 2024 },
      { id: '2', title: 'Second Citation', authors: 'Author 2', year: 2023 },
    ];
    await setupCitationListMocks(page, mockCitations);

    const citationList = new CitationListPage(page);
    await citationList.goto(workerCtx.projectId);

    await expect(page.getByText('First Citation')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await expect(page.getByText('Second Citation')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('user can delete citation with ConfirmDialog', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const mockCitations = [{ id: '1', title: 'Citation to Delete', authors: 'Author', year: 2024 }];
    await setupCitationListMocks(page, mockCitations);

    // Mock delete endpoint
    await page.route('**/api/citations/1', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ json: { success: true } });
      }
    });

    const citationList = new CitationListPage(page);
    await citationList.goto(workerCtx.projectId);

    // Wait for citation to be visible
    await expect(page.getByText('Citation to Delete')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Delete uses ConfirmDialog (Best Practice: Phase 4)
    await citationList.deleteCitation(0);

    // Should show success or remove from list
    await expect(page.getByText('Citation to Delete')).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('user can cancel deletion', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const mockCitations = [{ id: '1', title: 'Citation to Keep', authors: 'Author', year: 2024 }];
    await setupCitationListMocks(page, mockCitations);

    const citationList = new CitationListPage(page);
    await citationList.goto(workerCtx.projectId);

    // Wait for citation to be visible
    await expect(page.getByText('Citation to Keep')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Cancel deletion
    await citationList.cancelDelete(0);

    // Citation should still be visible
    await expect(page.getByText('Citation to Keep')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });
});
