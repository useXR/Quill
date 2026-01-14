# Phase 5 (Citations) E2E Test Coverage Analysis

**Date:** 2026-01-14
**Purpose:** Ensure E2E tests are sufficient to cover all implemented code, preventing issues with disconnected components or missing pages that occurred in previous phases.

---

## Executive Summary

The Phase 5 plan has **significant gaps** in E2E test coverage. While `08-e2e-tests.md` specifies a comprehensive E2E test suite, there are critical issues:

1. **E2E tests are only specified at the end** (Tasks 5.33-5.35) rather than incrementally
2. **No citations page exists** in the plan - only components with no route integration
3. **Missing integration with editor** - the CitationPicker component has no E2E test for actual editor insertion
4. **No E2E test verification checkpoints** at intermediate steps
5. **Missing page route** - Components are created but `/projects/[id]/citations` route is never created

---

## Step-by-Step Analysis

### Task 5.1: Citation Types

**What's Created:**

- `src/lib/citations/types.ts` - TypeScript types
- `src/lib/citations/schemas.ts` - Zod validation schemas
- `src/lib/constants/citations.ts` - Constants

**UI Components/Pages:** None
**User Interactions:** None
**API Endpoints:** None
**E2E Tests Required:** None (types only)
**E2E Tests Specified:** None

**Gap:** None - this is correctly a types-only task.

---

### Tasks 5.2-5.12: Semantic Scholar Client

**What's Created:**

- `src/lib/citations/semantic-scholar.ts` - API client
- `searchPapers()`, `getPaper()`, `searchPapersWithCache()` functions
- Rate limiting, caching, error handling

**UI Components/Pages:** None
**User Interactions:** None
**API Endpoints:** None (client-side only, internal use)
**E2E Tests Required:** None at this step
**E2E Tests Specified:** None

**Gap:** None - backend module only. Unit tests with mocked fetch are appropriate.

---

### Tasks 5.13-5.14: TipTap Citation Extension

**What's Created:**

- `src/components/editor/extensions/citation.ts` - TipTap mark extension
- `setCitation()` and `unsetCitation()` commands

**UI Components/Pages:** Editor integration point
**User Interactions:**

- Citation marks render in editor
- Citations are clickable
- Citations can be inserted/removed

**API Endpoints:** None

**Integrations with Earlier Phases:**

- Phase 1 Editor (`src/components/editor/Editor.tsx`) - MUST integrate extension

**E2E Tests Required:**

- [ ] Citation renders correctly in editor content
- [ ] Citation is clickable and shows tooltip/details
- [ ] Citation survives save/reload cycle

**E2E Tests Specified:** None at this step

**GAP - CRITICAL:** The TipTap extension is created but **no integration with the actual Editor component is specified**. The plan does not include updating `Editor.tsx` to include the Citation extension. This will result in a disconnected component that cannot be used.

**Recommendation:** Add step to integrate Citation extension into Editor.tsx and add E2E test:

```typescript
test('citation mark renders in editor', async ({ page }) => {
  // Insert text with citation mark via TipTap
  // Verify citation renders with correct styling
  // Verify citation is clickable
});
```

---

### Tasks 5.15-5.16: Database Migration

**What's Created:**

- Database migration for `citations` table enhancements
- `document_citations` junction table
- RLS policies
- `get_next_citation_number()` function

**UI Components/Pages:** None
**User Interactions:** None (backend schema)
**API Endpoints:** None
**E2E Tests Required:** None at this step
**E2E Tests Specified:** None

**Gap:** None - database migration only. Integration test scaffold is appropriate.

---

### Tasks 5.17-5.20: Citations API Helpers

**What's Created:**

- `src/lib/api/citations.ts` with CRUD operations
- `getCitations()`, `getCitation()`, `createCitation()`, etc.
- `citationLogger()` domain logger

**UI Components/Pages:** None
**User Interactions:** None (internal helpers)
**API Endpoints:** None (helpers only, routes come later)
**E2E Tests Required:** None at this step
**E2E Tests Specified:** None

**Gap:** None - internal API helpers with unit tests are appropriate.

---

### Tasks 5.21-5.23: API Routes

**What's Created:**

