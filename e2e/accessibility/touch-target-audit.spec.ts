/**
 * Touch Target Audit E2E Tests
 *
 * Verifies WCAG 2.5.8 (Target Size) compliance.
 * All interactive elements must have a minimum touch target of 44x44 CSS pixels.
 */
import { test, expect, Locator } from '@playwright/test';
import { test as authenticatedTest } from '../fixtures/test-fixtures';
import { AppShellPage } from '../pages/AppShellPage';
import { MobileNavPage } from '../pages/MobileNavPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { TIMEOUTS } from '../config/timeouts';

// WCAG 2.5.8 minimum touch target size
const MIN_TOUCH_TARGET = 44;

interface TouchTargetViolation {
  element: string;
  selector: string;
  width: number;
  height: number;
  minDimension: number;
}

/**
 * Check touch target size for an element.
 * Returns violation details if element is too small.
 */
async function checkTouchTarget(locator: Locator, name: string): Promise<TouchTargetViolation | null> {
  const box = await locator.boundingBox();
  if (!box) return null;

  const minDimension = Math.min(box.width, box.height);

  if (minDimension < MIN_TOUCH_TARGET) {
    // Get a selector for the element
    const testId = await locator.getAttribute('data-testid');
    const ariaLabel = await locator.getAttribute('aria-label');
    const selector = testId ? `[data-testid="${testId}"]` : ariaLabel ? `[aria-label="${ariaLabel}"]` : name;

    return {
      element: name,
      selector,
      width: box.width,
      height: box.height,
      minDimension,
    };
  }

  return null;
}

test.describe('Touch Target Audit - Unauthenticated Pages', () => {
  test('login page buttons meet minimum touch target size', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const violations: TouchTargetViolation[] = [];

    // Check all buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const violation = await checkTouchTarget(button, `Button: ${text?.trim() || i}`);
      if (violation) violations.push(violation);
    }

    // Check all links
    const links = page.locator('a:visible');
    const linkCount = await links.count();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const violation = await checkTouchTarget(link, `Link: ${text?.trim() || i}`);
      if (violation) violations.push(violation);
    }

    // Report violations
    if (violations.length > 0) {
      console.log('\nTouch Target Violations on Login Page:');
      violations.forEach((v) => {
        console.log(`  - ${v.element}: ${v.width}x${v.height}px (min: ${MIN_TOUCH_TARGET}px)`);
        console.log(`    Selector: ${v.selector}`);
      });
    }

    // Assert no violations (can make this a soft assertion if needed)
    expect(violations, `Found ${violations.length} touch target violations`).toHaveLength(0);
  });
});

