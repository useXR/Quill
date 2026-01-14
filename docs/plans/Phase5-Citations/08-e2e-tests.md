# Tasks 5.33-5.35: E2E Tests

> **Phase 5** | [← UI Components](./07-ui-components.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task creates Playwright E2E test infrastructure and tests for the citation system.** Tests cover user workflows from search to insertion.

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
- `e2e/citations/citation-search.spec.ts` (create)
- `e2e/citations/citation-management.spec.ts` (create)
- `e2e/citations/citation-accessibility.spec.ts` (create)

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

## Verification Checklist

- [ ] `e2e/fixtures/citation-mocks.ts` exists
- [ ] Page objects created in `e2e/pages/` (NOT `e2e/page-objects/`)
  - [ ] `CitationSearchPage.ts`
  - [ ] `CitationListPage.ts`
  - [ ] `CitationPickerPage.ts`
- [ ] Tests import from `../fixtures/test-fixtures` (NOT `@playwright/test`)
- [ ] Tests use `workerCtx` and `loginAsWorker` fixtures
- [ ] Tests import `TIMEOUTS` from `../config/timeouts.ts`
- [ ] Tests use `expect().toPass()` pattern for async operations
- [ ] Accessibility tests use `checkA11y()` from `../helpers/axe.ts`
- [ ] `citation-search.spec.ts` passes
- [ ] `citation-management.spec.ts` passes
- [ ] `citation-accessibility.spec.ts` passes
- [ ] All E2E tests pass (10+ tests)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Phase 5 Verification](./99-verification.md)** to confirm all phase requirements are complete.
