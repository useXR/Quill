# Task 6.7: E2E Tests

> **Phase 6** | [← Command Palette](./06-command-palette.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task implements comprehensive E2E tests using Playwright with accessibility testing via axe-core.** Tests cover auth flows, export functionality, toast notifications, command palette, mobile navigation, and WCAG compliance.

**IMPORTANT:** This task uses existing E2E infrastructure established in Phase 0. Do NOT recreate utilities that already exist.

### Prerequisites

- **Task 6.6** completed (Command Palette)
- All previous Phase 6 tasks completed
- Phase 0 E2E infrastructure exists (`e2e/config/`, `e2e/fixtures/`, `e2e/helpers/`, `e2e/pages/`)

### What This Task Creates

- `e2e/pages/ExportPage.ts` - Export page object (extends existing pattern)
- `e2e/pages/ToastPage.ts` - Toast helper page object
- `e2e/pages/CommandPalettePage.ts` - Command palette page object
- `e2e/pages/MobileNavPage.ts` - Mobile navigation page object
- `e2e/export/*.spec.ts` - Export functionality tests
- `e2e/toast/*.spec.ts` - Toast notification tests
- `e2e/command-palette/*.spec.ts` - Command palette tests
- `e2e/accessibility/*.spec.ts` - Accessibility tests
- `e2e/mobile/*.spec.ts` - Mobile-specific tests
- `src/test-utils/factories.ts` (extend) - Export-related test data factories

### What This Task Uses (DO NOT RECREATE)

- `e2e/config/timeouts.ts` - Existing `TIMEOUTS` constants (Phase 0)
- `e2e/fixtures/test-fixtures.ts` - Existing `workerCtx`, `loginAsWorker` (Phase 0)
- `e2e/helpers/auth.ts` - Existing auth helpers (Phase 0)
- `e2e/helpers/axe.ts` - Existing `checkA11y()` helper (Phase 0)
- `e2e/helpers/hydration.ts` - Existing `waitForFormReady()` helper (Phase 0)
- `e2e/pages/LoginPage.ts` - Existing page object pattern (Phase 0)

### Tasks That Depend on This

- None (final task in Phase 6)

---

## Files to Create/Modify

**Create (following existing patterns):**

- `e2e/pages/ExportPage.ts`
- `e2e/pages/ToastPage.ts`
- `e2e/pages/CommandPalettePage.ts`
- `e2e/pages/MobileNavPage.ts`
- `e2e/export/export-flows.spec.ts`
- `e2e/toast/toast-flows.spec.ts`
- `e2e/command-palette/command-palette.spec.ts`
- `e2e/accessibility/unauthenticated.spec.ts`
- `e2e/accessibility/authenticated.spec.ts`
- `e2e/mobile/navigation.spec.ts`

**Extend (add to existing files):**

- `e2e/config/timeouts.ts` - Add Phase 6 specific timeouts
- `src/test-utils/factories.ts` - Add export-related factories

---

## Steps

### Step 1: Verify Phase 0 infrastructure exists

Before proceeding, verify the existing infrastructure:

```bash
# Verify Phase 0 files exist
ls -la e2e/config/timeouts.ts
ls -la e2e/fixtures/test-fixtures.ts
ls -la e2e/helpers/auth.ts
ls -la e2e/helpers/axe.ts
ls -la e2e/helpers/hydration.ts
ls -la e2e/pages/LoginPage.ts
```

**Expected:** All files exist. If any are missing, Phase 0 must be completed first.

### Step 2: Install accessibility testing (if not already installed)

```bash
# Check if already installed
npm list @axe-core/playwright || npm install -D @axe-core/playwright
```

**Expected:** Package available in devDependencies

### Step 3: Extend existing timeout constants

Add Phase 6 specific timeouts to `e2e/config/timeouts.ts`:

```typescript
// Add these to the existing TIMEOUTS object in e2e/config/timeouts.ts

export const TIMEOUTS = {
  // ... existing timeouts from Phase 0 ...

  // Phase 6 additions
  /** Timeout for toast auto-dismiss verification (5s default + 2s buffer) */
  TOAST_AUTO_DISMISS: 7000,
  /** Timeout for export file download */
  EXPORT_DOWNLOAD: 30000,
  /** Timeout for command palette animation */
  COMMAND_PALETTE: 500,
} as const;

// Add pre-built wait options if not present
export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST };
export const EXPORT_WAIT = { timeout: TIMEOUTS.EXPORT_DOWNLOAD };
```

### Step 4: Extend test data factories

Add export-related factories to `src/test-utils/factories.ts`:

```typescript
// Add to existing src/test-utils/factories.ts

/**
 * Factory for creating mock export options
 */
export function createMockExportOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: 'docx',
    includeMetadata: false,
    ...overrides,
  };
}

/**
 * Factory for creating mock document for export testing
 */
export function createMockExportDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: `doc-${Math.random().toString(36).slice(2)}`,
    title: 'Test Export Document',
    content_text: '<p>This is test content for export testing.</p>',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Pre-built mock documents for export testing
 */
export const mockExportDocuments = {
  simple: createMockExportDocument({ title: 'Simple Document' }),
  withFormatting: createMockExportDocument({
    title: 'Formatted Document',
    content_text: '<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em> text.</p>',
  }),
  long: createMockExportDocument({
    title: 'Long Document',
    content_text: Array(100).fill('<p>Lorem ipsum dolor sit amet.</p>').join(''),
  }),
};
```

### Step 5: Create ExportPage page object

Create `e2e/pages/ExportPage.ts` following the existing pattern:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, EXPORT_WAIT } from '../config/timeouts';