- `src/app/api/citations/route.ts` - GET/POST citations list
- `src/app/api/citations/[id]/route.ts` - Single citation CRUD
- `src/app/api/citations/search/route.ts` - Search Semantic Scholar

**UI Components/Pages:** None
**User Interactions:** None (API only)
**API Endpoints:**

- `GET /api/citations?projectId=<uuid>` - List citations
- `POST /api/citations` - Create citation
- `GET /api/citations/[id]` - Get single citation
- `PATCH /api/citations/[id]` - Update citation
- `DELETE /api/citations/[id]` - Delete citation
- `GET /api/citations/search?q=<query>` - Search papers

**E2E Tests Required:**

- [ ] API endpoints are accessible and return correct responses
- [ ] Rate limiting returns 429
- [ ] Validation errors return 400

**E2E Tests Specified:** None at this step

**GAP - MODERATE:** API routes are created but no E2E verification is specified until Task 5.33. This means 3 task files of work could proceed with broken routes.

**Recommendation:** Add API smoke test after Task 5.23:

```typescript
test('citation API endpoints are accessible', async ({ page, workerCtx }) => {
  // Test GET /api/citations/search?q=test returns 200
  // Test GET /api/citations?projectId=<uuid> returns 200/empty array
});
```

---

### Tasks 5.24-5.32: UI Components

**What's Created:**

- `src/components/citations/CitationCard.tsx`
- `src/components/citations/CitationSearch.tsx`
- `src/components/citations/CitationList.tsx`
- `src/components/citations/CitationPicker.tsx`
- `src/lib/citations/formatter.ts`

**UI Components/Pages Created:**

- CitationCard - displays paper info with Add button
- CitationSearch - search input + results grid
- CitationList - list of project citations with delete
- CitationPicker - modal dialog for editor integration

**User Interactions:**

- Search for papers
- View paper details (title, authors, DOI badge, citation count)
- Add paper to project citations
- View project's citation list
- Delete citation (with ConfirmDialog)
- Open CitationPicker from editor
- Select citation to insert into document

**API Endpoints Used:**

- `GET /api/citations/search?q=<query>` - by CitationSearch
- `GET /api/citations?projectId=<uuid>` - by CitationList
- `POST /api/citations` - by CitationCard.onAdd
- `DELETE /api/citations/[id]` - by CitationList

**Integrations with Earlier Phases:**

- Phase 1 Editor - CitationPicker needs to integrate with toolbar/editor
- Phase 1 Projects - Citations are per-project
- Phase 0 Supabase Auth - All operations require authentication

**E2E Tests Required:**

- [ ] CitationSearch renders and accepts input
- [ ] CitationSearch displays results
- [ ] CitationCard shows verified/unverified badges
- [ ] CitationCard "Add Citation" button works
- [ ] CitationList displays project citations
- [ ] CitationList delete with ConfirmDialog works
- [ ] CitationPicker opens as modal
- [ ] CitationPicker search works
- [ ] CitationPicker inserts citation into editor

**E2E Tests Specified:** None at this step

**GAP - CRITICAL - MISSING PAGE ROUTE:** The plan creates components but **never creates a page route** for viewing/managing citations.

Looking at the E2E tests in `08-e2e-tests.md`:

```typescript
await citationSearch.goto(workerCtx.projectId);
// Goes to: /projects/${projectId}/citations
```

But **no task in the plan creates** `src/app/projects/[id]/citations/page.tsx`.

This is a **fatal gap** - E2E tests will fail because the page doesn't exist.

**GAP - CRITICAL - NO EDITOR INTEGRATION:** CitationPicker is created but:

1. No task adds CitationPicker to the Editor toolbar
2. No task shows how to open CitationPicker from editor
3. No E2E test verifies citation insertion into document

**GAP - MISSING TRIGGER:** How does a user open the CitationPicker? The plan doesn't specify:

- Toolbar button to open picker?
- Slash command in editor?
- Keyboard shortcut?

**Recommendations:**

1. **Add Task 5.32a: Create Citations Page Route**

```typescript
// src/app/projects/[id]/citations/page.tsx
export default function CitationsPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Citations</h1>
      <CitationSearch projectId={params.id} />
      <CitationList projectId={params.id} />
    </div>
  );
}
```

