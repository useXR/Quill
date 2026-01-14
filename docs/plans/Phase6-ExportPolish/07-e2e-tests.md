# Task 6.7: E2E Tests (Integration & Audit)

> **Phase 6** | [← Command Palette](./06-command-palette.md) | [Next: Verification →](./99-verification.md)

---

## E2E Tests and Page Objects Created in Earlier Tasks

**IMPORTANT:** Following the incremental testing pattern, E2E tests AND page objects have been created in each feature task. This task focuses ONLY on integration tests and final audits. Do NOT recreate page objects here.

### Page Objects Created in Tasks 6.1-6.6

| Task | Page Object          | Location                          |
| ---- | -------------------- | --------------------------------- |
| 6.1  | `ExportPage`         | `e2e/pages/ExportPage.ts`         |
| 6.3  | `MobileNavPage`      | `e2e/pages/MobileNavPage.ts`      |
| 6.5  | `ToastPage`          | `e2e/pages/ToastPage.ts`          |
| 6.6  | `CommandPalettePage` | `e2e/pages/CommandPalettePage.ts` |

### E2E Test Files Created in Tasks 6.1-6.6

| Task | E2E Test File                            | Purpose                                                          |
| ---- | ---------------------------------------- | ---------------------------------------------------------------- |
| 6.1  | `e2e/export/docx-export.spec.ts`         | DOCX export menu, download, filename, loading state              |
| 6.2  | `e2e/export/pdf-export.spec.ts`          | PDF export, loading state, download                              |
| 6.3  | `e2e/navigation/skip-links.spec.ts`      | Skip link visibility and function                                |
| 6.3  | `e2e/navigation/mobile-nav.spec.ts`      | Drawer open/close, ARIA attributes                               |
| 6.3  | `e2e/navigation/app-shell.spec.ts`       | Header, sidebar, touch targets, **logo navigation**              |
| 6.4  | `e2e/errors/error-handling.spec.ts`      | Error boundary, skeletons, error pages, **recovery after retry** |
| 6.5  | `e2e/notifications/toast.spec.ts`        | Toast appearance, auto-dismiss, ARIA, **stacking behavior**      |
| 6.6  | `e2e/navigation/command-palette.spec.ts` | Keyboard shortcuts (**including Ctrl+K**), search, navigation    |

### Test Routes Created in Task 6.4

| Route                  | File                                   | Purpose                                    |
| ---------------------- | -------------------------------------- | ------------------------------------------ |
| `/test/error-boundary` | `src/app/test/error-boundary/page.tsx` | Error boundary testing with retry/recovery |
| `/test/error-page`     | `src/app/test/error-page/page.tsx`     | Global error page testing                  |

### Timeout Constants Added

| Constant                      | Value   | Added In |
| ----------------------------- | ------- | -------- |
| `TIMEOUTS.EXPORT_DOWNLOAD`    | 30000ms | Task 6.2 |
| `TIMEOUTS.TOAST_AUTO_DISMISS` | 7000ms  | Task 6.5 |

---

## Design System Context

E2E tests validate that the **Scholarly Craft** design system is correctly implemented across the application. Tests should verify:

### Visual Consistency Checks