/**
 * Page object for document export functionality.
 * Follows Phase 0 page object pattern from LoginPage.ts.
 */
export class ExportPage {
  readonly page: Page;
  readonly exportButton: Locator;
  readonly exportMenu: Locator;
  readonly docxOption: Locator;
  readonly pdfOption: Locator;

  constructor(page: Page) {
    this.page = page;
    this.exportButton = page.getByRole('button', { name: /export/i });
    this.exportMenu = page.getByRole('menu');
    this.docxOption = page.getByRole('menuitem', { name: /docx/i });
    this.pdfOption = page.getByRole('menuitem', { name: /pdf/i });
  }

  async openExportMenu() {
    await this.exportButton.click();
    await expect(this.exportMenu).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async exportToDocx() {
    await this.openExportMenu();
    const downloadPromise = this.page.waitForEvent('download', EXPORT_WAIT);
    await this.docxOption.click();
    return downloadPromise;
  }

  async exportToPdf() {
    await this.openExportMenu();
    const downloadPromise = this.page.waitForEvent('download', EXPORT_WAIT);
    await this.pdfOption.click();
    return downloadPromise;
  }

  async expectExportButtonVisible() {
    await expect(this.exportButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }
}
```

### Step 6: Create ToastPage page object

Create `e2e/pages/ToastPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, TOAST_WAIT } from '../config/timeouts';

/**
 * Page object for toast notification interactions.
 */
export class ToastPage {
  readonly page: Page;
  readonly toastContainer: Locator;
  readonly toast: Locator;
  readonly dismissButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastContainer = page.locator('[role="status"][aria-live="polite"]');
    this.toast = page.getByRole('alert');
    this.dismissButton = this.toast.getByRole('button', { name: /dismiss/i });
  }

  async expectToastVisible(textPattern?: string | RegExp) {
    await expect(this.toast).toBeVisible(TOAST_WAIT);
    if (textPattern) {
      await expect(this.toast).toContainText(textPattern);
    }
  }

  async expectToastNotVisible() {
    await expect(this.toast).not.toBeVisible();
  }

  async dismiss() {
    await this.dismissButton.click();
    await this.expectToastNotVisible();
  }

  async waitForAutoDismiss() {
    await expect(this.toast).toBeVisible(TOAST_WAIT);
    await expect(this.toast).not.toBeVisible({ timeout: TIMEOUTS.TOAST_AUTO_DISMISS });
  }

  async getToastCount(): Promise<number> {
    return await this.toast.count();
  }
}
```

### Step 7: Create CommandPalettePage page object

Create `e2e/pages/CommandPalettePage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for command palette interactions.
 */
export class CommandPalettePage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly searchInput: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /command palette/i });
    this.searchInput = page.getByPlaceholder(/search or type/i);
    this.emptyState = page.getByText(/no results found/i);
  }

  async open() {
    // Use Meta+k for Mac, also works with Ctrl+k on other platforms
    await this.page.keyboard.press('Meta+k');
    await expect(this.dialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).not.toBeVisible();
  }

  async search(query: string) {
    await expect(this.searchInput).toBeVisible();
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE_SEARCH);
  }

  async selectOption(name: string | RegExp) {
    const option = this.page.getByRole('option', { name });
    await option.click();
  }

  async navigateWithKeyboard(direction: 'up' | 'down', count = 1) {
    for (let i = 0; i < count; i++) {
      await this.page.keyboard.press(direction === 'down' ? 'ArrowDown' : 'ArrowUp');
    }
  }

  async selectWithEnter() {
    await this.page.keyboard.press('Enter');
  }

  async expectOptionVisible(name: string | RegExp) {
    await expect(this.page.getByRole('option', { name })).toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  async expectClosed() {
    await expect(this.dialog).not.toBeVisible();
  }
}
```

### Step 8: Create MobileNavPage page object

Create `e2e/pages/MobileNavPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for mobile navigation interactions.
 */
