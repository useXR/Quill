# Phase 6 E2E Test Gap Analysis Report

**Date:** 2026-01-14
**Analyst:** Claude Code
**Scope:** Phase 6 (Export & Polish) Implementation Plan E2E Test Coverage

---

## Executive Summary

This report analyzes the Phase 6 implementation plan to identify gaps in E2E test coverage. The analysis reveals **significant gaps** in Steps 6.1-6.6 where new UI components and interactions are created but E2E tests are deferred entirely to Step 6.7. This pattern has caused issues in previous phases where disconnected components were not caught until late in development.

### Key Findings

| Issue Type                          | Count | Risk Level |
| ----------------------------------- | ----- | ---------- |
| Missing step-level E2E verification | 6     | HIGH       |
| Missing integration tests           | 4     | MEDIUM     |
| Missing Page Object definitions     | 0\*   | LOW        |
| Missing accessibility tests         | 2     | MEDIUM     |

\*Page Objects ARE defined in Step 6.7, but should be created earlier and used incrementally.

---

## Testing Infrastructure Reference

### Existing Phase 0 Infrastructure (DO NOT RECREATE)

From `/home/arobb/Dev/Quill/e2e/`:

- `config/timeouts.ts` - Centralized timeout constants
- `fixtures/test-fixtures.ts` - `workerCtx`, `loginAsWorker`
- `helpers/axe.ts` - `checkA11y()` accessibility helper
- `helpers/hydration.ts` - `waitForFormReady()`
- `helpers/auth.ts` - Authentication helpers
- `pages/LoginPage.ts`, `VaultPage.ts`, `EditorPage.ts`, `ProjectPage.ts` - Existing Page Objects

### Required Testing Patterns (from testing-best-practices.md)

1. **Page Objects in `e2e/pages/`** - All page objects must follow the existing pattern
2. **Use TIMEOUTS constants** - Never hardcode timeout values
3. **44px Touch Target Testing** - Verify with `boundingBox()` assertions
4. **ARIA Attribute Verification** - Use `toHaveAttribute()` for accessibility
5. **Reduced Motion Testing** - Test `prefers-reduced-motion` respect

---

## Step-by-Step Analysis

### Task 6.1: DOCX Export

#### Components Created

| Component              | Type    | File Path                          |
| ---------------------- | ------- | ---------------------------------- |
| HTML-to-DOCX converter | Library | `src/lib/export/html-to-docx.ts`   |
| DOCX styles            | Config  | `src/lib/export/docx-styles.ts`    |
| DOCX export function   | Library | `src/lib/export/docx.ts`           |
| Export API route       | API     | `src/app/api/export/docx/route.ts` |

#### User Interactions Introduced

- None directly (API-only, UI comes in Step 6.3)

#### API Endpoints Created

| Method | Endpoint                           | Auth Required |
| ------ | ---------------------------------- | ------------- |
| GET    | `/api/export/docx?documentId=UUID` | Yes           |

#### E2E Tests Specified

**NONE** - Unit tests only

#### Gap Analysis

| Gap                        | Severity | Recommendation                                      |
| -------------------------- | -------- | --------------------------------------------------- |
| No API route E2E test      | MEDIUM   | Add E2E test for API authentication                 |
| No authorization E2E test  | MEDIUM   | Test that users can only export their own documents |
| No error handling E2E test | LOW      | Test invalid UUID responses                         |

**Recommended E2E Tests to Add:**

```typescript
// e2e/export/docx-api.spec.ts
test.describe('DOCX Export API', () => {
  test('requires authentication', async ({ request }) => {
    const response = await request.get('/api/export/docx?documentId=123');
    expect(response.status()).toBe(401);
  });

  test('returns 403 for unauthorized document', async ({ workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Test with another user's document
  });

  test('returns 400 for invalid UUID', async ({ workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    const response = await request.get('/api/export/docx?documentId=invalid');
    expect(response.status()).toBe(400);
  });
});
```

**When to Run E2E:** After Step 6.1 completion (currently not specified)

---

### Task 6.2: PDF Export

#### Components Created

| Component           | Type    | File Path                         |
| ------------------- | ------- | --------------------------------- |
| PDF styles          | Config  | `src/lib/export/pdf-styles.ts`    |
| PDF export function | Library | `src/lib/export/pdf.ts`           |
| PDF API route       | API     | `src/app/api/export/pdf/route.ts` |

#### User Interactions Introduced

