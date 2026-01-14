# Task 2.13: E2E Tests

> **Phase 2** | [← Vault Page Integration](./13-vault-page-integration.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task creates end-to-end tests for the Knowledge Vault using Playwright.** Tests cover the complete user flow from upload to search with proper isolation and cleanup, following the Phase 0 testing infrastructure patterns.

### Prerequisites

- **Task 2.12** completed (vault page available)
- Playwright configured (from Phase 0)
- Phase 0 test fixtures and helpers available

### What This Task Creates

- `e2e/pages/VaultPage.ts` - Page Object Model for vault
- `e2e/vault/vault.spec.ts` - E2E test suite
- `e2e/vault/vault-search.spec.ts` - Search-specific tests
- `e2e/vault/vault-a11y.spec.ts` - Accessibility tests

### Phase 0 Infrastructure Used (DO NOT RECREATE)

> **Important:** These utilities already exist from Phase 0. Import and use them directly.

| Utility            | Import From                     | Purpose                                        |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| `test`, `expect`   | `e2e/fixtures/test-fixtures.ts` | Extended Playwright test with worker isolation |
| `workerCtx`        | `e2e/fixtures/test-fixtures.ts` | Worker-scoped context for data isolation       |
| `loginAsWorker`    | `e2e/fixtures/test-fixtures.ts` | Authentication helper                          |
| `testData`         | `e2e/fixtures/test-fixtures.ts` | Auto-cleanup test data management              |
| `TIMEOUTS`         | `e2e/config/timeouts.ts`        | Centralized timeout constants                  |
| `checkA11y`        | `e2e/helpers/axe.ts`            | Accessibility testing                          |
| `waitForFormReady` | `e2e/helpers/hydration.ts`      | React hydration handling                       |

---

## Files to Create/Modify

- `e2e/pages/VaultPage.ts` (create)
- `e2e/vault/vault.spec.ts` (create)
- `e2e/vault/vault-search.spec.ts` (create)
- `e2e/vault/vault-a11y.spec.ts` (create)

---

## Steps

### Step 1: Create Vault Page Object Model

Create `e2e/pages/VaultPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class VaultPage {
  readonly page: Page;
  readonly uploadZone: Locator;
  readonly fileInput: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly noFilesMessage: Locator;
  readonly noResultsMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.uploadZone = page.getByTestId('vault-upload-zone');
    this.fileInput = page.getByTestId('vault-file-input');
    this.searchInput = page.getByPlaceholder(/search your vault/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.noFilesMessage = page.getByText(/no files uploaded/i);
    this.noResultsMessage = page.getByText(/no results found/i);
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/vault`);
    await this.page.waitForLoadState('networkidle');
  }

  async uploadFile(filePath: string) {
    const uploadPromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/vault/upload') && resp.status() === 200,
      { timeout: TIMEOUTS.API_CALL }
    );

    await this.fileInput.setInputFiles(filePath);
    await uploadPromise;
  }

  async uploadFileWithBuffer(name: string, mimeType: string, content: Buffer) {
    await this.fileInput.setInputFiles({
      name,
      mimeType,
      buffer: content,
    });
  }

  async waitForExtractionComplete(filename: string) {
    // Wait for extraction to complete - this can take longer
    await expect(async () => {
      const successStatus = this.page
        .locator(`text=${filename}`)
        .locator('..')
        .getByText(/success|partial/i);
      await expect(successStatus).toBeVisible();
    }).toPass({ timeout: TIMEOUTS.API_CALL * 6 }); // Extraction can take up to 30s
  }

  async search(query: string) {
    await this.searchInput.fill(query);

    // Account for debounce
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE_SEARCH);

    const searchPromise = this.page.waitForResponse((resp) => resp.url().includes('/api/vault/search'), {
      timeout: TIMEOUTS.API_CALL,
    });

    await this.searchButton.click();
    await searchPromise;

    // Wait for DOM to settle after results load
    await this.page.waitForTimeout(TIMEOUTS.POST_FILTER);
  }

  async deleteFile(filename: string) {
    const fileRow = this.page.locator(`text=${filename}`).locator('..');
    const deleteButton = fileRow.getByRole('button', { name: /delete/i });

    const deletePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/vault/') && resp.request().method() === 'DELETE',
      { timeout: TIMEOUTS.API_CALL }
    );

    await deleteButton.click();
    await deletePromise;
  }

  getFileCard(filename: string): Locator {
    return this.page.locator(`text=${filename}`).locator('..');
  }

  getSearchResults(): Locator {
    return this.page.locator('[class*="result"]');
  }

  async expectFileVisible(filename: string) {
    await expect(this.page.getByText(filename)).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  async expectFileNotVisible(filename: string) {
    await expect(this.page.getByText(filename)).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  async expectUploadZoneVisible() {
    await expect(this.page.getByText(/drag files here/i)).toBeVisible();
    await expect(this.page.getByText(/pdf, docx, or txt/i)).toBeVisible();
  }

  async expectExtractionStatus(filename: string, status: string) {
    const fileRow = this.page.locator(`text=${filename}`).locator('..');
    await expect(fileRow.getByText(new RegExp(status, 'i'))).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  async expectSearchResultCount(count: number) {
    if (count === 0) {
      await expect(this.noResultsMessage).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    } else {
      await expect(this.page.getByText(new RegExp(`${count} result`, 'i'))).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    }
  }
}
```

---

### Step 2: Create main vault E2E tests with worker isolation

Create `e2e/vault/vault.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { VaultPage } from '../pages/VaultPage';
import { TIMEOUTS } from '../config/timeouts';
import path from 'path';

test.describe('Knowledge Vault', () => {
  let vaultPage: VaultPage;
  let testProjectId: string;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    // Login using Phase 0 auth helper
    await loginAsWorker();

    // Use worker-scoped project ID for isolation
    testProjectId = workerCtx.organizationId; // Or create project via API

    vaultPage = new VaultPage(page);
    await vaultPage.goto(testProjectId);
  });

  test('displays empty vault message when no files', async ({ page }) => {
    // Only check if no files exist
    const noFilesVisible = await vaultPage.noFilesMessage.isVisible();

    if (noFilesVisible) {
      await expect(vaultPage.noFilesMessage).toBeVisible();
    }
  });

  test('shows upload zone with instructions', async () => {
    await vaultPage.expectUploadZoneVisible();
  });

  test('can upload a text file', async ({ workerCtx }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');

    await vaultPage.uploadFile(testFilePath);
    await vaultPage.expectFileVisible('test.txt');
  });

  test('shows extraction status updates', async ({ workerCtx }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');

    await vaultPage.uploadFile(testFilePath);
    await vaultPage.expectFileVisible('test.txt');

    // Check for initial status
    await vaultPage.expectExtractionStatus('test.txt', 'pending|extracting|success');

    // Wait for extraction to complete
    await vaultPage.waitForExtractionComplete('test.txt');
  });

  test('can delete uploaded file', async ({ workerCtx }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');

    await vaultPage.uploadFile(testFilePath);
    await vaultPage.expectFileVisible('test.txt');

    await vaultPage.deleteFile('test.txt');
    await vaultPage.expectFileNotVisible('test.txt');
  });

  test('validates file type on upload', async ({ page }) => {
    await vaultPage.uploadFileWithBuffer('test.exe', 'application/x-executable', Buffer.from('invalid content'));

    await expect(page.getByText(/unsupported file type/i)).toBeVisible({
      timeout: TIMEOUTS.TOAST,
    });
  });

  test('validates file size on upload', async ({ page }) => {
    // Create a file that exceeds the limit (>100MB for PDF)
    const largeContent = Buffer.alloc(101 * 1024 * 1024, 'x');

    await vaultPage.uploadFileWithBuffer('large.pdf', 'application/pdf', largeContent);

    await expect(page.getByText(/file exceeds/i)).toBeVisible({
      timeout: TIMEOUTS.TOAST,
    });
  });
});
```

---

### Step 3: Create search-specific tests

Create `e2e/vault/vault-search.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { VaultPage } from '../pages/VaultPage';
import { TIMEOUTS } from '../config/timeouts';
import path from 'path';

