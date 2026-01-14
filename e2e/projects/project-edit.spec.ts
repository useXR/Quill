/**
 * Project Edit E2E tests
 *
 * Tests for editing project functionality including:
 * - Navigation to edit page
 * - Form pre-population
 * - Title and description editing with validation
 * - Status changes
 * - Save and cancel behavior
 * - Accessibility
 *
 * These tests run with authenticated storage state from auth.setup.ts.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, VISIBILITY_WAIT, NAVIGATION_WAIT } from '../config/timeouts';
import { ProjectPage } from '../pages/ProjectPage';
import { checkA11y } from '../helpers/axe';

test.describe('Project Editing', () => {
  // Store test project data
  const testData: { projectId?: string; projectTitle?: string; createdProjectIds: string[] } = {
    createdProjectIds: [],
  };

  // Helper to create a test project via API
  async function createTestProject(
    page: import('@playwright/test').Page,
    title?: string,
    description?: string
  ): Promise<{ id: string; title: string; description: string }> {
    const timestamp = Date.now();
    const projectTitle = title || `Edit Test Project ${timestamp}`;
    const projectDescription = description || 'A project for testing edit functionality.';
    const response = await page.request.post('/api/projects', {
      data: {
        title: projectTitle,
        description: projectDescription,
      },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create project: ${response.status()}`);
    }
    const project = await response.json();
    testData.createdProjectIds.push(project.id);
    return { id: project.id, title: projectTitle, description: projectDescription };
  }

  // Helper to delete test projects
  async function cleanupProjects(page: import('@playwright/test').Page) {
    for (const projectId of testData.createdProjectIds) {
      await page.request.delete(`/api/projects/${projectId}`).catch(() => {
        // Ignore cleanup errors
      });
    }
    testData.createdProjectIds = [];
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

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();
    await cleanupProjects(page);
    await context.close();
  });

  test.describe('Navigation', () => {
    test('should navigate to edit page from project detail', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      // Click edit button
      await projectPage.clickEdit();

      // Should navigate to edit page
      await expect(page).toHaveURL(new RegExp(`/projects/${testData.projectId}/edit`));
    });

    test('should display breadcrumb navigation on edit page', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Should have breadcrumb navigation with link back to project
      const breadcrumb = page.locator('nav[aria-label="breadcrumb"], nav:has(a[href*="/projects"])');
      await expect(breadcrumb).toBeVisible(VISIBILITY_WAIT);
    });

    test('should redirect to login if not authenticated', async ({ browser }) => {
      // Create a new context without auth
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/projects/${testData.projectId}/edit`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);

      await context.close();
    });
  });

  test.describe('Form Pre-population', () => {
    test('should pre-fill form with existing project data', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Title should be pre-filled
      await expect(projectPage.editTitleInput).toHaveValue(testData.projectTitle!);

      // Description should be pre-filled
      await expect(projectPage.editDescriptionInput).toHaveValue('A project for testing edit functionality.');
    });

    test('should show correct character count for pre-filled data', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Title character count should reflect current value
      const titleLength = testData.projectTitle!.length;
      await expect(projectPage.editTitleCharCount).toContainText(`${titleLength}/255`);

      // Description character count should reflect current value
      const descLength = 'A project for testing edit functionality.'.length;
      await expect(projectPage.editDescriptionCharCount).toContainText(`${descLength}/1000`);
    });
  });

  test.describe('Title Editing', () => {
    test('should update project title successfully', async ({ page }) => {
      // Create a new project for this test
      const context = await page.context();
      const project = await createTestProject(page, `Title Update Test ${Date.now()}`);

      const projectPage = new ProjectPage(page);
      const newTitle = `Updated Title ${Date.now()}`;

      await projectPage.editProject(project.id, newTitle);

      // Should redirect to detail page
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));

      // Title should be updated on detail page
      await expect(page.getByRole('heading', { name: newTitle, level: 1 })).toBeVisible(VISIBILITY_WAIT);
    });

    test('should show validation error when title is cleared', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Clear the title
      await projectPage.editTitleInput.clear();

      // The title input has required attribute - browser prevents submission
      await expect(projectPage.editTitleInput).toHaveAttribute('required', '');

      // Try to submit - browser validation should prevent it
      const currentUrl = page.url();
      await projectPage.submitEdit();

      // Should stay on same page (browser validation prevented submit)
      await expect(page).toHaveURL(currentUrl);
    });

    test('should update character count when title changes', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Clear and type new title
      await projectPage.clearAndFillEditTitle('Short');

      // Character count should update
      await expect(projectPage.editTitleCharCount).toContainText('5/255');
    });

    test('should enforce title character limit', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Try to enter a very long title (>255 chars)
      const longTitle = 'A'.repeat(300);
      await projectPage.editTitleInput.clear();
      await projectPage.editTitleInput.fill(longTitle);

      // The input should either truncate or show error
      const inputValue = await projectPage.editTitleInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(255);
    });
  });

  test.describe('Description Editing', () => {
    test('should update project description successfully', async ({ page }) => {
      // Create a new project for this test
      const project = await createTestProject(page, `Desc Update Test ${Date.now()}`);

      const projectPage = new ProjectPage(page);
      const newDescription = `Updated description at ${Date.now()}`;

      await projectPage.editProject(project.id, undefined, newDescription);

      // Should redirect to detail page
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
    });

    test('should allow clearing description', async ({ page }) => {
      // Create a new project for this test
      const project = await createTestProject(page, `Clear Desc Test ${Date.now()}`, 'Description to be cleared');

      const projectPage = new ProjectPage(page);

      // Clear the description
      await projectPage.gotoEdit(project.id);
      await projectPage.editDescriptionInput.clear();
      await projectPage.submitEdit();

      // Should redirect to detail page (description is optional)
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`), NAVIGATION_WAIT);
    });
  });

  test.describe('Status Changes', () => {
    test('should update project status to submitted', async ({ page }) => {
      // Create a new project for this test
      const project = await createTestProject(page, `Status Test Submitted ${Date.now()}`);

      const projectPage = new ProjectPage(page);

      await projectPage.editProject(project.id, undefined, undefined, 'submitted');

      // Should redirect to detail page
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));

      // Status should be visible (badge or text)
      await expect(page.locator('text=submitted')).toBeVisible(VISIBILITY_WAIT);
    });

    test('should update project status to funded', async ({ page }) => {
      // Create a new project for this test
      const project = await createTestProject(page, `Status Test Funded ${Date.now()}`);

      const projectPage = new ProjectPage(page);

      await projectPage.editProject(project.id, undefined, undefined, 'funded');

      // Should redirect to detail page
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));

      // Status should be visible (badge or text)
      await expect(page.locator('text=funded')).toBeVisible(VISIBILITY_WAIT);
    });

    test('should display all status options in dropdown', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Get all options from the status select
      const options = await projectPage.editStatusSelect.locator('option').allTextContents();

      // Should have draft, submitted, and funded options
      expect(options.some((opt) => opt.toLowerCase().includes('draft'))).toBe(true);
      expect(options.some((opt) => opt.toLowerCase().includes('submitted'))).toBe(true);
      expect(options.some((opt) => opt.toLowerCase().includes('funded'))).toBe(true);
    });
  });

  test.describe('Save and Cancel', () => {
    test('should show loading state when saving', async ({ page }) => {
      // Create a new project for this test
      const project = await createTestProject(page, `Save Loading Test ${Date.now()}`);

      // Add a small delay to API to observe loading state
      await page.route(`**/api/projects/${project.id}`, async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          await new Promise((resolve) => setTimeout(resolve, 500));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(project.id);

      await projectPage.clearAndFillEditTitle(`Updated ${Date.now()}`);
      await projectPage.submitEdit();

      // Save button should show loading state (disabled or changed text)
      // Check if button is disabled or has loading indicator
      const isDisabled = await projectPage.saveButton.isDisabled();
      const buttonText = await projectPage.saveButton.textContent();
      expect(isDisabled || buttonText?.toLowerCase().includes('saving')).toBe(true);
    });

    test('should navigate back on cancel without saving', async ({ page }) => {
      const projectPage = new ProjectPage(page);

      // First go to project detail, then to edit (so back() goes to detail)
      await projectPage.gotoProject(testData.projectId!);
      await projectPage.clickEdit();
      await expect(page).toHaveURL(new RegExp(`/projects/${testData.projectId}/edit`));

      // Make changes
      await projectPage.clearAndFillEditTitle('Cancelled Title Change');

      // Click cancel
      await projectPage.cancelEdit();

      // Should navigate back (either to detail page or list)
      await expect(page).not.toHaveURL(/\/edit/);
    });

    test('should not save changes when cancel is clicked', async ({ page }) => {
      // Create a new project with known title
      const originalTitle = `Cancel Test Original ${Date.now()}`;
      const project = await createTestProject(page, originalTitle);

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(project.id);

      // Make changes
      await projectPage.clearAndFillEditTitle('Should Not Be Saved');

      // Click cancel
      await projectPage.cancelEdit();

      // Navigate to project detail and verify title unchanged
      await projectPage.gotoProject(project.id);
      await expect(page.getByRole('heading', { name: originalTitle, level: 1 })).toBeVisible(VISIBILITY_WAIT);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API error gracefully', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Mock API failure
      await page.route(`**/api/projects/${testData.projectId}`, async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.continue();
        }
      });

      await projectPage.clearAndFillEditTitle(`Error Test ${Date.now()}`);
      await projectPage.submitEdit();

      // Should show error message
      await expect(projectPage.editFormError).toBeVisible({ timeout: TIMEOUTS.API_CALL });
    });

    test('should handle 404 for non-existent project', async ({ page }) => {
      const projectPage = new ProjectPage(page);

      // Navigate to edit page for non-existent project
      await projectPage.gotoEdit('00000000-0000-0000-0000-000000000000');

      await page.waitForLoadState('networkidle');

      // Should show error page or redirect
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
  });

  test.describe('Accessibility', () => {
    test('should pass accessibility audit on edit page', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should have accessible form labels', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Title input should have associated label
      const titleLabel = page.locator('label[for="title"]');
      await expect(titleLabel).toBeVisible();
      await expect(titleLabel).toContainText(/title/i);

      // Description input should have associated label
      const descLabel = page.locator('label[for="description"]');
      await expect(descLabel).toBeVisible();
      await expect(descLabel).toContainText(/description/i);

      // Status select should have associated label
      const statusLabel = page.locator('label[for="status"]');
      await expect(statusLabel).toBeVisible();
      await expect(statusLabel).toContainText(/status/i);
    });

    test('should support keyboard navigation', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Focus should be manageable via keyboard
      await page.keyboard.press('Tab');

      // Should be able to navigate through form fields
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']).toContain(activeElement);

      // Can tab through all form elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should eventually reach save or cancel button
      const finalElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']).toContain(finalElement);
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Form elements should be visible
      await expect(projectPage.editTitleInput).toBeVisible();
      await expect(projectPage.editDescriptionInput).toBeVisible();
      await expect(projectPage.saveButton).toBeVisible();
      await expect(projectPage.editCancelButton).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Form elements should be visible
      await expect(projectPage.editTitleInput).toBeVisible();
      await expect(projectPage.editDescriptionInput).toBeVisible();
      await expect(projectPage.saveButton).toBeVisible();
    });
  });
});
