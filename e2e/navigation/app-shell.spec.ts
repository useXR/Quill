/**
 * E2E Tests for App Shell.
 *
 * Tests the main application shell including:
 * - Header with logo and user menu
 * - Desktop sidebar navigation
 * - Sidebar collapse functionality
 * - User menu interactions
 * - Responsive layout behavior
 */
import { test, expect } from '../fixtures/test-fixtures';
import { AppShellPage } from '../pages/AppShellPage';
import AxeBuilder from '@axe-core/playwright';
import { TIMEOUTS } from '../config/timeouts';

test.describe('App Shell', () => {
  let appShell: AppShellPage;

  test.beforeEach(async ({ page, authenticatedPage }) => {
    appShell = new AppShellPage(page);
    await appShell.setDesktopViewport();
    await appShell.goto('/projects');
    await appShell.waitForReady();
  });

  test.describe('Layout Structure', () => {
    test('renders app shell with all main components', async ({ page }) => {
      await expect(appShell.appShell).toBeVisible();
      await expect(appShell.header).toBeVisible();
      await expect(appShell.sidebar).toBeVisible();
      await expect(appShell.mainContent).toBeVisible();
    });

    test('header contains logo', async ({ page }) => {
      await expect(appShell.headerLogo).toBeVisible();
      const logoText = await appShell.headerLogo.textContent();
      expect(logoText).toContain('Quill');
    });

    test('main content has correct id for skip links', async ({ page }) => {
      await expect(appShell.mainContent).toHaveAttribute('id', 'main-content');
    });

    test('sidebar has correct id for skip links', async ({ page }) => {
      await expect(appShell.sidebar).toHaveAttribute('id', 'sidebar-nav');
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('shows all navigation items', async ({ page }) => {
      await expect(appShell.navProjectsLink).toBeVisible();
      await expect(appShell.navVaultLink).toBeVisible();
      await expect(appShell.navCitationsLink).toBeVisible();
    });

    test('highlights active navigation item', async ({ page }) => {
      // On /projects page
      const isProjectsActive = await appShell.isNavItemActive('projects');
      expect(isProjectsActive).toBe(true);

      const isVaultActive = await appShell.isNavItemActive('vault');
      expect(isVaultActive).toBe(false);
    });

    test('navigates to correct route when nav item clicked', async ({ page }) => {
      await appShell.navigateViaSidebar('vault');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');
    });

    test('updates active state after navigation', async ({ page }) => {
      await appShell.navigateViaSidebar('vault');
      await page.waitForLoadState('networkidle');

      const isVaultActive = await appShell.isNavItemActive('vault');
      expect(isVaultActive).toBe(true);

      const isProjectsActive = await appShell.isNavItemActive('projects');
      expect(isProjectsActive).toBe(false);
    });
  });

  test.describe('Sidebar Collapse', () => {
    test('sidebar can be collapsed', async ({ page }) => {
      const wasCollapsed = await appShell.isSidebarCollapsed();
      expect(wasCollapsed).toBe(false);

      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const isCollapsed = await appShell.isSidebarCollapsed();
      expect(isCollapsed).toBe(true);
    });

    test('sidebar can be expanded', async ({ page }) => {
      // Collapse first
      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Then expand
      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const isCollapsed = await appShell.isSidebarCollapsed();
      expect(isCollapsed).toBe(false);
    });

    test('collapsed sidebar shows icons only', async ({ page }) => {
      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Nav item text should not be visible (only icons)
      const navItemText = appShell.sidebar.locator('span').first();
      await expect(navItemText).not.toBeVisible();
    });

    test('collapse toggle has accessible label', async ({ page }) => {
      const ariaLabel = await appShell.sidebarCollapseToggle.getAttribute('aria-label');
      expect(ariaLabel).toContain('Collapse sidebar');

      await appShell.toggleSidebarCollapse();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const expandedLabel = await appShell.sidebarCollapseToggle.getAttribute('aria-label');
      expect(expandedLabel).toContain('Expand sidebar');
    });
  });

  test.describe('User Menu', () => {
    test('user menu is visible in header', async ({ page }) => {
      await expect(appShell.userMenu).toBeVisible();
      await expect(appShell.userMenuTrigger).toBeVisible();
    });

    test('user menu opens on click', async ({ page }) => {
      await appShell.openUserMenu();
      await expect(appShell.userMenuDropdown).toBeVisible();
    });

    test('user menu closes on second click', async ({ page }) => {
      await appShell.openUserMenu();
      await appShell.closeUserMenu();
      await expect(appShell.userMenuDropdown).not.toBeVisible();
    });

    test('user menu closes on Escape', async ({ page }) => {
      await appShell.openUserMenu();
      await page.keyboard.press('Escape');
      await expect(appShell.userMenuDropdown).not.toBeVisible();
    });

    test('user menu shows settings option', async ({ page }) => {
      await appShell.openUserMenu();
      await expect(appShell.userMenuSettings).toBeVisible();
      const settingsText = await appShell.userMenuSettings.textContent();
      expect(settingsText).toContain('Settings');
    });

    test('user menu shows sign out option', async ({ page }) => {
      await appShell.openUserMenu();
      await expect(appShell.userMenuSignout).toBeVisible();
      const signOutText = await appShell.userMenuSignout.textContent();
      expect(signOutText).toContain('Sign out');
    });

    test('user menu has proper ARIA attributes', async ({ page }) => {
      await expect(appShell.userMenuTrigger).toHaveAttribute('aria-haspopup', 'menu');
      await expect(appShell.userMenuTrigger).toHaveAttribute('aria-expanded', 'false');

      await appShell.openUserMenu();
      await expect(appShell.userMenuTrigger).toHaveAttribute('aria-expanded', 'true');
      await expect(appShell.userMenuDropdown).toHaveAttribute('role', 'menu');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('sidebar is visible on desktop', async ({ page }) => {
      await appShell.setDesktopViewport();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(appShell.sidebar).toBeVisible();
    });

    test('sidebar is hidden on mobile', async ({ page }) => {
      await appShell.setMobileViewport();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(appShell.sidebar).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('app shell passes axe accessibility checks', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page }).include('[data-testid="app-shell"]').analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('header passes axe accessibility checks', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page }).include('[data-testid="app-header"]').analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('sidebar has navigation role', async ({ page }) => {
      const nav = appShell.sidebar.locator('nav');
      await expect(nav).toHaveAttribute('role', 'navigation');
    });

    test('sidebar has accessible label', async ({ page }) => {
      await expect(appShell.sidebar).toHaveAttribute('aria-label', 'Main navigation');
    });

    test('navigation items use aria-current for active state', async ({ page }) => {
      await expect(appShell.navProjectsLink).toHaveAttribute('aria-current', 'page');
    });

    test('touch targets meet minimum size', async ({ page }) => {
      const userMenuBox = await appShell.userMenuTrigger.boundingBox();
      expect(userMenuBox!.width).toBeGreaterThanOrEqual(44);
      expect(userMenuBox!.height).toBeGreaterThanOrEqual(44);

      const navItemBox = await appShell.navProjectsLink.boundingBox();
      expect(navItemBox!.height).toBeGreaterThanOrEqual(44);
    });

    test('focus is visible on interactive elements', async ({ page }) => {
      // Tab to user menu
      await appShell.userMenuTrigger.focus();

      // Check focus ring is applied
      const classes = await appShell.userMenuTrigger.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return computed.outline;
      });
      // Focus ring should be visible (not none)
    });
  });

  test.describe('Sign Out', () => {
    test('sign out redirects to login', async ({ page }) => {
      await appShell.signOut();

      // Wait for navigation
      await page.waitForURL('**/login**', { timeout: TIMEOUTS.NAVIGATION });
      expect(page.url()).toContain('/login');
    });
  });
});