- **Color Tokens:** Validate that design system colors (`bg-bg-primary`, `text-ink-primary`, etc.) render correctly
- **Typography:** Verify correct fonts load (Libre Baskerville for display, Source Sans 3 for UI)
- **Touch Targets:** All interactive elements meet 44x44px minimum size
- **Focus States:** Keyboard focus uses `ring-quill` (#7c3aed) consistently

### Accessibility Tests Should Verify

- **WCAG 2.1 AA Compliance:** All pages pass axe-core audits
- **Color Contrast:** Design system tokens meet 4.5:1 (text) and 3:1 (UI components) minimums
- **Reduced Motion:** Components respect `prefers-reduced-motion` preference
- **Focus Management:** Modals trap focus, return focus on close

### Visual Regression (Optional Enhancement)

Consider adding Percy or Playwright visual snapshots to catch unintended design system changes.

---

## Context

**This task implements comprehensive E2E tests using Playwright with accessibility testing via axe-core.** Tests cover auth flows, export functionality, toast notifications, command palette, mobile navigation, and WCAG compliance.

**IMPORTANT:** This task uses existing E2E infrastructure established in Phase 0. Do NOT recreate utilities that already exist.

### Prerequisites

- **Task 6.6** completed (Command Palette)
- All previous Phase 6 tasks completed
- Phase 0 E2E infrastructure exists (`e2e/config/`, `e2e/fixtures/`, `e2e/helpers/`, `e2e/pages/`)

### What This Task Creates

**Note:** Page objects have been created in earlier tasks (6.1, 6.3, 6.5, 6.6). This task focuses on integration and audit tests only.

- `e2e/integration/phase-integration.spec.ts` - Cross-phase integration tests
- `e2e/accessibility/full-audit.spec.ts` - Comprehensive accessibility audit
- `e2e/accessibility/touch-target-audit.spec.ts` - WCAG 2.5.8 touch target verification
- `e2e/integration/full-app-integration.spec.ts` - End-to-end user journey tests
- `src/test-utils/factories.ts` (extend) - Export-related test data factories

### What This Task Uses (DO NOT RECREATE)

**From Phase 0:**

- `e2e/config/timeouts.ts` - Existing `TIMEOUTS` constants
- `e2e/fixtures/test-fixtures.ts` - Existing `workerCtx`, `loginAsWorker`
- `e2e/helpers/auth.ts` - Existing auth helpers
- `e2e/helpers/axe.ts` - Existing `checkA11y()` helper
- `e2e/helpers/hydration.ts` - Existing `waitForFormReady()` helper
- `e2e/pages/LoginPage.ts` - Existing page object pattern

**From Phase 6 (Tasks 6.1-6.6):**

- `e2e/pages/ExportPage.ts` - Export page object (created in Task 6.1)
- `e2e/pages/MobileNavPage.ts` - Mobile navigation page object (created in Task 6.3)
- `e2e/pages/ToastPage.ts` - Toast helper page object (created in Task 6.5)
- `e2e/pages/CommandPalettePage.ts` - Command palette page object (created in Task 6.6)
- `src/app/test/error-boundary/page.tsx` - Test route for error boundary (created in Task 6.4)
- `src/app/test/error-page/page.tsx` - Test route for global error page (created in Task 6.4)

### Tasks That Depend on This

- None (final task in Phase 6)

---

## Files to Create/Modify

**Create (integration and audit tests only):**

- `e2e/integration/phase-integration.spec.ts` - Cross-phase integration tests
- `e2e/integration/full-app-integration.spec.ts` - End-to-end user journey tests
- `e2e/accessibility/unauthenticated.spec.ts` - Accessibility audit for public pages
- `e2e/accessibility/authenticated.spec.ts` - Accessibility audit for authenticated pages
- `e2e/accessibility/touch-target-audit.spec.ts` - WCAG 2.5.8 touch target verification
- `e2e/accessibility/full-audit.spec.ts` - Comprehensive accessibility audit

**Extend (add to existing files):**

- `e2e/config/timeouts.ts` - Add Phase 6 specific timeouts (if not already added in earlier tasks)
- `src/test-utils/factories.ts` - Add export-related factories

**NOTE:** Page objects (`ExportPage`, `ToastPage`, `CommandPalettePage`, `MobileNavPage`) have already been created in Tasks 6.1, 6.3, 6.5, and 6.6 respectively. Do NOT recreate them here.

---

## Steps

### Step 1: Verify Phase 0 and Phase 6 infrastructure exists

Before proceeding, verify the existing infrastructure from Phase 0 and earlier Phase 6 tasks:

```bash
# Verify Phase 0 files exist
ls -la e2e/config/timeouts.ts
ls -la e2e/fixtures/test-fixtures.ts
ls -la e2e/helpers/auth.ts
ls -la e2e/helpers/axe.ts
ls -la e2e/helpers/hydration.ts
ls -la e2e/pages/LoginPage.ts

# Verify Phase 6 page objects exist (created in Tasks 6.1, 6.3, 6.5, 6.6)
ls -la e2e/pages/ExportPage.ts
ls -la e2e/pages/MobileNavPage.ts
ls -la e2e/pages/ToastPage.ts
ls -la e2e/pages/CommandPalettePage.ts

# Verify test routes exist (created in Task 6.4)
ls -la src/app/test/error-boundary/page.tsx
ls -la src/app/test/error-page/page.tsx
```

**Expected:** All files exist. If any Phase 6 page objects are missing, complete the corresponding task first.

### Step 2: Install accessibility testing (if not already installed)

```bash
# Check if already installed
npm list @axe-core/playwright || npm install -D @axe-core/playwright
```

**Expected:** Package available in devDependencies

### Step 3: Verify timeout constants were added in earlier tasks

The following timeouts should already exist from earlier Phase 6 tasks:

```typescript
// These should already be in e2e/config/timeouts.ts from Tasks 6.1, 6.2, 6.5

export const TIMEOUTS = {
  // ... existing timeouts from Phase 0 ...

  // Phase 6 additions (already added)
  /** Timeout for toast auto-dismiss verification (5s default + 2s buffer) */
  TOAST_AUTO_DISMISS: 7000,
  /** Timeout for export file download */
  EXPORT_DOWNLOAD: 30000,
  /** Timeout for command palette animation */
  COMMAND_PALETTE: 500,
} as const;

// Pre-built wait options
export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST };
export const EXPORT_WAIT = { timeout: TIMEOUTS.EXPORT_DOWNLOAD };
```

If any are missing, add them now.

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

### Step 5: Create integration tests using existing page objects

**NOTE:** Page objects were created in Tasks 6.1, 6.3, 6.5, and 6.6. Import and use them from `e2e/pages/`.

Create `e2e/integration/export-integration.spec.ts` using the existing `ExportPage`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ExportPage } from '../pages/ExportPage';
import { ToastPage } from '../pages/ToastPage';
import { EditorPage } from '../pages/EditorPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Export Integration', () => {
  let exportPage: ExportPage;
  let toastPage: ToastPage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    exportPage = new ExportPage(page);
    toastPage = new ToastPage(page);
    editorPage = new EditorPage(page);
    await editorPage.goto(workerCtx.projectId, workerCtx.documentId);
    await editorPage.waitForEditorReady();
  });

  test('export shows success toast after completion', async () => {
    await exportPage.exportToDocx();
    await toastPage.expectToastVisible(/export|success/i);
  });

  test('export error shows error toast', async ({ page }) => {
    // Mock export failure
    await page.route('**/api/export/*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Export failed' }) })
    );

    await exportPage.openExportMenu();
    await exportPage.docxOption.click();

    await toastPage.expectToastVisible(/error|failed/i);
  });
});
```

### Step 6: Create cross-phase integration tests

**NOTE:** Feature-specific E2E tests have been created in Tasks 6.1-6.6. This step focuses on cross-phase integration tests that verify Phase 6 components work correctly with components from earlier phases.

Create `e2e/integration/phase-integration.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ExportPage } from '../pages/ExportPage';
import { ToastPage } from '../pages/ToastPage';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { EditorPage } from '../pages/EditorPage';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Phase 6 Integration with Earlier Phases', () => {
  test.beforeEach(async ({ page, loginAsWorker }) => {
    await loginAsWorker();
  });

  test.describe('Phase 0-1: Core Editor in New Shell', () => {
    test('editor loads correctly in new app shell', async ({ page, workerCtx }) => {
      await page.goto(`/projects/${workerCtx.projectId}/${workerCtx.documentId}`);

      const editor = page.locator('[data-testid="editor"]');
      await expect(editor).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

      const toolbar = page.locator('[data-testid="toolbar"]');
      await expect(toolbar).toBeVisible();
    });

    test('autosave works in new shell', async ({ page, workerCtx }) => {
      await page.goto(`/projects/${workerCtx.projectId}/${workerCtx.documentId}`);

      const editor = page.locator('[data-testid="editor"]');
      await editor.click();
      await page.keyboard.type('Integration test content');

      const saveStatus = page.locator('[data-testid="save-status"]');
      await expect(saveStatus).toContainText(/saved/i, { timeout: TIMEOUTS.AUTOSAVE });
    });
  });

  test.describe('Phase 2: Vault in New Shell', () => {
    test('vault page loads correctly in new shell', async ({ page }) => {
      await page.goto('/vault');
      await expect(page.getByRole('heading', { name: /vault/i })).toBeVisible();
    });
  });

  test.describe('Phase 5: Citations in New Shell', () => {
    test('citations page loads in new shell', async ({ page }) => {
      await page.goto('/citations');
      await expect(page.getByRole('heading', { name: /citations/i })).toBeVisible();
    });
  });

  test.describe('Cross-Feature Integration', () => {
    test('command palette can navigate to vault', async ({ page }) => {
      const commandPalette = new CommandPalettePage(page);

      await page.goto('/projects');
      await commandPalette.open();
      await commandPalette.selectOption(/vault/i);

      await expect(page).toHaveURL(/\/vault/);
    });

    test('export triggers toast notification', async ({ page, workerCtx }) => {
      const exportPage = new ExportPage(page);
      const toastPage = new ToastPage(page);
      const editorPage = new EditorPage(page);

      await editorPage.goto(workerCtx.projectId, workerCtx.documentId);
      await editorPage.waitForEditorReady();

      await exportPage.exportToDocx();
      await toastPage.expectToastVisible();
    });
  });
});
```

### Step 7: Create accessibility tests for unauthenticated pages

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

### Step 8: Create accessibility tests for authenticated pages

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

### Step 9: Create mobile navigation tests (integration focus)

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

### Step 10: Update package.json scripts (if needed)

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

### Step 11: Run E2E tests

```bash
# Run all E2E tests
npm run test:e2e

