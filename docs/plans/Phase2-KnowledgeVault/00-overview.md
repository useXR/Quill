# Phase 2: Knowledge Vault Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a robust file upload, text extraction, chunking, embedding, and semantic search system for the Knowledge Vault.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  VaultUpload    │────▶│  Upload API      │────▶│  Supabase       │
│  (drag & drop)  │     │  (validate/store)│     │  Storage        │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Extraction      │
                      │  Queue/Worker    │
                      └────────┬─────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
 ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
 │  PDF Parser   │    │  DOCX Parser  │    │  Text Handler │
 └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
         └─────────────────────┼─────────────────────┘
                               ▼
                      ┌──────────────────┐
                      │  Text Chunker    │
                      │  (2000/200)      │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  OpenAI          │
                      │  Embeddings      │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  vault_chunks    │
                      │  (pgvector)      │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Semantic Search │
                      └──────────────────┘
```

---

## Phase 2 Task Map

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: KNOWLEDGE VAULT                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌────────────────────┐                                                        │
│  │ 2.0 Infrastructure │                                                        │
│  │     Setup          │                                                        │
│  └─────────┬──────────┘                                                        │
│            │                                                                   │
│            ├─────────────────────┬─────────────────────┐                       │
│            ▼                     ▼                     ▼                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 2.1 VaultUpload  │  │ 2.2 VaultItemCard│  │ 2.3 VaultItemList│             │
│  │   (parallel)     │  │   (parallel)     │  │   (parallel)     │             │
│  └─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘             │
│            └─────────────────────┴─────────────────────┘                       │
│                                  │                                             │
│            ┌─────────────────────┼─────────────────────┐                       │
│            ▼                     ▼                     ▼                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 2.4 Vault API    │  │ 2.5 Upload API   │  │ 2.6 Text         │             │
│  │    Helpers       │  │    Route         │  │    Extraction    │             │
│  └─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘             │
│            └─────────────────────┴─────────────────────┘                       │
│                                  │                                             │
│            ┌─────────────────────┼─────────────────────┐                       │
│            ▼                     ▼                     ▼                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 2.7 Text         │  │ 2.8 OpenAI       │  │ 2.9 Extraction   │             │
│  │    Chunker       │  │    Embeddings    │  │    Processor     │             │
│  └─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘             │
│            └─────────────────────┴─────────────────────┘                       │
│                                  │                                             │
│                                  ▼                                             │
│                        ┌──────────────────┐                                    │
│                        │ 2.10 Semantic    │                                    │
│                        │     Search       │                                    │
│                        └─────────┬────────┘                                    │
│                                  │                                             │
│            ┌─────────────────────┴─────────────────────┐                       │
│            ▼                                           ▼                       │
│  ┌──────────────────┐                        ┌──────────────────┐             │
│  │ 2.11 VaultSearch │                        │ 2.12 Vault Page  │             │
│  │    Component     │                        │    Integration   │             │
│  └─────────┬────────┘                        └─────────┬────────┘             │
│            └─────────────────────┬─────────────────────┘                       │
│                                  │                                             │
│                                  ▼                                             │
│                        ┌──────────────────┐                                    │
│                        │ 2.13 E2E Tests   │                                    │
│                        └──────────────────┘                                    │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                                                 | Task | Description                                       | Prerequisites                |
| -------------------------------------------------------------------- | ---- | ------------------------------------------------- | ---------------------------- |
| [01-infrastructure-setup.md](./01-infrastructure-setup.md)           | 2.0  | Database tables, storage bucket, constants, types | Phase 0 and Phase 1 complete |
| [02-vault-upload-component.md](./02-vault-upload-component.md)       | 2.1  | Drag-drop upload component with validation (TDD)  | 2.0                          |
| [03-vault-item-card-component.md](./03-vault-item-card-component.md) | 2.2  | File card with status display (TDD)               | 2.0                          |
| [04-vault-item-list-component.md](./04-vault-item-list-component.md) | 2.3  | List container for vault items (TDD)              | 2.2                          |
| [05-vault-api-helpers.md](./05-vault-api-helpers.md)                 | 2.4  | Server-side vault CRUD operations (TDD)           | 2.0                          |
| [06-upload-api-route.md](./06-upload-api-route.md)                   | 2.5  | Upload API route with extraction queue            | 2.4                          |
| [07-text-extraction.md](./07-text-extraction.md)                     | 2.6  | PDF, DOCX, and TXT text extraction (TDD)          | 2.0                          |
| [08-text-chunker.md](./08-text-chunker.md)                           | 2.7  | Text chunking with sentence boundaries (TDD)      | 2.0                          |
| [09-openai-embeddings.md](./09-openai-embeddings.md)                 | 2.8  | OpenAI embeddings with batching (TDD)             | 2.0                          |
| [10-extraction-processor.md](./10-extraction-processor.md)           | 2.9  | Orchestrates extraction pipeline                  | 2.6, 2.7, 2.8                |
| [11-semantic-search.md](./11-semantic-search.md)                     | 2.10 | pgvector search function and API (TDD)            | 2.9                          |
| [12-vault-search-component.md](./12-vault-search-component.md)       | 2.11 | Search UI component (TDD)                         | 2.10                         |
| [13-vault-page-integration.md](./13-vault-page-integration.md)       | 2.12 | Vault page with all components                    | 2.1, 2.3, 2.11               |
| [14-e2e-tests.md](./14-e2e-tests.md)                                 | 2.13 | End-to-end Playwright tests                       | 2.12                         |
| [99-verification.md](./99-verification.md)                           | -    | Phase completion verification                     | All tasks                    |

---

## Key Dependencies

- **Next.js 14+** - App router with async params
- **Supabase** - Storage (files) + pgvector (embeddings) + RLS (security)
- **OpenAI API** - text-embedding-3-small model for embeddings
- **pdf-parse** - PDF text extraction
- **mammoth** - DOCX text extraction
- **Zod** - API validation

---

## Pre-Flight Checklist

Before starting **any** task, verify prerequisites:

```bash
# Check Phase 0 and 1 complete
npm run dev              # Server starts without errors
npm test                 # Tests pass
npm run build            # Build succeeds

