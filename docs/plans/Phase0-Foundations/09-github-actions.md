# Task 0.9: Set Up GitHub Actions CI

> **Phase 0** | [<- Test Utilities](./08-test-utilities.md) | [Next: Dev Scripts & Docs ->](./10-dev-scripts-docs.md)

---

## Context

**This task sets up GitHub Actions for continuous integration.** The CI pipeline runs lint, format checks, type checking, unit tests, build, and E2E tests on every push and pull request.

### Prerequisites

- **Task 0.3** completed (Vitest configured)
- **Task 0.4** completed (Playwright configured)
- **Task 0.8** completed (Test utilities created)

### What This Task Creates

- GitHub Actions CI workflow
- Lint, test, build, and E2E jobs
- Artifact caching for performance
- Status checks for PRs

---

## Files to Create

- `.github/workflows/ci.yml`

---

## Steps

### Step 1: Create CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# Cancel in-progress runs for the same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint --cache

      - name: Check Prettier formatting
        run: pnpm format:check

      - name: Type check
        run: pnpm exec tsc --noEmit

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start Supabase
        run: |
          pnpm exec supabase start
          pnpm exec supabase status

      - name: Run Vitest
        run: pnpm test:coverage
        env:
          NODE_ENV: test
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' }}

      - name: Upload coverage reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

      - name: Stop Supabase
        if: always()
        run: pnpm exec supabase stop

  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-for-build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: nextjs-build
          path: .next/
          retention-days: 1

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: build

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start Supabase
        run: |
          pnpm exec supabase start
          pnpm exec supabase status

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: nextjs-build
          path: .next/

      # NOTE: The Playwright webServer is configured to run 'pnpm start' in CI
      # since we already have the build artifact downloaded above.
      # Port 3099 is used to avoid conflicts with any other services.
      # The /api/health endpoint is available for debugging if tests fail.
      - name: Run Playwright tests (Chromium + Serial)
        run: pnpm exec playwright test --project=chromium --project=serial
        env:
          PORT: '3099'
          BASE_URL: 'http://localhost:3099'
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' }}
          CI: 'true'

      # Debug step: Check health endpoint if tests fail
      - name: Check health endpoint (debug)
        if: failure()
        run: |
          echo "Checking application health for debugging..."
          curl -sf http://localhost:3099/api/health || echo "Health check failed"
        continue-on-error: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload test results on failure
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-results
          path: test-results/
          retention-days: 7

      - name: Stop Supabase
        if: always()
        run: pnpm exec supabase stop

  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [lint, test, build, e2e]
    if: always()

    steps:
      - name: Check all jobs passed
        if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
        run: exit 1

      - name: CI passed
        run: echo "All CI checks passed!"
```

### Step 2: Commit

```bash
git add .
git commit -m "chore: add GitHub Actions CI workflow"
```

---

## CI Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CI PIPELINE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│  │   lint   │   │   test   │   │  build   │                 │
│  │          │   │  (unit)  │   │          │                 │
│  └──────────┘   └──────────┘   └────┬─────┘                 │
│       │              │              │                        │
│       │              │              ▼                        │
│       │              │        ┌──────────┐                  │
│       │              │        │   e2e    │                  │
│       │              │        │          │                  │
│       │              │        └────┬─────┘                  │
│       │              │             │                         │
│       └──────────────┴─────────────┤                         │
│                                    ▼                         │
│                           ┌──────────────┐                  │
│                           │  ci-success  │                  │
│                           └──────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Job Dependencies

- **lint, test, build**: Run in parallel
- **e2e**: Waits for build to complete (uses build artifact)
- **ci-success**: Waits for all jobs, fails if any job failed

---

## CI Configuration Details

| Setting             | Value              | Purpose                           |
| ------------------- | ------------------ | --------------------------------- |
| Node version        | 20                 | Match project requirements        |
| pnpm cache          | enabled            | Faster dependency installation    |
| Playwright browsers | Chromium only      | Faster E2E runs in CI             |
| E2E port            | 3099               | Isolated from other services      |
| Concurrency         | cancel-in-progress | Don't waste resources on old runs |
| Timeouts            | 10-30 min          | Prevent hung jobs                 |

---

## Artifacts

The CI uploads these artifacts on failure:

- **coverage-report**: Vitest coverage (always uploaded)
- **playwright-report**: E2E test report (always uploaded)
- **playwright-results**: Screenshots/videos on failure

---

## Verification Checklist

- [ ] `.github/workflows/ci.yml` created
- [ ] Workflow syntax is valid (GitHub will validate on push)
- [ ] Changes committed

---

## Testing the CI Locally

Before pushing, you can test the workflow steps locally:

```bash
# Lint & Format
pnpm lint
pnpm format:check
pnpm exec tsc --noEmit

# Unit tests
pnpm test:coverage

# Build
pnpm build

# E2E (with test port)
PORT=3099 pnpm test:e2e:chromium
```

---

## Next Steps

After this task, proceed to **[Task 0.10: Create Dev Scripts & Docs](./10-dev-scripts-docs.md)**.