# Run only Phase 6 tests
npm run test:e2e -- --grep "Export|Toast|Command Palette|Mobile|Accessibility"
```

**Expected:** All tests pass

### Step 12: Commit

```bash
git add e2e/integration/ e2e/accessibility/ e2e/mobile/ src/test-utils/factories.ts
git commit -m "test: add Phase 6 integration and accessibility E2E tests

- Add cross-phase integration tests for Phase 0-5 compatibility
- Add accessibility audit tests using existing checkA11y helper
- Add touch target audit tests for WCAG 2.5.8 compliance
- Add mobile navigation integration tests
- Extend factories with export-related test data

Uses existing infrastructure:
- Page objects created in Tasks 6.1, 6.3, 6.5, 6.6
- Test routes created in Task 6.4
- Phase 0 infrastructure (fixtures, helpers, timeouts)"
```

**Expected:** Commit created successfully

---

## Integration Tests with Phase 0-5 Components

**IMPORTANT:** Verify that Phase 6 features (new shell, export, toasts) don't break existing functionality from earlier phases.

### Create `e2e/integration/phase-integration.spec.ts`

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Phase Integration Tests', () => {
  test.beforeEach(async ({ page, loginAsWorker }) => {
    await loginAsWorker();
  });

  test.describe('Phase 0-1: Core Editor in New Shell', () => {
    test('editor loads correctly in new app shell', async ({ page, workerCtx }) => {
      await page.goto(`/projects/${workerCtx.projectId}/${workerCtx.documentId}`);

      // Editor should be visible
      const editor = page.locator('[data-testid="editor"]');
      await expect(editor).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

      // Toolbar should be visible
      const toolbar = page.locator('[data-testid="toolbar"]');
      await expect(toolbar).toBeVisible();
    });

    test('autosave works in new shell', async ({ page, workerCtx }) => {
      await page.goto(`/projects/${workerCtx.projectId}/${workerCtx.documentId}`);

      // Type in editor
      const editor = page.locator('[data-testid="editor"]');
      await editor.click();
      await page.keyboard.type('Integration test content');

      // Save status should show saved
      const saveStatus = page.locator('[data-testid="save-status"]');
      await expect(saveStatus).toContainText(/saved/i, { timeout: TIMEOUTS.AUTOSAVE });
    });
  });

  test.describe('Phase 2: Vault in New Shell', () => {
    test('vault page loads correctly in new shell', async ({ page }) => {
      await page.goto('/vault');

      // Vault UI should be visible
      await expect(page.getByRole('heading', { name: /vault/i })).toBeVisible();
    });

    test('vault search works in new shell', async ({ page }) => {
      await page.goto('/vault');

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('test query');

      // Should not error
      await expect(page.locator('[role="alert"]')).not.toBeVisible();
    });
  });

  test.describe('Phase 3-4: AI Features in New Shell', () => {
    test('AI toolbar loads when text selected', async ({ page, workerCtx }) => {
      await page.goto(`/projects/${workerCtx.projectId}/${workerCtx.documentId}`);

      // Select text in editor
      const editor = page.locator('[data-testid="editor"]');
      await editor.click();
      await page.keyboard.press('Control+a');

      // AI toolbar should appear (if text is present)
      // Note: This depends on document having content
    });
  });

  test.describe('Phase 5: Citations in New Shell', () => {
    test('citations page loads in new shell', async ({ page }) => {
      await page.goto('/citations');

      // Citations UI should be visible
      await expect(page.getByRole('heading', { name: /citations/i })).toBeVisible();
    });
  });
});
```

