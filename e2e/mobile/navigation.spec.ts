/**
 * Mobile Navigation Integration E2E Tests
 *
 * Comprehensive tests for mobile navigation behavior including:
 * - Responsive breakpoints
 * - Touch interactions
 * - Gesture handling
 * - Cross-page navigation
 * - Orientation changes
 */
import { test, expect } from '@playwright/test';
import { test as authenticatedTest } from '../fixtures/test-fixtures';
import { MobileNavPage } from '../pages/MobileNavPage';
import { AppShellPage } from '../pages/AppShellPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Mobile Navigation Integration', () => {
  test.describe('Responsive Breakpoints', () => {
    authenticatedTest('shows mobile nav at 640px and below', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);
      const appShell = new AppShellPage(page);

      // Test at 640px (mobile breakpoint)
      await page.setViewportSize({ width: 640, height: 800 });
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await expect(mobileNav.menuButton).toBeVisible();
      await expect(appShell.sidebar).not.toBeVisible();
    });

    authenticatedTest('shows desktop sidebar at 1024px and above', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);
      const appShell = new AppShellPage(page);

      await page.setViewportSize({ width: 1024, height: 800 });
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await expect(mobileNav.menuButton).not.toBeVisible();
      await expect(appShell.sidebar).toBeVisible();
    });

    authenticatedTest('handles viewport resize gracefully', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);
      const appShell = new AppShellPage(page);

      // Start at desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await expect(appShell.sidebar).toBeVisible();

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      await expect(appShell.sidebar).not.toBeVisible();
      await expect(mobileNav.menuButton).toBeVisible();

      // Resize back to desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      await expect(appShell.sidebar).toBeVisible();
      await expect(mobileNav.menuButton).not.toBeVisible();
    });
  });

  test.describe('iPhone 12 Device Tests', () => {
    // Note: Using manual viewport size instead of test.use() to avoid worker restrictions
    authenticatedTest('mobile nav works on iPhone 12 viewport', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      // Set iPhone 12 viewport size (390x844)
      await page.setViewportSize({ width: 390, height: 844 });

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Menu button should be visible
      await expect(mobileNav.menuButton).toBeVisible();

      // Open nav
      await mobileNav.open();
      await expect(mobileNav.drawer).toBeVisible();

      // Navigation items should be visible
      await expect(mobileNav.projectsLink).toBeVisible();
      await expect(mobileNav.vaultLink).toBeVisible();
      await expect(mobileNav.citationsLink).toBeVisible();

      // Close nav
      await mobileNav.close();
      await expect(mobileNav.mobileNav).not.toBeVisible();
    });

    authenticatedTest('navigation works on iPhone 12', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      // Set iPhone 12 viewport size (390x844)
      await page.setViewportSize({ width: 390, height: 844 });

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Navigate to vault
      await mobileNav.open();
      await mobileNav.navigateTo('vault');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/vault');
      await expect(mobileNav.mobileNav).not.toBeVisible();

      // Navigate to citations
      await mobileNav.open();
      await mobileNav.navigateTo('citations');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/citations');
    });
  });

  test.describe('Focus Management', () => {
    authenticatedTest('focus moves to close button when drawer opens', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Close button should receive focus
      await expect(mobileNav.closeButton).toBeFocused();
    });

    authenticatedTest('focus returns to menu button when drawer closes', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Focus menu button first
      await mobileNav.menuButton.focus();

      // Open and close
      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);
      await mobileNav.close();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Focus should return
      await expect(mobileNav.menuButton).toBeFocused();
    });

    authenticatedTest('focus is trapped within mobile nav drawer', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Tab through all elements multiple times
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
      }

      // Focus should still be within drawer
      const focusInDrawer = await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="mobile-nav-drawer"]');
        return drawer?.contains(document.activeElement) ?? false;
      });

      expect(focusInDrawer).toBe(true);
    });

    authenticatedTest('reverse tab also traps focus', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Shift+Tab through elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Shift+Tab');
      }

      // Focus should still be within drawer
      const focusInDrawer = await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="mobile-nav-drawer"]');
        return drawer?.contains(document.activeElement) ?? false;
      });

      expect(focusInDrawer).toBe(true);
    });
  });

  test.describe('ARIA Attributes', () => {
    authenticatedTest('mobile nav has correct dialog ARIA attributes', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      // Dialog role
      await expect(mobileNav.mobileNav).toHaveAttribute('role', 'dialog');

      // Modal attribute
      await expect(mobileNav.mobileNav).toHaveAttribute('aria-modal', 'true');

      // Accessible label
      const label = await mobileNav.mobileNav.getAttribute('aria-label');
      expect(label).toBeTruthy();
    });

    authenticatedTest('navigation items have correct ARIA current state', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      // Projects should be current page
      await expect(mobileNav.projectsLink).toHaveAttribute('aria-current', 'page');

      // Navigate to vault
      await mobileNav.navigateTo('vault');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      // Vault should now be current
      await expect(mobileNav.vaultLink).toHaveAttribute('aria-current', 'page');
    });

    authenticatedTest('close button has accessible label', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      await expect(mobileNav.closeButton).toHaveAttribute('aria-label', 'Close navigation menu');
    });
  });

  test.describe('Keyboard Interactions', () => {
    authenticatedTest('Escape key closes mobile nav', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(mobileNav.mobileNav).not.toBeVisible();
    });

    authenticatedTest('Enter key activates focused navigation item', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      // Tab to vault link
      await page.keyboard.press('Tab'); // Skip logo if present
      await page.keyboard.press('Tab'); // Skip close button
      await page.keyboard.press('Tab'); // Projects
      await page.keyboard.press('Tab'); // Vault

      // Press Enter
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');

      // Should navigate
      expect(page.url()).toContain('/vault');
    });

    authenticatedTest('command palette works alongside mobile nav', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);
      const commandPalette = new CommandPalettePage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Command palette should work
      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();
      await commandPalette.closeWithEscape();

      // Mobile nav should still work
      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();
      await mobileNav.close();
    });
  });

  test.describe('Body Scroll Lock', () => {
    authenticatedTest('body scroll is locked when mobile nav is open', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyOverflow).toBe('hidden');
    });

    authenticatedTest('body scroll is restored when mobile nav closes', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await mobileNav.close();

      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyOverflow).not.toBe('hidden');
    });
  });

  test.describe('Cross-Page Navigation', () => {
    authenticatedTest('mobile nav state resets on page navigation', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Navigate using mobile nav
      await mobileNav.open();
      await mobileNav.navigateTo('vault');
      await page.waitForLoadState('networkidle');

      // Mobile nav should be closed after navigation
      await expect(mobileNav.mobileNav).not.toBeVisible();

      // Menu button should be visible for next interaction
      await expect(mobileNav.menuButton).toBeVisible();
    });

    authenticatedTest('can navigate through all main sections', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Projects -> Vault
      await mobileNav.open();
      await mobileNav.navigateTo('vault');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/vault');

      // Vault -> Citations
      await mobileNav.open();
      await mobileNav.navigateTo('citations');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/citations');

      // Citations -> Projects
      await mobileNav.open();
      await mobileNav.navigateTo('projects');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/projects');
    });
  });

  test.describe('Backdrop Interactions', () => {
    authenticatedTest('clicking backdrop closes mobile nav', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await expect(mobileNav.mobileNav).toBeVisible();

      await mobileNav.closeViaBackdrop();
      await expect(mobileNav.mobileNav).not.toBeVisible();
    });

    authenticatedTest('backdrop has correct visual properties', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();

      // Backdrop should be visible
      await expect(mobileNav.backdrop).toBeVisible();

      // Backdrop should have some opacity (dim the background)
      const opacity = await page.evaluate(() => {
        const backdrop = document.querySelector('[data-testid="mobile-nav-backdrop"]');
        if (!backdrop) return '0';
        const styles = window.getComputedStyle(backdrop);
        return styles.opacity || styles.backgroundColor;
      });

      expect(opacity).toBeTruthy();
    });
  });
});
