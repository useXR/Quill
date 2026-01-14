# Phase 6 Verification Checklist

> **Phase 6** | [← E2E Tests](./07-e2e-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 6 tasks are complete and working, including design system compliance.**

---

## E2E Test Files That Must Pass

**CRITICAL:** All of the following E2E test files must pass before Phase 6 is considered complete.

### Export Tests (Tasks 6.1-6.2)

| File                             | Test Coverage                                              |
| -------------------------------- | ---------------------------------------------------------- |
| `e2e/export/docx-export.spec.ts` | DOCX export menu visibility, download initiation, filename |
| `e2e/export/pdf-export.spec.ts`  | PDF export menu, download initiation, loading state        |

### Navigation Tests (Task 6.3)

| File                                | Test Coverage                                        |
| ----------------------------------- | ---------------------------------------------------- |
| `e2e/navigation/skip-links.spec.ts` | Skip link visibility, focus, main content navigation |
| `e2e/navigation/mobile-nav.spec.ts` | Drawer open/close, backdrop click, ARIA attributes   |
| `e2e/navigation/app-shell.spec.ts`  | Header, sidebar, collapse, touch targets             |

### Error Handling Tests (Task 6.4)

| File                                | Test Coverage                                          |
| ----------------------------------- | ------------------------------------------------------ |
| `e2e/errors/error-handling.spec.ts` | Error boundary UI, skeletons, error page accessibility |

### Toast Tests (Task 6.5)

| File                              | Test Coverage                                        |
| --------------------------------- | ---------------------------------------------------- |
| `e2e/notifications/toast.spec.ts` | Toast appearance, auto-dismiss, manual dismiss, ARIA |

### Command Palette Tests (Task 6.6)

| File                                     | Test Coverage                                                   |
| ---------------------------------------- | --------------------------------------------------------------- |
| `e2e/navigation/command-palette.spec.ts` | Keyboard shortcuts, search, navigation, keyboard-only operation |

### Integration & Audit Tests (Task 6.7)

| File                                           | Test Coverage                                          |
| ---------------------------------------------- | ------------------------------------------------------ |
| `e2e/integration/phase-integration.spec.ts`    | Phase 0-5 features work in new shell                   |
| `e2e/accessibility/touch-target-audit.spec.ts` | 44px touch target verification across all pages        |
| `e2e/accessibility/full-audit.spec.ts`         | axe-core audit on all pages and interactive components |

### Run All Phase 6 E2E Tests

```bash
# Run all Phase 6 E2E tests
npm run test:e2e -- e2e/export e2e/navigation e2e/errors e2e/notifications e2e/integration e2e/accessibility

# Or by grep pattern
npm run test:e2e -- --grep "DOCX Export|PDF Export|Skip Links|Mobile Navigation|App Shell|Error Handling|Toast|Command Palette|Phase Integration|Touch Target|Accessibility Audit"
```

**Expected:** ALL tests must pass (0 failures)

---

## Design System Verification

Before verifying functionality, confirm all UI components implement the **Scholarly Craft** design system from `docs/design-system.md`:

### Visual Verification Checklist

- [ ] **Background:** Pages use `bg-bg-primary` (#faf8f5 warm cream), not white
- [ ] **Typography:** Headings use `font-display` (Libre Baskerville), UI uses `font-ui` (Source Sans 3)
- [ ] **Colors:** Brand accent is `bg-quill` (#7c3aed), not blue
- [ ] **Buttons:** Use `bg-quill hover:bg-quill-dark`, `rounded-md`, `shadow-sm`
- [ ] **Focus Rings:** All interactive elements show `ring-quill` on focus
- [ ] **Borders:** Use `border-ink-faint` (#d6d3d1), not gray
- [ ] **Toasts:** Use semantic colors (`bg-success-light`, `bg-error-light`, etc.)

### Accessibility Verification

- [ ] All buttons meet 44x44px touch target (`min-h-[44px] min-w-[44px]`)
- [ ] Focus rings visible on keyboard navigation
- [ ] Reduced motion: Animations disabled with `prefers-reduced-motion`
- [ ] Color contrast: All text meets WCAG AA (4.5:1 for text, 3:1 for UI)

---

## Automated Verification

Run this script to verify the build and tests pass:

```bash
#!/bin/bash
set -e

echo "=== Phase 6 Verification ==="

echo "1. Building project..."
npm run build

echo "2. Running unit tests..."
npm test

echo "3. Running E2E tests..."
npm run test:e2e

echo "=== All checks passed! ==="
```

---

## Manual Verification Steps

### 1. Export Functionality

```bash
# Start dev server
npm run dev
```

- [ ] Navigate to a document with content
- [ ] Click Export > DOCX
- [ ] Verify `.docx` file downloads with correct filename
- [ ] Open in Word - verify formatting preserved
- [ ] Click Export > PDF
- [ ] Verify `.pdf` file downloads with correct filename
- [ ] Open PDF - verify styling and page numbers

### 2. App Shell & Navigation

- [ ] App shell displays on all authenticated pages
- [ ] Sidebar visible on desktop (1024px+)
- [ ] Sidebar collapses on tablet (768px-1023px)
- [ ] Hamburger menu visible on mobile (<768px)
- [ ] Mobile drawer opens/closes correctly
- [ ] Navigation links highlight active route
- [ ] Skip link appears on Tab and navigates to main content

### 3. User Menu

- [ ] User menu button visible in header
- [ ] Menu opens on click
- [ ] Menu closes on outside click
- [ ] Menu closes on Escape key
- [ ] Settings link navigates to /settings
- [ ] Sign out redirects to /login

### 4. Loading States

- [ ] Loading spinner shows during page transitions
- [ ] Skeleton placeholders show while data loads
- [ ] Document list skeleton shows 5 items
- [ ] Editor skeleton shows toolbar + content

### 5. Error Handling

- [ ] ErrorBoundary catches component errors
- [ ] Error page shows user-friendly message
- [ ] Retry button attempts recovery
- [ ] Network errors show appropriate message

### 6. Toast Notifications

- [ ] Success toast appears on project creation
- [ ] Error toast appears on failed operations
- [ ] Toast auto-dismisses after timeout (5s success, 10s error)
- [ ] Manual dismiss button works
- [ ] Multiple toasts stack correctly

### 7. Command Palette

- [ ] Cmd+K (Mac) / Ctrl+K (Windows) opens palette
- [ ] Search input filters commands
- [ ] Arrow keys navigate items
- [ ] Enter selects item
- [ ] Escape closes palette
- [ ] Backdrop click closes palette
- [ ] Navigation commands work (Projects, Vault)
- [ ] Action commands work (New Project)

### 8. Accessibility

```bash
# Run accessibility audit
npm run test:e2e -- --grep "accessibility"
```

- [ ] All pages pass axe-core audit
- [ ] Skip link navigates to main content
- [ ] All interactive elements keyboard accessible
- [ ] Color contrast meets WCAG AA
- [ ] ARIA attributes correct on all components
- [ ] Screen reader announces toasts (aria-live)
- [ ] Focus management works in modals

---

## File Checklist

### Task 6.1 - DOCX Export

- [ ] `src/lib/export/html-to-docx.ts` exists
- [ ] `src/lib/export/docx-styles.ts` exists
- [ ] `src/lib/export/docx.ts` exists
- [ ] `src/lib/export/__tests__/html-to-docx.test.ts` exists
- [ ] `src/app/api/export/docx/route.ts` exists

### Task 6.2 - PDF Export

- [ ] `src/lib/export/pdf-styles.ts` exists
- [ ] `src/lib/export/pdf.ts` exists
- [ ] `src/lib/export/__tests__/pdf.test.ts` exists
- [ ] `src/app/api/export/pdf/route.ts` exists

### Task 6.3 - App Shell & Navigation

- [ ] `src/hooks/useMediaQuery.ts` exists
- [ ] `src/hooks/__tests__/useMediaQuery.test.ts` exists
- [ ] `src/components/layout/SkipLinks.tsx` exists
- [ ] `src/components/layout/UserMenu.tsx` exists
- [ ] `src/components/layout/__tests__/UserMenu.test.tsx` exists
- [ ] `src/components/layout/Header.tsx` exists
- [ ] `src/components/layout/Sidebar.tsx` exists
- [ ] `src/components/layout/MobileNav.tsx` exists
- [ ] `src/components/layout/AppShell.tsx` exists
- [ ] `src/components/layout/AppProviders.tsx` exists

### Task 6.4 - Loading States & Error Handling

- [ ] `src/lib/errors.ts` exists
- [ ] `src/lib/__tests__/errors.test.ts` exists
- [ ] `src/components/ui/Skeleton.tsx` exists
- [ ] `src/components/ui/__tests__/Skeleton.test.tsx` exists
- [ ] `src/components/ui/Spinner.tsx` exists
- [ ] `src/components/ui/ErrorFallback.tsx` exists
- [ ] `src/components/ui/ErrorBoundary.tsx` exists
- [ ] `src/app/error.tsx` exists
- [ ] `src/app/loading.tsx` exists

### Task 6.5 - Toast Notifications

- [ ] `src/hooks/useToast.ts` exists
- [ ] `src/hooks/__tests__/useToast.test.ts` exists
- [ ] `src/components/ui/Toast.tsx` exists
- [ ] `src/components/ui/__tests__/Toast.test.tsx` exists

### Task 6.6 - Command Palette

- [ ] `src/components/ui/CommandPalette.tsx` exists
- [ ] `src/components/ui/__tests__/CommandPalette.test.tsx` exists

### Task 6.1-6.6 - Incremental E2E Tests

**Export Tests:**

- [ ] `e2e/export/docx-export.spec.ts` exists and passes
- [ ] `e2e/export/pdf-export.spec.ts` exists and passes

**Navigation Tests:**

- [ ] `e2e/navigation/skip-links.spec.ts` exists and passes
- [ ] `e2e/navigation/mobile-nav.spec.ts` exists and passes
- [ ] `e2e/navigation/app-shell.spec.ts` exists and passes
- [ ] `e2e/navigation/command-palette.spec.ts` exists and passes

**Error & Notification Tests:**

- [ ] `e2e/errors/error-handling.spec.ts` exists and passes
- [ ] `e2e/notifications/toast.spec.ts` exists and passes

### Task 6.7 - Integration & Audit Tests

**Integration Tests:**

- [ ] `e2e/integration/phase-integration.spec.ts` exists and passes

**Accessibility Audits:**

- [ ] `e2e/accessibility/touch-target-audit.spec.ts` exists and passes
- [ ] `e2e/accessibility/full-audit.spec.ts` exists and passes

**Page Objects Created:**

- [ ] `e2e/pages/ExportPage.ts` exists
- [ ] `e2e/pages/ToastPage.ts` exists
- [ ] `e2e/pages/CommandPalettePage.ts` exists
- [ ] `e2e/pages/MobileNavPage.ts` exists

**Timeout Constants Added to `e2e/config/timeouts.ts`:**

- [ ] `TIMEOUTS.EXPORT_DOWNLOAD` (30000ms) added
- [ ] `TIMEOUTS.TOAST_AUTO_DISMISS` (7000ms) added

---

## Summary

| Task                                | Status |
| ----------------------------------- | ------ |
| 6.1 DOCX Export                     | [ ]    |
| 6.2 PDF Export                      | [ ]    |
| 6.3 App Shell & Navigation          | [ ]    |
| 6.4 Loading States & Error Handling | [ ]    |
| 6.5 Toast Notifications             | [ ]    |
| 6.6 Command Palette                 | [ ]    |
| 6.7 E2E Tests                       | [ ]    |

---

## Phase 6 Complete

**All checks passing? Phase 6 is complete!**

The MVP is now feature-complete with:

- Document export (DOCX/PDF) with professional academic styling
- Responsive app shell implementing **Scholarly Craft** design system
- Loading states and error handling with brand-consistent UI
- Toast notifications with semantic color tokens
- Command palette with design system integration
- Comprehensive E2E test suite including accessibility validation
- WCAG 2.1 AA accessibility compliance throughout

### Design System Implementation Summary

All UI components now use tokens from `docs/design-system.md`:

| Token Category | Example Tokens Used                                       |
| -------------- | --------------------------------------------------------- |
| Typography     | `font-display`, `font-ui`, `font-prose`                   |
| Colors         | `bg-bg-primary`, `text-ink-primary`, `bg-quill`           |
| Semantic       | `bg-success-light`, `text-error-dark`, `bg-warning-light` |
| Interactive    | `hover:bg-surface-hover`, `focus:ring-quill`              |
| Spacing        | `min-h-[44px]` touch targets, `rounded-md` borders        |

---

## Full E2E Regression Suite

Before marking Phase 6 complete, run the FULL E2E suite covering ALL phases:

```bash
npm run test:e2e
```

**Requirements:**

- All Phase 0-6 E2E tests must pass
- Zero test failures allowed
- Test report must be reviewed for flaky tests

---

**Next steps:** Deploy to production or proceed to post-MVP enhancements.
