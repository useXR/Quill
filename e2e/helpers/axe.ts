/**
 * Accessibility testing with axe-core.
 * Ensures WCAG 2.1 AA compliance.
 */
import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TIMEOUTS } from '../config/timeouts';

interface A11yOptions {
  skipFailures?: boolean;
  detailedReport?: boolean;
  skipNetworkidle?: boolean;
}

/**
 * Run accessibility audit on current page.
 */
export async function checkA11y(page: Page, options: A11yOptions = {}) {
  // Wait for page stability
  await page.waitForLoadState('domcontentloaded');

  if (!options.skipNetworkidle) {
    await page.waitForLoadState('networkidle').catch(() => {
      // Network idle timeout is acceptable
    });
  }

  // Disable animations to prevent false color contrast violations
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    `,
  });

  await page.waitForTimeout(TIMEOUTS.ANIMATION_SETTLE);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

  if (options.detailedReport && results.violations.length > 0) {
    console.log('\nAccessibility Violations:');
    results.violations.forEach((violation) => {
      console.log(`\n[${violation.impact}] ${violation.id}: ${violation.description}`);
      console.log(`Help: ${violation.helpUrl}`);
      violation.nodes.forEach((node) => {
        console.log(`  - ${node.failureSummary}`);
        console.log(`    Target: ${node.target.join(', ')}`);
      });
    });
  }

  if (!options.skipFailures) {
    expect(results.violations, `Found ${results.violations.length} accessibility violations`).toHaveLength(0);
  }

  return results;
}

/**
 * Run accessibility audit on a specific element.
 */
export async function checkElementA11y(page: Page, selector: string, options: A11yOptions = {}) {
  const results = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa']).analyze();

  if (!options.skipFailures) {
    expect(results.violations).toHaveLength(0);
  }

  return results;
}