- None directly (API-only, UI comes in Step 6.3)

#### API Endpoints Created

| Method | Endpoint                          | Auth Required |
| ------ | --------------------------------- | ------------- |
| GET    | `/api/export/pdf?documentId=UUID` | Yes           |

#### E2E Tests Specified

**NONE** - Unit tests only

#### Gap Analysis

| Gap                           | Severity | Recommendation                                     |
| ----------------------------- | -------- | -------------------------------------------------- |
| No API route E2E test         | MEDIUM   | Add E2E test for API authentication                |
| No Puppeteer timeout E2E test | MEDIUM   | Test with large documents (PDF generation is slow) |
| No `maxDuration` verification | LOW      | Verify 60s timeout works for large docs            |

**Recommended E2E Tests to Add:**

```typescript
// e2e/export/pdf-api.spec.ts
test.describe('PDF Export API', () => {
  test('requires authentication', async ({ request }) => {
    const response = await request.get('/api/export/pdf?documentId=123');
    expect(response.status()).toBe(401);
  });

  test('handles large documents within timeout', async ({ workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Create document with ~100 paragraphs
    // Verify PDF exports within 30s
  });
});
```

**When to Run E2E:** After Step 6.2 completion (currently not specified)

---

### Task 6.3: App Shell & Navigation

#### Components Created

| Component         | Type         | File Path                                |
| ----------------- | ------------ | ---------------------------------------- |
| SkipLinks         | UI Component | `src/components/layout/SkipLinks.tsx`    |
| UserMenu          | UI Component | `src/components/layout/UserMenu.tsx`     |
| Header            | UI Component | `src/components/layout/Header.tsx`       |
| Sidebar           | UI Component | `src/components/layout/Sidebar.tsx`      |
| MobileNav         | UI Component | `src/components/layout/MobileNav.tsx`    |
| AppShell          | UI Component | `src/components/layout/AppShell.tsx`     |
| AppProviders      | Provider     | `src/components/layout/AppProviders.tsx` |
| useMediaQuery     | Hook         | `src/hooks/useMediaQuery.ts`             |
| accessibility.css | Styles       | `src/styles/accessibility.css`           |

#### User Interactions Introduced

| Interaction                     | Component | Touch Target | ARIA Attributes                  |
| ------------------------------- | --------- | ------------ | -------------------------------- |
| Open user menu                  | UserMenu  | 44x44px      | `aria-expanded`, `aria-haspopup` |
| Close user menu (click outside) | UserMenu  | N/A          | -                                |
| Close user menu (Escape)        | UserMenu  | N/A          | -                                |
| Open mobile drawer              | Header    | 44x44px      | `aria-label="Open menu"`         |
| Close mobile drawer             | MobileNav | 44x44px      | `aria-label="Close menu"`        |
| Navigate via sidebar            | Sidebar   | 44x44px      | `aria-current="page"`            |
| Navigate via mobile nav         | MobileNav | 44x44px      | `aria-current="page"`            |
| Collapse/expand sidebar         | Sidebar   | 44x44px      | `aria-label`                     |
| Skip to main content            | SkipLinks | N/A          | -                                |

#### Integrations with Earlier Phases

- **Phase 0:** Uses existing auth system
- **Phase 1:** Integrates with document editor pages
- **Phase 2:** Navigation to `/vault`
- **Phase 5:** Navigation to `/citations`

#### E2E Tests Specified

**NONE** - Unit tests only for `useMediaQuery` and `UserMenu`

#### Gap Analysis

| Gap                               | Severity | Recommendation                   |
| --------------------------------- | -------- | -------------------------------- |
| No skip link E2E test             | HIGH     | Critical accessibility feature   |
| No mobile navigation E2E test     | HIGH     | Must test drawer open/close      |
| No responsive breakpoint E2E test | MEDIUM   | Test sidebar collapse on tablet  |
| No user menu E2E test             | MEDIUM   | Test keyboard accessibility      |
| No touch target E2E verification  | MEDIUM   | Verify 44px buttons              |
| No `aria-current` E2E test        | MEDIUM   | Verify active route highlighting |

**Recommended Page Object (create early):**

```typescript
// e2e/pages/AppShellPage.ts
export class AppShellPage {
  readonly page: Page;
  readonly skipLink: Locator;
  readonly userMenuButton: Locator;
  readonly userMenu: Locator;
  readonly hamburgerButton: Locator;
  readonly sidebar: Locator;
  readonly mobileDrawer: Locator;

  // ... methods for interactions
}
```