2. **Add Task 5.32b: Integrate CitationPicker with Editor**

- Add toolbar button to Editor toolbar
- Add command to open CitationPicker
- Handle citation selection and insertion

3. **Add E2E tests at this step** (not just at 5.33):

```typescript
test('citations page renders', async ({ page, workerCtx }) => {
  await page.goto(`/projects/${workerCtx.projectId}/citations`);
  await expect(page.getByPlaceholder(/search papers/i)).toBeVisible();
});
```

---

### Tasks 5.33-5.35: E2E Tests

**What's Created:**

- `e2e/fixtures/citation-mocks.ts` - API mocking
- `e2e/pages/CitationSearchPage.ts` - Page Object
- `e2e/pages/CitationListPage.ts` - Page Object
- `e2e/pages/CitationPickerPage.ts` - Page Object
- `e2e/citations/citation-search.spec.ts` - Search tests
- `e2e/citations/citation-management.spec.ts` - CRUD tests
- `e2e/citations/citation-accessibility.spec.ts` - A11y tests

**E2E Tests Specified:**

| Test File                        | Test                                             | Coverage                 |
| -------------------------------- | ------------------------------------------------ | ------------------------ |
| `citation-search.spec.ts`        | user can search for citations                    | CitationSearch component |
| `citation-search.spec.ts`        | shows empty state for no results                 | Empty state UI           |
| `citation-search.spec.ts`        | shows error on API failure                       | Error handling           |
| `citation-search.spec.ts`        | shows rate limit message                         | 429 handling             |
| `citation-search.spec.ts`        | user can add citation from search results        | Add flow                 |
| `citation-search.spec.ts`        | shows verified badge for papers with DOI         | DOI badge                |
| `citation-search.spec.ts`        | search with Enter key works                      | Keyboard nav             |
| `citation-management.spec.ts`    | shows empty state when no citations              | Empty list               |
| `citation-management.spec.ts`    | displays list of citations                       | CitationList             |
| `citation-management.spec.ts`    | user can delete citation with ConfirmDialog      | Delete flow              |
| `citation-management.spec.ts`    | user can cancel deletion                         | Cancel delete            |
| `citation-accessibility.spec.ts` | citation search page passes accessibility audit  | Axe-core                 |
| `citation-accessibility.spec.ts` | citation search results pass accessibility audit | Results a11y             |
| `citation-accessibility.spec.ts` | search input is focusable via keyboard           | Keyboard                 |
| `citation-accessibility.spec.ts` | error alerts have proper role                    | ARIA                     |
| `citation-accessibility.spec.ts` | buttons have accessible names                    | ARIA                     |
| `citation-accessibility.spec.ts` | citation cards are keyboard navigable            | Keyboard                 |
| `citation-accessibility.spec.ts` | loading state is announced to screen readers     | Status role              |
| `citation-accessibility.spec.ts` | ConfirmDialog is accessible                      | Dialog a11y              |

**GAPS IN E2E TESTS:**

| Missing Test                            | Priority | Reason                                       |
| --------------------------------------- | -------- | -------------------------------------------- |
| **Citation insertion into editor**      | CRITICAL | CitationPicker inserts marks but no E2E test |
| **Citation renders in saved document**  | CRITICAL | Marks must persist across save/reload        |
| **Citation survives document export**   | HIGH     | Phase 6 depends on this                      |
| **Navigation from editor to citations** | HIGH     | User flow                                    |
| **CitationPicker modal opens/closes**   | MEDIUM   | Modal behavior                               |
| **CitationPicker search and select**    | MEDIUM   | Picker flow                                  |
| **Duplicate citation prevention**       | MEDIUM   | 409 handling                                 |
| **Update citation notes**               | LOW      | PATCH endpoint                               |
| **Citation restore (soft delete undo)** | LOW      | Restore flow                                 |

---

## Critical Missing Elements

### 1. Missing Page Route

The plan creates UI components but **no page route**. E2E tests reference `/projects/${projectId}/citations` but this page is never created.

**Required Addition:**

```
Task 5.32a: Create Citations Page
File: src/app/projects/[id]/citations/page.tsx
```

