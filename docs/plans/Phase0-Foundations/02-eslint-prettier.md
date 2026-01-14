# Task 0.2: Configure ESLint and Prettier

> **Phase 0** | [← Next.js Init](./01-nextjs-init.md) | [Next: Vitest Setup →](./03-vitest-setup.md)

---

## Context

**This task establishes code quality tooling.** ESLint catches errors and enforces patterns, while Prettier ensures consistent formatting.

### Prerequisites

- **Task 0.1** completed (Next.js project initialized)

### What This Task Creates

- ESLint configuration with Next.js rules
- Prettier configuration for consistent formatting
- Format scripts in package.json

### Tasks That Depend on This

- **Task 0.3** (Vitest) - uses the linting infrastructure
- **Task 0.4** (Playwright) - uses the linting infrastructure
- **Task 0.5** (Supabase) - uses the linting infrastructure
- **Task 0.9** (CI) - runs lint checks

---

## Files to Create/Modify

- `package.json` (modify)
- `.prettierrc` (create)
- `.prettierignore` (create)
- `eslint.config.mjs` (modify)

---

## Steps

### Step 1: Install Prettier and ESLint compatibility packages

```bash
pnpm add -D prettier eslint-config-prettier
```

**Note:** Do NOT install `eslint-plugin-prettier` - it's deprecated for flat config.

**Note on jsx-a11y:** With ESLint 9 and eslint-config-next 16, the `jsx-a11y` plugin is now included automatically in the Next.js ESLint configuration. You no longer need to install or configure it separately.

**Packages explained:**

- `eslint-config-prettier` - Disables ESLint rules that conflict with Prettier

### Step 2: Create Prettier config

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 120
}
```

### Step 3: Create Prettier ignore file

Create `.prettierignore`:

```
node_modules
.next
dist
build
coverage
.env.local
.env*.local
supabase/
playwright-report/
test-results/
```

### Step 4: Update ESLint config for flat config format

Replace `eslint.config.mjs` with:

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Next.js config now includes jsx-a11y automatically in ESLint 9
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettierConfig,

  // Relax TypeScript rules for test files (mocks inherently produce `any`)
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
];

export default eslintConfig;
```

**Note:** ESLint 9 uses the flat config format. The Next.js ESLint config (`eslint-config-next@16`) now automatically includes jsx-a11y for accessibility linting.

**Note:** The test file relaxation is important because mocks inherently produce `any` types, and strict TypeScript rules would require excessive type casting in tests.

### Step 5: Add format scripts to package.json

Add to `scripts` in `package.json`:

```json
"format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\" \"./*.{js,mjs,json,md}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\" \"./*.{js,mjs,json,md}\""
```

### Step 6: Verify ESLint config is valid

```bash
pnpm exec eslint --print-config src/app/page.tsx
```

**Expected:** Should print resolved ESLint configuration without errors. If you see errors about missing plugins or configs, re-check the import statements.

### Step 7: Run format and lint

```bash
pnpm format
pnpm lint
```

**Expected:** No errors

### Step 8: Install Husky and lint-staged for pre-commit hooks

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

### Step 9: Configure lint-staged

Add to `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{js,jsx,mjs}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"]
}
```

### Step 10: Create pre-commit hook

Update `.husky/pre-commit`:

```bash
pnpm exec lint-staged
```

### Step 11: Commit

```bash
git add .
git commit -m "chore: configure ESLint, Prettier, and pre-commit hooks"
```

---

## Verification Checklist

- [ ] `.prettierrc` created with settings
- [ ] `.prettierignore` created
- [ ] `eslint.config.mjs` updated with flat config (jsx-a11y included via next config)
- [ ] `pnpm exec eslint --print-config` succeeds
- [ ] `pnpm format` runs without errors
- [ ] `pnpm lint` runs without errors
- [ ] Husky installed and `.husky/pre-commit` exists
- [ ] `lint-staged` configured in `package.json`
- [ ] Changes committed

---

## Next Steps

After this task, three tasks can proceed in parallel:

- **[Task 0.3: Set Up Vitest](./03-vitest-setup.md)** - Unit testing
- **[Task 0.4: Set Up Playwright](./04-playwright-setup.md)** - E2E testing
- **[Task 0.5: Set Up Supabase](./05-supabase-local.md)** - Database

For sequential execution, proceed to **[Task 0.3](./03-vitest-setup.md)**.
