/**
 * E2E Tests for Command Palette.
 *
 * Tests the command palette including:
 * - Keyboard shortcuts (Cmd+K / Ctrl+K)
 * - Navigation commands
 * - Action commands
 * - Search filtering
 * - Accessibility
 */
import { test, expect } from '../fixtures/test-fixtures';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import AxeBuilder from '@axe-core/playwright';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Command Palette', () => {
  let commandPalette: CommandPalettePage;

  test.beforeEach(async ({ page, authenticatedPage }) => {
    commandPalette = new CommandPalettePage(page);
    await commandPalette.goto('/projects');
  });

  test.describe('Keyboard Shortcuts', () => {
    test('opens with Ctrl+K', async ({ page }) => {
      await page.keyboard.press('Control+k');
      await expect(commandPalette.commandPalette).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    });

    test('toggles closed on second Ctrl+K', async ({ page }) => {
      await commandPalette.open();
      await commandPalette.toggleClose();
      await expect(commandPalette.commandPalette).not.toBeVisible();
    });

    test('closes on Escape', async ({ page }) => {
      await commandPalette.open();
      await commandPalette.closeWithEscape();
      await expect(commandPalette.commandPalette).not.toBeVisible();
    });
  });

  test.describe('Dialog Structure', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
    });

    test('has correct aria-label', async () => {
      const ariaLabel = await commandPalette.getAriaLabel();
      expect(ariaLabel).toBe('Command palette');
    });

    test('search input has autoFocus', async () => {
      await expect(commandPalette.input).toBeFocused();
    });

    test('search input has correct placeholder', async () => {
      const placeholder = await commandPalette.getInputPlaceholder();
      expect(placeholder).toContain('command');
    });
  });

  test.describe('Navigation Commands', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
      await commandPalette.waitForReady();
    });

    test('shows Navigation group with all items', async () => {
      await expect(commandPalette.projectsItem).toBeVisible();
      await expect(commandPalette.vaultItem).toBeVisible();
      await expect(commandPalette.citationsItem).toBeVisible();
    });

    test('navigates to Projects when selected', async ({ page }) => {
      await commandPalette.selectItem('projects');
      await page.waitForURL('**/projects', { timeout: TIMEOUTS.NAVIGATION });
      expect(page.url()).toContain('/projects');
    });

    test('navigates to Vault when selected', async ({ page }) => {
      await commandPalette.selectItem('vault');
      await page.waitForURL('**/vault', { timeout: TIMEOUTS.NAVIGATION });
      expect(page.url()).toContain('/vault');
    });

    test('navigates to Citations when selected', async ({ page }) => {
      await commandPalette.selectItem('citations');
      await page.waitForURL('**/citations', { timeout: TIMEOUTS.NAVIGATION });
      expect(page.url()).toContain('/citations');
    });

    test('closes after selecting a navigation item', async ({ page }) => {
      await commandPalette.selectItem('vault');
      await page.waitForURL('**/vault', { timeout: TIMEOUTS.NAVIGATION });
      await expect(commandPalette.commandPalette).not.toBeVisible();
    });
  });

  test.describe('Action Commands', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
      await commandPalette.waitForReady();
    });

    test('shows Actions group with New Project item', async () => {
      await expect(commandPalette.newProjectItem).toBeVisible();
    });

    test('navigates to New Project page when selected', async ({ page }) => {
      await commandPalette.selectItem('new-project');
      await page.waitForURL('**/projects/new', { timeout: TIMEOUTS.NAVIGATION });
      expect(page.url()).toContain('/projects/new');
    });
  });

  test.describe('Backdrop Interaction', () => {
    test('closes when backdrop is clicked', async ({ page }) => {
      await commandPalette.open();
      await commandPalette.closeWithBackdropClick();
      await expect(commandPalette.commandPalette).not.toBeVisible();
    });
  });

  test.describe('Search Filtering', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
      await commandPalette.waitForReady();
    });

    test('filters items based on search query', async () => {
      await commandPalette.search('proj');

      // Projects and New Project should be visible
      await expect(commandPalette.projectsItem).toBeVisible();
      await expect(commandPalette.newProjectItem).toBeVisible();
    });

    test('shows empty state when no results match', async () => {
      await commandPalette.search('xyznonexistent');

      await expect(commandPalette.emptyState).toBeVisible();
      expect(await commandPalette.isEmptyStateVisible()).toBe(true);
    });

    test('restores all items when search is cleared', async () => {
      await commandPalette.search('xyznonexistent');
      await expect(commandPalette.emptyState).toBeVisible();

      await commandPalette.clearSearch();

      await expect(commandPalette.projectsItem).toBeVisible();
      await expect(commandPalette.vaultItem).toBeVisible();
      await expect(commandPalette.citationsItem).toBeVisible();
      await expect(commandPalette.newProjectItem).toBeVisible();
    });
  });

  test.describe('Touch Targets', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
      await commandPalette.waitForReady();
    });

    test('items meet minimum touch target size (44px)', async () => {
      const items = ['projects', 'vault', 'citations', 'new-project'] as const;

      for (const item of items) {
        const box = await commandPalette.getItemBoundingBox(item);
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
      await commandPalette.waitForReady();
    });

    test('command palette passes axe accessibility checks', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="command-palette"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('search input has combobox role', async ({ page }) => {
      await expect(commandPalette.input).toHaveRole('combobox');
    });

    test('list has listbox role', async ({ page }) => {
      await expect(commandPalette.list).toHaveRole('listbox');
    });

    test('search input has correct aria-label', async () => {
      const ariaLabel = await commandPalette.input.getAttribute('aria-label');
      expect(ariaLabel).toBe('Search commands');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test.beforeEach(async () => {
      await commandPalette.open();
      await commandPalette.waitForReady();
    });

    test('can navigate items with arrow keys', async ({ page }) => {
      // First item should be selected by default or after pressing ArrowDown
      await page.keyboard.press('ArrowDown');

      // The first item should now be selected (aria-selected=true)
      await expect(commandPalette.projectsItem).toHaveAttribute('aria-selected', 'true');
    });

    test('can select item with Enter key', async ({ page }) => {
      await page.keyboard.press('ArrowDown'); // Select first item
      await page.keyboard.press('Enter');

      await page.waitForURL('**/projects', { timeout: TIMEOUTS.NAVIGATION });
      expect(page.url()).toContain('/projects');
    });
  });
});
