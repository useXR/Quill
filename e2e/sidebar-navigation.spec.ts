/**
 * E2E Tests for Unified Sidebar Navigation.
 *
 * Tests the unified sidebar's context-aware behavior:
 * - App-level navigation (Projects, Vault, Citations) when on projects list
 * - Project-level navigation when inside a project
 * - Transitions between app and project navigation modes
 *
 * Uses the Phase 0 E2E infrastructure with authenticated storage state.
 */
import { test, expect } from './fixtures/test-fixtures';
import { AppShellPage } from './pages/AppShellPage';
import { TIMEOUTS, VISIBILITY_WAIT, NAVIGATION_WAIT } from './config/timeouts';

// Test data stored per-worker to avoid race conditions
const testData: {
  projectId?: string;
  projectTitle?: string;
  secondProjectId?: string;
  secondProjectTitle?: string;
  documentId?: string;
  documentTitle?: string;
} = {};

// Helper to create a test project via API
async function createTestProject(
  page: import('@playwright/test').Page,
  title: string
): Promise<{ id: string; title: string }> {
  const response = await page.request.post('/api/projects', {
    data: {
      title,
      description: 'Test project for unified sidebar E2E tests',
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()}`);
  }
  const project = await response.json();
  return { id: project.id, title: project.title };
}

// Helper to create a test document via API
async function createTestDocument(
  page: import('@playwright/test').Page,
  projectId: string,
  title: string
): Promise<{ id: string; title: string }> {
  const response = await page.request.post('/api/documents', {
    data: {
      project_id: projectId,
      title,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create document: ${response.status()}`);
  }
  const document = await response.json();
  return { id: document.id, title: document.title };
}

