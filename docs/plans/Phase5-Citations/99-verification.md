# Phase 5 Verification Checklist

> **Phase 5** | [← E2E Tests](./08-e2e-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 5 tasks are complete and working.** Run all verification steps before marking Phase 5 as complete.

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
- [ ] Next.js 15 async params pattern used (`params` awaited)
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

### 7. E2E Tests

```bash
npm run test:e2e e2e/citations/
```

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
- [ ] All E2E tests pass (10+ tests)
- [ ] Citation search works end-to-end
- [ ] Citation add works end-to-end
- [ ] Citation delete uses ConfirmDialog end-to-end
- [ ] Error handling works
- [ ] Accessibility audits pass

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

### Tasks 5.24-5.32 - UI Components

- [ ] `src/components/citations/CitationCard.tsx` exists
- [ ] `src/components/citations/CitationSearch.tsx` exists
- [ ] `src/components/citations/CitationList.tsx` exists
- [ ] `src/components/citations/CitationPicker.tsx` exists
- [ ] `src/lib/citations/formatter.ts` exists
- [ ] Test files for all components exist

### Tasks 5.33-5.35 - E2E Tests

- [ ] `e2e/fixtures/citation-mocks.ts` exists
- [ ] `e2e/pages/CitationSearchPage.ts` exists (in `pages/`, NOT `page-objects/`)
- [ ] `e2e/pages/CitationListPage.ts` exists
- [ ] `e2e/pages/CitationPickerPage.ts` exists
- [ ] `e2e/citations/citation-search.spec.ts` exists
- [ ] `e2e/citations/citation-management.spec.ts` exists
- [ ] `e2e/citations/citation-accessibility.spec.ts` exists

---

## Summary

| Task      | Description             | Status |
| --------- | ----------------------- | ------ |
| 5.1       | Citation Types          | [ ]    |
| 5.2-5.12  | Semantic Scholar Client | [ ]    |
| 5.13-5.14 | TipTap Extension        | [ ]    |
| 5.15-5.16 | Database Migration      | [ ]    |
| 5.17-5.20 | Citations API Helpers   | [ ]    |
| 5.21-5.23 | API Routes              | [ ]    |
| 5.24-5.32 | UI Components           | [ ]    |
| 5.33-5.35 | E2E Tests               | [ ]    |

---

## Test Coverage Summary

| Category         | Tests   | Coverage Target |
| ---------------- | ------- | --------------- |
| Semantic Scholar | 13+     | > 90%           |
| TipTap Extension | 5       | > 80%           |
| Citations API    | 10+     | > 80%           |
| Components       | 15+     | > 70%           |
| E2E              | 10+     | N/A             |
| **Total**        | **53+** | **> 80%**       |

---

## Phase 5 Complete

**All checks passing?** Phase 5 is complete!

### What Was Accomplished

1. **Semantic Scholar Integration** - Full API client with caching and rate limiting
2. **TipTap Citation Extension** - Editor mark for inline citations
3. **Database Schema** - Enhanced citations table with document relationships
4. **API Layer** - Complete CRUD operations for citations
5. **UI Components** - Search, list, card, and picker components
6. **E2E Tests** - Comprehensive browser-based testing

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