export class MobileNavPage {
  readonly page: Page;
  readonly hamburgerButton: Locator;
  readonly closeButton: Locator;
  readonly drawer: Locator;
  readonly backdrop: Locator;

  constructor(page: Page) {
    this.page = page;
    this.hamburgerButton = page.getByRole('button', { name: /open menu/i });
    this.closeButton = page.getByRole('button', { name: /close menu/i });
    this.drawer = page.getByRole('dialog', { name: /navigation/i });
    this.backdrop = page.locator('.bg-black\\/50');
  }

  async openDrawer() {
    await this.hamburgerButton.click();
    await expect(this.drawer).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async closeDrawer() {
    await this.closeButton.click();
    await expect(this.drawer).not.toBeVisible();
  }

  async closeViaBackdrop() {
    await this.backdrop.click();
    await expect(this.drawer).not.toBeVisible();
  }

  async navigateTo(linkName: string | RegExp) {
    const link = this.drawer.getByRole('link', { name: linkName });
    await link.click();
  }

  async expectHamburgerVisible() {
    await expect(this.hamburgerButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  async expectHamburgerNotVisible() {
    await expect(this.hamburgerButton).not.toBeVisible();
  }

  async expectDrawerClosed() {
    await expect(this.drawer).not.toBeVisible();
  }
}
```

### Step 9: Create export flow tests

Create `e2e/export/export-flows.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ExportPage } from '../pages/ExportPage';
import { EditorPage } from '../pages/EditorPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Document Export', () => {
  let exportPage: ExportPage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    exportPage = new ExportPage(page);
    editorPage = new EditorPage(page);

    // Navigate to a test document using worker context
    await editorPage.goto(workerCtx.projectId, workerCtx.documentId);
    await editorPage.waitForEditorReady();
  });

  test('exports document to DOCX', async () => {
    const download = await exportPage.exportToDocx();

    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    // Verify file was downloaded
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('exports document to PDF', async () => {
    const download = await exportPage.exportToPdf();

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // Verify file was downloaded
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('export button is visible in editor', async () => {
    await exportPage.expectExportButtonVisible();
  });

  test('export menu shows format options', async () => {
    await exportPage.openExportMenu();

    await expect(exportPage.docxOption).toBeVisible();
    await expect(exportPage.pdfOption).toBeVisible();
  });
});
```

### Step 10: Create toast notification tests

Create `e2e/toast/toast-flows.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ToastPage } from '../pages/ToastPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Toast Notifications', () => {
  let toastPage: ToastPage;
  let projectsPage: ProjectsPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    toastPage = new ToastPage(page);
    projectsPage = new ProjectsPage(page);

    await projectsPage.goto();
  });

  test('shows success toast on project creation', async () => {
    const projectName = `Toast Test ${Date.now()}`;

    await projectsPage.createProject(projectName);

    await toastPage.expectToastVisible(/created|success/i);
  });

  test('toast can be dismissed manually', async () => {
    const projectName = `Dismiss Test ${Date.now()}`;

    await projectsPage.createProject(projectName);
    await toastPage.expectToastVisible();

    await toastPage.dismiss();

    await toastPage.expectToastNotVisible();
  });

  test('toast auto-dismisses after timeout', async () => {
    const projectName = `Auto Dismiss ${Date.now()}`;

    await projectsPage.createProject(projectName);

    await toastPage.waitForAutoDismiss();
  });

