/**
 * E2E Tests for Mobile Navigation.
 *
 * Tests mobile navigation drawer behavior including:
 * - Opening/closing via button, backdrop, and Escape key
 * - Focus management
 * - Navigation functionality
 * - Responsive behavior
 */
import { test, expect } from '../fixtures/test-fixtures';
import { MobileNavPage } from '../pages/MobileNavPage';
import { AppShellPage } from '../pages/AppShellPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Mobile Navigation', () => {
  let mobileNav: MobileNavPage;
  let appShell: AppShellPage;

  test.beforeEach(async ({ page, authenticatedPage }) => {
    mobileNav = new MobileNavPage(page);
    appShell = new AppShellPage(page);

    // Set mobile viewport
    await mobileNav.setMobileViewport();
    await mobileNav.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Responsive Behavior', () => {
    test('hamburger menu button is visible on mobile', async ({ page }) => {
      await expect(mobileNav.menuButton).toBeVisible();
    });

    test('hamburger menu button is hidden on desktop', async ({ page }) => {
      await mobileNav.setDesktopViewport();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(mobileNav.menuButton).not.toBeVisible();
    });

    test('sidebar is visible on desktop', async ({ page }) => {
      await mobileNav.setDesktopViewport();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(appShell.sidebar).toBeVisible();
    });

    test('sidebar is hidden on mobile', async ({ page }) => {
      await expect(appShell.sidebar).not.toBeVisible();
    });
  });

  test.describe('Opening and Closing', () => {
    test('opens mobile nav when hamburger menu is clicked', async ({ page }) => {
      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();
      await expect(mobileNav.drawer).toBeVisible();
    });

    test('closes mobile nav when close button is clicked', async ({ page }) => {
      await mobileNav.open();
      await mobileNav.close();
      await expect(mobileNav.mobileNav).not.toBeVisible();
    });

    test('closes mobile nav when backdrop is clicked', async ({ page }) => {
      await mobileNav.open();
      await mobileNav.closeViaBackdrop();
      await expect(mobileNav.mobileNav).not.toBeVisible();
    });

    test('closes mobile nav when Escape key is pressed', async ({ page }) => {
      await mobileNav.open();
      await mobileNav.closeViaEscape();
      await expect(mobileNav.mobileNav).not.toBeVisible();
    });
  });

  test.describe('Focus Management', () => {
    test('focuses close button when mobile nav opens', async ({ page }) => {
      await mobileNav.open();
      // Small delay for animation and focus transfer
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await expect(mobileNav.closeButton).toBeFocused();
    });

    test('returns focus to menu button after closing', async ({ page }) => {
      // Focus the menu button first
      await mobileNav.menuButton.focus();
      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await mobileNav.closeViaEscape();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      // Focus should return to menu button
      await expect(mobileNav.menuButton).toBeFocused();
    });

    test('traps focus within mobile nav', async ({ page }) => {
      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Tab through elements - should stay within drawer
      // First element should be logo link, then close button, then nav items
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // After several tabs, we should still be within the mobile nav
      const activeElement = await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="mobile-nav-drawer"]');
        return drawer?.contains(document.activeElement) ?? false;
      });
      expect(activeElement).toBe(true);
    });
  });

  test.describe('Navigation', () => {
    test('shows all navigation items', async ({ page }) => {
      await mobileNav.open();

      await expect(mobileNav.projectsLink).toBeVisible();
      await expect(mobileNav.vaultLink).toBeVisible();
      await expect(mobileNav.citationsLink).toBeVisible();
    });

    test('highlights current page in navigation', async ({ page }) => {
      await mobileNav.open();

      // On /projects page, projects link should be active
      const isActive = await mobileNav.isNavItemActive('projects');
      expect(isActive).toBe(true);
    });

    test('closes mobile nav when navigating', async ({ page }) => {
      await mobileNav.open();
      await mobileNav.navigateTo('vault');

      // Navigation should close the mobile nav
      await expect(mobileNav.mobileNav).not.toBeVisible({ timeout: TIMEOUTS.NAVIGATION });
    });

    test('navigates to correct route when link clicked', async ({ page }) => {
      await mobileNav.open();
      await mobileNav.navigateTo('vault');

      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');
    });
  });

  test.describe('Accessibility', () => {
    test('mobile nav has dialog role', async ({ page }) => {
      await mobileNav.open();

      await expect(mobileNav.mobileNav).toHaveAttribute('role', 'dialog');
    });

    test('mobile nav has aria-modal attribute', async ({ page }) => {
      await mobileNav.open();

      await expect(mobileNav.mobileNav).toHaveAttribute('aria-modal', 'true');
    });

    test('mobile nav has accessible label', async ({ page }) => {
      await mobileNav.open();

      await expect(mobileNav.mobileNav).toHaveAttribute('aria-label', 'Navigation menu');
    });

    test('close button has accessible label', async ({ page }) => {
      await mobileNav.open();

      await expect(mobileNav.closeButton).toHaveAttribute('aria-label', 'Close navigation menu');
    });

    test('nav items have aria-current for active route', async ({ page }) => {
      await mobileNav.open();

      await expect(mobileNav.projectsLink).toHaveAttribute('aria-current', 'page');
      expect(await mobileNav.vaultLink.getAttribute('aria-current')).toBeNull();
    });

    test('touch targets meet minimum size requirements', async ({ page }) => {
      await mobileNav.open();

      // Check close button size
      const closeButtonBox = await mobileNav.closeButton.boundingBox();
      expect(closeButtonBox!.width).toBeGreaterThanOrEqual(44);
      expect(closeButtonBox!.height).toBeGreaterThanOrEqual(44);

      // Check nav item sizes
      const projectsBox = await mobileNav.projectsLink.boundingBox();
      expect(projectsBox!.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Body Scroll Lock', () => {
    test('prevents body scroll when mobile nav is open', async ({ page }) => {
      await mobileNav.open();

      const bodyOverflow = await page.evaluate(() => {
        return document.body.style.overflow;
      });
      expect(bodyOverflow).toBe('hidden');
    });

    test('restores body scroll when mobile nav closes', async ({ page }) => {
      await mobileNav.open();
      await mobileNav.close();

      const bodyOverflow = await page.evaluate(() => {
        return document.body.style.overflow;
      });
      expect(bodyOverflow).not.toBe('hidden');
    });
  });
});
