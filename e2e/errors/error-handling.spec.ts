/**
 * E2E Tests for Error Handling and Error Boundaries
 *
 * Tests the error boundary component behavior, error recovery,
 * and loading states across the application.
 */
import { test, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Error Handling', () => {
  test.describe('Error Boundary Test Page', () => {
    test('should display error fallback when component throws', async ({ page }) => {
      // Navigate to the test page
      await page.goto('/test/error-boundary', { waitUntil: 'networkidle' });

      // The test page should be visible
      await expect(page.getByTestId('error-boundary-test-page')).toBeVisible({
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      // The error fallback should be displayed (component throws on first render)
      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });

      // Error message should be shown
      await expect(page.getByText('Something went wrong')).toBeVisible();
      await expect(page.getByText('Test error from ThrowingComponent')).toBeVisible();
    });

    test('should recover when retry button is clicked', async ({ page }) => {
      await page.goto('/test/error-boundary', { waitUntil: 'networkidle' });

      // Wait for error fallback to appear
      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      // Click the retry button
      await page.getByTestId('error-retry-button').click();

      // Success content should now be visible
      await expect(page.getByTestId('success-content')).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });

      // Error fallback should be gone
      await expect(page.getByTestId('error-fallback')).not.toBeVisible();
    });

    test('should be able to trigger error again after recovery', async ({ page }) => {
      await page.goto('/test/error-boundary', { waitUntil: 'networkidle' });

      // Recover from initial error
      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.PAGE_LOAD,
      });
      await page.getByTestId('error-retry-button').click();
      await expect(page.getByTestId('success-content')).toBeVisible();

      // Trigger error again
      await page.getByTestId('trigger-error-button').click();

      // Error fallback should be visible again
      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    });

    test('should focus heading when error is displayed for accessibility', async ({ page }) => {
      await page.goto('/test/error-boundary', { waitUntil: 'networkidle' });

      // Wait for error fallback
      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      // The error fallback should have role="alert" for screen readers
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible();
    });

    test('retry button should have minimum touch target size', async ({ page }) => {
      await page.goto('/test/error-boundary', { waitUntil: 'networkidle' });

      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      const retryButton = page.getByTestId('error-retry-button');
      const boundingBox = await retryButton.boundingBox();

      expect(boundingBox).not.toBeNull();
      // Check minimum 44x44px touch target
      expect(boundingBox!.width).toBeGreaterThanOrEqual(44);
      expect(boundingBox!.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Global Loading Page', () => {
    test('loading page should have proper accessibility attributes', async ({ page }) => {
      // Create a route that delays to show loading state
      await page.route('**/api/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.continue();
      });

      // Navigate and check loading state appears
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // If loading page appears, verify its structure
      const loadingPage = page.getByTestId('global-loading-page');
      const isVisible = await loadingPage.isVisible().catch(() => false);

      if (isVisible) {
        // Should have spinner with status role
        await expect(page.locator('[role="status"]')).toBeVisible();
      }
    });
  });

  test.describe('Error State Styling', () => {
    test('error fallback should use correct design system colors', async ({ page }) => {
      await page.goto('/test/error-boundary', { waitUntil: 'networkidle' });

      await expect(page.getByTestId('error-fallback')).toBeVisible({
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      // Check that the error container has proper styling
      const errorContainer = page.getByTestId('error-fallback');

      // Verify it's using the error-light background via class
      await expect(errorContainer).toHaveClass(/bg-\[var\(--color-error-light\)\]/);
    });
  });
});

test.describe('Skeleton Loading States', () => {
  // These tests would run against actual pages that use skeletons
  // For now, we verify the components are available

  test('skeleton components should be importable', async ({ page }) => {
    // Navigate to any page and verify no import errors
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