---

## Touch Target Audit

**IMPORTANT:** Run comprehensive touch target audit across all interactive elements.

### Create `e2e/accessibility/touch-target-audit.spec.ts`

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Touch Target Audit (WCAG 2.5.8)', () => {
  const PAGES_TO_AUDIT = [
    { name: 'projects', path: '/projects' },
    { name: 'vault', path: '/vault' },
    { name: 'citations', path: '/citations' },
  ];

  test.beforeEach(async ({ loginAsWorker }) => {
    await loginAsWorker();
  });

  for (const { name, path } of PAGES_TO_AUDIT) {
    test(`${name} page - all buttons meet 44px minimum`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const buttons = page.locator('button:visible');
      const count = await buttons.count();

      const violations: string[] = [];

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        const label = (await button.getAttribute('aria-label')) || (await button.textContent()) || `Button ${i}`;

        if (box) {
          if (box.height < 44) {
            violations.push(`"${label}" height: ${box.height}px (min 44px)`);
          }
          if (box.width < 44) {
            violations.push(`"${label}" width: ${box.width}px (min 44px)`);
          }
        }
      }

      expect(violations, `Touch target violations on ${name}:\n${violations.join('\n')}`).toHaveLength(0);
    });

    test(`${name} page - all links meet 44px minimum`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      // Only check navigation/action links, not inline text links
      const navLinks = page.locator('nav a:visible, [role="menuitem"]:visible');
      const count = await navLinks.count();

      const violations: string[] = [];

      for (let i = 0; i < count; i++) {
        const link = navLinks.nth(i);
        const box = await link.boundingBox();
        const label = (await link.textContent()) || `Link ${i}`;

        if (box && box.height < 44) {
          violations.push(`"${label.trim()}" height: ${box.height}px (min 44px)`);
        }
      }

      expect(violations, `Touch target violations on ${name}:\n${violations.join('\n')}`).toHaveLength(0);
    });
  }
});
```

---

## Full Accessibility Audit

**IMPORTANT:** Run comprehensive accessibility audit using `checkA11y()`.

### Create `e2e/accessibility/full-audit.spec.ts`

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Full Accessibility Audit', () => {
  const AUTHENTICATED_PAGES = [
    { name: 'projects', path: '/projects' },
    { name: 'vault', path: '/vault' },
    { name: 'citations', path: '/citations' },
    { name: 'new project', path: '/projects/new' },
  ];

  test.describe('Unauthenticated Pages', () => {
    test('login page passes axe audit', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      await checkA11y(page, {
        detailedReport: true,
        skipFailures: false,
      });
    });
  });

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ loginAsWorker }) => {
      await loginAsWorker();
    });

    for (const { name, path } of AUTHENTICATED_PAGES) {
      test(`${name} page passes axe audit`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');

        await checkA11y(page, {
          detailedReport: true,
          skipFailures: false,
        });
      });
    }
  });

  test.describe('Interactive Components', () => {
    test.beforeEach(async ({ loginAsWorker }) => {
      await loginAsWorker();
    });

    test('command palette passes axe audit when open', async ({ page }) => {
      await page.goto('/projects');
      await page.keyboard.press('Meta+k');

      await page.waitForSelector('[role="dialog"]');

      await checkA11y(page, {
        detailedReport: true,
        skipFailures: false,
      });
    });

    test('mobile nav drawer passes axe audit when open', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/projects');

      await page.getByRole('button', { name: /open menu/i }).click();
      await page.waitForSelector('[role="dialog"]');

      await checkA11y(page, {
        detailedReport: true,
        skipFailures: false,
      });
    });

    test('export menu passes axe audit when open', async ({ page, workerCtx }) => {
      await page.goto(`/projects/${workerCtx.projectId}/${workerCtx.documentId}`);

      await page.getByRole('button', { name: /export/i }).click();
      await page.waitForSelector('[role="menu"]');

      await checkA11y(page, {
        detailedReport: true,
        skipFailures: false,
      });
    });
  });
});
```