authenticatedTest.describe('Touch Target Audit - Authenticated Pages', () => {
  authenticatedTest.describe('App Shell Navigation', () => {
    authenticatedTest('sidebar navigation links meet minimum touch target size', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      const violations: TouchTargetViolation[] = [];

      // Check sidebar nav items
      if (await appShell.sidebar.isVisible().catch(() => false)) {
        const navItems = [
          { locator: appShell.navProjectsLink, name: 'Projects nav link' },
          { locator: appShell.navVaultLink, name: 'Vault nav link' },
          { locator: appShell.navCitationsLink, name: 'Citations nav link' },
        ];

        for (const item of navItems) {
          if (await item.locator.isVisible().catch(() => false)) {
            const violation = await checkTouchTarget(item.locator, item.name);
            if (violation) violations.push(violation);
          }
        }

        // Check sidebar collapse toggle
        if (await appShell.sidebarCollapseToggle.isVisible().catch(() => false)) {
          const violation = await checkTouchTarget(appShell.sidebarCollapseToggle, 'Sidebar collapse toggle');
          if (violation) violations.push(violation);
        }
      }

      // Report violations
      if (violations.length > 0) {
        console.log('\nTouch Target Violations in Sidebar:');
        violations.forEach((v) => {
          console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
        });
      }

      expect(violations, `Found ${violations.length} touch target violations in sidebar`).toHaveLength(0);
    });

    authenticatedTest('header elements meet minimum touch target size', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      const violations: TouchTargetViolation[] = [];

      // Check header logo
      if (await appShell.headerLogo.isVisible().catch(() => false)) {
        const violation = await checkTouchTarget(appShell.headerLogo, 'Header logo');
        if (violation) violations.push(violation);
      }

      // Check user menu trigger
      if (await appShell.userMenuTrigger.isVisible().catch(() => false)) {
        const violation = await checkTouchTarget(appShell.userMenuTrigger, 'User menu trigger');
        if (violation) violations.push(violation);
      }

      if (violations.length > 0) {
        console.log('\nTouch Target Violations in Header:');
        violations.forEach((v) => {
          console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
        });
      }

      expect(violations, `Found ${violations.length} touch target violations in header`).toHaveLength(0);
    });
  });

  authenticatedTest.describe('Mobile Navigation', () => {
    authenticatedTest('mobile menu button meets minimum touch target size', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      const violations: TouchTargetViolation[] = [];

      // Check hamburger menu button
      const menuViolation = await checkTouchTarget(mobileNav.menuButton, 'Mobile menu button');
      if (menuViolation) violations.push(menuViolation);

      if (violations.length > 0) {
        console.log('\nTouch Target Violations - Mobile Menu Button:');
        violations.forEach((v) => {
          console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
        });
      }

      expect(violations, `Mobile menu button is too small`).toHaveLength(0);
    });

    authenticatedTest('mobile nav items meet minimum touch target size', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const violations: TouchTargetViolation[] = [];

      // Check close button
      const closeViolation = await checkTouchTarget(mobileNav.closeButton, 'Close button');
      if (closeViolation) violations.push(closeViolation);

      // Check nav items
      const navItems = [
        { locator: mobileNav.projectsLink, name: 'Projects link' },
        { locator: mobileNav.vaultLink, name: 'Vault link' },
        { locator: mobileNav.citationsLink, name: 'Citations link' },
      ];

      for (const item of navItems) {
        if (await item.locator.isVisible().catch(() => false)) {
          const violation = await checkTouchTarget(item.locator, item.name);
          if (violation) violations.push(violation);
        }
      }

      if (violations.length > 0) {
        console.log('\nTouch Target Violations in Mobile Nav:');
        violations.forEach((v) => {
          console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
        });
      }

      expect(violations, `Found ${violations.length} touch target violations in mobile nav`).toHaveLength(0);
    });
  });

  authenticatedTest.describe('Command Palette', () => {
    authenticatedTest('command palette items meet minimum touch target size', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();

      const violations: TouchTargetViolation[] = [];

      // Check command items
      const items = [
        { locator: commandPalette.projectsItem, name: 'Projects item' },
        { locator: commandPalette.vaultItem, name: 'Vault item' },
        { locator: commandPalette.citationsItem, name: 'Citations item' },
        { locator: commandPalette.newProjectItem, name: 'New project item' },
      ];

      for (const item of items) {
        if (await item.locator.isVisible().catch(() => false)) {
          const violation = await checkTouchTarget(item.locator, item.name);
          if (violation) violations.push(violation);
        }
      }

      if (violations.length > 0) {
        console.log('\nTouch Target Violations in Command Palette:');
        violations.forEach((v) => {
          console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
        });
      }

      expect(violations, `Found ${violations.length} touch target violations in command palette`).toHaveLength(0);
    });
  });

  authenticatedTest.describe('User Menu', () => {
    authenticatedTest('user menu items meet minimum touch target size', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      if (!(await appShell.userMenuTrigger.isVisible().catch(() => false))) {
        authenticatedTest.skip();
        return;
      }

      await appShell.openUserMenu();

      const violations: TouchTargetViolation[] = [];

      // Check menu items
      const menuItems = [appShell.userMenuSettings, appShell.userMenuSignout];

      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        if (await item.isVisible().catch(() => false)) {
          const violation = await checkTouchTarget(item, `User menu item ${i + 1}`);
          if (violation) violations.push(violation);
        }
      }

      if (violations.length > 0) {
        console.log('\nTouch Target Violations in User Menu:');
        violations.forEach((v) => {
          console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
        });
      }

      expect(violations, `Found ${violations.length} touch target violations in user menu`).toHaveLength(0);
    });
  });
});

authenticatedTest.describe('Touch Target Audit - Page Buttons', () => {
  authenticatedTest('projects page buttons meet minimum touch target size', async ({ page, loginAsWorker }) => {
    await loginAsWorker();

    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const violations: TouchTargetViolation[] = [];

    // Find all visible buttons on the page
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = (await button.textContent())?.trim() || `Button ${i}`;
      const testId = await button.getAttribute('data-testid');
      const name = testId || text;

      const violation = await checkTouchTarget(button, name);
      if (violation) violations.push(violation);
    }

    if (violations.length > 0) {
      console.log('\nTouch Target Violations on Projects Page:');
      violations.forEach((v) => {
        console.log(`  - ${v.element}: ${v.width.toFixed(0)}x${v.height.toFixed(0)}px (min: ${MIN_TOUCH_TARGET}px)`);
      });
    }

    // Log warning but don't fail - some small buttons may be intentional
    if (violations.length > 0) {
      console.warn(`Found ${violations.length} potential touch target issues`);
    }

    expect(violations, `Found ${violations.length} touch target violations`).toHaveLength(0);
  });
});
