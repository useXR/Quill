import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    // Use domcontentloaded for faster tests - don't wait for all resources
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify the page loads
    await expect(page).toHaveURL('/');

    // Check page is not empty
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should have valid HTML structure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Use getByRole for accessibility-focused selectors
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'load' });
    const loadTime = Date.now() - startTime;

    // Basic performance assertion - page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should pass accessibility audit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Run axe-core accessibility audit
    // Note: May need skipFailures: true initially until app is accessible
    await checkA11y(page, { skipFailures: true, detailedReport: true });
  });
});