  test('toast container has correct ARIA attributes', async ({ page }) => {
    const projectName = `ARIA Test ${Date.now()}`;

    await projectsPage.createProject(projectName);
    await toastPage.expectToastVisible();

    // Verify accessibility attributes
    await expect(toastPage.toastContainer).toHaveAttribute('aria-live', 'polite');
    await expect(toastPage.toast).toHaveAttribute('role', 'alert');
  });
});
```

### Step 11: Create command palette tests

Create `e2e/command-palette/command-palette.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Command Palette', () => {
  let commandPalette: CommandPalettePage;

  test.beforeEach(async ({ page, loginAsWorker }) => {
    await loginAsWorker();

    commandPalette = new CommandPalettePage(page);
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
  });

  test('opens with Cmd+K keyboard shortcut', async () => {
    await commandPalette.open();

    await expect(commandPalette.dialog).toBeVisible();
    await expect(commandPalette.searchInput).toBeFocused();
  });

  test('closes with Escape key', async () => {
    await commandPalette.open();
    await commandPalette.close();

    await commandPalette.expectClosed();
  });

  test('toggles closed on second Cmd+K press', async ({ page }) => {
    await commandPalette.open();
    await page.keyboard.press('Meta+k');

    await commandPalette.expectClosed();
  });

  test('filters commands as user types', async () => {
    await commandPalette.open();
    await commandPalette.search('vault');

    await commandPalette.expectOptionVisible(/vault/i);
  });

  test('shows empty state when no matches', async () => {
    await commandPalette.open();
    await commandPalette.search('nonexistent command xyz');

    await commandPalette.expectEmptyState();
  });

  test('navigates with arrow keys and Enter', async ({ page }) => {
    await commandPalette.open();

    await commandPalette.navigateWithKeyboard('down');
    await commandPalette.selectWithEnter();

    await commandPalette.expectClosed();
  });

  test('executes navigation command on click', async ({ page }) => {
    await commandPalette.open();
    await commandPalette.selectOption(/vault/i);

    await expect(page).toHaveURL(/\/vault/);
    await commandPalette.expectClosed();
  });

  test('has accessible dialog label', async () => {
    await commandPalette.open();

    await expect(commandPalette.dialog).toHaveAttribute('aria-label', /command palette/i);
  });

  test('search input has accessible label', async () => {
    await commandPalette.open();

    await expect(commandPalette.searchInput).toHaveAttribute('aria-label', /search commands/i);
  });
});
```

### Step 12: Create accessibility tests for unauthenticated pages

Create `e2e/accessibility/unauthenticated.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { waitForFormReady } from '../helpers/hydration';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Accessibility - Unauthenticated Pages', () => {
  test('login page has no accessibility violations', async ({ page }) => {
    await page.goto('/login');
    await waitForFormReady(page);

    await checkA11y(page, { detailedReport: true });
  });

  test('skip link is focusable and navigates to main content', async ({ page }) => {
    await page.goto('/login');

    // Tab to skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to main/i });
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');

    // Verify focus moved to main content
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeFocused();
  });

  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/login');
    await waitForFormReady(page);

    // Tab through all focusable elements
    const focusableElements: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName + (el?.getAttribute('aria-label') || '');
      });
      focusableElements.push(focused);
    }

    // Should have multiple focusable elements
    const nonBodyElements = focusableElements.filter((el) => el !== 'BODY');
    expect(nonBodyElements.length).toBeGreaterThan(0);
  });

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    await page.goto('/login');

    await checkA11y(page, {
      skipFailures: false,
      // Only test color contrast
    });
  });
});
```

### Step 13: Create accessibility tests for authenticated pages

Create `e2e/accessibility/authenticated.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

// Authenticated pages to test
const authenticatedPages = [
  { name: 'projects', path: '/projects' },
  { name: 'vault', path: '/vault' },
  { name: 'citations', path: '/citations' },
];