// Helper to delete a test project via API
async function deleteTestProject(page: import('@playwright/test').Page, projectId: string): Promise<void> {
  try {
    await page.request.delete(`/api/projects/${projectId}`);
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Unified Sidebar Navigation', () => {
  let appShell: AppShellPage;

  // Create test projects and document for each worker
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    // Create first test project
    const project1 = await createTestProject(page, `E2E Sidebar Test ${Date.now()}`);
    testData.projectId = project1.id;
    testData.projectTitle = project1.title;

    // Create second test project for navigation testing
    const project2 = await createTestProject(page, `E2E Sidebar Test 2 ${Date.now()}`);
    testData.secondProjectId = project2.id;
    testData.secondProjectTitle = project2.title;

    // Create a document in the first project
    const doc = await createTestDocument(page, project1.id, `Test Document ${Date.now()}`);
    testData.documentId = doc.id;
    testData.documentTitle = doc.title;

    await context.close();
  });

  // Cleanup test projects after all tests
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    if (testData.projectId) {
      await deleteTestProject(page, testData.projectId);
    }
    if (testData.secondProjectId) {
      await deleteTestProject(page, testData.secondProjectId);
    }

    await context.close();
  });

  test.beforeEach(async ({ page, authenticatedPage }) => {
    appShell = new AppShellPage(page);
    await appShell.setDesktopViewport();
  });

  test.describe('App-Level Navigation', () => {
    test('shows app-level navigation on projects list', async ({ page }) => {
      await appShell.goto('/projects');
      await appShell.waitForReady();

      await expect(appShell.sidebar).toHaveAttribute('aria-label', 'Main navigation');
      await expect(appShell.navProjectsLink).toBeVisible(VISIBILITY_WAIT);
      await expect(appShell.navVaultLink).toBeVisible(VISIBILITY_WAIT);
      await expect(appShell.navCitationsLink).toBeVisible(VISIBILITY_WAIT);
    });

    test('shows app-level navigation on global vault page', async ({ page }) => {
      await appShell.goto('/vault');
      await appShell.waitForReady();

      await expect(appShell.sidebar).toHaveAttribute('aria-label', 'Main navigation');
      await expect(appShell.navProjectsLink).toBeVisible(VISIBILITY_WAIT);
      await expect(appShell.navVaultLink).toBeVisible(VISIBILITY_WAIT);
      await expect(appShell.navCitationsLink).toBeVisible(VISIBILITY_WAIT);
    });

    test('shows app-level navigation on global citations page', async ({ page }) => {
      await appShell.goto('/citations');
      await appShell.waitForReady();

      await expect(appShell.sidebar).toHaveAttribute('aria-label', 'Main navigation');
      await expect(appShell.navCitationsLink).toBeVisible(VISIBILITY_WAIT);
    });

    test('highlights active navigation item on projects page', async ({ page }) => {
      await appShell.goto('/projects');
      await appShell.waitForReady();

      const isProjectsActive = await appShell.isNavItemActive('projects');
      expect(isProjectsActive).toBe(true);

      const isVaultActive = await appShell.isNavItemActive('vault');
      expect(isVaultActive).toBe(false);
    });

    test('navigates between app-level sections', async ({ page }) => {
      await appShell.goto('/projects');
      await appShell.waitForReady();

      // Navigate to vault
      await appShell.navigateViaSidebar('vault');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');

      // Navigate to citations
      await appShell.navigateViaSidebar('citations');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/citations');

      // Navigate back to projects
      await appShell.navigateViaSidebar('projects');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/projects');
    });
  });

  test.describe('Project-Level Navigation', () => {
    test('shows project navigation when inside a project', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Verify project-level navigation elements
      await expect(page.getByTestId('nav-back-to-projects')).toBeVisible(VISIBILITY_WAIT);
      await expect(page.getByTestId('nav-item-documents')).toBeVisible(VISIBILITY_WAIT);
      await expect(page.getByTestId('nav-item-project-vault')).toBeVisible(VISIBILITY_WAIT);
      await expect(page.getByTestId('nav-item-project-citations')).toBeVisible(VISIBILITY_WAIT);
    });

    test('displays project title in sidebar', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      const projectTitle = page.getByTestId('project-title');
      await expect(projectTitle).toBeVisible(VISIBILITY_WAIT);
      await expect(projectTitle).toContainText(testData.projectTitle || '');
    });

    test('updates aria-label for project navigation', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Sidebar should have project-specific aria-label
      await expect(appShell.sidebar).toHaveAttribute('aria-label', new RegExp(`Project:.*navigation`, 'i'));
    });

    test('navigates to project vault via sidebar', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      await page.getByTestId('nav-item-project-vault').click();
      await page.waitForURL(`**/projects/${testData.projectId}/vault`, NAVIGATION_WAIT);

      expect(page.url()).toContain(`/projects/${testData.projectId}/vault`);
    });

    test('navigates to project citations via sidebar', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      await page.getByTestId('nav-item-project-citations').click();
      await page.waitForURL(`**/projects/${testData.projectId}/citations`, NAVIGATION_WAIT);

      expect(page.url()).toContain(`/projects/${testData.projectId}/citations`);
    });

    test('back link returns to projects list', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      await page.getByTestId('nav-back-to-projects').click();
      await page.waitForURL('**/projects', NAVIGATION_WAIT);

      // Should be on projects list (not inside a project)
      expect(page.url()).toMatch(/\/projects$/);
    });
  });

  test.describe('Sidebar Context Transitions', () => {
    test('transitions from app-level to project-level navigation', async ({ page }) => {
      // Start at projects list (app-level)
      await appShell.goto('/projects');
      await appShell.waitForReady();

      // Verify app-level navigation
      await expect(appShell.sidebar).toHaveAttribute('aria-label', 'Main navigation');

      // Click on a project to enter it
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Verify transitioned to project-level navigation
      await expect(page.getByTestId('nav-back-to-projects')).toBeVisible(VISIBILITY_WAIT);
      await expect(page.getByTestId('project-title')).toBeVisible(VISIBILITY_WAIT);
    });

    test('transitions from project-level back to app-level navigation', async ({ page }) => {
      // Start inside a project (project-level)
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Verify project-level navigation
      await expect(page.getByTestId('nav-back-to-projects')).toBeVisible(VISIBILITY_WAIT);

      // Navigate back to projects list
      await page.getByTestId('nav-back-to-projects').click();
      await page.waitForURL('**/projects', NAVIGATION_WAIT);

      // Verify transitioned back to app-level navigation
      await expect(appShell.sidebar).toHaveAttribute('aria-label', 'Main navigation');
      await expect(appShell.navProjectsLink).toBeVisible(VISIBILITY_WAIT);
    });

    test('navigating between projects updates sidebar', async ({ page }) => {
      // Navigate to first project
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Verify first project title in sidebar
      const projectTitle = page.getByTestId('project-title');
      await expect(projectTitle).toContainText(testData.projectTitle || '');

      // Navigate back to projects list
      await page.getByTestId('nav-back-to-projects').click();
      await page.waitForURL('**/projects', NAVIGATION_WAIT);

      // Navigate to second project
      await page.goto(`/projects/${testData.secondProjectId}`);
      await appShell.waitForReady();

      // Verify second project title in sidebar
      await expect(projectTitle).toContainText(testData.secondProjectTitle || '');
    });
  });

  test.describe('Document Navigation', () => {
    test('sidebar stays in project view when navigating to document', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Get project title for later comparison
      const projectTitle = page.getByTestId('project-title');
      const initialTitle = await projectTitle.textContent();

      // Navigate to document via URL
      await page.goto(`/projects/${testData.projectId}/documents/${testData.documentId}`);
      await appShell.waitForReady();

      // Sidebar should still show project navigation
      await expect(page.getByTestId('nav-back-to-projects')).toBeVisible(VISIBILITY_WAIT);
      await expect(projectTitle).toContainText(initialTitle || '');
    });

    test('document list shows documents in sidebar', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Document list should be visible with our test document
      const documentList = page.getByTestId('document-list');
      await expect(documentList).toBeVisible(VISIBILITY_WAIT);
      await expect(documentList.getByRole('link')).toHaveCount(1);
    });

    test('clicking document in sidebar navigates to document', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Click the document in the document list
      const documentList = page.getByTestId('document-list');
      const docLink = documentList.getByRole('link').first();
      await docLink.click();

      await page.waitForURL(`**/documents/${testData.documentId}`, NAVIGATION_WAIT);

      // Should be on document page
      expect(page.url()).toContain(`/documents/${testData.documentId}`);
    });
  });

  test.describe('Sidebar Collapse Behavior', () => {
    test('sidebar collapse persists in project navigation', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Collapse the sidebar
      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const isCollapsed = await appShell.isSidebarCollapsed();
      expect(isCollapsed).toBe(true);

      // Project navigation elements should still be accessible (via icons/tooltips)
      await expect(page.getByTestId('nav-back-to-projects')).toBeVisible(VISIBILITY_WAIT);
    });

    test('collapsed sidebar shows tooltips for navigation items', async ({ page }) => {
      await page.goto(`/projects/${testData.projectId}`);
      await appShell.waitForReady();

      // Collapse the sidebar
      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Check that collapsed items have title attributes for tooltips
      const vaultLink = page.getByTestId('nav-item-project-vault');
      await expect(vaultLink).toHaveAttribute('title', 'Vault');
    });
  });
});