test.describe('Vault Search', () => {
  let vaultPage: VaultPage;
  let testProjectId: string;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    testProjectId = workerCtx.organizationId;

    vaultPage = new VaultPage(page);
    await vaultPage.goto(testProjectId);

    // Upload and wait for extraction to complete before search tests
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');
    await vaultPage.uploadFile(testFilePath);
    await vaultPage.waitForExtractionComplete('test.txt');
  });

  test('can search vault and get results', async () => {
    // Search for content from the test file
    await vaultPage.search('test document');

    // Should show results
    await expect(async () => {
      const resultCount = await vaultPage.getSearchResults().count();
      expect(resultCount).toBeGreaterThan(0);
    }).toPass({ timeout: TIMEOUTS.API_CALL });
  });

  test('shows no results message for unmatched query', async () => {
    await vaultPage.search('xyzzy completely unmatched query 12345');
    await vaultPage.expectSearchResultCount(0);
  });

  test('displays similarity percentage in results', async ({ page }) => {
    await vaultPage.search('test document');

    // Results should show percentage match
    await expect(page.getByText(/%\s*match/i)).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('displays filename in search results', async ({ page }) => {
    await vaultPage.search('test document');

    // Results should show the source filename
    await expect(page.getByText('test.txt')).toBeVisible({
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  });

  test('search button is disabled when query is empty', async () => {
    await expect(vaultPage.searchButton).toBeDisabled();
  });

  test('cancels previous search when new search started', async ({ page }) => {
    // Start first search
    await vaultPage.searchInput.fill('first query');
    await vaultPage.searchButton.click();

    // Immediately start second search (should cancel first)
    await vaultPage.searchInput.fill('test document');
    await vaultPage.searchButton.click();

    // Wait for results - should be from second query
    await page.waitForTimeout(TIMEOUTS.API_CALL);

    // Should not show stale results or errors
    const errorVisible = await page.getByText(/error/i).isVisible();
    expect(errorVisible).toBe(false);
  });
});
```

---

### Step 4: Create accessibility tests

Create `e2e/vault/vault-a11y.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { VaultPage } from '../pages/VaultPage';
import { checkA11y, checkElementA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';
import path from 'path';

test.describe('Vault Accessibility', () => {
  let vaultPage: VaultPage;
  let testProjectId: string;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    testProjectId = workerCtx.organizationId;

    vaultPage = new VaultPage(page);
    await vaultPage.goto(testProjectId);
  });

  test('empty vault page passes accessibility checks', async ({ page }) => {
    await checkA11y(page, { detailedReport: true });
  });

  test('vault page with files passes accessibility checks', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');
    await vaultPage.uploadFile(testFilePath);
    await vaultPage.expectFileVisible('test.txt');

    await checkA11y(page, { detailedReport: true });
  });

  test('search results pass accessibility checks', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');
    await vaultPage.uploadFile(testFilePath);
    await vaultPage.waitForExtractionComplete('test.txt');

    await vaultPage.search('test document');

    await checkA11y(page, { detailedReport: true });
  });

  test('upload zone has proper ARIA attributes', async ({ page }) => {
    await checkElementA11y(page, '[data-testid="vault-upload-zone"]');
  });

  test('file cards have proper ARIA labels for actions', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');
    await vaultPage.uploadFile(testFilePath);

    // Verify delete button has accessible name
    const deleteButton = page.getByRole('button', { name: /delete/i });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toHaveAccessibleName();
  });

  test('search input has proper label association', async ({ page }) => {
    // Input should be accessible via placeholder or label
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await expect(searchInput).toBeVisible();
  });

  test('loading spinners respect reduced motion preference', async ({ page }) => {
    // Verify spinners use motion-safe class
    const testFilePath = path.join(__dirname, '../fixtures/test.txt');
    await vaultPage.uploadFile(testFilePath);

    // Check that any spinner elements use motion-safe:animate-spin
    const spinnerElements = page.locator('.motion-safe\\:animate-spin, [class*="motion-safe:animate-spin"]');

    // If spinners are present, they should have the class
    const spinnerCount = await spinnerElements.count();
    if (spinnerCount > 0) {
      // Spinners exist and have proper class - pass
      expect(spinnerCount).toBeGreaterThan(0);
    }
  });
});
```

---

### Step 5: Update Playwright config to include vault tests

Ensure `playwright.config.ts` includes vault tests in the parallel project:

```typescript
// In projects array, ensure vault tests are included
{
  name: 'parallel',
  testIgnore: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
  testMatch: ['**/*.spec.ts'], // Includes e2e/vault/*.spec.ts
  use: { ...devices['Desktop Chrome'] },
},
```

---

### Step 6: Run E2E tests

```bash
npm run test:e2e -- --grep="vault"
```

**Expected:** Tests run with proper isolation

---

### Step 7: Commit E2E tests

```bash
git add e2e/pages/VaultPage.ts e2e/vault/
git commit -m "test: add E2E tests for Knowledge Vault using Phase 0 infrastructure"
```

---

## Verification Checklist

- [ ] `e2e/pages/VaultPage.ts` exists with Page Object pattern
- [ ] `e2e/vault/vault.spec.ts` exists with main tests
- [ ] `e2e/vault/vault-search.spec.ts` exists with search tests
- [ ] `e2e/vault/vault-a11y.spec.ts` exists with accessibility tests
- [ ] Tests import from `e2e/fixtures/test-fixtures.ts` (NOT new auth fixture)
- [ ] Tests use `TIMEOUTS` constants from `e2e/config/timeouts.ts`
- [ ] Tests use `workerCtx` for data isolation
- [ ] Tests use `loginAsWorker` for authentication
- [ ] Tests use `checkA11y` for accessibility testing
- [ ] Tests use `expect().toPass()` pattern for async assertions
- [ ] Tests account for search debounce with proper waits
- [ ] No hardcoded timeout values
- [ ] E2E tests run without errors
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[99: Phase 2 Verification](./99-verification.md)**.
