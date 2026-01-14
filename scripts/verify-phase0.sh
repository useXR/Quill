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

# 11. Check next.config has standalone output
echo "11. Next.js standalone output..."
if grep -q "standalone" next.config.mjs 2>/dev/null; then
  check "standalone output configured" "pass"
else
  check "next.config.mjs missing output: 'standalone'" "fail"
fi

# 12. Check database tables
echo "12. Database tables..."
# Use Docker to query local Supabase database directly
DB_CONTAINER=$(docker ps --filter "name=supabase_db" --format "{{.Names}}" | head -1)
if [ -n "$DB_CONTAINER" ]; then
  TABLES=$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' \n' || echo "0")
else
  TABLES="0"
fi
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
