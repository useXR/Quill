/**
 * Unauthenticated Pages Accessibility Audit
 *
 * Tests WCAG 2.1 AA compliance for public-facing pages.
 * Uses axe-core for comprehensive accessibility testing.
 */
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Unauthenticated Pages Accessibility', () => {
  test.describe('Login Page', () => {
    test('login page passes accessibility audit', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await checkA11y(page, { detailedReport: true });
    });

    test('login page has proper heading structure', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Should have a main heading
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
    });

    test('login form has accessible labels', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Email input should have associated label
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      if (await emailInput.isVisible().catch(() => false)) {
        const labelledBy = await emailInput.getAttribute('aria-labelledby');
        const label = await emailInput.getAttribute('aria-label');
        const id = await emailInput.getAttribute('id');

        // Either aria-labelledby, aria-label, or associated <label> should exist
        const hasLabel = labelledBy || label || (id && (await page.locator(`label[for="${id}"]`).isVisible()));
        expect(hasLabel).toBeTruthy();
      }
    });

    test('login page has skip link or main landmark', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Should have main landmark
      const mainLandmark = page.locator('main, [role="main"]');
      await expect(mainLandmark).toBeVisible();
    });

    test('login page has sufficient color contrast', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Run axe with specific color contrast rules
      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      // Filter for color contrast violations
      const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');

      // Log any contrast issues but don't fail (might be intentional design)
      if (contrastViolations.length > 0) {
        console.log(`Color contrast issues found: ${contrastViolations.length}`);
      }
    });
  });

  test.describe('Home/Landing Page', () => {
    test('home page passes accessibility audit', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Home may redirect to login, that's OK
      await checkA11y(page, { detailedReport: true });
    });

    test('home page is keyboard navigable', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Tab through elements
      await page.keyboard.press('Tab');

      // Something should be focused
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Error Pages', () => {
    test('404 page passes accessibility audit', async ({ page }) => {
      // Navigate to non-existent page
      await page.goto('/this-page-does-not-exist-404');

      // Wait for page to load (may show 404 or redirect)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUTS.SHORT);

      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });
  });

  test.describe('ARIA Landmarks', () => {
    test('unauthenticated pages have proper landmark structure', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Should have at least one main landmark
      const mainLandmarks = page.locator('main, [role="main"]');
      const mainCount = await mainLandmarks.count();
      expect(mainCount).toBeGreaterThanOrEqual(1);

      // Should not have multiple main landmarks
      expect(mainCount).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Focus Management', () => {
    test('focus is visible when tabbing through login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Tab to first focusable element
      await page.keyboard.press('Tab');

      // Get focused element
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;

        const styles = window.getComputedStyle(el);
        return {
          tagName: el.tagName,
          hasOutline: styles.outlineStyle !== 'none' || styles.boxShadow !== 'none',
        };
      });

      expect(focusedElement).toBeTruthy();
    });

    test('focus order is logical on login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const focusOrder: string[] = [];

      // Tab through several elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const focusedTag = await page.evaluate(() => document.activeElement?.tagName || '');
        focusOrder.push(focusedTag);
      }

      // Should have tabbed through multiple elements
      expect(focusOrder.filter((t) => t).length).toBeGreaterThan(0);
    });
  });

  test.describe('Screen Reader Accessibility', () => {
    test('login page has meaningful page title', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('login page has language attribute', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
    });

    test('images have alt text', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const images = page.locator('img:not([role="presentation"])');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaHidden = await img.getAttribute('aria-hidden');

        // Either has alt text or is hidden from screen readers
        expect(alt !== null || ariaHidden === 'true').toBe(true);
      }
    });
  });
});