### 2. Missing Editor Integration

The TipTap Citation extension and CitationPicker are created but:

- No task integrates the extension into the Editor
- No task adds a way to open CitationPicker
- No task handles inserting the selected citation

**Required Additions:**

```
Task 5.14a: Integrate Citation extension into Editor.tsx
Task 5.32b: Add CitationPicker trigger to Editor toolbar
Task 5.32c: Handle citation selection and insertion
```

### 3. Missing Navigation

No task adds navigation to the citations page from:

- Project page sidebar
- Editor toolbar
- Header navigation

**Required Addition:**

```
Task 5.32d: Add navigation links to citations page
```

### 4. E2E Tests Run Too Late

E2E tests are only specified at Task 5.33, after all implementation. This means:

- Components could be built incorrectly for 8+ tasks before discovery
- Integration issues between components won't surface until the end
- API routes could be misconfigured without early validation

**Recommendation:** Add E2E smoke tests after:

- Task 5.23 (API routes complete)
- Task 5.27 (CitationSearch complete)
- Task 5.29 (CitationList complete)
- Task 5.31 (CitationPicker complete)

---

## E2E Test Coverage Matrix

| Feature                   | Unit Tests       | E2E Tests in Plan | E2E Tests Missing              |
| ------------------------- | ---------------- | ----------------- | ------------------------------ |
| Semantic Scholar client   | Yes              | No (mocked)       | N/A (external API)             |
| Citation TipTap extension | Yes              | No                | **Yes - editor integration**   |
| Database migration        | Integration test | No                | N/A (backend only)             |
| API routes                | Yes              | Indirect (via UI) | **API smoke tests**            |
| CitationCard              | Yes              | Yes               | -                              |
| CitationSearch            | Yes              | Yes               | -                              |
| CitationList              | Yes              | Yes               | **Optimistic update rollback** |
| CitationPicker            | Yes              | No                | **Yes - modal and selection**  |
| Citation formatter        | Yes              | No                | N/A (internal)                 |
| Citations page            | N/A              | References it     | **Page doesn't exist in plan** |
| Editor + Citation         | No               | No                | **Yes - full flow**            |
| Navigation to citations   | No               | No                | **Yes - user flow**            |

---

## Recommended E2E Tests to Add

### Immediate (Add to Task 5.35)

```typescript
// e2e/citations/citation-editor-integration.spec.ts

test.describe('Citation Editor Integration', () => {
  test('can insert citation into document via picker', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Navigate to editor
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Open citation picker (adjust selector based on actual implementation)
    await page.getByRole('button', { name: /add citation/i }).click();

    // Search and select citation
    await page.getByPlaceholder(/search papers/i).fill('machine learning');
    await page.keyboard.press('Enter');
    await page.getByTestId('citation-card').first().click();

    // Verify citation inserted in editor
    await expect(page.locator('cite[data-citation-id]')).toBeVisible();
  });

  test('inserted citation persists after save and reload', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Insert citation (using steps from above test)
    // ...

    // Wait for autosave
    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();

    // Verify citation still exists
    await expect(page.locator('cite[data-citation-id]')).toBeVisible();
  });

  test('citation in editor shows tooltip on hover', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // ...
    await page.locator('cite[data-citation-id]').hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
  });
});
```

### Navigation Tests

```typescript
// e2e/citations/citation-navigation.spec.ts

test.describe('Citation Navigation', () => {
  test('can navigate from project to citations page', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.goto(`/projects/${workerCtx.projectId}`);
    await page.getByRole('link', { name: /citations/i }).click();

    await expect(page).toHaveURL(`/projects/${workerCtx.projectId}/citations`);
    await expect(page.getByPlaceholder(/search papers/i)).toBeVisible();
  });

  test('can navigate from editor toolbar to citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByRole('button', { name: /manage citations/i }).click();

    await expect(page).toHaveURL(`/projects/${workerCtx.projectId}/citations`);
  });
});
```

### CitationPicker Tests

