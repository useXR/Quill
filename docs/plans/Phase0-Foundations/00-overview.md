# Phase 0: Foundation & Testing Infrastructure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish complete development environment, testing pyramid, and CI/CD pipeline before any feature work begins.

---

## Phase 0 Task Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 0: FOUNDATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ 0.1 Next.js  │ ──────────────────────────────────────────────────────┐   │
│  │    Init      │                                                       │   │
│  └──────┬───────┘                                                       │   │
│         │                                                               │   │
│         ▼                                                               │   │
│  ┌──────────────┐                                                       │   │
│  │ 0.2 ESLint   │                                                       │   │
│  │   Prettier   │                                                       │   │
│  └──────┬───────┘                                                       │   │
│         │                                                               │   │
│         ├─────────────────────┬─────────────────────┐                   │   │
│         ▼                     ▼                     ▼                   │   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐           │   │
│  │ 0.3 Vitest   │      │ 0.4 Playwright│      │ 0.5 Supabase │           │   │
│  │    Setup     │      │    Setup     │      │    Local     │           │   │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘           │   │
│         │                     │                     │                   │   │
│         │                     │                     ▼                   │   │
│         │                     │              ┌──────────────┐           │   │
│         │                     │              │ 0.6 Database │           │   │
│         │                     │              │    Schema    │           │   │
│         │                     │              └──────┬───────┘           │   │
│         │                     │                     │                   │   │
│         │                     │                     ▼                   │   │
│         │                     │              ┌──────────────┐           │   │
│         │                     │              │ 0.7 TS Types │           │   │
│         │                     │              └──────┬───────┘           │   │
│         │                     │                     │                   │   │
│         └─────────────────────┴─────────────────────┤                   │   │
│                                                     │                   │   │
│                                                     ▼                   │   │
│                                              ┌──────────────┐           │   │
│                                              │ 0.8 Test     │           │   │
│                                              │  Utilities   │           │   │
│                                              └──────┬───────┘           │   │
│                                                     │                   │   │
│                                                     ▼                   │   │
│                                              ┌──────────────┐           │   │
│                                              │ 0.9 GitHub   │◄──────────┘   │
│                                              │  Actions CI  │               │
│                                              └──────┬───────┘               │
│                                                     │                       │
│                                                     ▼                       │
│                                              ┌──────────────┐               │
│                                              │ 0.10 Dev     │               │
│                                              │ Scripts/Docs │               │
│                                              └──────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                               | Task | Description                       | Prerequisites        |
| -------------------------------------------------- | ---- | --------------------------------- | -------------------- |
| [01-nextjs-init.md](./01-nextjs-init.md)           | 0.1  | Initialize Next.js with Git       | Pre-flight checklist |
| [02-eslint-prettier.md](./02-eslint-prettier.md)   | 0.2  | Configure ESLint and Prettier     | 0.1                  |
| [03-vitest-setup.md](./03-vitest-setup.md)         | 0.3  | Set up Vitest for unit testing    | 0.2                  |
| [04-playwright-setup.md](./04-playwright-setup.md) | 0.4  | Set up Playwright for E2E testing | 0.2                  |
| [05-supabase-local.md](./05-supabase-local.md)     | 0.5  | Set up Supabase local development | 0.2                  |
| [06-database-schema.md](./06-database-schema.md)   | 0.6  | Create database schema migration  | 0.5                  |
| [07-typescript-types.md](./07-typescript-types.md) | 0.7  | Generate TypeScript types         | 0.6                  |
| [08-test-utilities.md](./08-test-utilities.md)     | 0.8  | Set up test database utilities    | 0.3, 0.7             |
| [09-github-actions.md](./09-github-actions.md)     | 0.9  | Set up GitHub Actions CI          | 0.3, 0.4, 0.8        |
| [10-dev-scripts-docs.md](./10-dev-scripts-docs.md) | 0.10 | Create dev scripts and docs       | 0.9                  |
| [99-verification.md](./99-verification.md)         | -    | Phase completion verification     | All tasks            |

---

## Key Dependencies

- **Node.js 24+** - Required for Next.js 16+ features
- **pnpm 9+** - Package manager (faster, stricter than npm)
- **Docker** - Required for Supabase local development

---

## System Requirements

| Resource   | Minimum | Recommended | Notes                                                    |
| ---------- | ------- | ----------- | -------------------------------------------------------- |
| RAM        | 8 GB    | 16 GB       | Supabase containers + Next.js dev server                 |
| Disk Space | 5 GB    | 10 GB       | ~2 GB for Playwright browsers, ~2 GB for Supabase images |
| Docker     | Running | Running     | Required for local Supabase                              |

---

## Phase 0 Success Criteria

Phase 0 is **complete** when:

1. **Development Environment**
   - [ ] `pnpm dev` starts Next.js on localhost:3000
   - [ ] `pnpm exec supabase status` shows all services running
   - [ ] `.env.local` contains valid Supabase keys

2. **Testing Infrastructure**
   - [ ] `pnpm test` runs unit tests (Vitest)
   - [ ] `pnpm test:e2e:chromium` runs E2E tests (Playwright)
   - [ ] `pnpm test:coverage` generates coverage report

3. **Code Quality**
   - [ ] `pnpm lint` passes with no errors
   - [ ] `pnpm format:check` passes
   - [ ] Pre-commit hooks run lint-staged

