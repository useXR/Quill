/**
 * Authenticated Pages Accessibility Audit
 *
 * Tests WCAG 2.1 AA compliance for authenticated pages.
 * Uses axe-core for comprehensive accessibility testing.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { checkA11y } from '../helpers/axe';
import { AppShellPage } from '../pages/AppShellPage';
import { MobileNavPage } from '../pages/MobileNavPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Authenticated Pages Accessibility', () => {
  test.describe('App Shell Accessibility', () => {
    test('app shell passes accessibility audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      await checkA11y(page, { detailedReport: true });
    });

    test('app shell has proper landmark structure', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Should have header
      const header = page.locator('header, [role="banner"]');
      await expect(header).toBeVisible();

      // Should have main content area
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible();

      // Should have navigation
      const nav = page.locator('nav, [role="navigation"]');
      const navCount = await nav.count();
      expect(navCount).toBeGreaterThanOrEqual(1);
    });

    test('sidebar navigation is accessible', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      // Sidebar should have navigation role or be within nav element
      if (await appShell.sidebar.isVisible().catch(() => false)) {
        const sidebarNav = appShell.sidebar.locator('nav, [role="navigation"]');
        const hasNav = (await sidebarNav.count()) > 0;
        expect(hasNav || (await appShell.sidebar.getAttribute('role')) === 'navigation').toBe(true);
      }
    });
  });

  test.describe('Projects Page Accessibility', () => {
    test('projects page passes accessibility audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      await checkA11y(page, { detailedReport: true });
    });

    test('projects page has proper heading hierarchy', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Should have h1
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();

      // Count heading levels
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1); // Should only have one h1
    });
  });

  test.describe('Vault Page Accessibility', () => {
    test('vault page passes accessibility audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      // Mock empty vault for consistent testing
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

      await page.goto('/vault');
      await page.waitForLoadState('networkidle');

      await checkA11y(page, { detailedReport: true });
    });
  });

  test.describe('Citations Page Accessibility', () => {
    test('citations page passes accessibility audit', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/citations`);
      await page.waitForLoadState('networkidle');

      await checkA11y(page, { detailedReport: true });
    });
  });

  test.describe('Editor Page Accessibility', () => {
    test('editor page passes accessibility audit', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');

      await checkA11y(page, { detailedReport: true });
    });

    test('editor is keyboard accessible', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');

      // Tab to editor
      const editor = page.locator('[role="textbox"], .ProseMirror');
      if (await editor.isVisible().catch(() => false)) {
        await editor.focus();
        await expect(editor).toBeFocused();
      }
    });
  });

  test.describe('Command Palette Accessibility', () => {
    test('command palette passes accessibility audit when open', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Open command palette
      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();

      // Run a11y audit with command palette open
      await checkA11y(page, { detailedReport: true });
    });

    test('command palette has proper dialog role', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();

      // Should have dialog or combobox role
      const role = await commandPalette.commandPalette.getAttribute('role');
      expect(['dialog', 'combobox', 'listbox'].includes(role || '')).toBe(true);
    });

    test('command palette input has accessible label', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();

      // Input should have label
      const input = commandPalette.input;
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      const labelledBy = await input.getAttribute('aria-labelledby');

      expect(ariaLabel || placeholder || labelledBy).toBeTruthy();
    });

    test('command palette supports keyboard navigation', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();
      await expect(commandPalette.input).toBeFocused();

      // Arrow down should move through items
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');

      // Escape should close
      await page.keyboard.press('Escape');
      await expect(commandPalette.commandPalette).not.toBeVisible();
    });
  });

  test.describe('Mobile Navigation Accessibility', () => {
    test('mobile nav passes accessibility audit when open', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Open mobile nav
      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();

      // Run a11y audit
      await checkA11y(page, { detailedReport: true });
    });

    test('mobile nav has proper dialog attributes', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      // Should have dialog role
      await expect(mobileNav.mobileNav).toHaveAttribute('role', 'dialog');

      // Should have aria-modal
      await expect(mobileNav.mobileNav).toHaveAttribute('aria-modal', 'true');

      // Should have aria-label
      const ariaLabel = await mobileNav.mobileNav.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('mobile nav close button is accessible', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      // Close button should have aria-label
      await expect(mobileNav.closeButton).toHaveAttribute('aria-label');

      // Close button should be focusable
      await mobileNav.closeButton.focus();
      await expect(mobileNav.closeButton).toBeFocused();
    });
  });

  test.describe('User Menu Accessibility', () => {
    test('user menu passes accessibility audit when open', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      if (await appShell.userMenuTrigger.isVisible().catch(() => false)) {
        await appShell.openUserMenu();
        await checkA11y(page, { detailedReport: true });
      }
    });

    test('user menu trigger has proper attributes', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      if (await appShell.userMenuTrigger.isVisible().catch(() => false)) {
        // Should have aria-expanded
        const ariaExpanded = await appShell.userMenuTrigger.getAttribute('aria-expanded');
        expect(ariaExpanded).toBe('false');

        await appShell.openUserMenu();

        const ariaExpandedAfter = await appShell.userMenuTrigger.getAttribute('aria-expanded');
        expect(ariaExpandedAfter).toBe('true');
      }
    });
  });

  test.describe('Focus Management', () => {
    test('focus is trapped in modal dialogs', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Tab multiple times - should stay within mobile nav
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }

      // Focus should still be within mobile nav
      const focusInNav = await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="mobile-nav-drawer"]');
        return drawer?.contains(document.activeElement) ?? false;
      });

      expect(focusInNav).toBe(true);
    });

    test('focus returns to trigger after closing modal', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Focus menu button
      await mobileNav.menuButton.focus();

      // Open and close
      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await mobileNav.closeViaEscape();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Focus should return to menu button
      await expect(mobileNav.menuButton).toBeFocused();
    });
  });
});
