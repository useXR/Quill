# Phase 1: Core Editor & Document Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core TipTap editor with autosave, Supabase auth with magic links, and CRUD for projects/documents.

**Architecture:** Next.js App Router with server components for data fetching, client components for interactive UI. Supabase handles auth and Postgres storage with RLS policies. TipTap provides rich text editing with grant-specific extensions.

**Tech Stack:** Next.js 16+, TipTap, Supabase (auth + Postgres + RLS), Zod validation, Vitest + React Testing Library, Playwright E2E

---

## Task Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PHASE 1: CORE EDITOR & DOCUMENT MANAGEMENT          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐                                               │
│  │ Task 0: Supabase     │  (Foundation - MUST complete first)           │
│  │ Setup & Schema       │                                               │
│  └──────────┬───────────┘                                               │
│             │                                                           │
│             ▼                                                           │
│  ┌──────────────────────┐                                               │
│  │ Task 1: Testing      │                                               │
│  │ Infrastructure       │                                               │
│  └──────────┬───────────┘                                               │
│             │                                                           │
│             ├────────────────────────────────────────┐                  │
│             ▼                                        ▼                  │
│  ┌──────────────────────┐               ┌──────────────────────┐        │
│  │ Task 2: TipTap       │               │ Task 4: Auth with    │        │
│  │ Editor Setup         │               │ Magic Link           │        │
│  └──────────┬───────────┘               └──────────┬───────────┘        │
│             │                                      │                    │
│             ▼                                      ▼                    │
│  ┌──────────────────────┐               ┌──────────────────────┐        │
│  │ Task 3: Editor       │               │ Task 5: Auth         │        │
│  │ Toolbar              │               │ Middleware           │        │
│  └──────────┬───────────┘               └──────────┬───────────┘        │
│             │                                      │                    │
│             │              ┌───────────────────────┘                    │
│             │              ▼                                            │
│             │   ┌──────────────────────┐                                │
│             │   │ Task 6: Projects     │                                │
│             │   │ CRUD                 │                                │
│             │   └──────────┬───────────┘                                │
│             │              │                                            │
│             │              ▼                                            │
│             │   ┌──────────────────────┐                                │
│             │   │ Task 7: Documents    │                                │
│             │   │ CRUD                 │                                │
│             │   └──────────┬───────────┘                                │
│             │              │                                            │
│             └──────────────┼──────────────────────────┐                 │
│                            ▼                          │                 │
│             ┌──────────────────────┐                  │                 │
│             │ Task 8: Autosave     │                  │                 │
│             │ Hook                 │                  │                 │
│             └──────────┬───────────┘                  │                 │
│                        │                              │                 │
│                        ▼                              │                 │
│             ┌──────────────────────┐                  │                 │
│             │ Task 9: Word/Char    │◄─────────────────┘                 │
│             │ Count                │                                    │
│             └──────────┬───────────┘                                    │
│                        │                                                │
│                        ▼                                                │
│             ┌──────────────────────┐                                    │
│             │ Task 10: E2E Tests   │                                    │
│             │ with Playwright      │                                    │
│             └──────────┬───────────┘                                    │
│                        │                                                │
│                        ▼                                                │
│             ┌──────────────────────┐                                    │
│             │ Task 11: Document    │  (Final feature)                   │
│             │ Metadata Editing     │                                    │
│             └──────────────────────┘                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                                           | Task  | Description                                   | Prerequisites        |
| -------------------------------------------------------------- | ----- | --------------------------------------------- | -------------------- |
| [01-supabase-setup.md](./01-supabase-setup.md)                 | 0     | Supabase schema, RLS policies, client helpers | Pre-flight checklist |
| [02-testing-infrastructure.md](./02-testing-infrastructure.md) | 1     | Testing utilities, mocks, fixtures            | Task 0               |
| [03-tiptap-editor.md](./03-tiptap-editor.md)                   | 2     | TipTap editor with extensions                 | Task 1               |
| [04-editor-toolbar.md](./04-editor-toolbar.md)                 | 3     | Editor formatting toolbar                     | Task 2               |
| [05-auth-magic-link.md](./05-auth-magic-link.md)               | 4     | Magic link auth with rate limiting            | Task 1               |
| [06-auth-middleware.md](./06-auth-middleware.md)               | 5     | Route protection middleware                   | Task 4               |
| [07-projects-crud.md](./07-projects-crud.md)                   | 6     | Projects API and UI                           | Task 5               |
| [08-documents-crud.md](./08-documents-crud.md)                 | 7     | Documents API with version conflict           | Task 6               |
| [09-autosave-hook.md](./09-autosave-hook.md)                   | 8     | Autosave with debounce and retry              | Tasks 3, 7           |
| [10-word-count.md](./10-word-count.md)                         | 9     | Word/character count with limits              | Task 8               |
| [11-e2e-tests.md](./11-e2e-tests.md)                           | 10    | Playwright E2E tests                          | All previous         |
| [12-document-metadata.md](./12-document-metadata.md)           | 11    | Inline document title editing                 | Tasks 7, 8, 10       |
| [13-edit-project-page.md](./13-edit-project-page.md)           | 12    | Edit project page with status updates         | Task 6, 10           |
| [99-verification.md](./99-verification.md)                     | Final | Phase completion checklist                    | Task 12              |

