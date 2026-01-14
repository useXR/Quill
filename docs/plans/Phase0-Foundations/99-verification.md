# Phase 0 Verification Checklist

> **Phase 0** | [<- Dev Scripts & Docs](./10-dev-scripts-docs.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 0 tasks are complete and working.** Run through each section to confirm the development environment is fully functional.

---

## Automated Verification

Save this script as `scripts/verify-phase0.sh` and run it to verify all Phase 0 requirements.

### Step 1: Create verification script

Create `scripts/verify-phase0.sh`:

```bash
#!/bin/bash
set -e

echo "Phase 0 Verification"
echo "===================="
echo ""

FAILURES=0

# Helper function
check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "pass" ]; then
    echo "   PASS: $name"
  else
    echo "   FAIL: $name"
    ((FAILURES++)) || true
  fi
}

# 1. Check Node version
echo "1. Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
  check "Node.js $(node -v)" "pass"
else
  check "Node.js 20+ required, found $(node -v)" "fail"
fi

# 2. Check pnpm
echo "2. pnpm version..."
if command -v pnpm &> /dev/null; then
  check "pnpm $(pnpm -v)" "pass"
else
  check "pnpm not installed" "fail"
fi

# 3. Check Docker
echo "3. Docker status..."
if docker ps &> /dev/null; then
  check "Docker running" "pass"
else
  check "Docker not running" "fail"
fi

# 4. Check Supabase
echo "4. Supabase status..."
if pnpm exec supabase status &> /dev/null; then
  check "Supabase running" "pass"
else
  check "Supabase not running" "fail"
fi

# 5. Check .env.local
echo "5. Environment file..."
if [ -f ".env.local" ]; then
  if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
    check ".env.local configured" "pass"
  else
    check ".env.local missing required keys" "fail"
  fi
else
  check ".env.local not found" "fail"
fi

# 6. Run linting
echo "6. ESLint..."
if pnpm lint --quiet 2>/dev/null; then
  check "No lint errors" "pass"
else
  check "Lint errors found" "fail"
fi

# 7. Run format check
echo "7. Prettier formatting..."
if pnpm format:check 2>/dev/null; then
  check "Formatting correct" "pass"
else
  check "Formatting issues found" "fail"
fi

# 8. Run unit tests
echo "8. Unit tests..."
if pnpm test 2>/dev/null; then
  check "All unit tests pass" "pass"
else
  check "Unit tests failed" "fail"
fi

# 9. Run build
echo "9. Build..."
if pnpm build 2>/dev/null; then
  check "Build successful" "pass"
else
  check "Build failed" "fail"
fi

# 10. Check critical files exist
echo "10. Critical files..."
CRITICAL_FILES=(
  "src/app/api/health/route.ts"
  ".gitattributes"
  "src/lib/supabase/client.ts"
  "src/lib/supabase/server.ts"
  "src/lib/supabase/admin.ts"
  "src/lib/supabase/database.types.ts"
  "e2e/helpers/cleanup.ts"
  "e2e/pages/LoginPage.ts"
  ".husky/pre-commit"
)
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    check "$file exists" "pass"
  else
    check "$file not found" "fail"
  fi
done

# 11. Check next.config.ts has standalone output
echo "11. Next.js standalone output..."
if grep -q "standalone" next.config.ts 2>/dev/null; then
  check "standalone output configured" "pass"
else
  check "next.config.ts missing output: 'standalone'" "fail"
fi

# 12. Check database tables
echo "12. Database tables..."
TABLES=$(pnpm exec supabase db dump --schema public 2>/dev/null | grep -c "CREATE TABLE" || echo "0")
if [ "$TABLES" -ge 9 ]; then
  check "Found $TABLES tables (expected 9+)" "pass"
else
  check "Found $TABLES tables (expected 9+)" "fail"
fi

# 13. Check TypeScript types
echo "13. TypeScript types..."
if grep -q "export type Database" src/lib/supabase/database.types.ts 2>/dev/null; then
  check "Database types generated" "pass"
else
  check "Database types not generated" "fail"
fi

# Summary
echo ""
echo "===================="
if [ $FAILURES -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  echo ""
  echo "Manual verification still required:"
  echo "- E2E tests: pnpm test:e2e:chromium"
  echo "- Dev server: pnpm dev (visit http://localhost:3000)"
  echo "- Health endpoint: curl http://localhost:3000/api/health"
  echo "- Supabase Studio: http://localhost:54323"
  exit 0
else
  echo "FAILED: $FAILURES check(s) did not pass"
  exit 1
fi
```

### Step 2: Make script executable

```bash
chmod +x scripts/verify-phase0.sh
```

### Step 3: Run verification

```bash
./scripts/verify-phase0.sh
```

---

## Manual Verification Steps

### 1. Development Server

```bash
pnpm dev
```

- [ ] Server starts on http://localhost:3000
- [ ] Page loads without errors
- [ ] No console errors in browser

### 1b. Health Endpoint

While dev server is running:

```bash
curl http://localhost:3000/api/health
```

- [ ] Returns JSON with `status: "healthy"` or `status: "degraded"`
- [ ] Includes `timestamp`, `version`, and `checks` fields
- [ ] `checks.database.status` is `"ok"` when Supabase is running

Press `Ctrl+C` to stop dev server.

### 2. Unit Tests

```bash
pnpm test
```

- [ ] All tests pass
- [ ] No warnings or errors
- [ ] Tests include: example.test.ts, client.test.ts

### 3. E2E Tests

```bash
pnpm test:e2e:chromium
```

- [ ] All tests pass (4 tests expected)
- [ ] Homepage tests pass
- [ ] Accessibility audit runs

### 4. Linting and Formatting

```bash
pnpm lint
pnpm format:check
```

- [ ] No lint errors
- [ ] No formatting issues

### 5. TypeScript

```bash
pnpm exec tsc --noEmit
```

- [ ] No type errors

### 6. Build

```bash
pnpm build
```

- [ ] Build completes successfully
- [ ] No warnings about missing dependencies

### 7. Supabase

```bash
pnpm exec supabase status
```

- [ ] Shows running services
- [ ] API URL: http://127.0.0.1:54321
- [ ] Studio URL: http://localhost:54323

### 8. Database

```bash
pnpm exec supabase db dump --schema public | head -50
```

- [ ] Shows table definitions
- [ ] Tables include: profiles, projects, documents, vault_items, vault_chunks, citations, chat_history, audit_logs, ai_operations

### 9. TypeScript Types

```bash
head -50 src/lib/supabase/database.types.ts
```

- [ ] File exists
- [ ] Contains `export type Database = {`
- [ ] Contains table definitions

---

## File Checklist

### Task 0.1 - Next.js Init

- [ ] `package.json` exists with `packageManager` field
- [ ] `.nvmrc` contains `20`
- [ ] `.gitattributes` exists with LF line endings for scripts
- [ ] `tsconfig.json` exists
- [ ] `next.config.ts` exists with `output: 'standalone'`

### Task 0.2 - ESLint/Prettier

- [ ] `eslint.config.mjs` exists with test file relaxation and jsx-a11y
- [ ] `.prettierrc` exists
- [ ] `.prettierignore` exists
- [ ] `.husky/pre-commit` exists with lint-staged
- [ ] `lint-staged` configured in `package.json`

### Task 0.3 - Vitest

- [ ] `vitest.config.ts` exists
- [ ] `vitest.setup.ts` exists with browser API mocks
- [ ] `src/test-utils/render.tsx` exists
- [ ] `src/test-utils/next-mocks.ts` exists
- [ ] `src/test-utils/index.ts` exists
- [ ] `src/lib/__tests__/example.test.ts` exists

### Task 0.4 - Playwright

- [ ] `playwright.config.ts` exists
- [ ] `.env.test` exists
- [ ] `e2e/config/timeouts.ts` exists
- [ ] `e2e/fixtures/test-accounts.ts` exists
- [ ] `e2e/fixtures/test-fixtures.ts` exists
- [ ] `e2e/helpers/hydration.ts` exists
- [ ] `e2e/helpers/auth.ts` exists
- [ ] `e2e/helpers/axe.ts` exists
- [ ] `e2e/helpers/cleanup.ts` exists with TestDataCleanup class
- [ ] `e2e/pages/LoginPage.ts` exists (Page Object Model)
- [ ] `e2e/setup/global-setup.ts` exists
- [ ] `e2e/setup/global-teardown.ts` exists
- [ ] `e2e/home/example.spec.ts` exists

### Task 0.5 - Supabase Local

- [ ] `supabase/config.toml` exists
- [ ] `.env.local.example` exists
- [ ] `.env.local` exists (with real keys)
- [ ] `src/lib/supabase/client.ts` exists with env validation
- [ ] `src/lib/supabase/server.ts` exists with env validation
- [ ] `src/lib/supabase/admin.ts` exists for service-role operations

### Task 0.6 - Database Schema

- [ ] `supabase/migrations/*_initial_schema.sql` exists
- [ ] Migration contains all 9 tables

### Task 0.7 - TypeScript Types

- [ ] `src/lib/supabase/database.types.ts` exists
- [ ] `src/lib/supabase/types.ts` exists
- [ ] `src/lib/supabase/index.ts` exists

### Task 0.8 - Test Utilities

- [ ] `src/lib/supabase/test-utils.ts` exists with TestData class
- [ ] `src/test-utils/factories.ts` exists
- [ ] `src/lib/supabase/__tests__/client.test.ts` exists

### Task 0.9 - GitHub Actions

- [ ] `.github/workflows/ci.yml` exists

### Task 0.10 - Dev Scripts & Docs

- [ ] `src/app/api/health/route.ts` exists
- [ ] `scripts/dev-setup.sh` exists and is executable
- [ ] `DEVELOPMENT.md` exists

---

## Package.json Scripts

Verify these scripts exist in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write ...",
    "format:check": "prettier --check ...",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:serial": "playwright test --project=serial",
    "test:all": "pnpm lint && pnpm format:check && pnpm test && pnpm test:e2e:chromium",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:status": "supabase status",
    "db:push": "supabase db push",
    "db:types": "pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts"
  }
}
```

---

## Summary

| Task                    | Status |
| ----------------------- | ------ |
| 0.1 Next.js Init        | [ ]    |
| 0.2 ESLint/Prettier     | [ ]    |
| 0.3 Vitest Setup        | [ ]    |
| 0.4 Playwright Setup    | [ ]    |
| 0.5 Supabase Local      | [ ]    |
| 0.6 Database Schema     | [ ]    |
| 0.7 TypeScript Types    | [ ]    |
| 0.8 Test Utilities      | [ ]    |
| 0.9 GitHub Actions      | [ ]    |
| 0.10 Dev Scripts & Docs | [ ]    |

---

## Phase 0 Complete

**All checks passing? Phase 0 is complete!**

Proceed to **Phase 1: Authentication & User Management**.