# Check Supabase is running
npx supabase status

# Check OpenAI API key
grep OPENAI_API_KEY .env.local
```

---

## Execution Strategy

### Sequential vs Parallel Tasks

- **Task 2.0** must complete first (infrastructure)
- **Tasks 2.1, 2.2, 2.3** can run in parallel after 2.0
- **Tasks 2.4, 2.5, 2.6, 2.7, 2.8** can mostly run in parallel after 2.0
- **Task 2.9** requires 2.6, 2.7, and 2.8 complete
- **Task 2.10** requires 2.9 complete
- **Tasks 2.11, 2.12** can run in parallel after 2.10
- **Task 2.13** is the final task before verification

### Recommended Order

For a single developer, follow numerical order: 2.0 → 2.1 → ... → 2.13

For parallel execution with multiple agents:

1. Complete 2.0 first
2. Then parallel: 2.1 | 2.2 | 2.4 | 2.6 | 2.7 | 2.8
3. Then 2.3 (needs 2.2), 2.5 (needs 2.4)
4. Then 2.9 (needs 2.6, 2.7, 2.8)
5. Then 2.10 (needs 2.9)
6. Then parallel: 2.11 | 2.12
7. Finally 2.13

---

## Tech Stack Summary

| Component    | Technology                                      |
| ------------ | ----------------------------------------------- |
| Framework    | Next.js 14+ (App Router)                        |
| Database     | Supabase (PostgreSQL + pgvector)                |
| Storage      | Supabase Storage                                |
| Embeddings   | OpenAI text-embedding-3-small (1536 dimensions) |
| PDF Parsing  | pdf-parse                                       |
| DOCX Parsing | mammoth                                         |
| Validation   | Zod                                             |
| Testing      | Vitest (unit), Playwright (E2E)                 |