---

## Verification Checklist

### Phase 0 Infrastructure Usage

- [ ] Uses existing `TIMEOUTS` from `e2e/config/timeouts.ts`
- [ ] Uses existing `test-fixtures.ts` with `workerCtx` and `loginAsWorker`
- [ ] Uses existing `checkA11y()` from `e2e/helpers/axe.ts`
- [ ] Uses existing `waitForFormReady()` from `e2e/helpers/hydration.ts`

### Page Objects (Verified from Tasks 6.1, 6.3, 6.5, 6.6)

**NOTE:** Do NOT create these in Task 6.7 - verify they exist from earlier tasks.

- [ ] `ExportPage.ts` exists (created in Task 6.1)
- [ ] `MobileNavPage.ts` exists (created in Task 6.3)
- [ ] `ToastPage.ts` exists (created in Task 6.5)
- [ ] `CommandPalettePage.ts` exists (created in Task 6.6)

### Test Routes (Verified from Task 6.4)

- [ ] `src/app/test/error-boundary/page.tsx` exists (with recovery support)
- [ ] `src/app/test/error-page/page.tsx` exists

### Integration Test Coverage (Created in This Task)

- [ ] Cross-phase integration tests verify Phase 0-5 compatibility
- [ ] Accessibility audit tests use `checkA11y()` helper
- [ ] Touch target audit tests verify WCAG 2.5.8 compliance
- [ ] Full app integration tests cover user journeys

### Extensions

- [ ] `TIMEOUTS` has `TOAST_AUTO_DISMISS`, `EXPORT_DOWNLOAD` (added in earlier tasks)
- [ ] `factories.ts` extended with export-related factories

### Tests Pass

- [ ] All E2E tests pass
- [ ] Changes committed

---

## Cross-Phase Integration Tests

Create `e2e/integration/full-app-integration.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Full Application Integration', () => {
  test('complete user journey: login -> project -> document -> AI -> export', async ({ page, loginAsWorker }) => {
    await loginAsWorker();
    // Create project
    // Create document
    // Add content
    // Use AI to refine (Phase 3)
    // Add citation (Phase 5)
    // Export to PDF (Phase 6)
    // Sign out
    // Verify redirect to login
  });

  test('error boundary catches Phase 3 AI errors', async ({ page, loginAsWorker }) => {
    await loginAsWorker();
    // Mock AI endpoint to throw
    // Trigger AI action
    // Verify error boundary shows, retry works
  });

  test('Phase 5 citations appear in Phase 6 exports', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Navigate to document with citations
    // Export to DOCX
    // Verify citation data in response
  });
});
```

---

## Next Steps

After this task, proceed to **[Verification Checklist](./99-verification.md)** to verify Phase 6 completion.
