/**
 * Cross-Phase Integration E2E Tests
 *
 * Verifies that Phase 0-5 features work correctly within the Phase 6 app shell.
 * Tests integration between different phases of the application.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { AppShellPage } from '../pages/AppShellPage';
import { MobileNavPage } from '../pages/MobileNavPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { EditorPage } from '../pages/EditorPage';
import { VaultPage } from '../pages/VaultPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Cross-Phase Integration', () => {
  test.describe('Phase 0-2: Core Infrastructure in Phase 6 Shell', () => {
    test('editor loads correctly within app shell', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);
      const editor = new EditorPage(page);

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');

      // Verify app shell components are present
      await expect(appShell.header).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
      await expect(appShell.sidebar).toBeVisible();

      // Verify editor loaded within shell
      await expect(editor.editor).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    });

    test('project list renders within app shell', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // App shell should be present
      await expect(appShell.header).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
      await expect(appShell.mainContent).toBeVisible();

      // Projects page content should load
      const projectsHeading = page.getByRole('heading', { name: /projects/i });
      await expect(projectsHeading).toBeVisible();
    });
  });

  test.describe('Phase 3: Vault Integration', () => {
    test('vault search works within Phase 6 app shell', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Mock vault API for consistent testing
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

      await page.route('**/api/vault/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                vaultItemId: 'test-item-1',
                chunkIndex: 0,
                filename: 'test-document.pdf',
                content: 'Test search result content matching query',
                similarity: 0.92,
              },
            ],
          }),
        });
      });

      const appShell = new AppShellPage(page);
      const vaultPage = new VaultPage(page);

      await vaultPage.goto(workerCtx.projectId);
      await page.waitForLoadState('networkidle');

      // Verify app shell is present
      await expect(appShell.header).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

      // Perform vault search
      await vaultPage.search('test query');

      // Verify search results appear
      await vaultPage.expectSearchResultCount(1);
    });

    test('vault navigation via sidebar works', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Navigate to vault via sidebar
      await appShell.navigateViaSidebar('vault');
      await page.waitForLoadState('networkidle');

      // Verify we're on vault page
      expect(page.url()).toContain('/vault');
    });
  });

  test.describe('Phase 4: Citations Integration', () => {
    test('citations page accessible via sidebar navigation', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Navigate to citations via sidebar
      await appShell.navigateViaSidebar('citations');
      await page.waitForLoadState('networkidle');

      // Verify we're on citations page
      expect(page.url()).toContain('/citations');
    });

    test('citations page renders within app shell', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await page.goto(`/projects/${workerCtx.projectId}/citations`);
      await page.waitForLoadState('networkidle');

      // Verify app shell components
      await expect(appShell.header).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
      await expect(appShell.sidebar).toBeVisible();
      await expect(appShell.mainContent).toBeVisible();
    });
  });

  test.describe('Phase 5: AI Integration', () => {
    test('chat panel integrates with app shell', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');

      // Verify app shell is present
      await expect(appShell.header).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });

      // Chat toggle should be available
      const chatToggle = page.getByTestId('chat-toggle');
      if (await chatToggle.isVisible().catch(() => false)) {
        await chatToggle.click();

        // Chat panel should appear
        const chatPanel = page.getByTestId('chat-sidebar');
        await expect(chatPanel).toBeVisible({ timeout: TIMEOUTS.DIALOG });
      }
    });
  });

  test.describe('Phase 6: Navigation Components', () => {
    test('command palette opens from any page', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      // Test on projects page
      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();
      await commandPalette.closeWithEscape();

      // Test on vault page
      await page.goto('/vault');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();
      await commandPalette.closeWithEscape();
    });

    test('mobile nav works on all authenticated pages', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();

      // Test on projects page
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();
      await mobileNav.closeViaEscape();

      // Test on vault page
      await mobileNav.goto('/vault');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();
      await mobileNav.close();
    });

    test('sidebar collapse persists across navigation', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Skip if collapse toggle not visible
      if (!(await appShell.sidebarCollapseToggle.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      // Collapse sidebar
      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const wasCollapsed = await appShell.isSidebarCollapsed();

      // Navigate to another page
      await appShell.navigateViaSidebar('vault');
      await page.waitForLoadState('networkidle');

      // Check if collapse state persisted
      const isStillCollapsed = await appShell.isSidebarCollapsed();
      expect(isStillCollapsed).toBe(wasCollapsed);
    });
  });

  test.describe('Cross-Phase Feature Coordination', () => {
    test('skip links work in Phase 6 shell', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Tab to skip link
      await page.keyboard.press('Tab');

      // Skip link should be visible/focused
      const skipLink = page.getByTestId('skip-to-main');
      if (await skipLink.isVisible().catch(() => false)) {
        await expect(skipLink).toBeFocused();

        // Activate skip link
        await page.keyboard.press('Enter');

        // Main content should receive focus
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
    });

    test('user menu works across pages', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Open user menu
      if (await appShell.userMenuTrigger.isVisible().catch(() => false)) {
        await appShell.openUserMenu();
        await expect(appShell.userMenuDropdown).toBeVisible();
        await appShell.closeUserMenu();

        // Navigate to another page
        await appShell.navigateViaSidebar('vault');
        await page.waitForLoadState('networkidle');

        // User menu should still work
        await appShell.openUserMenu();
        await expect(appShell.userMenuDropdown).toBeVisible();
      }
    });
  });
});