**Recommended E2E Tests to Add at Step 6.3:**

```typescript
// e2e/navigation/app-shell.spec.ts
test.describe('App Shell Navigation', () => {
  test('skip link navigates to main content', async ({ page }) => {
    await page.goto('/projects');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to main/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('user menu is keyboard accessible', async ({ page }) => {
    // ... test Escape key, outside click, etc.
  });

  test('all buttons meet 44px touch target', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
```

**When to Run E2E:** After Step 6.3 completion (CRITICAL - not specified)

---

### Task 6.4: Loading States & Error Handling

#### Components Created

| Component            | Type         | File Path                             |
| -------------------- | ------------ | ------------------------------------- |
| Skeleton             | UI Component | `src/components/ui/Skeleton.tsx`      |
| DocumentListSkeleton | UI Component | `src/components/ui/Skeleton.tsx`      |
| EditorSkeleton       | UI Component | `src/components/ui/Skeleton.tsx`      |
| Spinner              | UI Component | `src/components/ui/Spinner.tsx`       |
| ErrorFallback        | UI Component | `src/components/ui/ErrorFallback.tsx` |
| ErrorBoundary        | UI Component | `src/components/ui/ErrorBoundary.tsx` |
| Global error.tsx     | Page         | `src/app/error.tsx`                   |
| Global loading.tsx   | Page         | `src/app/loading.tsx`                 |
| Custom error classes | Library      | `src/lib/errors.ts`                   |

#### User Interactions Introduced

| Interaction            | Component               | Touch Target | ARIA Attributes                    |
| ---------------------- | ----------------------- | ------------ | ---------------------------------- |
| Click retry button     | ErrorFallback           | 44x44px      | -                                  |
| Focus on error heading | ErrorFallback/error.tsx | N/A          | `tabIndex=-1` for focus management |

#### Accessibility Considerations

- Skeleton components have `aria-hidden="true"`
- Spinner has `role="status"` and `aria-label="Loading"`
- ErrorFallback focuses heading on mount for screen readers
- `motion-reduce:animate-none` on animations

#### E2E Tests Specified

**NONE** - Unit tests only

#### Gap Analysis

| Gap                          | Severity | Recommendation                     |
| ---------------------------- | -------- | ---------------------------------- |
| No error boundary E2E test   | HIGH     | Must test error recovery           |
| No loading state E2E test    | MEDIUM   | Verify skeleton visibility         |
| No reduced motion E2E test   | MEDIUM   | Test with `prefers-reduced-motion` |
| No focus management E2E test | MEDIUM   | Verify error heading focus         |

**Recommended E2E Tests to Add at Step 6.4:**

```typescript
// e2e/error-handling/error-states.spec.ts
test.describe('Error Handling', () => {
  test('error page focuses heading for accessibility', async ({ page }) => {
    // Trigger error state
    await page.goto('/projects/invalid-uuid');

    // Verify heading is focused
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('retry button meets touch target and works', async ({ page }) => {
    // ... verify 44px and retry functionality
  });

  test('respects reduced motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/projects');

    // Verify no animations
    const skeleton = page.locator('[class*="animate-pulse"]');
    // Should have animate-none applied
  });
});
```

**When to Run E2E:** After Step 6.4 completion (not specified)

---

### Task 6.5: Toast Notifications

#### Components Created

| Component       | Type         | File Path                     |
| --------------- | ------------ | ----------------------------- |
| ToastContainer  | UI Component | `src/components/ui/Toast.tsx` |
| useToast        | Hook/Store   | `src/hooks/useToast.ts`       |
| Toast constants | Config       | `src/lib/constants/toast.ts`  |

#### User Interactions Introduced

| Interaction           | Component      | Touch Target | ARIA Attributes                     |
| --------------------- | -------------- | ------------ | ----------------------------------- |
| Dismiss toast         | ToastContainer | 44x44px      | `aria-label="Dismiss notification"` |
| Auto-dismiss (5s/10s) | ToastContainer | N/A          | -                                   |

#### ARIA & Accessibility

- Container: `role="status"`, `aria-live="polite"`
- Individual toasts: `role="alert"`
- Animation: `animate-slide-in`, `motion-reduce:animate-none`

#### Integrations with Earlier Phases

- Will be triggered by export success (6.1, 6.2)
- Will be triggered by project creation (Phase 1)
- Will be triggered by vault operations (Phase 2)