test.describe('Accessibility - Authenticated Pages', () => {
  test.beforeEach(async ({ loginAsWorker }) => {
    await loginAsWorker();
  });

  for (const { name, path } of authenticatedPages) {
    test(`${name} page has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      await checkA11y(page, { detailedReport: true });
    });
  }

  test('sidebar navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/projects');

    const navItems = page.locator('nav a');
    const count = await navItems.count();

    expect(count).toBeGreaterThan(0);

    // Verify each nav item is focusable
    for (let i = 0; i < count; i++) {
      const item = navItems.nth(i);
      await item.focus();
      await expect(item).toBeFocused();
    }
  });

  test('user menu is keyboard accessible', async ({ page }) => {
    await page.goto('/projects');

    const userMenuButton = page.getByRole('button', { name: /user menu/i });
    await userMenuButton.focus();
    await expect(userMenuButton).toBeFocused();

    // Open menu with Enter
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();

    // Focus should return to trigger button
    await expect(userMenuButton).toBeFocused();
  });

  test('all interactive elements meet 44px touch target', async ({ page }) => {
    await page.goto('/projects');

    // Check buttons have minimum touch target
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });
});
```

### Step 14: Create mobile navigation tests

Create `e2e/mobile/navigation.spec.ts`:

```typescript
import { test, expect, devices } from '@playwright/test';
import { MobileNavPage } from '../pages/MobileNavPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Mobile Navigation', () => {
  // Use mobile viewport
  test.use({ ...devices['iPhone 12'] });

  let mobileNav: MobileNavPage;

  test.beforeEach(async ({ page }) => {
    mobileNav = new MobileNavPage(page);
    await page.goto('/projects');
  });

  test('shows hamburger menu on mobile', async () => {
    await mobileNav.expectHamburgerVisible();
  });

  test('opens mobile nav drawer on hamburger click', async () => {
    await mobileNav.openDrawer();

    await expect(mobileNav.drawer).toBeVisible();
  });

  test('closes mobile nav on close button click', async () => {
    await mobileNav.openDrawer();
    await mobileNav.closeDrawer();

    await mobileNav.expectDrawerClosed();
  });

  test('closes mobile nav on backdrop click', async () => {
    await mobileNav.openDrawer();
    await mobileNav.closeViaBackdrop();

    await mobileNav.expectDrawerClosed();
  });

  test('navigates and closes menu on link click', async ({ page }) => {
    await mobileNav.openDrawer();
    await mobileNav.navigateTo(/vault/i);

    await expect(page).toHaveURL(/\/vault/);
    await mobileNav.expectDrawerClosed();
  });

  test('focuses close button when drawer opens', async ({ page }) => {
    await mobileNav.openDrawer();

    await expect(mobileNav.closeButton).toBeFocused();
  });

  test('closes drawer on Escape key', async ({ page }) => {
    await mobileNav.openDrawer();

    await page.keyboard.press('Escape');

    await mobileNav.expectDrawerClosed();
  });

  test('drawer has correct ARIA attributes', async () => {
    await mobileNav.openDrawer();

    await expect(mobileNav.drawer).toHaveAttribute('role', 'dialog');
    await expect(mobileNav.drawer).toHaveAttribute('aria-modal', 'true');
  });
});
```

### Step 15: Update package.json scripts (if needed)

Verify the following scripts exist in `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

**Note:** These scripts should already exist from Phase 0. Only add if missing.

### Step 16: Run E2E tests

```bash
# Run all E2E tests
npm run test:e2e

# Run only Phase 6 tests
npm run test:e2e -- --grep "Export|Toast|Command Palette|Mobile|Accessibility"
```

**Expected:** All tests pass

### Step 17: Commit

```bash
git add e2e/pages/ e2e/export/ e2e/toast/ e2e/command-palette/ e2e/accessibility/ e2e/mobile/ e2e/config/timeouts.ts src/test-utils/factories.ts
git commit -m "test: add Phase 6 E2E tests using existing infrastructure

- Add ExportPage, ToastPage, CommandPalettePage, MobileNavPage page objects
- Add export flow tests for DOCX and PDF downloads
- Add toast notification tests with auto-dismiss verification
- Add command palette keyboard and navigation tests
- Add accessibility tests using existing checkA11y helper
- Add mobile navigation tests with drawer interactions
- Extend TIMEOUTS with Phase 6 specific values
- Extend factories with export-related test data

Uses existing Phase 0 infrastructure:
- e2e/fixtures/test-fixtures.ts (workerCtx, loginAsWorker)
- e2e/helpers/axe.ts (checkA11y)
- e2e/helpers/hydration.ts (waitForFormReady)
- e2e/config/timeouts.ts (TIMEOUTS)"
```

**Expected:** Commit created successfully

---

## Verification Checklist

### Phase 0 Infrastructure Usage

- [ ] Uses existing `TIMEOUTS` from `e2e/config/timeouts.ts`
- [ ] Uses existing `test-fixtures.ts` with `workerCtx` and `loginAsWorker`
- [ ] Uses existing `checkA11y()` from `e2e/helpers/axe.ts`
- [ ] Uses existing `waitForFormReady()` from `e2e/helpers/hydration.ts`
- [ ] Page objects placed in `e2e/pages/` directory (not `e2e/page-objects/`)

### New Page Objects

- [ ] `ExportPage.ts` extends existing pattern
- [ ] `ToastPage.ts` created with ARIA assertions
- [ ] `CommandPalettePage.ts` created with keyboard helpers
- [ ] `MobileNavPage.ts` created with drawer helpers

### Test Coverage

- [ ] Export tests verify DOCX and PDF downloads
- [ ] Toast tests verify appearance, dismissal, and auto-dismiss
- [ ] Command palette tests verify keyboard shortcuts and navigation
- [ ] Accessibility tests use `checkA11y()` helper
- [ ] Mobile tests verify responsive navigation

### Extensions

- [ ] `TIMEOUTS` extended with `TOAST_AUTO_DISMISS`, `EXPORT_DOWNLOAD`
- [ ] `factories.ts` extended with export-related factories

### Tests Pass

- [ ] All E2E tests pass
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Verification Checklist](./99-verification.md)** to verify Phase 6 completion.
