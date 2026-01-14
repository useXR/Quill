# Phase 5: Citations & Research Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Semantic Scholar integration, citation management, and editor citation insertion with comprehensive test coverage.

---

## Phase 5 Task Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 5: CITATIONS & RESEARCH                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐                                                               │
│  │ 5.1 Citation │                                                               │
│  │    Types     │                                                               │
│  └──────┬───────┘                                                               │
│         │                                                                       │
│         ├───────────────────────┬───────────────────────┐                       │
│         │                       │                       │                       │
│         ▼                       ▼                       ▼                       │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐               │
│  │ 5.2-5.12     │        │ 5.13-5.14    │        │ 5.15-5.16    │               │
│  │ Semantic     │        │ TipTap       │        │ Database     │               │
│  │ Scholar API  │        │ Extension    │        │ Migration    │               │
│  │ (parallel)   │        │ (parallel)   │        │ (parallel)   │               │
│  └──────┬───────┘        └──────┬───────┘        └──────┬───────┘               │
│         │                       │                       │                       │
│         └───────────────────────┴───────────────────────┤                       │
│                                                         │                       │
│                                                         ▼                       │
│                                                  ┌──────────────┐               │
│                                                  │ 5.17-5.20    │               │
│                                                  │ Citations    │               │
│                                                  │ API Helpers  │               │
│                                                  └──────┬───────┘               │
│                                                         │                       │
│                                                         ▼                       │
│                                                  ┌──────────────┐               │
│                                                  │ 5.21-5.23    │               │
│                                                  │ API Routes   │               │
│                                                  └──────┬───────┘               │
│                                                         │                       │
│                                                         ▼                       │
│                                                  ┌──────────────┐               │
│                                                  │ 5.24-5.32    │               │
│                                                  │ UI Components│               │
│                                                  └──────┬───────┘               │
│                                                         │                       │
│                                                         ▼                       │
│                                                  ┌──────────────┐               │
│                                                  │ 5.33-5.35    │               │
│                                                  │ E2E Tests    │               │
│                                                  └──────────────┘               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                                             | Tasks     | Description                                   | Prerequisites              |
| ---------------------------------------------------------------- | --------- | --------------------------------------------- | -------------------------- |
| [01-citation-types.md](./01-citation-types.md)                   | 5.1       | Define Paper and SearchResult types           | Pre-flight checklist       |
| [02-semantic-scholar-client.md](./02-semantic-scholar-client.md) | 5.2-5.12  | Semantic Scholar API client with TDD          | 5.1                        |
| [03-tiptap-extension.md](./03-tiptap-extension.md)               | 5.13-5.14 | TipTap citation mark extension                | 5.1 (parallel to 5.2-5.12) |
| [04-database-migration.md](./04-database-migration.md)           | 5.15-5.16 | Citation DB schema enhancements               | 5.1 (parallel to 5.2-5.14) |
| [05-citations-api-helpers.md](./05-citations-api-helpers.md)     | 5.17-5.20 | Supabase citation CRUD helpers                | 5.12, 5.16                 |
| [06-api-routes.md](./06-api-routes.md)                           | 5.21-5.23 | Next.js API routes for citations              | 5.20                       |
| [07-ui-components.md](./07-ui-components.md)                     | 5.24-5.32 | React components (Card, Search, List, Picker) | 5.23                       |
| [08-e2e-tests.md](./08-e2e-tests.md)                             | 5.33-5.35 | Playwright E2E test infrastructure            | 5.32                       |
| [99-verification.md](./99-verification.md)                       | -         | Phase completion verification                 | All tasks                  |

---

## Key Dependencies

- **Semantic Scholar API** - External service for paper search (free tier: 100 requests/5 min)
- **TipTap** - Editor framework for citation marks
- **Supabase** - Database with RLS for citation storage
- **Playwright** - E2E testing framework

---

## Pre-Flight Checklist

Before starting **any** task, verify prerequisites:

```bash
# Check Node.js and package manager
node --version        # Must be 20+
npm --version

# Check dev server runs
npm run dev           # Should start without errors

# Check test infrastructure
npm test              # Should run existing tests

# Verify Supabase CLI
npx supabase --version
```

---

## Architecture

**Client-side:** API wrapper for Semantic Scholar with server-side caching and rate limiting.

**Editor:** TipTap mark extension for inline citations.

**Database:** Supabase tables for citation storage with document-citation junction table.

**UI:** React components for search/list/picker functionality.

**Tech Stack:** Next.js API routes, TipTap editor extensions, Supabase (PostgreSQL + RLS), Vitest for unit tests, Playwright for E2E, MSW for API mocking.

---

## Execution Strategy

### Parallelization

After Task 5.1 (types), three tracks can run in parallel:

1. **Track A (5.2-5.12):** Semantic Scholar client - complete API with TDD
2. **Track B (5.13-5.14):** TipTap extension - editor mark
3. **Track C (5.15-5.16):** Database migration - schema changes

All three tracks must complete before Tasks 5.17+ (API helpers depend on all three).

### Recommended Order

**Single developer:** Follow numerical order 5.1 → 5.35

**Parallel execution with multiple agents:**

1. Complete 5.1 first
2. Then parallel: Track A | Track B | Track C
3. Then sequential: 5.17-5.20 → 5.21-5.23 → 5.24-5.32 → 5.33-5.35

### TDD Discipline

This phase follows strict RED-GREEN-COMMIT cycles:

- **RED:** Write failing tests first
- **GREEN:** Implement minimal code to pass
- **COMMIT:** After every task

Never skip the RED phase - tests must fail before implementation.
