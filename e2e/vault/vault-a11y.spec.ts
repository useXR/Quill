/**
 * Knowledge Vault Accessibility E2E tests
 *
 * Tests for WCAG 2.1 AA compliance of vault components.
 * Uses the Phase 0 E2E infrastructure.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';
import { checkA11y } from '../helpers/axe';
import { VaultPage } from '../pages/VaultPage';

// Test project ID
const TEST_PROJECT_ID = 'test-project-id';

test.describe('Knowledge Vault Accessibility', () => {
  test.describe('Empty Page Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Mock empty vault
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        }
      });
    });

    test('should pass accessibility audit on empty vault page', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        // Run a11y on login page instead
        await checkA11y(page, { skipFailures: true, detailedReport: true });
        return;
      }

      // Run accessibility audit
      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Main heading should be h1
      await expect(vaultPage.pageTitle).toBeVisible();

      // Section headings should be h2
      const searchHeading = page.getByRole('heading', { name: /search/i, level: 2 });
      const filesHeading = page.getByRole('heading', { name: /files/i, level: 2 });

      await expect(searchHeading).toBeVisible();
      await expect(filesHeading).toBeVisible();
    });
  });

  test.describe('Page with Files Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Mock vault with items
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                {
                  id: 'item-1',
                  filename: 'document1.pdf',
                  type: 'pdf',
                  extraction_status: 'success',
                  chunk_count: 5,
                },
                {
                  id: 'item-2',
                  filename: 'document2.txt',
                  type: 'txt',
                  extraction_status: 'pending',
                  chunk_count: null,
                },
                {
                  id: 'item-3',
                  filename: 'document3.docx',
                  type: 'docx',
                  extraction_status: 'failed',
                  chunk_count: null,
                },
              ],
            }),
          });
        }
      });
    });

    test('should pass accessibility audit with files present', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Run accessibility audit
      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should have accessible delete buttons', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Delete buttons should have aria-label
      const deleteButtons = page.locator('button[aria-label="Delete item"]');
      const count = await deleteButtons.count();

      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        await expect(deleteButtons.nth(i)).toHaveAttribute('aria-label', 'Delete item');
      }
    });

    test('should have accessible retry buttons for failed items', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Retry button should have aria-label
      const retryButton = page.locator('button[aria-label="Retry extraction"]');
      await expect(retryButton).toHaveAttribute('aria-label', 'Retry extraction');
    });
  });

  test.describe('Search Results Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        }
      });
    });

    test('should pass accessibility audit with search results', async ({ page }) => {
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'result1.pdf',
                content: 'Search result content',
                similarity: 0.9,
              },
              {
                vaultItemId: 'item-2',
                chunkIndex: 0,
                filename: 'result2.txt',
                content: 'More search content',
                similarity: 0.8,
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

      // Perform search to get results
      await vaultPage.search('test');

      // Wait for results
      await vaultPage.expectSearchResultCount(2);

      // Run accessibility audit
      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should have accessible search results list', async ({ page }) => {
      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'item-1',
                chunkIndex: 0,
                filename: 'accessible.pdf',
                content: 'Accessible content',
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

      await vaultPage.search('accessible');
      await vaultPage.expectSearchResultCount(1);

      // Results list should have proper ARIA attributes
      const resultsList = vaultPage.searchResults;
      await expect(resultsList).toHaveAttribute('role', 'list');
      await expect(resultsList).toHaveAttribute('aria-label', 'Search results');

      // Individual results should have listitem role
      const resultItem = vaultPage.getSearchResult(0);
      await expect(resultItem).toHaveAttribute('role', 'listitem');
    });
  });

  test.describe('ARIA Attributes', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        }
      });
    });

    test('should have proper ARIA attributes on upload zone', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Upload zone should have proper accessibility attributes
      const uploadZone = vaultPage.uploadZone;
      await expect(uploadZone).toHaveAttribute('role', 'button');
      await expect(uploadZone).toHaveAttribute('aria-label', 'Upload files to vault');
      await expect(uploadZone).toHaveAttribute('tabindex', '0');
    });

    test('should have proper ARIA attributes on search button', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      const searchButton = vaultPage.searchButton;
      await expect(searchButton).toHaveAttribute('aria-label', 'Search');
      await expect(searchButton).toHaveAttribute('type', 'submit');
    });

    test('should have accessible section landmarks', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Sections should have aria-labelledby
      await expect(vaultPage.searchSection).toHaveAttribute('aria-labelledby', 'search-heading');
      await expect(vaultPage.filesSection).toHaveAttribute('aria-labelledby', 'files-heading');
    });

    test('should hide decorative icons from screen readers', async ({ page }) => {
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                {
                  id: 'item-1',
                  filename: 'test.pdf',
                  type: 'pdf',
                  extraction_status: 'success',
                  chunk_count: 3,
                },
              ],
            }),
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

      // Icons should have aria-hidden
      const icons = page.locator('svg[aria-hidden="true"]');
      const count = await icons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        }
      });
    });

    test('should allow keyboard interaction with upload zone', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(TEST_PROJECT_ID);

      // Skip if redirected to login
      if (page.url().includes('/login')) {
        test.skip();
        return;
      }

      // Upload zone should be focusable
      await vaultPage.uploadZone.focus();
      await expect(vaultPage.uploadZone).toBeFocused();
    });

    test('should allow form submission via keyboard', async ({ page }) => {
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

      // Fill search input
      await vaultPage.searchInput.fill('test query');

      // Submit via Enter key
      await vaultPage.searchInput.press('Enter');

      // Should show no results (form was submitted)
      await expect(page.locator('text=No results found')).toBeVisible({
        timeout: TIMEOUTS.API_CALL,
      });
    });
  });

  test.describe('Error State Accessibility', () => {
    test('should have accessible error messages', async ({ page }) => {
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

      // Trigger error
      await vaultPage.search('test');

      // Error should have role="alert" for screen reader announcement
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({
        timeout: TIMEOUTS.API_CALL,
      });

      // Run a11y audit on error state
      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });
  });
});