```typescript
// e2e/citations/citation-picker.spec.ts

test.describe('CitationPicker', () => {
  test('picker opens as modal dialog', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByRole('button', { name: /add citation/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  test('picker closes on Escape key', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Open picker
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByRole('button', { name: /add citation/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('picker shows recently added citations', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // First add a citation
    await page.goto(`/projects/${workerCtx.projectId}/citations`);
    await page.getByPlaceholder(/search/i).fill('test');
    await page.keyboard.press('Enter');
    await page
      .getByRole('button', { name: /add citation/i })
      .first()
      .click();

    // Then open picker in editor
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByRole('button', { name: /add citation/i }).click();

    // Should show the recently added citation
    await expect(page.getByRole('dialog').getByText(/recently added/i)).toBeVisible();
  });
});
```

---

## When to Run E2E Tests

| After Task            | E2E Tests to Run                                   | Purpose                   |
| --------------------- | -------------------------------------------------- | ------------------------- |
| 5.23 (API Routes)     | `npm run test:e2e -- --grep "citation API"`        | Verify API endpoints work |
| 5.27 (CitationSearch) | `npm run test:e2e -- --grep "citation search"`     | Verify search UI works    |
| 5.29 (CitationList)   | `npm run test:e2e -- --grep "citation management"` | Verify list/delete works  |
| 5.31 (CitationPicker) | `npm run test:e2e -- --grep "citation picker"`     | Verify picker works       |
| 5.35 (All E2E)        | `npm run test:e2e e2e/citations/`                  | Full E2E verification     |
| 99-verification       | `npm run test:e2e`                                 | Complete regression       |

---

## Page Object Patterns to Follow

Based on existing infrastructure in `/home/arobb/Dev/Quill/e2e/`:

### Required Imports

```typescript
// CORRECT
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

// WRONG - DO NOT USE
import { test, expect } from '@playwright/test'; // Missing fixtures!
```

### Required Fixtures

```typescript
// CORRECT - use workerCtx and loginAsWorker
test('example', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();
  // use workerCtx.projectId, workerCtx.account.email, etc.
});

// WRONG - hardcoded values
test('example', async ({ page }) => {
  await page.goto('/projects/hardcoded-id'); // Will fail!
});
```

### Async Polling Pattern

```typescript
// CORRECT - use expect().toPass()
await expect(async () => {
  const count = await page.getByTestId('citation-card').count();
  expect(count).toBeGreaterThan(0);
}).toPass({ timeout: TIMEOUTS.API_CALL });

// WRONG - fixed timeout
await page.waitForTimeout(5000); // Flaky!
await expect(page.getByTestId('citation-card').first()).toBeVisible();
```

---

## Summary of Required Plan Changes

### Critical (Must Fix)

1. **Add Task 5.32a:** Create `/projects/[id]/citations/page.tsx` route
2. **Add Task 5.14a:** Integrate Citation extension into `Editor.tsx`
3. **Add Task 5.32b:** Add CitationPicker trigger to editor toolbar
4. **Add E2E test:** Citation insertion into editor flow
5. **Add E2E test:** Citation persistence across save/reload

### High Priority

6. **Add Task:** Navigation links to citations page
7. **Add intermediate E2E checkpoints** after Tasks 5.23, 5.27, 5.29, 5.31
8. **Add E2E test:** CitationPicker modal behavior
9. **Add E2E test:** Optimistic update rollback on delete failure

### Medium Priority

10. **Add E2E test:** Duplicate citation handling (409 response)
11. **Add E2E test:** Rate limiting UI feedback
12. **Add E2E test:** Citation tooltip on hover in editor

---

## Conclusion

The Phase 5 plan has solid unit test coverage through TDD but has **critical gaps in E2E coverage** and **missing integration points**. The most serious issues are:

1. **Missing page route** - Components exist but no page to render them
2. **Missing editor integration** - TipTap extension exists but isn't used
3. **E2E tests too late** - All E2E at end, not incremental
4. **Missing user flows** - Navigation, picker modal, citation insertion untested

These gaps would result in a "complete" Phase 5 where:

- Citation components exist but aren't accessible to users
- The Citation TipTap extension exists but isn't in the editor
- E2E tests would fail immediately on page navigation

**Recommended Action:** Update the Phase 5 plan to add the missing tasks and E2E tests before implementation begins.
