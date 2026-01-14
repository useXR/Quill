# Tasks 5.33-5.35: E2E Tests

> **Phase 5** | [← UI Components](./07-ui-components.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task creates Playwright E2E test infrastructure and tests for the citation system.** Tests cover user workflows from search to insertion.

### Design System Testing

E2E tests verify that UI components correctly implement the Scholarly Craft design system. Tests should check:

| Visual Element  | Test Assertion                                |
| --------------- | --------------------------------------------- |
| Citation titles | Rendered with serif font (Libre Baskerville)  |
| Verified badges | Green background (`bg-success-light`)         |
| No DOI badges   | Yellow/amber background (`bg-warning-light`)  |
| Primary buttons | Purple background (`bg-quill`)                |
| Error alerts    | Red-tinted background with proper contrast    |
| Focus rings     | Visible on keyboard navigation (quill color)  |
| Card hover      | Shadow increases (`shadow-sm` to `shadow-md`) |

Visual regression testing (if configured) should verify consistent implementation of the warm cream/paper color palette (`bg-bg-primary: #faf8f5`).

### Prerequisites

- **Tasks 5.24-5.32** completed (UI components ready)

### What This Task Creates

- `e2e/fixtures/citation-mocks.ts` - Citation-specific API mocking utilities
- `e2e/pages/CitationSearchPage.ts` - search page object
- `e2e/pages/CitationListPage.ts` - list page object
- `e2e/pages/CitationPickerPage.ts` - picker page object
- `e2e/citations/citation-search.spec.ts` - search tests
- `e2e/citations/citation-management.spec.ts` - CRUD tests
- `e2e/citations/citation-accessibility.spec.ts` - a11y tests

### Tasks That Depend on This

- Phase completion verification

### Testing Best Practices Applied (CRITICAL)

- **Use Existing Fixtures** - Import `test, expect` from `../fixtures/test-fixtures`, NOT from `@playwright/test` (Best Practice: Phase 0)
- **Worker Isolation** - Use `workerCtx` and `loginAsWorker` fixtures (Best Practice: Phase 0)
- **TIMEOUTS Constants** - Import from `../config/timeouts.ts`, never hardcode (Best Practice: Phase 0)
- **Page Objects in `e2e/pages/`** - Follow established directory convention (Best Practice: Phase 0)
- **axe-core for Accessibility** - Use `checkA11y()` from `../helpers/axe.ts` (Best Practice: Phase 0)
- **`expect().toPass()` Pattern** - Use retry assertions for async operations (Best Practice: Phase 2)
- **Hydration Helpers** - Use `waitForFormReady()` from `../helpers/hydration.ts` (Best Practice: Phase 0)

---

## Files to Create

- `e2e/fixtures/citation-mocks.ts` (create - extends existing mocks pattern)
- `e2e/pages/CitationSearchPage.ts` (create - in `pages/` NOT `page-objects/`)
- `e2e/pages/CitationListPage.ts` (create)
- `e2e/pages/CitationPickerPage.ts` (create)
- `e2e/pages/CitationEditorPage.ts` (create - **CRITICAL** for editor integration tests)
- `e2e/citations/citation-search.spec.ts` (create)
- `e2e/citations/citation-management.spec.ts` (create)
- `e2e/citations/citation-accessibility.spec.ts` (create)
- `e2e/citations/citation-rate-limit.spec.ts` (create - rate limit UI feedback tests)
- `e2e/citations/citation-hover-tooltip.spec.ts` (create - tooltip E2E tests)
- `e2e/citations/citation-view-paper.spec.ts` (create - external link tests)
- `e2e/citations/citation-manual-entry.spec.ts` (create - manual entry if UI exists)

---

## Task 5.33: E2E Test Infrastructure

### Step 1: Create citation-specific mock handlers

Create `e2e/fixtures/citation-mocks.ts`:

```typescript
// e2e/fixtures/citation-mocks.ts
import { Page } from '@playwright/test';

/**
 * Setup mock handlers for citation-related APIs.
 * Use in beforeEach of citation tests.
 */
export async function setupCitationMocks(page: Page) {
  // Mock Semantic Scholar API
  await page.route('**/api.semanticscholar.org/**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query') || '';

    // Empty results
    if (query.includes('__empty__')) {
      await route.fulfill({ json: { total: 0, data: [] } });
      return;
    }

    // Error response
    if (query.includes('__error__')) {
      await route.fulfill({ status: 500, json: { error: 'Server error' } });
      return;
    }

    // Rate limit response
    if (query.includes('__rate_limited__')) {
      await route.fulfill({
        status: 429,
        json: { error: 'Rate limited' },
        headers: { 'Retry-After': '60' },
      });
      return;
    }

    // Default: return mock results
    await route.fulfill({
      json: {
        total: 2,
        data: [
          {
            paperId: 'mock-1',
            title: `Mock Paper: ${query}`,
            authors: [{ name: 'Test Author' }],
            year: 2024,
            externalIds: { DOI: '10.1000/mock1' },
            url: 'https://example.com',
            citationCount: 100,
            isOpenAccess: true,
          },
          {
            paperId: 'mock-2',
            title: `Second Paper: ${query}`,
            authors: [{ name: 'Another Author' }],
            year: 2023,
            externalIds: {},
            url: 'https://example.com/2',
            citationCount: 50,
          },
        ],
      },
    });
  });

  // Mock internal citations API search endpoint
  await page.route('**/api/citations/search**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') || '';

    if (query.includes('__empty__')) {
      await route.fulfill({ json: { papers: [], total: 0 } });
      return;
    }

    if (query.includes('__error__')) {
      await route.fulfill({ status: 500, json: { error: 'Search failed' } });
      return;
    }

    if (query.includes('__rate_limited__')) {
      await route.fulfill({
        status: 429,
        json: { error: 'Rate limited', retryAfter: 60 },
      });
      return;
    }

    await route.fulfill({
      json: {
        papers: [
          {
            paperId: 'internal-1',
            title: `Search Result: ${query}`,
            authors: [{ name: 'Mock Author' }],
            year: 2024,
            url: 'https://example.com',
            externalIds: { DOI: '10.1000/internal' },
          },
        ],
        total: 1,
      },
    });
  });
}

export async function setupCitationListMocks(page: Page, citations: any[] = []) {
  await page.route('**/api/citations?**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: citations });
    } else {
      await route.continue();
    }
  });
}
```

### Step 2: Create page objects (in `e2e/pages/` directory)

Create `e2e/pages/CitationSearchPage.ts`:

```typescript
// e2e/pages/CitationSearchPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CitationSearchPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly resultsContainer: Locator;
  readonly loadingIndicator: Locator;
  readonly errorAlert: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search papers/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.resultsContainer = page.getByTestId('citation-results');
    this.loadingIndicator = page.getByRole('status');
    this.errorAlert = page.getByRole('alert');
    this.emptyState = page.getByText(/no papers found/i);
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/citations`);
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  // Use expect().toPass() pattern for async operations (Best Practice: Phase 2)
  async waitForResults() {
    await expect(async () => {
      await expect(this.loadingIndicator).not.toBeVisible();
      await expect(this.resultsContainer).toBeVisible();
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  async getCitationCards() {
    await this.waitForResults();
    return this.resultsContainer.getByTestId('citation-card').all();
  }

  async addCitation(index: number) {
    const cards = await this.getCitationCards();
    await cards[index].getByRole('button', { name: /add/i }).click();
  }

  async expectError() {
    await expect(this.errorAlert).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }

  async expectNoResults() {
    await expect(this.emptyState).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }

  async expectRateLimited() {
    await expect(this.page.getByText(/rate limited/i)).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }
}
```

Create `e2e/pages/CitationListPage.ts`:

```typescript
// e2e/pages/CitationListPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CitationListPage {
  readonly page: Page;
  readonly citationList: Locator;
  readonly emptyState: Locator;
  readonly deleteButtons: Locator;
  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.citationList = page.getByRole('list', { name: /citations/i });
    this.emptyState = page.getByText(/no citations yet/i);
    this.deleteButtons = page.getByRole('button', { name: /delete citation/i });
    // ConfirmDialog component (Best Practice: Phase 4)
    this.confirmDialog = page.getByRole('alertdialog');
    this.confirmDeleteButton = page.getByRole('button', { name: /^delete$/i });
    this.cancelDeleteButton = page.getByRole('button', { name: /cancel/i });
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/citations`);
  }

  async getCitationCount() {
    const items = await this.citationList.getByRole('listitem').all();
    return items.length;
  }

  // Use ConfirmDialog pattern (Best Practice: Phase 4)
  async deleteCitation(index: number) {
    const buttons = await this.deleteButtons.all();
    await buttons[index].click();
    // Wait for ConfirmDialog to appear
    await expect(this.confirmDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await this.confirmDeleteButton.click();
    // Wait for dialog to close
    await expect(this.confirmDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async cancelDelete(index: number) {
    const buttons = await this.deleteButtons.all();
    await buttons[index].click();
    await expect(this.confirmDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await this.cancelDeleteButton.click();
    await expect(this.confirmDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }
}
```

Create `e2e/pages/CitationPickerPage.ts`:

```typescript
// e2e/pages/CitationPickerPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class CitationPickerPage {
  readonly page: Page;
  readonly triggerButton: Locator;
  readonly dialog: Locator;
  readonly searchInput: Locator;
  readonly citationList: Locator;
  readonly closeButton: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.triggerButton = page.getByRole('button', { name: /add citation/i });
    this.dialog = page.getByRole('dialog');
    this.searchInput = page.getByRole('dialog').getByPlaceholder(/search/i);
    this.citationList = page.getByRole('dialog').getByRole('list');
    this.closeButton = page.getByRole('button', { name: /close/i });
    this.loadingIndicator = page.getByRole('dialog').getByRole('status');
  }

  async open() {
    await this.triggerButton.click();
    await expect(this.dialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  // Use expect().toPass() pattern (Best Practice: Phase 2)
  async waitForSearchResults() {
    await expect(async () => {
      await expect(this.loadingIndicator).not.toBeVisible();
      const items = await this.citationList.getByRole('listitem').count();
      expect(items).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  async selectCitation(index: number) {
    const items = await this.citationList.getByRole('listitem').all();
    await items[index].click();
    // Dialog should close after selection
    await expect(this.dialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async close() {
    await this.closeButton.click();
    await expect(this.dialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }
}
```

Create `e2e/pages/CitationEditorPage.ts`:

> **CRITICAL**: This page object encapsulates all citation interactions within the document editor. All tests involving citation insertion, hover tooltips, and editor integration MUST use this page object.

```typescript
// e2e/pages/CitationEditorPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for citation interactions within the document editor.
 * Encapsulates all citation-related editor operations for consistent test patterns.
 *
 * Usage:
 *   const citationEditor = new CitationEditorPage(page);
 *   await citationEditor.goto(projectId, documentId);
 *   await citationEditor.insertCitation('machine learning');
 *   await citationEditor.hoverCitation(0);
 */
export class CitationEditorPage {
  readonly page: Page;
  readonly editor: Locator;
  readonly citationPickerButton: Locator;
  readonly citationPickerDialog: Locator;
  readonly pickerSearchInput: Locator;
  readonly pickerSearchButton: Locator;
  readonly pickerResults: Locator;
  readonly pickerCloseButton: Locator;
  readonly citationMarks: Locator;
  readonly citationTooltip: Locator;
  readonly rateLimitMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editor = page.locator('[role="textbox"]');
    this.citationPickerButton = page.getByRole('button', { name: /insert citation/i });
    this.citationPickerDialog = page.getByRole('dialog');
    this.pickerSearchInput = page.getByRole('dialog').getByPlaceholder(/search/i);
    this.pickerSearchButton = page.getByRole('dialog').getByRole('button', { name: /search/i });
    this.pickerResults = page.getByRole('dialog').getByTestId('citation-results');
    this.pickerCloseButton = page.getByRole('dialog').getByRole('button', { name: /close/i });
    this.citationMarks = page.locator('cite[data-citation-id]');
    this.citationTooltip = page.getByRole('tooltip');
    this.rateLimitMessage = page.getByText(/rate limit|too many requests|try again/i);
  }

  /**
   * Navigate to the document editor page
   */
  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  }

  /**
   * Open the citation picker modal from the toolbar
   */
  async openCitationPicker() {
    await this.citationPickerButton.click();
    await expect(this.citationPickerDialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Search for papers within the citation picker
   */
  async searchInPicker(query: string) {
    await this.pickerSearchInput.fill(query);
    await this.pickerSearchButton.click();
    // Wait for results to load using toPass pattern (Best Practice: Phase 2)
    await expect(async () => {
      const cards = await this.pickerResults.getByTestId('citation-card').count();
      expect(cards).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  }

  /**
   * Select a citation from picker results by index
   */
  async selectCitationFromPicker(index: number) {
    const addButtons = this.pickerResults.getByRole('button', { name: /add/i });
    await addButtons.nth(index).click();
    // Dialog should close after selection
    await expect(this.citationPickerDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Close the citation picker without selecting
   */
  async closeCitationPicker() {
    await this.pickerCloseButton.click();
    await expect(this.citationPickerDialog).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Verify a citation exists in the editor
   */
  async expectCitationInEditor(citationId?: string) {
    if (citationId) {
      await expect(this.page.locator(`cite[data-citation-id="${citationId}"]`)).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    } else {
      await expect(this.citationMarks.first()).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    }
  }

  /**
   * Get count of citations in the editor
   */
  async getCitationCount(): Promise<number> {
    return await this.citationMarks.count();
  }

  /**
   * Hover over a citation to show tooltip
   */
  async hoverCitation(index: number = 0) {
    await this.citationMarks.nth(index).hover();
    await expect(this.citationTooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Click "View Paper" link in citation tooltip
   * Returns the URL that would be opened
   */
  async clickViewPaperLink(): Promise<string> {
    const viewPaperLink = this.citationTooltip.getByRole('link', { name: /view paper/i });
    const href = await viewPaperLink.getAttribute('href');
    // Verify link opens in new tab
    const target = await viewPaperLink.getAttribute('target');
    expect(target).toBe('_blank');
    return href || '';
  }

  /**
   * Complete workflow: open picker, search, select citation
   */
  async insertCitation(searchQuery: string, resultIndex: number = 0) {
    await this.openCitationPicker();
    await this.searchInPicker(searchQuery);
    await this.selectCitationFromPicker(resultIndex);
    await this.expectCitationInEditor();
  }

  /**
   * Expect rate limit message to be visible
   */
  async expectRateLimitMessage() {
    await expect(this.rateLimitMessage).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Wait for editor to be ready (hydrated)
   */
  async waitForEditorReady() {
    await expect(this.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    // Wait for form hydration (Best Practice: Phase 1)
    await expect(async () => {
      const hydrated = await this.page.locator('form[data-hydrated="true"]').count();
      expect(hydrated).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.HYDRATION });
  }
}
```

### Step 3: Commit

```bash
git add e2e/
git commit -m "test(e2e): add citation E2E infrastructure with page objects"
```

---

## Task 5.34: E2E Tests - Citation Search

### Step 1: Write E2E tests using existing fixtures

Create `e2e/citations/citation-search.spec.ts`:

```typescript
// e2e/citations/citation-search.spec.ts
// CRITICAL: Import from test-fixtures, NOT from @playwright/test (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { CitationSearchPage } from '../pages/CitationSearchPage';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  // Use workerCtx and loginAsWorker from fixtures (Best Practice: Phase 0)
  test('user can search for citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('machine learning');
    await citationSearch.waitForResults();

    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('shows empty state for no results', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__empty__');
    await citationSearch.expectNoResults();
  });

  test('shows error on API failure', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__error__');
    await citationSearch.expectError();
  });

  test('shows rate limit message', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');
    await citationSearch.expectRateLimited();
  });

  test('user can add citation from search results', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('test query');
    await citationSearch.waitForResults();
    await citationSearch.addCitation(0);

    // Button should change to "Already Added"
    await expect(page.getByRole('button', { name: /already added/i })).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('shows verified badge for papers with DOI', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('test');
    await citationSearch.waitForResults();

    await expect(page.getByText('Verified').first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('search with Enter key works', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.searchInput.fill('keyboard search');
    await page.keyboard.press('Enter');

    await citationSearch.waitForResults();
    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });
});
```

### Step 2: Run E2E tests

```bash
npm run test:e2e e2e/citations/
```

### Step 3: Commit

```bash
git add e2e/citations/
git commit -m "test(e2e): add citation search E2E tests"
```

---

## Task 5.34a: E2E Tests - Rate Limit UI Feedback

> **CRITICAL**: Users must receive clear feedback when rate limits are hit. This is essential for a good user experience when the Semantic Scholar API returns 429 responses.

### Step 1: Write rate limit feedback tests

Create `e2e/citations/citation-rate-limit.spec.ts`:

```typescript
// e2e/citations/citation-rate-limit.spec.ts
// CRITICAL: Import from test-fixtures, NOT from @playwright/test (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { CitationSearchPage } from '../pages/CitationSearchPage';
import { CitationEditorPage } from '../pages/CitationEditorPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Rate Limit UI Feedback', () => {
  test.beforeEach(async ({ page }) => {
    // Setup rate limit mock for specific query
    await page.route('**/api/citations/search**', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') || '';

      if (query.includes('__rate_limited__')) {
        await route.fulfill({
          status: 429,
          json: {
            error: 'Rate limited',
            message: 'Too many requests. Please try again in 60 seconds.',
            retryAfter: 60,
          },
          headers: {
            'Retry-After': '60',
          },
        });
        return;
      }

      // Default: return normal results
      await route.fulfill({
        json: {
          papers: [
            {
              paperId: 'test-1',
              title: 'Normal Result',
              authors: [{ name: 'Author' }],
              year: 2024,
              url: 'https://example.com',
            },
          ],
          total: 1,
        },
      });
    });
  });

  test('shows user-friendly rate limit message on 429 response', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    // Trigger rate limited search
    await citationSearch.search('__rate_limited__');

    // Wait for rate limit message to appear
    await citationSearch.expectRateLimited();

    // Verify the message is user-friendly (not technical jargon)
    await expect(page.getByText(/too many requests|rate limit|try again/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });

    // Should NOT show raw HTTP status code to user
    await expect(page.getByText(/429/)).not.toBeVisible();
  });

  test('rate limit message includes retry timing information', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');
    await citationSearch.expectRateLimited();

    // Should show when user can retry
    await expect(page.getByText(/60 seconds|1 minute|try again later/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('rate limit message has appropriate visual styling', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');

    // Wait for rate limit alert to appear
    const rateLimitAlert = page.getByRole('alert').filter({ hasText: /rate limit|too many/i });
    await expect(rateLimitAlert).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Verify it uses warning/info colors (not error colors - it's not a user error)
    // Design system: bg-warning-light or bg-info-light
    const bgColor = await rateLimitAlert.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should have a visible background color (not transparent)
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('user can retry search after rate limit', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Track request count
    let requestCount = 0;
    await page.route('**/api/citations/search**', async (route) => {
      requestCount++;
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') || '';

      // First request rate limited, second succeeds
      if (requestCount === 1 && query.includes('retry_test')) {
        await route.fulfill({
          status: 429,
          json: { error: 'Rate limited', retryAfter: 1 },
        });
        return;
      }

      await route.fulfill({
        json: {
          papers: [
            {
              paperId: 'success-1',
              title: 'Successful Retry Result',
              authors: [{ name: 'Author' }],
              year: 2024,
              url: 'https://example.com',
            },
          ],
          total: 1,
        },
      });
    });

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    // First search - rate limited
    await citationSearch.search('retry_test');
    await citationSearch.expectRateLimited();

    // Wait briefly then retry
    await page.waitForTimeout(1500);

    // Clear and retry
    await citationSearch.searchInput.clear();
    await citationSearch.search('retry_test_2');

    // Should succeed on retry
    await citationSearch.waitForResults();
    await expect(page.getByText('Successful Retry Result')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('rate limit in citation picker shows message in dialog', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Open citation picker
    await citationEditor.openCitationPicker();

    // Search with rate limited query
    await citationEditor.pickerSearchInput.fill('__rate_limited__');
    await citationEditor.pickerSearchButton.click();

    // Rate limit message should appear within the dialog
    await citationEditor.expectRateLimitMessage();

    // Message should be inside the dialog, not outside
    const dialogContent = page.getByRole('dialog');
    await expect(dialogContent.getByText(/rate limit|too many/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('rate limit does not break subsequent searches', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    // First search - rate limited
    await citationSearch.search('__rate_limited__');
    await citationSearch.expectRateLimited();

    // Second search with different query - should work
    await citationSearch.searchInput.clear();
    await citationSearch.search('normal search');
    await citationSearch.waitForResults();

    // Should show results, not stuck in rate limit state
    const cards = await citationSearch.getCitationCards();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('rate limit message is accessible', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationSearch = new CitationSearchPage(page);
    await citationSearch.goto(workerCtx.projectId);

    await citationSearch.search('__rate_limited__');

    // Rate limit message should have appropriate ARIA role
    const rateLimitMessage = page.getByRole('alert').filter({ hasText: /rate limit|too many/i });
    await expect(rateLimitMessage).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Should be announced to screen readers (role="alert" or aria-live)
    const role = await rateLimitMessage.getAttribute('role');
    const ariaLive = await rateLimitMessage.getAttribute('aria-live');

    expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBe(true);
  });
});
```

### Step 2: Update CitationSearchPage with rate limit expectation

Add to `e2e/pages/CitationSearchPage.ts`:

```typescript
// Add to CitationSearchPage class
readonly rateLimitMessage: Locator;

constructor(page: Page) {
  // ... existing locators ...
  this.rateLimitMessage = page.getByText(/rate limit|too many requests|try again/i);
}

async expectRateLimited() {
  await expect(this.rateLimitMessage).toBeVisible({ timeout: TIMEOUTS.API_CALL });
}
```

### Step 3: Run rate limit tests

```bash
npm run test:e2e e2e/citations/citation-rate-limit.spec.ts
```

### Step 4: Commit

```bash
git add e2e/citations/citation-rate-limit.spec.ts
git commit -m "test(e2e): add rate limit UI feedback tests"
```

---

## Task 5.35: E2E Tests - Citation Management & Accessibility

### Step 1: Write management tests

Create `e2e/citations/citation-management.spec.ts`:

```typescript
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

    // Cancel deletion
    await citationList.cancelDelete(0);

    // Citation should still be visible
    await expect(page.getByText('Citation to Keep')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });
});
```

### Step 2: Write accessibility tests with axe-core

Create `e2e/citations/citation-accessibility.spec.ts`:

```typescript
// e2e/citations/citation-accessibility.spec.ts
// CRITICAL: Import from test-fixtures (Best Practice: Phase 0)
import { test, expect } from '../fixtures/test-fixtures';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  // Use axe-core for automated a11y testing (Best Practice: Phase 0)
  test('citation search page passes accessibility audit', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Run axe-core accessibility check
    await checkA11y(page);
  });

  test('citation search results pass accessibility audit', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Trigger search to load results
    await page.getByPlaceholder(/search papers/i).fill('test');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="citation-card"]', { timeout: TIMEOUTS.API_CALL });

    // Run axe-core on page with results
    await checkA11y(page);
  });

  test('search input is focusable via keyboard', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    await page.keyboard.press('Tab');
    const searchInput = page.getByPlaceholder(/search papers/i);
    await expect(searchInput).toBeFocused();
  });

  test('error alerts have proper role', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    await page.getByPlaceholder(/search/i).fill('__error__');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('alert')).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  });

  test('buttons have accessible names', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    const searchButton = page.getByRole('button', { name: /search/i });
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toBeEnabled();
  });

  test('citation cards are keyboard navigable', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    await page.getByPlaceholder(/search/i).fill('test');
    await page.keyboard.press('Enter');

    // Wait for results using toPass pattern (Best Practice: Phase 2)
    await expect(async () => {
      const cards = await page.getByTestId('citation-card').count();
      expect(cards).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });

    // Tab to first interactive element in results
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to activate with Enter
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(['button', 'a']).toContain(focusedElement);
  });

  test('loading state is announced to screen readers', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Mock slow response
    await page.route('**/api/citations/search**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: { papers: [], total: 0 } });
    });

    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await page.getByPlaceholder(/search/i).fill('slow query');
    await page.keyboard.press('Enter');

    // Loading indicator should have status role for screen reader announcement
    await expect(page.getByRole('status')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('ConfirmDialog is accessible', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const mockCitations = [{ id: '1', title: 'Test Citation', authors: 'Author', year: 2024 }];

    await page.route('**/api/citations?**', async (route) => {
      await route.fulfill({ json: mockCitations });
    });

    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Click delete to open ConfirmDialog
    await page
      .getByRole('button', { name: /delete citation/i })
      .first()
      .click();

    // Dialog should be visible and have proper role
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: TIMEOUTS.DIALOG });

    // Run axe-core on dialog
    await checkA11y(page);

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();
  });
});
```

### Step 3: Commit

```bash
git add e2e/citations/
git commit -m "test(e2e): add citation management and accessibility tests with axe-core"
```

---

## Task 5.35a: Extended E2E Test Coverage

> **IMPORTANT**: The following test scenarios must be covered in addition to the basic E2E tests.

### Citation Insertion into Editor via Picker

Test file: `e2e/citations/citation-editor-integration.spec.ts` (defined in 07-ui-components.md)

**Must test:**

- [ ] User can insert citation into editor via toolbar picker
- [ ] Inserted citation renders with correct `<cite>` element
- [ ] Citation has correct `data-citation-id` attribute
- [ ] Citation display text shows correct format (e.g., "[1]")

### Citation Persistence Across Save/Reload

**Must test:**

- [ ] Citation persists after document autosave
- [ ] Citation persists after manual save
- [ ] Citation is visible after page reload
- [ ] Citation data (ID, DOI, title) is preserved

### Navigation Tests

Test file: `e2e/citations/citation-navigation.spec.ts`

```typescript
// e2e/citations/citation-navigation.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Navigation', () => {
  test('user can navigate from project page to citations page', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}`);

    // Find and click citations link
    await page.getByRole('link', { name: /citations/i }).click();

    // Should be on citations page
    await expect(page).toHaveURL(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByRole('heading', { name: /citations/i })).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  });

  test('user can navigate from editor to citations page', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Navigate to citations (via toolbar or navigation)
    await page.getByRole('link', { name: /citations/i }).click();

    await expect(page).toHaveURL(`/projects/${workerCtx.projectId}/citations`);
  });

  test('user is redirected to login if not authenticated', async ({ page, workerCtx }) => {
    // Don't log in
    await page.goto(`/projects/${workerCtx.projectId}/citations`);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('user is redirected if accessing another user project citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Try to access a non-existent or other user's project
    await page.goto('/projects/00000000-0000-0000-0000-000000000000/citations');

    // Should redirect to projects list
    await expect(page).toHaveURL(/\/projects\/?$/);
  });
});
```

### Optimistic Update Rollback Tests

Test file: `e2e/citations/citation-optimistic-updates.spec.ts`

```typescript
// e2e/citations/citation-optimistic-updates.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Optimistic Updates', () => {
  test('citation is immediately removed from UI on delete', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Setup: Create a citation via API first
    const createResponse = await page.request.post('/api/citations', {
      data: {
        projectId: workerCtx.projectId,
        title: 'Test Citation',
        authors: 'Author',
        year: 2024,
      },
    });
    const citation = await createResponse.json();

    // Navigate to citations page
    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByText('Test Citation')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Click delete and confirm
    await page
      .getByRole('button', { name: /delete citation/i })
      .first()
      .click();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Citation should be removed immediately (optimistic update)
    await expect(page.getByText('Test Citation')).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('citation is restored on delete failure', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Setup: Create a citation
    const createResponse = await page.request.post('/api/citations', {
      data: {
        projectId: workerCtx.projectId,
        title: 'Rollback Test Citation',
        authors: 'Author',
        year: 2024,
      },
    });
    const citation = await createResponse.json();

    // Mock the delete to fail
    await page.route(`**/api/citations/${citation.id}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 500, json: { error: 'Server error' } });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByText('Rollback Test Citation')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Delete and confirm
    await page
      .getByRole('button', { name: /delete citation/i })
      .first()
      .click();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Citation should reappear after failed delete (rollback)
    await expect(page.getByText('Rollback Test Citation')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Error toast should appear
    await expect(page.getByText(/failed to delete/i)).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });
});
```

### Full Integration with Phase 1 Editor

Test file: `e2e/citations/citation-full-integration.spec.ts`

```typescript
// e2e/citations/citation-full-integration.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Full Integration with Editor', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  test('complete workflow: search, add, insert, save, verify', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // 1. Navigate to editor
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // 2. Write some content
    const editor = page.locator('[role="textbox"]');
    await editor.fill('This is my document content. ');

    // 3. Open citation picker
    await page.getByRole('button', { name: /insert citation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.DIALOG });

    // 4. Search for paper
    await page.getByPlaceholder(/search/i).fill('machine learning');
    await page.keyboard.press('Enter');

    // 5. Wait for results and add citation
    await expect(page.getByTestId('citation-card').first()).toBeVisible({ timeout: TIMEOUTS.API_CALL });
    await page.getByRole('button', { name: /add/i }).first().click();

    // 6. Verify citation in editor
    await expect(page.locator('cite[data-citation-id]')).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // 7. Wait for autosave
    await page.waitForTimeout(2000);

    // 8. Reload and verify persistence
    await page.reload();
    await expect(page.locator('cite[data-citation-id]')).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

    // 9. Navigate to citations page and verify citation exists
    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByText(/machine learning/i)).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('citation mark styling matches design system', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Insert citation
    await page.getByRole('button', { name: /insert citation/i }).click();
    await page.getByPlaceholder(/search/i).fill('styling test');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /add/i }).first().click();

    // Verify citation styling
    const citation = page.locator('cite[data-citation-id]');
    await expect(citation).toBeVisible();

    // Check for quill brand color (design system)
    const styles = await citation.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        cursor: computed.cursor,
      };
    });

    expect(styles.cursor).toBe('pointer');
    // Color should be quill purple (approximately #7c3aed)
  });
});
```

---

## Verification Checklist

- [ ] `e2e/fixtures/citation-mocks.ts` exists
- [ ] Page objects created in `e2e/pages/` (NOT `e2e/page-objects/`)
  - [ ] `CitationSearchPage.ts`
  - [ ] `CitationListPage.ts`
  - [ ] `CitationPickerPage.ts`
  - [ ] **CRITICAL**: `CitationEditorPage.ts` (for editor integration tests)
- [ ] Tests import from `../fixtures/test-fixtures` (NOT `@playwright/test`)
- [ ] Tests use `workerCtx` and `loginAsWorker` fixtures
- [ ] Tests import `TIMEOUTS` from `../config/timeouts.ts`
- [ ] Tests use `expect().toPass()` pattern for async operations
- [ ] Accessibility tests use `checkA11y()` from `../helpers/axe.ts`
- [ ] `citation-search.spec.ts` passes
- [ ] `citation-management.spec.ts` passes
- [ ] `citation-accessibility.spec.ts` passes
- [ ] **New E2E coverage tests:**
  - [ ] `citation-rate-limit.spec.ts` passes (rate limit UI feedback)
  - [ ] `citation-hover-tooltip.spec.ts` passes (tooltip shows title/authors/DOI)
  - [ ] `citation-view-paper.spec.ts` passes (external link opens in new tab)
  - [ ] `citation-manual-entry.spec.ts` passes or skips if UI not implemented
- [ ] **Extended coverage tests:**
  - [ ] `citation-editor-integration.spec.ts` passes (citation insertion via picker)
  - [ ] `citation-navigation.spec.ts` passes (navigation between pages)
  - [ ] `citation-optimistic-updates.spec.ts` passes (optimistic update rollback)
  - [ ] `citation-full-integration.spec.ts` passes (end-to-end workflow)
- [ ] All E2E tests pass (55+ tests total)
- [ ] Changes committed

---

## E2E Test File Summary

After completing this task, the following E2E test files should exist:

| File                                                | Purpose                                       | Tests         |
| --------------------------------------------------- | --------------------------------------------- | ------------- |
| `e2e/citations/citations-api.spec.ts`               | API authentication and CRUD                   | 6+            |
| `e2e/citations/citation-search.spec.ts`             | Search UI functionality                       | 7+            |
| `e2e/citations/citation-management.spec.ts`         | List and delete operations                    | 4+            |
| `e2e/citations/citation-accessibility.spec.ts`      | Accessibility compliance                      | 8+            |
| `e2e/citations/citation-picker.spec.ts`             | Picker modal functionality                    | 4+            |
| `e2e/citations/citation-list.spec.ts`               | List display and interaction                  | 4+            |
| `e2e/citations/citation-editor-integration.spec.ts` | **CRITICAL**: Editor integration              | 4+            |
| `e2e/citations/citation-navigation.spec.ts`         | Navigation between pages                      | 4+            |
| `e2e/citations/citation-optimistic-updates.spec.ts` | Optimistic update rollback                    | 2+            |
| `e2e/citations/citation-full-integration.spec.ts`   | End-to-end workflow                           | 2+            |
| `e2e/citations/citation-rate-limit.spec.ts`         | **NEW**: Rate limit UI feedback               | 7+            |
| `e2e/citations/citation-hover-tooltip.spec.ts`      | **NEW**: Hover tooltip with details           | 4+            |
| `e2e/citations/citation-view-paper.spec.ts`         | **NEW**: View Paper link behavior             | 4+            |
| `e2e/citations/citation-manual-entry.spec.ts`       | **NEW**: Manual citation entry (if UI exists) | 4+            |
| **Total**                                           |                                               | **64+ tests** |

### Page Objects Summary

| File                              | Purpose                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `e2e/pages/CitationSearchPage.ts` | Search page interactions                                            |
| `e2e/pages/CitationListPage.ts`   | Citation list and delete operations                                 |
| `e2e/pages/CitationPickerPage.ts` | Picker modal interactions                                           |
| `e2e/pages/CitationEditorPage.ts` | **CRITICAL**: Editor citation interactions (insert, hover, tooltip) |

---

---

### Cross-Phase Integration Tests

Create `e2e/citations/citation-cross-phase-integration.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Citation Cross-Phase Integration', () => {
  test('citations persist through document autosave (Phase 1)', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Navigate to editor
    // Insert citation
    // Wait for autosave
    // Reload page
    // Verify citation still present
  });

  test('citation + bold/italic formatting works together (Phase 1)', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Select text
    // Apply bold
    // Insert citation on same text
    // Verify both formatting applied
  });

  test('citation hover shows tooltip with details', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Insert citation
    // Hover over citation
    // Verify tooltip appears with title/DOI
  });

  test('removing citation from editor works', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Insert citation
    // Select citation text
    // Delete
    // Verify citation removed
  });
});

// Future Phase Integration (Phase 6)
test.describe.skip('Citation Export Integration (Phase 6)', () => {
  test('DOCX export includes citations', async ({ page }) => {
    // Will be implemented in Phase 6
  });

  test('PDF export includes bibliography', async ({ page }) => {
    // Will be implemented in Phase 6
  });
});
```

---

## Next Steps

After this task, proceed to **[Phase 5 Verification](./99-verification.md)** to confirm all phase requirements are complete.