---

## Key Dependencies

- **Supabase** - Database, auth, and RLS for secure data access
- **TipTap** - Rich text editor with ProseMirror foundation
- **Zod** - Schema validation for API inputs
- **Playwright** - E2E testing across browsers
- **Pino** - Structured logging
- **Lodash** - Utility functions (deep equality for autosave)

---

## Infrastructure Components

Tasks 0-1 establish foundational infrastructure used throughout Phase 1:

| Component          | Location                       | Purpose                                   |
| ------------------ | ------------------------------ | ----------------------------------------- |
| Environment Helper | `src/lib/env.ts`               | Type-safe env vars, fails fast on missing |
| Constants          | `src/lib/constants/`           | Centralized magic values                  |
| Logger             | `src/lib/logger.ts`            | Structured logging with pino              |
| Error Formatting   | `src/lib/api/format-errors.ts` | Consistent Zod error formatting           |
| Security Headers   | `next.config.ts`               | HSTS, CSP, X-Frame-Options, etc.          |
| Auth Provider      | `src/contexts/auth.tsx`        | React context for auth state              |

---

## Pre-Flight Checklist

Before starting Phase 1, verify:

```bash
# Node.js 24+
node --version

# Supabase CLI
npx supabase --version

# Next.js project initialized
ls package.json

# Supabase project linked
npx supabase status
```

---

## Execution Strategy

### Sequential vs Parallel Tasks

**Must Be Sequential:**

- Task 0 → Task 1 (testing needs schema types)
- Task 2 → Task 3 (toolbar needs editor)
- Task 4 → Task 5 → Task 6 → Task 7 (auth chain)
- Task 8 → Task 9 (word count integrates with autosave)

**Can Run in Parallel:**

- Tasks 2-3 (Editor) and Tasks 4-5 (Auth) - after Task 1
- After merging at Task 8, all sequential

### Recommended Order (Single Developer)

1. Task 0: Supabase Setup
2. Task 1: Testing Infrastructure
3. Task 2: TipTap Editor
4. Task 3: Editor Toolbar
5. Task 4: Auth Magic Link
6. Task 5: Auth Middleware
7. Task 6: Projects CRUD
8. Task 7: Documents CRUD
9. Task 8: Autosave Hook
10. Task 9: Word/Character Count
11. Task 10: E2E Tests
12. Task 11: Document Metadata Editing
13. Verification

### Parallel Execution (Two Developers)

**Developer A (Editor Track):** 0 → 1 → 2 → 3 → wait for Task 7 → 8 → 9 → 10

**Developer B (Auth/Data Track):** wait for 0 → 1 → 4 → 5 → 6 → 7 → merge

---

## Quick Links

- **Start here:** [Task 0: Supabase Setup](./01-supabase-setup.md)
- **Final step:** [Verification](./99-verification.md)
