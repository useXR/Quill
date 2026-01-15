/**
 * E2E Tests for Skip Links accessibility feature.
 *
 * Tests that skip links are properly hidden, become visible on focus,
 * and navigate to the correct targets.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { AppShellPage } from '../pages/AppShellPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Skip Links', () => {
  let appShell: AppShellPage;

  test.beforeEach(async ({ page, authenticatedPage }) => {
    appShell = new AppShellPage(page);
    await appShell.goto('/projects');
    await appShell.waitForReady();
  });

  test('skip-to-main link is visually hidden initially', async ({ page }) => {
    // Skip link should exist but be visually hidden
    const skipLink = appShell.skipToMain;
    await expect(skipLink).toBeAttached();

    // Check that it has sr-only class (visually hidden)
    const classes = await skipLink.getAttribute('class');
    expect(classes).toContain('sr-only');
  });

  test('skip-to-main link becomes visible on focus', async ({ page }) => {
    // Tab to focus the skip link
    await page.keyboard.press('Tab');

    // Skip link should be focused and visible
    await expect(appShell.skipToMain).toBeFocused();

    // When focused, sr-only-focusable makes it visible
    const boundingBox = await appShell.skipToMain.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test('skip-to-main link navigates to main content', async ({ page }) => {
    // Tab to skip link
    await page.keyboard.press('Tab');
    await expect(appShell.skipToMain).toBeFocused();

    // Activate the skip link
    await page.keyboard.press('Enter');

    // Check URL hash or focus moved to main content
    const url = page.url();
    expect(url).toContain('#main-content');
  });

  test('skip-to-nav link is available', async ({ page }) => {
    const skipLink = appShell.skipToNav;
    await expect(skipLink).toBeAttached();

    const href = await skipLink.getAttribute('href');
    expect(href).toBe('#sidebar-nav');
  });

  test('keyboard user can navigate using skip links', async ({ page }) => {
    // Tab through skip links
    await page.keyboard.press('Tab'); // First skip link
    await expect(appShell.skipToMain).toBeFocused();

    await page.keyboard.press('Tab'); // Second skip link
    await expect(appShell.skipToNav).toBeFocused();

    await page.keyboard.press('Tab'); // Continue to regular navigation
    // Should have moved past skip links to interactive elements
  });

  test('skip links have proper accessible names', async ({ page }) => {
    const skipToMainText = await appShell.skipToMain.textContent();
    expect(skipToMainText).toContain('Skip to main content');

    const skipToNavText = await appShell.skipToNav.textContent();
    expect(skipToNavText).toContain('Skip to navigation');
  });

  test('skip links are styled correctly when focused', async ({ page }) => {
    await page.keyboard.press('Tab');

    // Check that skip link has visible styles when focused
    const skipLink = appShell.skipToMain;
    await expect(skipLink).toBeFocused();

    // Verify it has focus ring styling
    const classes = await skipLink.getAttribute('class');
    expect(classes).toContain('focus:ring-2');
  });
});
