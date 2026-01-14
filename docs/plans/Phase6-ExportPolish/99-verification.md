# Phase 6 Verification Checklist

> **Phase 6** | [← E2E Tests](./07-e2e-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 6 tasks are complete and working.**

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

### Task 6.7 - E2E Tests

- [ ] `e2e/auth.setup.ts` exists
- [ ] `e2e/fixtures/auth.ts` exists
- [ ] `e2e/page-objects/BasePage.ts` exists
- [ ] `e2e/page-objects/EditorPage.ts` exists
- [ ] `e2e/page-objects/ProjectsPage.ts` exists
- [ ] `e2e/auth-flows.spec.ts` exists
- [ ] `e2e/export-flows.spec.ts` exists
- [ ] `e2e/toast-flows.spec.ts` exists
- [ ] `e2e/command-palette.spec.ts` exists
- [ ] `e2e/accessibility.spec.ts` exists
- [ ] `e2e/accessibility-authenticated.spec.ts` exists
- [ ] `e2e/mobile-navigation.spec.ts` exists
- [ ] `e2e/seed-test-data.ts` exists
- [ ] `playwright.config.ts` updated
- [ ] `.gitignore` updated

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

- Document export (DOCX/PDF)
- Responsive app shell with navigation
- Loading states and error handling
- Toast notifications
- Command palette
- Comprehensive E2E test suite
- WCAG-compliant accessibility

**Next steps:** Deploy to production or proceed to post-MVP enhancements.