4. **Database**
   - [ ] 9 tables created (profiles, projects, documents, vault_items, vault_chunks, citations, chat_history, audit_logs, ai_operations)
   - [ ] RLS policies enabled on all tables
   - [ ] TypeScript types generated from schema

5. **CI/CD**
   - [ ] GitHub Actions workflow passes all checks
   - [ ] Build completes successfully

6. **Documentation**
   - [ ] DEVELOPMENT.md exists with setup instructions
   - [ ] `/api/health` endpoint returns status

---

## Pre-Flight Checklist

Before starting **any** task, verify prerequisites:

```bash
# Check git is installed
git --version

# Check Node.js version (must be 24+)
node --version

# Check pnpm is installed (must be 9+)
pnpm --version
# If not installed: npm install -g pnpm

# Check Docker is installed AND running
docker --version
docker ps  # Must not error - daemon must be running
```

**All checks must pass before proceeding to Task 0.1.**

**Note on first-time setup:** The first `supabase start` command will download ~2GB of Docker images and may take 5-10 minutes depending on your connection speed. Subsequent starts are much faster.

---

## Execution Strategy

### Sequential vs Parallel Tasks

- **Tasks 0.1 → 0.2** must be sequential (0.2 depends on 0.1)
- **Tasks 0.3, 0.4, 0.5** can be done in parallel after 0.2
- **Tasks 0.6 → 0.7** are sequential (types depend on schema)
- **Task 0.8** requires both 0.3 (Vitest) and 0.7 (types)
- **Task 0.9** requires 0.3, 0.4, and 0.8
- **Task 0.10** is the final task

### Recommended Order

For a single developer, follow numerical order: 0.1 → 0.2 → ... → 0.10

For parallel execution with multiple agents:

1. Complete 0.1 → 0.2 first
2. Then parallel: 0.3 | 0.4 | 0.5
3. Then 0.6 → 0.7
4. Then 0.8 → 0.9 → 0.10

---

## Tech Stack Summary

| Layer           | Technology               | Purpose                          |
| --------------- | ------------------------ | -------------------------------- |
| Framework       | Next.js 16+ (App Router) | React framework with SSR/SSG     |
| Language        | TypeScript               | Type safety                      |
| Styling         | Tailwind CSS             | Utility-first CSS                |
| Database        | Supabase (PostgreSQL)    | Backend-as-a-service             |
| Unit Tests      | Vitest                   | Fast unit/integration tests      |
| E2E Tests       | Playwright               | Cross-browser E2E testing        |
| Accessibility   | axe-core                 | WCAG 2.1 AA compliance           |
| CI/CD           | GitHub Actions           | Automated testing and deployment |
| Package Manager | pnpm                     | Fast, disk-efficient             |

---

## Environment Isolation

| Environment | App Port | Purpose                           |
| ----------- | -------- | --------------------------------- |
| Development | 3000     | Local development with hot reload |
| E2E Testing | 3088     | Isolated E2E test runs            |

This isolation prevents conflicts between development and test environments.

---

## Infrastructure Deferred to Later Phases

Phase 0 establishes the **development and testing foundation**. The following production infrastructure concerns are intentionally deferred to deployment-focused phases:

| Item                     | Description                                                                    | Target Phase |
| ------------------------ | ------------------------------------------------------------------------------ | ------------ |
| **Security Headers**     | CSP, HSTS, X-Frame-Options, etc. in `next.config.ts`                           | Phase 1      |
| **Rate Limiting**        | Login (5/min), registration (3/min), API (100/min)                             | Phase 1      |
| **Zod Validation**       | Schema validation for forms and API inputs                                     | Phase 1      |
| **Custom Error Classes** | `AppError`, `NotFoundError`, `UnauthorizedError`                               | Phase 1      |
| **Constants Files**      | `lib/constants/auth.ts`, `lib/constants/retention.ts`                          | Phase 1      |
| **Docker Compose**       | `docker-compose.dev.yml`, `docker-compose.test.yml`, `docker-compose.prod.yml` | Deployment   |
| **Dockerfile**           | Multi-stage production build with non-root user                                | Deployment   |
| **Backup Scripts**       | Database backup/restore with checksums                                         | Operations   |
| **Deployment Scripts**   | Update and rollback automation                                                 | Deployment   |
| **Structured Logging**   | Pino or similar for JSON logs                                                  | Phase 1-2    |
| **Resource Limits**      | Docker memory/CPU constraints                                                  | Deployment   |

**Preparation completed in Phase 0:**

- ✅ `output: 'standalone'` in `next.config.ts` (required for Docker)
- ✅ `/api/health` endpoint (required for Docker health checks)
- ✅ `.gitattributes` for LF line endings (prevents script failures)
- ✅ Port isolation strategy (dev: 3000, test: 3088, prod: internal)
- ✅ `audit_logs` table (for security tracking)
- ✅ RLS policies on all tables (database-level access control)
- ✅ Typed Supabase clients (type-safe database queries)

See `docs/best-practices/infrastructure-best-practices.md` for detailed patterns when implementing these items.

---

## After Phase 0

Once all tasks are complete and [verification](./99-verification.md) passes:

- Development environment is fully configured
- Testing pyramid is established (unit → integration → E2E)
- CI/CD pipeline runs all checks on every PR
- Database schema and types are in place

**Proceed to Phase 1: Authentication & User Management**
