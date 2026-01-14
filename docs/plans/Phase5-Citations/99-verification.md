# Phase 5 Verification Checklist

> **Phase 5** | [← E2E Tests](./08-e2e-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 5 tasks are complete and working.** Run all verification steps before marking Phase 5 as complete.

### Design System Compliance

All UI components must implement the **Scholarly Craft** design system from `docs/design-system.md`. This verification includes:

- Typography: Libre Baskerville (`font-display`) for titles, Source Sans 3 (`font-ui`) for UI
- Colors: Quill brand palette, semantic status colors, warm cream backgrounds
- Spacing: Consistent use of 4px-based scale
- Shadows: Warm-tinted shadows for paper aesthetic
- Motion: Unhurried transitions (150-200ms), reduced motion support

---

## Automated Verification

Run this script to verify all tests pass:

```bash
#!/bin/bash
set -e

echo "=== Phase 5 Verification ==="
echo ""

echo "1. Running type check..."
npm run typecheck

echo ""
echo "2. Running Semantic Scholar client tests..."
npm test src/lib/citations/__tests__/semantic-scholar.test.ts -- --coverage

echo ""
echo "3. Running TipTap extension tests..."
npm test src/components/editor/extensions/__tests__/citation.test.ts

echo ""
echo "4. Running Citations API tests..."
npm test src/lib/api/__tests__/citations.test.ts

echo ""
echo "5. Running component tests..."
npm test src/components/citations/

echo ""
echo "6. Running formatter tests..."
npm test src/lib/citations/__tests__/formatter.test.ts

echo ""
echo "7. Running E2E tests..."
npm run test:e2e e2e/citations/

echo ""
echo "8. Running build..."
npm run build

echo ""
echo "=== All Phase 5 Verifications Passed ==="
```

Save as `scripts/verify-phase5.sh` and run:

```bash
chmod +x scripts/verify-phase5.sh
./scripts/verify-phase5.sh
```

---

## Manual Verification Steps

### 1. Semantic Scholar Client

```bash
npm test src/lib/citations/__tests__/semantic-scholar.test.ts -- --coverage
```

- [ ] All 13+ tests pass
- [ ] `searchPapers` function exists
- [ ] `searchPapersWithCache` function exists
- [ ] `getPaper` function exists
- [ ] `clearCache` function exists
- [ ] `resetRateLimitState` function exists
- [ ] Error handling works (SemanticScholarError)
- [ ] Rate limiting implemented
- [ ] Coverage > 90%

### 2. TipTap Extension

```bash
npm test src/components/editor/extensions/__tests__/citation.test.ts
```

- [ ] All 5 tests pass
- [ ] `Citation` extension registered
- [ ] `setCitation` command works
- [ ] `unsetCitation` command works
- [ ] HTML parsing works
- [ ] HTML rendering works

### 3. Database Migration

```bash
npx supabase db diff
```

- [ ] Migration file exists
- [ ] `paper_id` column added to citations
- [ ] `deleted_at` column added to citations (soft delete)
- [ ] `document_citations` table created
- [ ] RLS policies with soft delete filter:
  - [ ] `Users can view own non-deleted citations` (SELECT excludes soft-deleted)
  - [ ] `Users can create citations in own projects` (INSERT)
  - [ ] `Users can update own citations` (UPDATE)
  - [ ] `Users can delete own citations` (DELETE)
- [ ] `get_next_citation_number` function exists
- [ ] `cleanup_expired_citations` function exists
- [ ] Indexes created for common query patterns
- [ ] Types regenerated

### 4. Citations API Helpers

```bash
npm test src/lib/api/__tests__/citations.test.ts
```

- [ ] All 10+ tests pass
- [ ] `citationLogger()` domain logger factory exists in `src/lib/citations/logger.ts`
- [ ] `getCitations` function exists
- [ ] `getCitation` function exists
- [ ] `createCitation` function exists
- [ ] `createCitationFromPaper` function exists
- [ ] `updateCitation` function exists
- [ ] `deleteCitation` function exists (soft delete via `deleted_at`)
- [ ] `restoreCitation` function exists
- [ ] `isDuplicateCitation` function exists
- [ ] Uses `citationLogger()` domain logger (not bare `logger`)
- [ ] Audit logging via `createAuditLog()` helper

### 5. API Routes

Test manually or via curl:

```bash
# Test search endpoint
curl "http://localhost:3000/api/citations/search?q=test"

# Test list endpoint (requires auth)
curl "http://localhost:3000/api/citations?projectId=<uuid>"
```

- [ ] GET /api/citations works
- [ ] POST /api/citations works
- [ ] GET /api/citations/[id] works
- [ ] PATCH /api/citations/[id] works
- [ ] DELETE /api/citations/[id] works
- [ ] GET /api/citations/search works
- [ ] Server-side rate limiting returns 429
- [ ] Zod validation on all endpoints
- [ ] Next.js 16 async params pattern used (`params` awaited)
- [ ] Uses `validationError()`, `notFoundError()`, `rateLimitError()` helpers
- [ ] Uses `handleApiError()` pattern in catch blocks
- [ ] Uses `citationLogger()` domain logger (no bare `logger`)

### 6. UI Components

```bash
npm test src/components/citations/
```

- [ ] All component tests pass (15+ tests)
- [ ] CitationCard renders correctly
- [ ] CitationSearch works
  - [ ] Uses form element with `data-hydrated` attribute (hydration pattern)
  - [ ] Uses `aria-label` on search input
  - [ ] Uses AbortController for request cancellation (Infrastructure Phase 2)
  - [ ] Ignores AbortError on cancelled requests
- [ ] CitationList displays citations
  - [ ] Uses `ConfirmDialog` component (NOT `window.confirm()`)
  - [ ] Uses optimistic updates for delete (Infrastructure Phase 2)
  - [ ] Rolls back optimistic update on API failure
- [ ] CitationPicker opens and works
- [ ] Formatter outputs correct styles
- [ ] Loading states implemented for async buttons
- [ ] Reduced motion support (`motion-reduce:animate-none`) on all spinners
- [ ] No `window.confirm()` or `window.alert()` usage
- [ ] Error states handled via component state (no `console.error`)

### 6a. Design System Compliance

Verify UI components follow the Scholarly Craft design system (`docs/design-system.md`):

**Typography (Tailwind v4 `@theme` tokens)**

- [ ] Citation titles use `font-display` (Libre Baskerville)
- [ ] UI text (labels, buttons, metadata) uses `font-ui` (Source Sans 3)
- [ ] Text sizes follow scale: `text-xs`, `text-sm`, `text-base`, `text-lg`

**Colors**

- [ ] Cards use `bg-surface` background with `border-ink-faint`
- [ ] Primary text uses `text-ink-primary` (#1c1917)
- [ ] Secondary text uses `text-ink-secondary` (#44403c)
- [ ] Muted text uses `text-ink-tertiary` (#78716c)
- [ ] Primary buttons use `bg-quill hover:bg-quill-dark` (#7c3aed)
- [ ] Verified DOI badge uses `bg-success-light text-success`
- [ ] No DOI warning uses `bg-warning-light text-warning`
- [ ] Open Access badge uses `bg-info-light text-info`
- [ ] Error alerts use `bg-error-light text-error-dark`

**Spacing & Layout**

- [ ] Cards use `p-4` or `p-6` padding
- [ ] Badge spacing uses `px-2.5 py-1`
- [ ] Button padding uses `px-4 py-2.5`
- [ ] Grid gaps use `gap-4`

**Shadows & Radius**

- [ ] Cards at rest use `shadow-sm`
- [ ] Cards on hover use `shadow-md`
- [ ] Cards use `rounded-lg`
- [ ] Buttons and badges use `rounded-md`

**Motion & Interaction**

- [ ] Transitions use `duration-150` (buttons) or `duration-200` (cards)
- [ ] All spinners have `motion-reduce:animate-none`
- [ ] Focus states use `focus:ring-2 focus:ring-quill focus:ring-offset-2`

**Visual Audit (Manual)**

- [ ] Run dev server and visually inspect citation components
- [ ] Verify warm cream background (`#faf8f5`) on page
- [ ] Verify serif font on citation titles
- [ ] Verify badge colors match semantic meaning
- [ ] Verify hover states work correctly
- [ ] Verify focus rings visible on keyboard navigation

### 7. E2E Tests

```bash
npm run test:e2e e2e/citations/
```

#### E2E Test Infrastructure

- [ ] `e2e/fixtures/citation-mocks.ts` exists
- [ ] Page objects created in `e2e/pages/` (NOT `e2e/page-objects/`)
  - [ ] `CitationSearchPage.ts`
  - [ ] `CitationListPage.ts`
  - [ ] `CitationPickerPage.ts`
- [ ] Tests import from `../fixtures/test-fixtures` (NOT `@playwright/test`)
- [ ] Tests use `workerCtx` and `loginAsWorker` fixtures
- [ ] Tests import `TIMEOUTS` from `../config/timeouts.ts`
- [ ] Tests use `expect().toPass()` pattern for async operations
- [ ] Accessibility tests use `checkA11y()` from `../helpers/axe.ts`

#### E2E Test Files (REQUIRED)

All of the following E2E test files must exist and pass:

| Test File                                           | Purpose                                                    | Status |
| --------------------------------------------------- | ---------------------------------------------------------- | ------ |
| `e2e/citations/citations-api.spec.ts`               | API authentication (401), CRUD operations, rate limiting   | [ ]    |
| `e2e/citations/citation-search.spec.ts`             | Search UI, results, empty state, error state               | [ ]    |
| `e2e/citations/citation-management.spec.ts`         | List display, delete with ConfirmDialog, cancel delete     | [ ]    |
| `e2e/citations/citation-accessibility.spec.ts`      | axe-core audits, keyboard navigation, ARIA                 | [ ]    |
| `e2e/citations/citation-picker.spec.ts`             | Picker modal open/close, search, selection                 | [ ]    |
| `e2e/citations/citation-list.spec.ts`               | List rendering, empty state, delete interaction            | [ ]    |
| `e2e/citations/citation-editor-integration.spec.ts` | **CRITICAL**: Insert citation via picker, verify in editor | [ ]    |
| `e2e/citations/citation-navigation.spec.ts`         | Navigate to citations page, auth redirects                 | [ ]    |
| `e2e/citations/citation-optimistic-updates.spec.ts` | Optimistic delete, rollback on failure                     | [ ]    |
| `e2e/citations/citation-full-integration.spec.ts`   | Complete workflow: search, add, insert, save, verify       | [ ]    |

#### E2E Test Coverage Requirements

- [ ] All E2E tests pass (50+ tests total)
- [ ] Citation search works end-to-end
- [ ] Citation add works end-to-end
- [ ] Citation delete uses ConfirmDialog end-to-end
- [ ] **CRITICAL**: Citation insertion into editor via picker works
- [ ] **CRITICAL**: Citations page `/projects/${projectId}/citations` is accessible
- [ ] **CRITICAL**: Citation persists after save and reload
- [ ] Navigation from project/editor to citations page works
- [ ] Optimistic update rollback works on delete failure
- [ ] Error handling works
- [ ] Accessibility audits pass
- [ ] Authorization tests pass (user cannot access other user's citations)
- [ ] Duplicate citation returns 409 with existingId
- [ ] Cross-phase integration tests pass (autosave, formatting, hover tooltip)

#### Run Full E2E Suite

```bash
# Run all citation E2E tests
npm run test:e2e e2e/citations/

# Expected output: 50+ tests passing
# All test files listed above should be included in the run
```

---

## Comprehensive E2E Verification Gates

The following gates must be passed at specific points during implementation:

### Gate 1: After Task 5.14 (TipTap Extension)

```bash
# Verify citation extension doesn't break existing editor functionality
npm run test:e2e e2e/editor/
```

**All existing editor tests must pass before proceeding.**

### Gate 2: After Task 5.23 (API Routes)

```bash
npm run test:e2e e2e/citations/citations-api.spec.ts
```

**All API tests including authorization must pass before proceeding to Task 5.7.**

### Gate 3: After Task 5.23a (Citations Page Route)

```bash
npm run test:e2e e2e/citations/citation-navigation.spec.ts
```

**Page must load successfully before creating UI components.**

### Gate 4: After Task 5.27 (CitationSearch)

```bash
npm run test:e2e e2e/citations/citation-search.spec.ts
```

### Gate 5: After Task 5.29 (CitationList)

```bash
npm run test:e2e e2e/citations/citation-management.spec.ts
```

### Gate 6: After Task 5.31 (CitationPicker + Toolbar Integration)

```bash
npm run test:e2e e2e/citations/citation-editor-integration.spec.ts
```

### Gate 7: Final Verification

```bash
npm run test:e2e e2e/citations/
```

**All 50+ E2E tests must pass.**

### 8. Build

```bash
npm run build
```

- [ ] Build succeeds with no errors
- [ ] No TypeScript errors
- [ ] No unused exports warnings

---

## File Checklist

### Task 5.1 - Citation Types

- [ ] `src/lib/citations/types.ts` exists
- [ ] Paper interface defined
- [ ] SearchResult type defined
- [ ] SemanticScholarError class defined
- [ ] `src/lib/citations/schemas.ts` exists with Zod schemas
- [ ] `src/lib/citations/logger.ts` exists with `citationLogger()` factory
- [ ] `src/lib/citations/index.ts` barrel export exists (exports all, including logger)
- [ ] `src/lib/constants/citations.ts` exists with constants

### Tasks 5.2-5.12 - Semantic Scholar Client

- [ ] `src/lib/citations/semantic-scholar.ts` exists
- [ ] `src/lib/citations/__tests__/semantic-scholar.test.ts` exists
- [ ] Test factories added to `src/test-utils/factories.ts`:
  - [ ] `createMockPaper()`
  - [ ] `createMockCitation()`
  - [ ] `createMockSearchResponse()`
- [ ] Tests mock `citationLogger` (Best Practice: Phase 2-3)

### Tasks 5.13-5.14 - TipTap Extension

- [ ] `src/components/editor/extensions/citation.ts` exists
- [ ] `src/components/editor/extensions/__tests__/citation.test.ts` exists
- [ ] **CRITICAL**: Citation extension added to `createExtensions()` in `extensions/index.ts`
- [ ] **CRITICAL**: Editor integration test verifies citation commands are available

### Tasks 5.15-5.16 - Database Migration

- [ ] `supabase/migrations/*_citation_enhancements.sql` exists
- [ ] `src/lib/api/__tests__/citation-db.integration.test.ts` exists

### Tasks 5.17-5.20 - Citations API Helpers

- [ ] `src/lib/api/citations.ts` exists
- [ ] `src/lib/api/__tests__/citations.test.ts` exists

### Tasks 5.21-5.23 - API Routes

- [ ] `src/app/api/citations/route.ts` exists
- [ ] `src/app/api/citations/[id]/route.ts` exists
- [ ] `src/app/api/citations/search/route.ts` exists
- [ ] `src/app/api/citations/__tests__/route.test.ts` exists

### Task 5.23a - Citations Page Route (CRITICAL)

- [ ] **CRITICAL**: `src/app/projects/[id]/citations/page.tsx` exists
- [ ] Page requires authentication (redirects to login)
- [ ] Page verifies user owns the project
- [ ] Page renders CitationSearch and CitationList components
- [ ] Next.js 16 async params pattern used (`params` awaited)
- [ ] Unit test exists: `src/app/projects/[id]/citations/__tests__/page.test.tsx`

### Tasks 5.24-5.32 - UI Components

- [ ] `src/components/citations/CitationCard.tsx` exists
- [ ] `src/components/citations/CitationSearch.tsx` exists
- [ ] `src/components/citations/CitationList.tsx` exists
- [ ] `src/components/citations/CitationPicker.tsx` exists
- [ ] `src/lib/citations/formatter.ts` exists
- [ ] Test files for all components exist
- [ ] **CRITICAL**: CitationPicker trigger button added to editor toolbar (`src/components/editor/Toolbar.tsx`)
- [ ] **CRITICAL**: CitationPicker wired to insert citations via `editor.commands.setCitation()`

### Tasks 5.33-5.35 - E2E Tests

#### Fixtures and Page Objects

- [ ] `e2e/fixtures/citation-mocks.ts` exists
- [ ] `e2e/pages/CitationSearchPage.ts` exists (in `pages/`, NOT `page-objects/`)
- [ ] `e2e/pages/CitationListPage.ts` exists
- [ ] `e2e/pages/CitationPickerPage.ts` exists

#### E2E Test Files (ALL REQUIRED)

- [ ] `e2e/citations/citations-api.spec.ts` exists (API auth, CRUD, rate limiting)
- [ ] `e2e/citations/citations-api.spec.ts` includes Authorization tests (403 for other user, 409 for duplicate)
- [ ] `e2e/citations/citation-search.spec.ts` exists (search UI)
- [ ] `e2e/citations/citation-management.spec.ts` exists (list, delete)
- [ ] `e2e/citations/citation-accessibility.spec.ts` exists (a11y)
- [ ] `e2e/citations/citation-picker.spec.ts` exists (picker modal)
- [ ] `e2e/citations/citation-list.spec.ts` exists (list display)
- [ ] **CRITICAL**: `e2e/citations/citation-editor-integration.spec.ts` exists (insert into editor)
- [ ] `e2e/citations/citation-navigation.spec.ts` exists (page navigation)
- [ ] `e2e/citations/citation-optimistic-updates.spec.ts` exists (rollback on failure)
- [ ] `e2e/citations/citation-full-integration.spec.ts` exists (end-to-end workflow)
- [ ] `e2e/citations/citation-cross-phase-integration.spec.ts` exists (Phase 1/6 integration)

---

## Summary

| Task      | Description                               | Status |
| --------- | ----------------------------------------- | ------ |
| 5.1       | Citation Types                            | [ ]    |
| 5.2-5.12  | Semantic Scholar Client                   | [ ]    |
| 5.13-5.14 | TipTap Extension + **Editor Integration** | [ ]    |
| 5.15-5.16 | Database Migration                        | [ ]    |
| 5.17-5.20 | Citations API Helpers                     | [ ]    |
| 5.21-5.23 | API Routes + **E2E Tests**                | [ ]    |
| 5.23a     | **Citations Page Route (CRITICAL)**       | [ ]    |
| 5.24-5.32 | UI Components + **Toolbar Integration**   | [ ]    |
| 5.33-5.35 | E2E Tests + **Extended Coverage**         | [ ]    |
| -         | Design System Compliance                  | [ ]    |

---

## Test Coverage Summary

| Category              | Tests   | Coverage Target |
| --------------------- | ------- | --------------- |
| Semantic Scholar      | 13+     | > 90%           |
| TipTap Extension      | 5+      | > 80%           |
| Citations API         | 10+     | > 80%           |
| Components            | 15+     | > 70%           |
| Citations Page        | 2+      | > 70%           |
| E2E (Total)           | 50+     | N/A             |
| - API Tests           | 6+      | -               |
| - Authorization Tests | 3+      | -               |
| - Search Tests        | 7+      | -               |
| - Management Tests    | 4+      | -               |
| - Accessibility Tests | 8+      | -               |
| - Editor Integration  | 4+      | -               |
| - Navigation Tests    | 4+      | -               |
| - Optimistic Updates  | 2+      | -               |
| - Full Integration    | 2+      | -               |
| - Cross-Phase Tests   | 6+      | -               |
| **Total**             | **95+** | **> 80%**       |

---

## Phase 5 Complete

**All checks passing?** Phase 5 is complete!

### What Was Accomplished

1. **Semantic Scholar Integration** - Full API client with caching and rate limiting
2. **TipTap Citation Extension** - Editor mark for inline citations + **editor integration**
3. **Database Schema** - Enhanced citations table with document relationships
4. **API Layer** - Complete CRUD operations for citations + **E2E API tests**
5. **Citations Page Route** - `/projects/${projectId}/citations` page with auth
6. **UI Components** - Search, list, card, and picker components + **toolbar integration**
7. **E2E Tests** - Comprehensive browser-based testing with **45+ tests** covering:
   - API authentication and CRUD
   - Search, list, and picker UI
   - **Citation insertion into editor via picker**
   - **Citation persistence across save/reload**
   - Navigation and auth redirects
   - Optimistic update rollback
   - Accessibility compliance

### Next Phase

Proceed to **Phase 6** or continue with additional features as specified in the project roadmap.

---

## Final Commit

After all verification passes:

```bash
git add .
git commit -m "feat(phase5): complete citations & research implementation

- Semantic Scholar client with TDD
- TipTap citation mark extension
- Database schema enhancements
- Citations API with CRUD operations
- React components for citation management
- E2E tests with Playwright

All tests passing, coverage > 80%"
```
