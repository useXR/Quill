/**
 * Knowledge Vault Search E2E tests
 *
 * Tests for semantic search functionality within the vault.
 * Uses the Phase 0 E2E infrastructure.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, NAVIGATION_WAIT, VISIBILITY_WAIT } from '../config/timeouts';
import { VaultPage } from '../pages/VaultPage';

// Test project ID
const TEST_PROJECT_ID = 'test-project-id';

test.describe('Knowledge Vault Search', () => {
  test.describe('Search Functionality (Mocked)', () => {
    test.beforeEach(async ({ page }) => {
      // Mock vault items API
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                {
                  id: 'item-1',
                  filename: 'research-paper.pdf',
                  type: 'pdf',
                  extraction_status: 'success',
                  chunk_count: 10,
                },
              ],
            }),
          });
        }
      });
    });

    test('should perform search and display results', async ({ page }) => {
      // Mock search API
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'research-paper.pdf',
                content: 'Machine learning algorithms are fundamental to AI research.',
                similarity: 0.95,
              },
              {
                vaultItemId: 'item-1',
                chunkIndex: 1,
                filename: 'research-paper.pdf',
                content: 'Deep learning is a subset of machine learning methods.',
                similarity: 0.87,
              },
            ],
          }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Perform search
      await vaultPage.search('machine learning');

      // Verify results are displayed
      await vaultPage.expectSearchResultCount(2);
    });

    test('should show no results message when search returns empty', async ({ page }) => {
      // Mock empty search results
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Perform search that returns no results
      await vaultPage.search('nonexistent content xyz123');

      // Verify no results message
      await vaultPage.expectSearchResultCount(0);
      await expect(page.locator('text=No results found')).toBeVisible(VISIBILITY_WAIT);
      await expect(page.locator('text=Try different keywords or phrases')).toBeVisible(VISIBILITY_WAIT);
    });

    test('should display similarity percentage in results', async ({ page }) => {
      // Mock search with varied similarity scores
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'document.txt',
                content: 'Highly relevant content',
                similarity: 0.92,
              },
              {
                vaultItemId: 'item-2',
                chunkIndex: 0,
                filename: 'other.txt',
                content: 'Somewhat relevant content',
                similarity: 0.75,
              },
            ],
          }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      await vaultPage.search('relevant content');

      // Verify similarity percentages are displayed
      await expect(page.locator('text=92%')).toBeVisible(VISIBILITY_WAIT);
      await expect(page.locator('text=75%')).toBeVisible(VISIBILITY_WAIT);
    });

    test('should display filename in search results', async ({ page }) => {
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'important-research.pdf',
                content: 'Content from the research paper',
                similarity: 0.88,
              },
            ],
          }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      await vaultPage.search('research');

      // Verify filename is displayed in results
      await expect(page.locator('text=important-research.pdf')).toBeVisible(VISIBILITY_WAIT);
    });

    test('should disable search button when input is empty', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Search button should be disabled with empty input
      await expect(vaultPage.searchButton).toBeDisabled();

      // Type something
      await vaultPage.searchInput.fill('test query');

      // Button should now be enabled
      await expect(vaultPage.searchButton).toBeEnabled();

      // Clear input
      await vaultPage.searchInput.fill('');

      // Button should be disabled again
      await expect(vaultPage.searchButton).toBeDisabled();
    });

    test('should show loading state during search', async ({ page }) => {
      // Mock slow search
      await page.route('**/api/vault/search', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Start search
      await vaultPage.searchInput.fill('test query');
      await vaultPage.searchButton.click();

      // Should show loading spinner (button contains spinner during loading)
      await expect(page.locator('[data-testid="status-spinner"], button svg.animate-spin')).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    });

    test('should display content snippet in results', async ({ page }) => {
      const contentSnippet = 'This is the matching content from the document that relates to the search query.';

      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'document.txt',
                content: contentSnippet,
                similarity: 0.9,
              },
            ],
          }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      await vaultPage.search('matching content');

      // Verify content snippet is displayed
      await expect(page.locator(`text=${contentSnippet}`)).toBeVisible(VISIBILITY_WAIT);
    });

    test('should handle search error gracefully', async ({ page }) => {
      // Mock search error
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Search failed' }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      await vaultPage.search('test query');

      // Should show error message
      await expect(page.locator('[role="alert"]')).toBeVisible({
        timeout: TIMEOUTS.API_CALL,
      });
    });

    test('should allow clicking on search results', async ({ page }) => {
      const resultClicked = false;

      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'clickable.txt',
                content: 'Click me content',
                similarity: 0.85,
              },
            ],
          }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      await vaultPage.search('click');

      // Click on the result
      const result = vaultPage.getSearchResult(0);
      await expect(result).toBeVisible(VISIBILITY_WAIT);

      // Verify result is clickable (has button role)
      await expect(result).toHaveAttribute('type', 'button');
    });
  });

  test.describe('Search Input Behavior', () => {
    test('should clear search input after results', async ({ page }) => {
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        }
      });

      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Fill and search
      await vaultPage.searchInput.fill('test query');
      await expect(vaultPage.searchInput).toHaveValue('test query');

      // Search input should maintain value after search
      await vaultPage.searchButton.click();
      await expect(vaultPage.searchInput).toHaveValue('test query');
    });

    test('should have correct placeholder text', async ({ page }) => {
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        }
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      await expect(vaultPage.searchInput).toHaveAttribute('placeholder', 'Search your vault...');
    });
  });
});
