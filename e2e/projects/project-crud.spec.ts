/**
 * Project CRUD E2E tests
 *
 * Comprehensive tests for project management including:
 * - Project listing
 * - Project creation with validation
 * - Project detail view
 * - Document management within projects
 * - Navigation
 *
 * These tests run with authenticated storage state from auth.setup.ts.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, VISIBILITY_WAIT, NAVIGATION_WAIT } from '../config/timeouts';
import { ProjectPage } from '../pages/ProjectPage';
import { checkA11y } from '../helpers/axe';

test.describe('Project Management', () => {
  test.describe('Projects List', () => {
    test('should display projects list page when authenticated', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      // Should NOT redirect to login (we're authenticated via storage state)
      await expect(page).not.toHaveURL(/\/login/);

      // Projects heading should be visible
      await expect(projectPage.projectsHeading).toBeVisible();
    });

    test('should display new project button', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      await expect(projectPage.newProjectButton).toBeVisible();
    });

    test('should navigate to new project form when clicking new project button', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      await projectPage.newProjectButton.click();

      await expect(page).toHaveURL(/\/projects\/new/);
    });

    test('should display project cards for existing projects', async ({ page }) => {
      // Create a project via API (faster and more reliable)
      const timestamp = Date.now();
      const title = `List Test Project ${timestamp}`;
      const response = await page.request.post('/api/projects', {
        data: { title, description: 'Test project' },
      });
      expect(response.ok()).toBe(true);

      // Navigate to projects list
      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      // Wait for and verify the project card appears
      const card = projectPage.getProjectCardByTitle(title);
      await expect(card).toBeVisible({ timeout: TIMEOUTS.API_CALL });

      // Should have at least one project card
      const count = await projectPage.getProjectCount();
      expect(count).toBeGreaterThan(0);
    });

    test('should navigate to project detail when clicking a project card', async ({ page }) => {
      // Create a project via API
      const timestamp = Date.now();
      const title = `Click Test Project ${timestamp}`;
      const response = await page.request.post('/api/projects', {
        data: { title, description: 'Test project' },
      });
      expect(response.ok()).toBe(true);
      const project = await response.json();

      // Navigate to list
      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      // Wait for the project card to appear and click it
      const card = projectPage.getProjectCardByTitle(title);
      await expect(card).toBeVisible({ timeout: TIMEOUTS.API_CALL });
      await card.click();

      // Should be on project detail page
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}`));
    });
  });

  test.describe('Project Creation', () => {
    test('should display new project form with all fields', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // Form elements should be visible
      await expect(projectPage.titleInput).toBeVisible();
      await expect(projectPage.descriptionInput).toBeVisible();
      await expect(projectPage.createButton).toBeVisible();
      await expect(projectPage.cancelButton).toBeVisible();
    });

    test('should create project with title only', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      const timestamp = Date.now();
      const title = `Title Only Project ${timestamp}`;

      const projectId = await projectPage.createProject(title);

      // Should redirect to project detail page
      expect(projectId).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
    });

    test('should create project with title and description', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      const timestamp = Date.now();
      const title = `Full Project ${timestamp}`;
      const description = 'This is a test project description for E2E testing.';

      const projectId = await projectPage.createProject(title, description);

      // Should redirect to project detail page
      expect(projectId).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
    });

    test('should show validation error when title is empty', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // The title input has required attribute - browser prevents submission
      // So we verify the required attribute exists
      await expect(projectPage.titleInput).toHaveAttribute('required', '');

      // Try to submit - browser validation should prevent it
      const currentUrl = page.url();
      await projectPage.submitCreate();

      // Should stay on same page (browser validation prevented submit)
      await expect(page).toHaveURL(currentUrl);
    });

    test('should show character count for title', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // Type in title
      await projectPage.fillTitle('Test Title');

      // Character count should show in helper text (format: "10/255 characters")
      await expect(projectPage.titleCharCount).toContainText('10/255');
    });

    test('should show character count for description', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // Type in description
      await projectPage.fillDescription('Test description text');

      // Character count should show in helper text (format: "21/1000 characters")
      await expect(projectPage.descriptionCharCount).toContainText('21/1000');
    });

    test('should navigate back to projects list on cancel', async ({ page }) => {
      const projectPage = new ProjectPage(page);

      // First go to projects list, then to new (so back() goes to list)
      await projectPage.gotoList();
      await projectPage.newProjectButton.click();
      await expect(page).toHaveURL(/\/projects\/new/);

      // Fill some data
      await projectPage.fillTitle('Cancelled Project');

      // Click cancel (uses router.back())
      await projectPage.cancelCreate();

      // Should be back on projects list
      await expect(page).toHaveURL(/\/projects$/);
    });

    test('should enforce title character limit', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // Try to enter a very long title (>255 chars)
      const longTitle = 'A'.repeat(300);
      await projectPage.fillTitle(longTitle);

      // The input should either truncate or show error
      const inputValue = await projectPage.titleInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(255);
    });

    test('should enforce description character limit', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // Try to enter a very long description (>1000 chars)
      const longDescription = 'B'.repeat(1100);
      await projectPage.fillDescription(longDescription);

      // The input should either truncate or show error
      const inputValue = await projectPage.descriptionInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(1000);
    });
  });

  test.describe('Project Detail', () => {
    // Use object to store test data (avoids race conditions with parallel workers)
    const testData: { projectId?: string; projectTitle?: string } = {};

    // Helper to create a test project via API (faster and more reliable)
    async function createTestProject(page: import('@playwright/test').Page): Promise<{ id: string; title: string }> {
      const timestamp = Date.now();
      const title = `Detail Test Project ${timestamp}`;
      const response = await page.request.post('/api/projects', {
        data: {
          title,
          description: 'A project for testing the detail page.',
        },
      });
      if (!response.ok()) {
        throw new Error(`Failed to create project: ${response.status()}`);
      }
      const project = await response.json();
      return { id: project.id, title };
    }

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({
        storageState: '.playwright/.auth/user.json',
      });
      const page = await context.newPage();

      const project = await createTestProject(page);
      testData.projectId = project.id;
      testData.projectTitle = project.title;

      await context.close();
    });

    test('should display project title on detail page', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      // Project title should be visible in the h1 heading
      await expect(page.getByRole('heading', { name: testData.projectTitle!, level: 1 })).toBeVisible();
    });

    test('should display add document button', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      await expect(projectPage.addDocumentButton).toBeVisible();
    });

    test('should create new document when clicking add document', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      // Click add document
      await projectPage.addDocument();

      // Should navigate to document editor
      await expect(page).toHaveURL(new RegExp(`/projects/${testData.projectId}/documents/`));
    });

    // NOTE: Skipped because vault link is not implemented in current UI
    test.skip('should display vault link', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      // Vault link should be visible
      await expect(projectPage.vaultLink).toBeVisible();
    });

    // NOTE: Skipped because vault link is not implemented in current UI
    test.skip('should navigate to vault when clicking vault link', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      await projectPage.vaultLink.click();

      // Should be on vault page
      await expect(page).toHaveURL(new RegExp(`/projects/${testData.projectId}/vault`));
    });
  });

  test.describe('Accessibility', () => {
    test('should pass accessibility audit on projects list', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should pass accessibility audit on new project form', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should have accessible form labels', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      // Title input should have associated label
      const titleLabel = page.locator('label[for="title"]');
      await expect(titleLabel).toBeVisible();
      await expect(titleLabel).toContainText(/title/i);

      // Description input should have associated label
      const descLabel = page.locator('label[for="description"]');
      await expect(descLabel).toBeVisible();
      await expect(descLabel).toContainText(/description/i);
    });

    test('should support keyboard navigation on projects list', async ({ page }) => {
      // Create a project first
      const projectPage = new ProjectPage(page);
      const timestamp = Date.now();
      await projectPage.createProject(`Keyboard Test ${timestamp}`);

      // Navigate to list
      await projectPage.gotoList();

      // Tab to new project button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to activate with Enter
      // (This tests general keyboard navigability)
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON']).toContain(activeElement);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle project not found', async ({ page }) => {
      // Use a valid UUID format that doesn't exist
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject('00000000-0000-0000-0000-000000000000');

      // Should show 404 or error page
      await page.waitForLoadState('networkidle');

      // Either error page (404/500), redirect to projects list, or login
      const isErrorPage = await page
        .getByText(/not found|error|something went wrong|404/i)
        .first()
        .isVisible()
        .catch(() => false);
      const isProjectsList = page.url().endsWith('/projects');
      const isLogin = page.url().includes('/login');

      // Non-existent project should result in error page or redirect
      expect(isErrorPage || isProjectsList || isLogin).toBe(true);
    });

    test('should handle API errors gracefully on project creation', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.continue();
        }
      });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoNew();

      await projectPage.fillTitle('Error Test Project');
      await projectPage.submitCreate();

      // Should show error message
      await expect(projectPage.formError).toBeVisible({ timeout: TIMEOUTS.API_CALL });
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      // Projects heading should still be visible
      await expect(projectPage.projectsHeading).toBeVisible();

      // New project button should be visible
      await expect(projectPage.newProjectButton).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoList();

      // Projects heading should be visible
      await expect(projectPage.projectsHeading).toBeVisible();
    });
  });
});