#### E2E Tests Specified

**NONE** - Unit tests only

#### Gap Analysis

| Gap                          | Severity | Recommendation             |
| ---------------------------- | -------- | -------------------------- |
| No toast visibility E2E test | HIGH     | Must verify toasts appear  |
| No auto-dismiss E2E test     | HIGH     | Test 5s/10s timeouts work  |
| No ARIA E2E verification     | MEDIUM   | Test `aria-live="polite"`  |
| No toast stacking E2E test   | MEDIUM   | Test MAX_VISIBLE limit     |
| No touch target E2E test     | MEDIUM   | Verify dismiss button 44px |

**Recommended Page Object (create at 6.5):**

```typescript
// e2e/pages/ToastPage.ts - AS SPECIFIED IN 6.7, BUT NEEDED EARLIER
export class ToastPage {
  readonly page: Page;
  readonly toastContainer: Locator;
  readonly toast: Locator;
  readonly dismissButton: Locator;

  async expectToastVisible(textPattern?: string | RegExp) {}
  async dismiss() {}
  async waitForAutoDismiss() {}
}
```

**Recommended E2E Tests to Add at Step 6.5:**

```typescript
// e2e/toast/toast-integration.spec.ts
test.describe('Toast Notifications', () => {
  test('toast appears on project creation', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto('/projects/new');
    // Create project
    // Verify toast appears
  });

  test('toast has correct ARIA attributes', async ({ page }) => {
    // Trigger toast
    const container = page.locator('[role="status"]');
    await expect(container).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('dismiss button meets 44px touch target', async ({ page }) => {
    // Trigger toast
    const button = page.getByRole('button', { name: /dismiss/i });
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
```

**When to Run E2E:** After Step 6.5 completion (CRITICAL - not specified)

---

### Task 6.6: Command Palette

#### Components Created

| Component      | Type         | File Path                              |
| -------------- | ------------ | -------------------------------------- |
| CommandPalette | UI Component | `src/components/ui/CommandPalette.tsx` |

#### User Interactions Introduced

| Interaction            | Component      | Touch Target | ARIA Attributes                |
| ---------------------- | -------------- | ------------ | ------------------------------ |
| Open (Cmd+K / Ctrl+K)  | CommandPalette | N/A          | -                              |
| Close (Escape)         | CommandPalette | N/A          | -                              |
| Close (backdrop click) | CommandPalette | N/A          | -                              |
| Search/filter          | CommandPalette | N/A          | `aria-label="Search commands"` |
| Navigate (arrow keys)  | CommandPalette | N/A          | -                              |
| Select (Enter/click)   | CommandPalette | 44x44px      | -                              |

#### ARIA & Accessibility

- Dialog: `aria-label="Command palette"`, `role="dialog"`
- Input: `aria-label="Search commands"`
- Items: `min-h-[44px]` touch targets
- Animation: `motion-reduce:animate-none`

#### Integrations with Earlier Phases

- Navigation to `/projects` (Phase 1)
- Navigation to `/vault` (Phase 2)
- Navigation to `/citations` (Phase 5)
- Action: New Project (Phase 1)

#### E2E Tests Specified

**NONE** - Unit tests only

#### Gap Analysis

| Gap                            | Severity | Recommendation                 |
| ------------------------------ | -------- | ------------------------------ |
| No keyboard shortcut E2E test  | HIGH     | Test Cmd+K / Ctrl+K            |
| No navigation command E2E test | HIGH     | Test navigation actually works |
| No touch target E2E test       | MEDIUM   | Verify 44px items              |
| No ARIA dialog E2E test        | MEDIUM   | Test dialog attributes         |
| No empty state E2E test        | LOW      | Test "no results" display      |

**Recommended Page Object (create at 6.6):**

```typescript
// e2e/pages/CommandPalettePage.ts - AS SPECIFIED IN 6.7, BUT NEEDED EARLIER
export class CommandPalettePage {
  async open() {
    await this.page.keyboard.press('Meta+k');
  }
  async close() {
    await this.page.keyboard.press('Escape');
  }
  async search(query: string) {}
  async selectOption(name: string | RegExp) {}
  // ... etc
}
```

**Recommended E2E Tests to Add at Step 6.6:**

