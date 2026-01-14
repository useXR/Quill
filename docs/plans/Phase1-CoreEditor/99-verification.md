# Phase 1 Verification Checklist

> **Phase 1** | [← E2E Tests](./11-e2e-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 1 tasks are complete and working.** Run all checks before marking Phase 1 as done.

---

## Automated Verification

Run this script to verify the basics:

```bash
#!/bin/bash
set -e

echo "=== Phase 1 Verification ==="
echo ""

echo "1. Running unit tests..."
npm test
echo "✓ Unit tests passed"
echo ""

echo "2. Running E2E tests..."
npx playwright test
echo "✓ E2E tests passed"
echo ""

echo "3. Running linter..."
npm run lint
echo "✓ Lint passed"
echo ""

echo "4. Building project..."
npm run build
echo "✓ Build succeeded"
echo ""

echo "5. Checking Supabase..."
npx supabase status
echo "✓ Supabase running"
echo ""

echo "=== All automated checks passed! ==="
```

---

## Manual Verification Steps

### 1. Authentication

Start the dev server: `npm run dev`

- [ ] Navigate to `/login`
- [ ] Enter email and submit
- [ ] Verify "Check your email" message appears
- [ ] Navigate to `/projects` while logged out
- [ ] Verify redirect to `/login`

### 2. Projects

Log in with magic link:

- [ ] Projects page shows (empty state or list)
- [ ] Click "New Project"
- [ ] Create project with title
- [ ] Verify redirect to project detail page
- [ ] Project appears in projects list
- [ ] Can edit project title
- [ ] Can delete project

### 3. Documents

Open a project:

- [ ] Can create new document
- [ ] Document appears in project
- [ ] Can edit document title

### 4. Editor

Open a document:

- [ ] Editor renders with toolbar
- [ ] Can type in editor
- [ ] Bold button works (Ctrl+B)
- [ ] Italic button works (Ctrl+I)
- [ ] Headings work
- [ ] Lists work
- [ ] Alignment works
- [ ] Undo/Redo work

### 5. Autosave

In the editor:

- [ ] Type some content
- [ ] "Unsaved changes" appears
- [ ] Wait 1 second
- [ ] "Saving..." appears
- [ ] "Saved" appears with timestamp
- [ ] Refresh page
- [ ] Content persists

### 6. Word Count

In the editor:

- [ ] Word count displays at bottom
- [ ] Character count displays
- [ ] Counts update as you type
- [ ] (If limit set) Progress bar shows
- [ ] (If near limit) Yellow warning shows
- [ ] (If over limit) Red error shows

---

## File Checklist

### Task 0 - Supabase Setup

- [ ] `supabase/migrations/20260113000000_initial_schema.sql` exists
- [ ] `src/lib/env.ts` exists
- [ ] `src/lib/supabase/server.ts` exists
- [ ] `src/lib/supabase/client.ts` exists
- [ ] `src/lib/supabase/database.types.ts` exists
- [ ] `src/lib/supabase/index.ts` exists
- [ ] `next.config.ts` has security headers (including CSP)
- [ ] `next.config.ts` has `output: 'standalone'` for Docker builds

### Task 1 - Testing Infrastructure

- [ ] `vitest.config.ts` exists with happy-dom environment
- [ ] `eslint.config.js` has test file relaxation rules
- [ ] `src/lib/constants/auth.ts` exists
- [ ] `src/lib/constants/editor.ts` exists
- [ ] `src/lib/constants/index.ts` exists
- [ ] `src/lib/logger.ts` exists
- [ ] `vitest.setup.ts` exists with:
  - [ ] Auto-cleanup after each test
  - [ ] jest-dom matchers imported
  - [ ] Next.js navigation mock
  - [ ] Browser API mocks
- [ ] `src/test-utils/supabase-mock.ts` exists
- [ ] `src/test-utils/tiptap-mock.ts` exists
- [ ] `src/test-utils/factories.ts` exists
- [ ] `src/test-utils/index.ts` exists (with Phase 1 exports)
- [ ] `src/lib/api/types.ts` exists
- [ ] `src/lib/api/errors.ts` exists
- [ ] `src/lib/api/format-errors.ts` exists
- [ ] `src/lib/api/handle-error.ts` exists
- [ ] `src/lib/api/index.ts` exists

### Task 2 - TipTap Editor

- [ ] `src/components/editor/extensions/index.ts` exists
- [ ] `src/components/editor/Editor.tsx` exists
- [ ] `src/components/editor/__tests__/Editor.test.tsx` exists

### Task 3 - Editor Toolbar

- [ ] `src/components/editor/Toolbar.tsx` exists
- [ ] `src/components/editor/__tests__/Toolbar.test.tsx` exists

### Task 4 - Auth Magic Link

- [ ] `src/lib/auth/rate-limit.ts` exists
- [ ] `src/lib/auth/__tests__/rate-limit.test.ts` exists
- [ ] `src/lib/auth/index.ts` exists
- [ ] `src/app/api/auth/check-rate-limit/route.ts` exists
- [ ] `src/app/auth/callback/route.ts` exists
- [ ] `src/components/auth/LoginForm.tsx` exists
- [ ] `src/components/auth/__tests__/LoginForm.test.tsx` exists
- [ ] `src/app/login/page.tsx` exists
- [ ] `src/contexts/auth.tsx` exists
- [ ] `src/app/layout.tsx` includes AuthProvider

### Task 5 - Auth Middleware

- [ ] `src/middleware.ts` exists
- [ ] `src/__tests__/middleware.test.ts` exists

### Task 6 - Projects CRUD

- [ ] `src/lib/api/schemas/project.ts` exists
- [ ] `src/lib/api/projects.ts` exists
- [ ] `src/lib/api/__tests__/projects.test.ts` exists
- [ ] `src/app/api/projects/route.ts` exists
- [ ] `src/app/api/projects/[id]/route.ts` exists
- [ ] `src/components/projects/ProjectCard.tsx` exists
- [ ] `src/components/projects/ProjectList.tsx` exists
- [ ] `src/components/projects/NewProjectForm.tsx` exists
- [ ] `src/app/projects/page.tsx` exists
- [ ] `src/app/projects/new/page.tsx` exists
- [ ] `src/app/projects/[id]/page.tsx` exists

### Task 7 - Documents CRUD

- [ ] `src/lib/api/schemas/document.ts` exists
- [ ] `src/lib/api/documents.ts` exists
- [ ] `src/lib/api/__tests__/documents.test.ts` exists
- [ ] `src/app/api/documents/route.ts` exists
- [ ] `src/app/api/documents/[id]/route.ts` exists

### Task 8 - Autosave Hook

- [ ] `src/hooks/useAutosave.ts` exists
- [ ] `src/hooks/__tests__/useAutosave.test.ts` exists
- [ ] `src/components/editor/SaveStatus.tsx` exists
- [ ] `src/components/editor/DocumentEditor.tsx` exists

### Task 9 - Word Count

- [ ] `src/hooks/useWordCount.ts` exists
- [ ] `src/hooks/__tests__/useWordCount.test.ts` exists
- [ ] `src/components/editor/WordCount.tsx` exists
- [ ] `src/components/editor/__tests__/WordCount.test.tsx` exists

### Task 10 - E2E Tests

- [ ] `playwright.config.ts` exists with serial/parallel project separation
- [ ] `.env.test` exists
- [ ] `.gitattributes` exists with LF line ending enforcement
- [ ] `e2e/config/timeouts.ts` exists
- [ ] `e2e/fixtures/test-accounts.ts` exists (with shared + worker accounts)
- [ ] `e2e/fixtures/worker-context.ts` exists
- [ ] `e2e/fixtures/test-fixtures.ts` exists
- [ ] `e2e/helpers/hydration.ts` exists
- [ ] `e2e/helpers/auth.ts` exists
- [ ] `e2e/helpers/cleanup.ts` exists (with TestData class)
- [ ] `e2e/helpers/axe.ts` exists
- [ ] `e2e/pages/LoginPage.ts` exists
- [ ] `e2e/setup/global-setup.ts` exists (with CRLF check, retry loop, verification)
- [ ] `e2e/setup/global-teardown.ts` exists
- [ ] `e2e/setup/auth.setup.ts` exists
- [ ] `e2e/auth/auth.spec.ts` exists
- [ ] `e2e/projects/projects.spec.ts` exists
- [ ] `e2e/editor/editor.spec.ts` exists

---

## Summary

| Task | Name                   | Status |
| ---- | ---------------------- | ------ |
| 0    | Supabase Setup         | [ ]    |
| 1    | Testing Infrastructure | [ ]    |
| 2    | TipTap Editor          | [ ]    |
| 3    | Editor Toolbar         | [ ]    |
| 4    | Auth Magic Link        | [ ]    |
| 5    | Auth Middleware        | [ ]    |
| 6    | Projects CRUD          | [ ]    |
| 7    | Documents CRUD         | [ ]    |
| 8    | Autosave Hook          | [ ]    |
| 9    | Word Count             | [ ]    |
| 10   | E2E Tests              | [ ]    |

---

## Phase 1 Complete

**All checks passing? Phase 1 is complete!**

You now have:

- A working TipTap editor with formatting toolbar
- Magic link authentication with rate limiting
- Protected routes via middleware
- Full CRUD for projects and documents
- Autosave with debouncing, retry, and conflict detection
- Word/character counting with limit warnings
- Comprehensive E2E test suite

**Proceed to Phase 2: Knowledge Vault** for source management and RAG integration.
