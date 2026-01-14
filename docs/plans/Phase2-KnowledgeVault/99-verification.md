# Phase 2 Verification Checklist

> **Phase 2** | [← E2E Tests](./14-e2e-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 2 tasks are complete and working, with all testing best practices followed.**

> **Design System:** All UI components must follow the "Scholarly Craft" aesthetic documented in [`docs/design-system.md`](../../design-system.md).

---

## Automated Verification

Run the full verification suite:

```bash
# Run all checks
npm run lint && npm run format:check && npm test && npm run build

# For E2E tests (requires running server)
npm run test:e2e -- --grep="vault"
```

---

## Manual Verification Steps

### 1. Development Server

```bash
npm run dev
```

- [ ] Server starts without errors
- [ ] No TypeScript compilation errors

### 2. Unit Tests

```bash
npm test
```

- [ ] All tests pass
- [ ] No skipped tests (unless intentional)

### 3. Lint & Format

```bash
npm run lint && npm run format:check
```

- [ ] No lint errors
- [ ] No formatting issues

### 4. Build

```bash
npm run build
```

- [ ] Build completes successfully
- [ ] No type errors

### 5. Database

```bash
npx supabase status
```

- [ ] Supabase is running
- [ ] vault_items table exists
- [ ] vault_chunks table exists
- [ ] vault-files bucket exists
- [ ] search_vault_chunks function exists

---

## File Checklist

### Task 2.0 - Infrastructure Setup

- [ ] `fixtures/sample.txt` exists
- [ ] `e2e/fixtures/test.txt` exists
- [ ] `src/lib/vault/__tests__/fixtures.ts` exists with `createMockVaultItem` and `mockVaultItems`
- [ ] `src/lib/vault/constants.ts` exists (including RETENTION config)
- [ ] `src/lib/vault/types.ts` exists
- [ ] `src/lib/vault/index.ts` exists (barrel export)
- [ ] `src/lib/logger.ts` exists with pino logger
- [ ] Vault tables migration exists (with `deleted_at` for soft delete)
- [ ] Storage bucket migration exists
- [ ] `cleanup_soft_deleted_vault_items` function exists

### Task 2.1 - VaultUpload Component

- [ ] `src/components/vault/__tests__/VaultUpload.test.tsx` exists (uses `@/test-utils/render`)
- [ ] `src/components/vault/VaultUpload.tsx` exists (spinner uses `motion-safe:animate-spin`)

### Task 2.2 - VaultItemCard Component

- [ ] `src/components/vault/__tests__/VaultItemCard.test.tsx` exists (uses `@/test-utils/render` and `createMockVaultItem`)
- [ ] `src/components/vault/VaultItemCard.tsx` exists (spinner uses `motion-safe:animate-spin`)

### Task 2.3 - VaultItemList Component

- [ ] `src/components/vault/__tests__/VaultItemList.test.tsx` exists (uses `@/test-utils/render` and `createMockVaultItem`)
- [ ] `src/components/vault/VaultItemList.tsx` exists

### Task 2.4 - Vault API Helpers

- [ ] `src/lib/api/__tests__/vault.test.ts` exists (8 tests with cleanup pattern)
- [ ] `src/lib/api/vault.ts` exists (with soft delete, `.is('deleted_at', null)` filter)
- [ ] `src/lib/api/audit.ts` exists
- [ ] `src/lib/utils/filename.ts` exists

### Task 2.5 - Upload API Route

- [ ] `src/lib/queue/__tests__/extraction-queue.test.ts` exists (5 tests)
- [ ] `src/lib/queue/extraction-queue.ts` exists
- [ ] `src/lib/queue/index.ts` exists (barrel export)
- [ ] `src/app/api/vault/__tests__/upload.test.ts` exists (4 tests)
- [ ] `src/app/api/vault/upload/route.ts` exists (uses `vaultLogger`)
- [ ] `src/app/api/vault/route.ts` exists (uses `vaultLogger`)
- [ ] `src/app/api/vault/[id]/route.ts` exists (uses `vaultLogger`)

### Task 2.6 - Text Extraction

- [ ] `src/lib/extraction/__tests__/pdf.test.ts` exists
- [ ] `src/lib/extraction/pdf.ts` exists
- [ ] `src/lib/extraction/__tests__/docx.test.ts` exists
- [ ] `src/lib/extraction/docx.ts` exists
- [ ] `src/lib/extraction/text.ts` exists

### Task 2.7 - Text Chunker

- [ ] `src/lib/extraction/__tests__/chunker.test.ts` exists
- [ ] `src/lib/extraction/chunker.ts` exists

### Task 2.8 - OpenAI Embeddings

- [ ] `src/lib/extraction/__tests__/embeddings.test.ts` exists
- [ ] `src/lib/extraction/embeddings.ts` exists

### Task 2.9 - Extraction Processor

- [ ] `src/lib/extraction/__tests__/processor.test.ts` exists (6 tests)
- [ ] `src/lib/extraction/processor.ts` exists
- [ ] `src/lib/extraction/index.ts` exists (barrel export)
- [ ] `src/app/api/vault/extract/route.ts` exists

### Task 2.10 - Semantic Search

- [ ] Search function migration exists
- [ ] `src/lib/api/__tests__/search.test.ts` exists
- [ ] `src/lib/api/search.ts` exists
- [ ] `src/app/api/vault/search/route.ts` exists (uses `handleApiError` pattern)

### Task 2.11 - VaultSearch Component

- [ ] `src/components/vault/__tests__/VaultSearch.test.tsx` exists (uses `@/test-utils/render`)
- [ ] `src/components/vault/VaultSearch.tsx` exists (spinner uses `motion-safe:animate-spin`)
- [ ] `src/components/vault/VaultSearch.tsx` uses error state (not `console.error`)
- [ ] `src/components/vault/index.ts` exists

### Task 2.12 - Vault Page Integration

- [ ] `src/app/projects/[id]/vault/__tests__/VaultPageClient.test.tsx` exists (6 tests)
- [ ] `src/app/projects/[id]/vault/page.tsx` exists
- [ ] `src/app/projects/[id]/vault/VaultPageClient.tsx` exists

### Task 2.13 - E2E Tests

- [ ] `e2e/pages/VaultPage.ts` exists (Page Object Model)
- [ ] `e2e/vault/vault.spec.ts` exists
- [ ] `e2e/vault/vault-search.spec.ts` exists
- [ ] `e2e/vault/vault-a11y.spec.ts` exists

---

## Testing Best Practices Compliance

> See `docs/best-practices/testing-best-practices.md` for full guidance.

### Unit Tests

- [ ] All component tests use custom `render` from `@/test-utils/render`
- [ ] All component tests import mock data from `@/lib/vault/__tests__/fixtures.ts`
- [ ] Tests use `createMockVaultItem` factory function (no inline mock objects)
- [ ] All tests follow TDD pattern (tests written before implementation)
- [ ] Tests use mock cleanup pattern (track created records)
- [ ] Tests use `vi.clearAllMocks()` in `beforeEach`
- [ ] Tests mock the pino logger (no console.log)

### E2E Tests

- [ ] E2E tests import from `e2e/fixtures/test-fixtures.ts` (Phase 0 infrastructure)
- [ ] E2E tests use `TIMEOUTS` constants from `e2e/config/timeouts.ts`
- [ ] E2E tests use `workerCtx` for data isolation
- [ ] E2E tests use `loginAsWorker` for authentication
- [ ] E2E tests use `checkA11y` for accessibility testing
- [ ] E2E tests use `expect().toPass()` pattern for async assertions
- [ ] E2E tests use Page Object Model pattern
- [ ] No hardcoded timeout values in E2E tests

### Code Organization

- [ ] All `src/lib/<module>/` directories have `index.ts` barrel exports
- [ ] API routes use `handleApiError` pattern for error handling
- [ ] No `console.log`/`console.error` in production code (use `vaultLogger`)
- [ ] Client components show user-friendly error messages (not console.error)

### Design System Compliance

> See [`docs/design-system.md`](../../design-system.md) for full token reference.

- [ ] All components use design system color tokens (not hardcoded colors)
  - `bg-quill`, `text-quill` for brand accent
  - `bg-surface`, `bg-bg-primary` for backgrounds
  - `text-ink-primary`, `text-ink-secondary`, `text-ink-tertiary` for text
  - `text-success`, `text-error`, `text-warning` for semantic colors
- [ ] All components use design system typography
  - `font-display` (Libre Baskerville) for headings
  - `font-ui` (Source Sans 3) for UI text and labels
  - `font-prose` for document content
- [ ] All buttons use proper design system patterns
  - Primary: `bg-quill hover:bg-quill-dark text-white font-ui font-semibold`
  - Focus states: `focus:ring-2 focus:ring-quill focus:ring-offset-2`
- [ ] All cards use proper design system patterns
  - `bg-surface border border-ink-faint rounded-lg shadow-sm`
  - Interactive: `hover:shadow-md hover:border-ink-subtle transition-all`
- [ ] All inputs use proper design system patterns
  - `bg-surface border border-ink-faint rounded-md`
  - Focus: `focus:ring-2 focus:ring-quill focus:border-quill`
- [ ] Empty states use `font-display` for headings, `font-ui` for body
- [ ] Error states use `bg-error-light`, `text-error`, `border-error/20`
- [ ] Spinners use `motion-safe:animate-spin` for accessibility

---

## Functional Verification

### Upload Flow

- [ ] Can upload PDF files via UI
- [ ] Can upload DOCX files via UI
- [ ] Can upload TXT files via UI
- [ ] File size limits are enforced
- [ ] Unsupported file types are rejected
- [ ] Upload progress is shown

### Extraction Flow

- [ ] Extraction starts automatically after upload
- [ ] Status updates display correctly (pending → extracting → success)
- [ ] Failed extractions show retry button
- [ ] Partial extractions handled gracefully

### Search Flow

- [ ] Can search vault and get relevant results
- [ ] Results show filename and similarity score
- [ ] "No results found" message shown when appropriate
- [ ] Search can be cancelled (new search replaces old)

### Management Flow

- [ ] Can delete vault items (soft delete)
- [ ] Soft-deleted items hidden from normal queries
- [ ] Can restore soft-deleted items within grace period
- [ ] Permanent cleanup function removes items after 7-day grace period
- [ ] Optimistic updates work correctly

### Error Handling

- [ ] Error boundary catches component errors
- [ ] API errors return appropriate status codes
- [ ] Authentication required for all routes

### Observability

- [ ] Structured logging with pino (no console.log)
- [ ] Audit logs created for create/delete/restore/extraction events
- [ ] Spinners respect `prefers-reduced-motion` (motion-safe:animate-spin)

---

## Summary

| Task                        | Status |
| --------------------------- | ------ |
| 2.0 Infrastructure Setup    | [ ]    |
| 2.1 VaultUpload Component   | [ ]    |
| 2.2 VaultItemCard Component | [ ]    |
| 2.3 VaultItemList Component | [ ]    |
| 2.4 Vault API Helpers       | [ ]    |
| 2.5 Upload API Route        | [ ]    |
| 2.6 Text Extraction         | [ ]    |
| 2.7 Text Chunker            | [ ]    |
| 2.8 OpenAI Embeddings       | [ ]    |
| 2.9 Extraction Processor    | [ ]    |
| 2.10 Semantic Search        | [ ]    |
| 2.11 VaultSearch Component  | [ ]    |
| 2.12 Vault Page Integration | [ ]    |
| 2.13 E2E Tests              | [ ]    |

---

## Test Count Summary

| Component            | Tests  |
| -------------------- | ------ |
| VaultUpload          | 7      |
| VaultItemCard        | 7      |
| VaultItemList        | 3      |
| Vault API            | 8      |
| Extraction Queue     | 5      |
| Upload API Route     | 4      |
| PDF Extraction       | 3      |
| DOCX Extraction      | 3      |
| Text Chunker         | 8      |
| Embeddings           | 4      |
| Extraction Processor | 6      |
| Search API           | 2      |
| VaultSearch          | 5      |
| VaultPageClient      | 6      |
| **Total Unit Tests** | **71** |

### E2E Tests

| Suite                | Tests  |
| -------------------- | ------ |
| vault.spec.ts        | 7      |
| vault-search.spec.ts | 6      |
| vault-a11y.spec.ts   | 7      |
| **Total E2E Tests**  | **20** |

---

## Phase 2 Complete

**All checks passing? Phase 2 is complete!**

Proceed to **Phase 3: AI Integration**.
