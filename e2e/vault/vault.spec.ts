/**
 * Knowledge Vault E2E tests
 *
 * Tests for vault file upload, management, and basic functionality.
 * Uses the Phase 0 E2E infrastructure with authenticated storage state.
 *
 * NOTE: These tests run with storage state from auth.setup.ts (via playwright.config.ts).
 * Unauthenticated access tests are in auth.spec.ts.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';
import { VaultPage } from '../pages/VaultPage';
import * as path from 'path';

// Test data stored per-worker to avoid race conditions
const testData: { projectId?: string } = {};

// Helper to create a test project via API (faster and more reliable)
async function createTestProject(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      title: `E2E Vault Test ${Date.now()}`,
      description: 'Test project for vault E2E tests',
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()}`);
  }
  const project = await response.json();
  return project.id;
}

test.describe('Knowledge Vault', () => {
  // Create a test project for each worker
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();
    // Make a request to ensure we're authenticated
    testData.projectId = await createTestProject(page);
    await context.close();
  });

  test.describe('Vault Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      // Mock the vault API to return empty items for consistent tests
      await page.route('**/api/vault', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        } else {
          await route.continue();
        }
      });
    });

    test('should display vault page when authenticated', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Should NOT redirect to login (we're authenticated via storage state)
      await expect(page).not.toHaveURL(/\/login/);

      // Vault page should be visible
      await expect(vaultPage.pageTitle).toBeVisible();
    });

    test('should show upload zone with correct attributes', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      await vaultPage.expectUploadZoneVisible();
    });
  });

  test.describe('Upload Zone Interaction (Mocked)', () => {
    test.beforeEach(async ({ page }) => {
      // Mock vault APIs
      await page.route('**/api/vault**', async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
          });
        } else if (method === 'POST' && route.request().url().includes('/upload')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-item-1',
              filename: 'test.txt',
              type: 'txt',
              extraction_status: 'pending',
            }),
          });
        } else {
          await route.continue();
        }
      });
    });

    test('should accept file input via upload zone', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Verify file input exists and accepts correct types
      const fileInput = vaultPage.fileInput;
      await expect(fileInput).toHaveAttribute(
        'accept',
        '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
      );
    });

    test('should show upload instructions', async ({ page }) => {
      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Verify upload instructions are visible
      await expect(page.locator('text=Drag files here or click to browse')).toBeVisible();
      await expect(page.locator('text=PDF, DOCX, or TXT')).toBeVisible();
    });
  });

  test.describe('File Upload Flow (Mocked)', () => {
    test('should handle file upload and show in list', async ({ page }) => {
      let uploadCalled = false;
      const mockItem = {
        id: 'uploaded-item-1',
        project_id: testData.projectId!,
        filename: 'test.txt',
        type: 'txt',
        storage_path: 'vault/test.txt',
        size_bytes: 1024,
        extraction_status: 'pending',
        chunk_count: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock vault APIs with upload tracking
      await page.route('**/api/vault**', async (route) => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'GET') {
          // Return uploaded item after upload is called
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: uploadCalled ? [mockItem] : [],
            }),
          });
        } else if (method === 'POST' && url.includes('/upload')) {
          uploadCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockItem),
          });
        } else {
          await route.continue();
        }
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Upload a test file
      const testFilePath = path.resolve(__dirname, '../fixtures/test.txt');
      await vaultPage.uploadFile(testFilePath);

      // Wait for upload to complete and file to appear
      await vaultPage.waitForUploadComplete();
      await vaultPage.expectFileVisible('test.txt');
    });

    test('should show uploading state during file upload', async ({ page }) => {
      // Mock slow upload
      await page.route('**/api/vault/upload', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-item',
            filename: 'test.txt',
            type: 'txt',
            extraction_status: 'pending',
          }),
        });
      });

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
      await vaultPage.goto(testData.projectId!);

      // Start upload
      const testFilePath = path.resolve(__dirname, '../fixtures/test.txt');
      await vaultPage.uploadFile(testFilePath);

      // Should show uploading state
      await expect(page.locator('text=Uploading...')).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    });
  });

  // NOTE: These tests are skipped because the vault page uses server-side rendering
  // which fetches data directly from Supabase before client-side mocks take effect.
  // To test deletion with actual data, we would need to create real vault items.
  test.describe('File Deletion (Mocked)', () => {
    test.skip('should remove file from list on delete', async ({ page }) => {
      let itemDeleted = false;
      const mockItem = {
        id: 'item-to-delete',
        project_id: testData.projectId!,
        filename: 'deleteme.txt',
        type: 'txt',
        storage_path: 'vault/deleteme.txt',
        size_bytes: 512,
        extraction_status: 'success',
        chunk_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await page.route('**/api/vault**', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: itemDeleted ? [] : [mockItem],
            }),
          });
        } else if (method === 'DELETE') {
          itemDeleted = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Verify file is visible
      await vaultPage.expectFileVisible('deleteme.txt');

      // Delete the file
      await vaultPage.deleteFile('deleteme.txt');

      // File should be removed (optimistic update)
      await vaultPage.expectFileNotVisible('deleteme.txt');
    });
  });

  // NOTE: These tests are skipped because the vault page uses server-side rendering
  // which fetches data directly from Supabase before client-side mocks take effect.
  test.describe('Extraction Status Display (Mocked)', () => {
    test.skip('should display different extraction statuses', async ({ page }) => {
      const mockItems = [
        {
          id: 'item-pending',
          filename: 'pending.txt',
          type: 'txt',
          extraction_status: 'pending',
          chunk_count: null,
        },
        {
          id: 'item-success',
          filename: 'success.txt',
          type: 'txt',
          extraction_status: 'success',
          chunk_count: 5,
        },
        {
          id: 'item-failed',
          filename: 'failed.txt',
          type: 'txt',
          extraction_status: 'failed',
          chunk_count: null,
        },
      ];

      await page.route('**/api/vault**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: mockItems }),
          });
        }
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Verify all status types are displayed
      await expect(page.locator('text=pending').first()).toBeVisible(VISIBILITY_WAIT);
      await expect(page.locator('text=success').first()).toBeVisible(VISIBILITY_WAIT);
      await expect(page.locator('text=failed').first()).toBeVisible(VISIBILITY_WAIT);

      // Success item should show chunk count
      await expect(page.locator('text=5 chunks')).toBeVisible(VISIBILITY_WAIT);
    });

    test.skip('should show retry button for failed extractions', async ({ page }) => {
      const mockItem = {
        id: 'failed-item',
        filename: 'failed.txt',
        type: 'txt',
        extraction_status: 'failed',
        chunk_count: null,
      };

      await page.route('**/api/vault**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [mockItem] }),
          });
        }
      });

      const vaultPage = new VaultPage(page);
      await vaultPage.goto(testData.projectId!);

      // Retry button should be visible for failed items
      const retryButton = vaultPage.getRetryButton('failed.txt');
      await expect(retryButton).toBeVisible(VISIBILITY_WAIT);
    });
  });
});
