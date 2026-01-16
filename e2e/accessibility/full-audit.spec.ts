/**
 * Comprehensive Accessibility Audit E2E Tests
 *
 * Full axe-core audit across all application pages and states.
 * Tests WCAG 2.1 AA compliance comprehensively.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { checkA11y, checkElementA11y } from '../helpers/axe';
import { AppShellPage } from '../pages/AppShellPage';
import { MobileNavPage } from '../pages/MobileNavPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { ToastPage } from '../pages/ToastPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Comprehensive Accessibility Audit', () => {
  test.describe('Full Page Audits', () => {
    test('projects list page - full audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      // Log summary
      console.log(`\nProjects Page Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);
      console.log(`  - Passes: ${results.passes.length}`);
      console.log(`  - Incomplete: ${results.incomplete.length}`);

      expect(results.violations).toHaveLength(0);
    });

    test('vault page - full audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      // Mock empty vault
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

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nVault Page Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);
      console.log(`  - Passes: ${results.passes.length}`);

      expect(results.violations).toHaveLength(0);
    });

    test('citations page - full audit', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/citations`);
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nCitations Page Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);
      console.log(`  - Passes: ${results.passes.length}`);

      expect(results.violations).toHaveLength(0);
    });

    test('document editor page - full audit', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nEditor Page Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);
      console.log(`  - Passes: ${results.passes.length}`);

      expect(results.violations).toHaveLength(0);
    });
  });

  test.describe('Interactive Component Audits', () => {
    test('command palette open state - audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Open command palette
      await commandPalette.open();
      await expect(commandPalette.commandPalette).toBeVisible();

      // Audit the page with command palette open
      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nCommand Palette Open - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      // Close before assertion to clean up
      await commandPalette.closeWithEscape();

      expect(results.violations).toHaveLength(0);
    });

    test('command palette with search results - audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const commandPalette = new CommandPalettePage(page);

      await commandPalette.goto('/projects');
      await page.waitForLoadState('networkidle');

      await commandPalette.open();
      await commandPalette.search('vault');
      await page.waitForTimeout(TIMEOUTS.DEBOUNCE_SEARCH);

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nCommand Palette with Search - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      await commandPalette.closeWithEscape();

      expect(results.violations).toHaveLength(0);
    });

    test('mobile nav open state - audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const mobileNav = new MobileNavPage(page);

      await mobileNav.setMobileViewport();
      await mobileNav.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Open mobile nav
      await mobileNav.open();
      await page.waitForTimeout(TIMEOUTS.ANIMATION);

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nMobile Nav Open - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      await mobileNav.close();

      expect(results.violations).toHaveLength(0);
    });

    test('user menu open state - audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      if (!(await appShell.userMenuTrigger.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      await appShell.openUserMenu();

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nUser Menu Open - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      await appShell.closeUserMenu();

      expect(results.violations).toHaveLength(0);
    });
  });

  test.describe('Responsive Layout Audits', () => {
    test('desktop viewport - full audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nDesktop Viewport (1440x900) - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      expect(results.violations).toHaveLength(0);
    });

    test('tablet viewport - full audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nTablet Viewport (768x1024) - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      expect(results.violations).toHaveLength(0);
    });

    test('mobile viewport - full audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nMobile Viewport (375x667) - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      expect(results.violations).toHaveLength(0);
    });
  });

  test.describe('Element-Specific Audits', () => {
    test('sidebar navigation - element audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      if (await appShell.sidebar.isVisible().catch(() => false)) {
        const results = await checkElementA11y(page, '[data-testid="sidebar"]', { skipFailures: true });

        console.log(`\nSidebar Element - Audit Summary:`);
        console.log(`  - Violations: ${results.violations.length}`);

        expect(results.violations).toHaveLength(0);
      }
    });

    test('header - element audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      const results = await checkElementA11y(page, '[data-testid="app-header"]', { skipFailures: true });

      console.log(`\nHeader Element - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      expect(results.violations).toHaveLength(0);
    });

    test('main content area - element audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();
      const appShell = new AppShellPage(page);

      await appShell.goto('/projects');
      await page.waitForLoadState('networkidle');
      await appShell.waitForReady();

      const results = await checkElementA11y(page, '[data-testid="main-content"]', { skipFailures: true });

      console.log(`\nMain Content Element - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      expect(results.violations).toHaveLength(0);
    });
  });

  test.describe('State-Based Audits', () => {
    test('loading state - audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      // Intercept API to create loading state
      await page.route('**/api/projects', async (route) => {
        // Delay response to capture loading state
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.continue();
      });

      await page.goto('/projects');

      // Audit during loading (before networkidle)
      const results = await checkA11y(page, { skipFailures: true, detailedReport: true, skipNetworkidle: true });

      console.log(`\nLoading State - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      // Loading states may have some issues, just log them
      if (results.violations.length > 0) {
        console.warn(`Loading state has ${results.violations.length} accessibility issues`);
      }
    });

    test('empty state - audit', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      // Mock empty state
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

      const results = await checkA11y(page, { skipFailures: true, detailedReport: true });

      console.log(`\nEmpty State (Vault) - Audit Summary:`);
      console.log(`  - Violations: ${results.violations.length}`);

      expect(results.violations).toHaveLength(0);
    });
  });

  test.describe('WCAG Compliance Summary', () => {
    test('generate comprehensive accessibility report', async ({ page, loginAsWorker }) => {
      await loginAsWorker();

      const pagesToAudit = [
        { path: '/projects', name: 'Projects' },
        { path: '/vault', name: 'Vault' },
      ];

      const report: { page: string; violations: number; passes: number }[] = [];

      for (const pageInfo of pagesToAudit) {
        await page.goto(pageInfo.path);
        await page.waitForLoadState('networkidle');

        const results = await checkA11y(page, { skipFailures: true });

        report.push({
          page: pageInfo.name,
          violations: results.violations.length,
          passes: results.passes.length,
        });
      }

      // Print summary report
      console.log('\n========================================');
      console.log('WCAG 2.1 AA Compliance Summary Report');
      console.log('========================================\n');

      let totalViolations = 0;
      let totalPasses = 0;

      report.forEach((r) => {
        console.log(`${r.page}:`);
        console.log(`  Violations: ${r.violations}`);
        console.log(`  Passes: ${r.passes}`);
        console.log('');
        totalViolations += r.violations;
        totalPasses += r.passes;
      });

      console.log('----------------------------------------');
      console.log(`Total Violations: ${totalViolations}`);
      console.log(`Total Passes: ${totalPasses}`);
      console.log(`Compliance Rate: ${((totalPasses / (totalPasses + totalViolations)) * 100).toFixed(1)}%`);
      console.log('========================================\n');

      expect(totalViolations).toBe(0);
    });
  });
});
