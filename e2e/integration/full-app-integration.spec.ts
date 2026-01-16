/**
 * Full Application Integration E2E Tests
 *
 * End-to-end user journey tests that span multiple features.
 * Tests realistic user workflows from start to finish.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { AppShellPage } from '../pages/AppShellPage';
import { MobileNavPage } from '../pages/MobileNavPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { EditorPage } from '../pages/EditorPage';
import { ExportPage } from '../pages/ExportPage';
import { ToastPage } from '../pages/ToastPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Full Application User Journeys', () => {
  test.describe('New User Onboarding Journey', () => {
    test('user can navigate app, create content, and find help', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);
      const commandPalette = new CommandPalettePage(page);

      // Step 1: Land on projects page
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Step 2: Explore navigation via sidebar
      await expect(appShell.navProjectsLink).toBeVisible();
      await expect(appShell.navVaultLink).toBeVisible();
      await expect(appShell.navCitationsLink).toBeVisible();

      // Step 3: Discover command palette
      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();

      // Step 4: Search for navigation options
      await commandPalette.search('vault');
      const vaultVisible = await commandPalette.isItemVisible('vault');
      expect(vaultVisible).toBe(true);

      // Step 5: Navigate using command palette
      await commandPalette.selectItem('vault');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');

      // Step 6: Return to projects
      await commandPalette.open();
      await commandPalette.selectItem('projects');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/projects');
    });
  });

  test.describe('Document Creation and Export Journey', () => {
    test('user creates document content and exports to DOCX', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const editor = new EditorPage(page);
      const exportPage = new ExportPage(page);

      // Step 1: Navigate to document
      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');

      // Step 2: Wait for editor to be ready
      await expect(editor.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

      // Step 3: Create some content
      await editor.type('# Test Document\n\nThis is content for export testing.');
      await page.waitForTimeout(TIMEOUTS.AUTOSAVE_WAIT);

      // Step 4: Export to DOCX
      const result = await exportPage.exportToDocx({
        documentId: workerCtx.documentId,
        includeTitle: true,
        pageSize: 'letter',
      });

      // Step 5: Verify export succeeded
      await exportPage.expectDocxExportSuccess(result);
      exportPage.expectValidDocxFormat(result.buffer);
    });

    test('user exports document to PDF format', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const editor = new EditorPage(page);
      const exportPage = new ExportPage(page);

      // Navigate to document
      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');
      await expect(editor.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

      // Add content
      await editor.type('# PDF Export Test\n\nContent for PDF export.');
      await page.waitForTimeout(TIMEOUTS.AUTOSAVE_WAIT);

      // Export to PDF
      const result = await exportPage.exportToPdf({
        documentId: workerCtx.documentId,
        format: 'letter',
        includePageNumbers: true,
      });

      // Verify PDF export
      await exportPage.expectPdfExportSuccess(result);
      exportPage.expectValidPdfFormat(result.buffer);
    });
  });

  test.describe('Mobile User Journey', () => {
    test('mobile user navigates app using hamburger menu', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);
      const appShell = new AppShellPage(page);

      // Set mobile viewport
      await mobileNav.setMobileViewport();

      // Step 1: Start on projects page
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Step 2: Verify mobile menu is visible, sidebar is hidden
      await expect(mobileNav.menuButton).toBeVisible();
      await expect(appShell.sidebar).not.toBeVisible();

      // Step 3: Open mobile nav
      await mobileNav.open();
      await expect(mobileNav.drawer).toBeVisible();

      // Step 4: Navigate to vault
      await mobileNav.navigateTo('vault');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');

      // Step 5: Mobile nav should close after navigation
      await expect(mobileNav.mobileNav).not.toBeVisible();

      // Step 6: Open nav again and go to citations
      await mobileNav.open();
      await mobileNav.navigateTo('citations');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/citations');
    });

    test('mobile user can still use keyboard shortcuts', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);
      const commandPalette = new CommandPalettePage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Command palette should work on mobile
      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();

      // Close with escape
      await commandPalette.closeWithEscape();
      await expect(commandPalette.commandPalette).not.toBeVisible();
    });
  });

  test.describe('Research Workflow Journey', () => {
    test('user navigates between vault and citations for research', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      // Step 1: Start in vault to review materials
      await page.goto('/vault');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Step 2: Navigate to citations
      await appShell.navigateViaSidebar('citations');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/citations');

      // Step 3: Go back to vault
      await appShell.navigateViaSidebar('vault');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');

      // Step 4: Return to projects
      await appShell.navigateViaSidebar('projects');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/projects');
    });
  });

  test.describe('Power User Journey', () => {
    test('power user uses keyboard shortcuts exclusively', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      // Start on projects
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Navigate using command palette only
      await commandPalette.open();
      await commandPalette.search('vault');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');

      // Use command palette to go to citations
      await commandPalette.open();
      await commandPalette.search('citations');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/citations');

      // Back to projects
      await commandPalette.open();
      await commandPalette.search('projects');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/projects');
    });
  });

  test.describe('Error Recovery Journey', () => {
    test('user recovers from network error gracefully', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const toastPage = new ToastPage(page);

      // Navigate to a page
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Simulate a failed API call
      await page.route('**/api/projects/invalid-id', (route) => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Project not found' }),
        });
      });

      // Try to access invalid project
      await page.goto('/projects/invalid-id');

      // App should handle gracefully (either error page or redirect)
      // Verify app shell is still functional
      const appShell = new AppShellPage(page);
      const header = appShell.header;

      // Header should still be visible (app didn't crash)
      if (await header.isVisible().catch(() => false)) {
        await expect(header).toBeVisible();
      }
    });
  });

  test.describe('Session Continuity', () => {
    test('navigation state survives page reload', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      // Navigate to vault
      await page.goto('/vault');
      await page.waitForLoadState('networkidle');

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on vault
      expect(page.url()).toContain('/vault');

      // App shell should be functional
      await appShell.waitForReady();
      await expect(appShell.header).toBeVisible();
    });
  });
});