```typescript
// e2e/command-palette/command-palette-integration.spec.ts
test.describe('Command Palette', () => {
  test('Cmd+K opens palette', async ({ page }) => {
    await page.goto('/projects');
    await page.keyboard.press('Meta+k');
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
  });

  test('navigation command navigates to vault', async ({ page }) => {
    await page.goto('/projects');
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /vault/i }).click();
    await expect(page).toHaveURL(/\/vault/);
  });

  test('items meet 44px touch target', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const item = page.getByRole('option').first();
    const box = await item.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
```

**When to Run E2E:** After Step 6.6 completion (CRITICAL - not specified)

---

### Task 6.7: E2E Tests

#### What's Defined

- **Page Objects:** ExportPage, ToastPage, CommandPalettePage, MobileNavPage
- **Test Suites:**
  - `e2e/export/export-flows.spec.ts`
  - `e2e/toast/toast-flows.spec.ts`
  - `e2e/command-palette/command-palette.spec.ts`
  - `e2e/accessibility/unauthenticated.spec.ts`
  - `e2e/accessibility/authenticated.spec.ts`
  - `e2e/mobile/navigation.spec.ts`

#### Gap Analysis

| Gap                                  | Severity | Recommendation                               |
| ------------------------------------ | -------- | -------------------------------------------- |
| Tests too late in pipeline           | HIGH     | Should be incremental per step               |
| Missing TIMEOUTS extension           | MEDIUM   | Need `TOAST_AUTO_DISMISS`, `EXPORT_DOWNLOAD` |
| Missing `e2e/pages/` directory check | LOW      | Verify path matches existing convention      |

---

## Integration with Earlier Phases

### Phase 0/1 Integration Points (Must Test)

| Integration                 | Component | Test Required                                 |
| --------------------------- | --------- | --------------------------------------------- |
| Auth flow with app shell    | AppShell  | Verify redirect to login when unauthenticated |
| Project list in sidebar     | Sidebar   | Verify navigation to projects                 |
| Document editor with export | Export    | Verify export from editor page                |

### Phase 2 Integration Points (Must Test)

| Integration       | Component         | Test Required             |
| ----------------- | ----------------- | ------------------------- |
| Vault navigation  | Sidebar/MobileNav | Test `/vault` route works |
| Vault with toasts | Toast             | Test upload success toast |

### Phase 3/4 Integration Points (Must Test)

| Integration                      | Component     | Test Required                     |
| -------------------------------- | ------------- | --------------------------------- |
| AI streaming with error boundary | ErrorBoundary | Test AI timeout doesn't break app |
| Chat with toasts                 | Toast         | Test AI response notifications    |

### Phase 5 Integration Points (Must Test)

| Integration                  | Component              | Test Required               |
| ---------------------------- | ---------------------- | --------------------------- |
| Citations navigation         | Sidebar/CommandPalette | Test `/citations` route     |
| Citation addition with toast | Toast                  | Test citation success toast |

---

## Missing TIMEOUTS Constants

The plan specifies adding these to `e2e/config/timeouts.ts`:

```typescript
// REQUIRED ADDITIONS (Step 6.7 specifies, but not currently in file)
export const TIMEOUTS = {
  // ... existing ...

  // Phase 6 additions
  TOAST_AUTO_DISMISS: 7000, // 5s default + 2s buffer
  EXPORT_DOWNLOAD: 30000, // PDF can be slow
  COMMAND_PALETTE: 500, // Animation time
} as const;

export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST }; // Already exists
export const EXPORT_WAIT = { timeout: TIMEOUTS.EXPORT_DOWNLOAD }; // MISSING
```

---

## Comprehensive Recommendations

### 1. Add Step-Level E2E Verification Requirements

Each step should have a "Run E2E Tests" substep before commit:

| Step | E2E Tests to Run                                     |
| ---- | ---------------------------------------------------- |
| 6.1  | `npm run test:e2e -- --grep "Export.*API"`           |
| 6.2  | `npm run test:e2e -- --grep "PDF.*API"`              |
| 6.3  | `npm run test:e2e -- --grep "App Shell\|Navigation"` |
| 6.4  | `npm run test:e2e -- --grep "Error\|Loading"`        |
| 6.5  | `npm run test:e2e -- --grep "Toast"`                 |
| 6.6  | `npm run test:e2e -- --grep "Command Palette"`       |
| 6.7  | `npm run test:e2e` (all tests)                       |

### 2. Create Page Objects Incrementally

Instead of creating all Page Objects in Step 6.7, create them as components are built:

| Step | Page Object to Create                 |
| ---- | ------------------------------------- |
| 6.3  | `AppShellPage.ts`, `MobileNavPage.ts` |
| 6.5  | `ToastPage.ts`                        |
| 6.6  | `CommandPalettePage.ts`               |
| 6.7  | `ExportPage.ts` (needs all export UI) |

### 3. Add Missing E2E Test Files

Create these test files incrementally:

```
e2e/
  export/
    docx-api.spec.ts       # After 6.1
    pdf-api.spec.ts        # After 6.2
    export-flows.spec.ts   # After 6.7 (UI exists)
  navigation/
    app-shell.spec.ts      # After 6.3
    mobile-nav.spec.ts     # After 6.3
  error-handling/
    error-states.spec.ts   # After 6.4
  toast/
    toast-integration.spec.ts  # After 6.5
  command-palette/
    command-palette.spec.ts    # After 6.6
  accessibility/
    touch-targets.spec.ts      # After 6.3
    aria-attributes.spec.ts    # After 6.5
```

### 4. Add Touch Target Test Pattern

Create a reusable test helper:

```typescript
// e2e/helpers/touch-targets.ts
export async function verifyTouchTargets(page: Page, selector: string) {
  const elements = page.locator(selector);
  const count = await elements.count();

  for (let i = 0; i < count; i++) {
    const element = elements.nth(i);
    if (await element.isVisible()) {
      const box = await element.boundingBox();
      if (box) {
        expect(box.height, `Element ${i} height`).toBeGreaterThanOrEqual(44);
        expect(box.width, `Element ${i} width`).toBeGreaterThanOrEqual(44);
      }
    }
  }
}
```

### 5. Add Accessibility Test per Step

Each step creating UI should include `checkA11y()`:

```typescript
// In each step's E2E test file
test('has no accessibility violations', async ({ page }) => {
  await page.goto('/projects'); // Or relevant page
  await checkA11y(page, { detailedReport: true });
});
```

---

## Summary Table: E2E Test Requirements by Step

| Step | Unit Tests | E2E Tests Specified | E2E Tests Needed                | Run E2E at Completion |
| ---- | ---------- | ------------------- | ------------------------------- | --------------------- |
| 6.1  | Yes        | No                  | API auth, validation            | No (should be Yes)    |
| 6.2  | Yes        | No                  | API auth, timeout               | No (should be Yes)    |
| 6.3  | Yes        | No                  | Navigation, a11y, touch targets | No (should be Yes)    |
| 6.4  | Yes        | No                  | Error recovery, focus mgmt      | No (should be Yes)    |
| 6.5  | Yes        | No                  | Toast appearance, ARIA          | No (should be Yes)    |
| 6.6  | Yes        | No                  | Keyboard, navigation            | No (should be Yes)    |
| 6.7  | N/A        | Yes (comprehensive) | Already specified               | Yes                   |

---

## Action Items

### HIGH Priority

1. **Add E2E verification requirement to Steps 6.1-6.6**
   - Each step should run relevant E2E tests before commit

2. **Create Page Objects incrementally**
   - Move `MobileNavPage.ts`, `ToastPage.ts`, `CommandPalettePage.ts` creation to earlier steps

3. **Add touch target E2E tests for all interactive elements**
   - Every button must be verified at 44x44px minimum

4. **Add accessibility integration tests per step**
   - Use existing `checkA11y()` helper from Phase 0

### MEDIUM Priority

5. **Add TIMEOUTS constants before Step 6.7**
   - `TOAST_AUTO_DISMISS`, `EXPORT_DOWNLOAD`, `COMMAND_PALETTE`

6. **Add integration tests with earlier phases**
   - Test vault navigation, citation navigation, AI error handling

7. **Add reduced motion E2E tests**
   - Use `page.emulateMedia({ reducedMotion: 'reduce' })`

### LOW Priority

8. **Add visual regression testing consideration**
   - Plan mentions Percy/Playwright snapshots as optional

---

## Conclusion

The Phase 6 plan has comprehensive unit test coverage but **defers all E2E testing to the final step (6.7)**. This is a high-risk pattern that can lead to:

1. **Late discovery of integration issues** - Problems between components won't surface until Step 6.7
2. **Disconnected components** - UI elements may not be properly connected to APIs/state
3. **Accessibility regressions** - Touch targets and ARIA attributes may not be verified early

**Recommendation:** Modify Steps 6.1-6.6 to include E2E test creation and execution as substeps, following the incremental testing pattern established in testing-best-practices.md.
