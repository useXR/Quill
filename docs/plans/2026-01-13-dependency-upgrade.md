# Dependency Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade all outdated dependencies to their latest stable versions, ensuring compatibility and fixing breaking changes.

**Architecture:** Sequential upgrade in dependency order - React/Next.js first (as foundation), then Tailwind CSS, then ESLint. Each upgrade includes testing before proceeding.

**Tech Stack:** Next.js 16.1, React 19, Tailwind CSS 4, ESLint 9, pnpm

---

## Pre-Upgrade Checklist

- [ ] Create a new git branch for the upgrade
- [ ] Ensure all tests pass before starting
- [ ] Commit any pending changes

---

## Task 1: Create Upgrade Branch and Verify Current State

**Files:**

- None (git operations only)

**Step 1: Create upgrade branch**

```bash
git checkout -b upgrade/dependencies-2026-01
```

**Step 2: Verify current tests pass**

```bash
pnpm test
```

Expected: All tests pass

**Step 3: Verify current lint passes**

```bash
pnpm lint
```

Expected: No errors

**Step 4: Commit branch creation**

```bash
git add -A && git commit --allow-empty -m "chore: start dependency upgrade branch"
```

---

## Task 2: Upgrade React and Next.js

**Files:**

- Modify: `package.json`
- Modify: `next.config.mjs`
- Modify: `src/contexts/auth.tsx:35` (Context.Provider → Context)

**Step 1: Run Next.js upgrade codemod**

```bash
npx @next/codemod@canary upgrade latest
```

This will:

- Upgrade `next` to 16.x
- Upgrade `react` and `react-dom` to 19.x
- Upgrade `@types/react` and `@types/react-dom` to 19.x
- Upgrade `eslint-config-next` to 16.x
- Apply necessary codemods

**Step 2: Update next.config.mjs - move serverExternalPackages out of experimental**

Change from:

```javascript
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  },
```

To:

```javascript
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
```

**Step 3: Update Context.Provider to Context (React 19 deprecation)**

In `src/contexts/auth.tsx`, line 35, change:

```tsx
return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
```

To:

```tsx
return <AuthContext value={{ user, loading }}>{children}</AuthContext>;
```

**Step 4: Install updated dependencies**

```bash
pnpm install
```

**Step 5: Verify build works**

```bash
pnpm build
```

Expected: Build succeeds

**Step 6: Run tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 7: Verify dev server starts without errors**

```bash
timeout 10 pnpm dev || true
```

Expected: Server starts without MODULE_NOT_FOUND or config warnings

**Step 8: Commit React/Next.js upgrade**

```bash
git add -A
git commit -m "chore: upgrade React 18→19 and Next.js 14→16

- React 19: Context.Provider → Context syntax
- Next.js 16: serverExternalPackages moved out of experimental
- Updated all related type definitions"
```

---

## Task 3: Upgrade Tailwind CSS

**Files:**

- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `postcss.config.mjs`
- Delete: `tailwind.config.ts` (v4 uses CSS-based config)

**Step 1: Run Tailwind upgrade tool**

```bash
npx @tailwindcss/upgrade
```

This will:

- Upgrade `tailwindcss` to 4.x
- Convert `@tailwind` directives to `@import "tailwindcss"`
- Migrate `tailwind.config.ts` to CSS-based configuration
- Update utility class names (shadow-sm → shadow-xs, etc.)
- Update PostCSS config

**Step 2: Verify the upgrade changes**

Check that `src/app/globals.css` now starts with:

```css
@import 'tailwindcss';
```

Check that `postcss.config.mjs` uses `@tailwindcss/postcss`:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**Step 3: Install updated dependencies**

```bash
pnpm install
```

**Step 4: Verify build works**

```bash
pnpm build
```

Expected: Build succeeds

**Step 5: Run tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 6: Visual verification**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3000 > /dev/null && echo "Server running"
pkill -f "next dev"
```

**Step 7: Commit Tailwind upgrade**

```bash
git add -A
git commit -m "chore: upgrade Tailwind CSS 3→4

- Migrated to CSS-based configuration
- Updated @tailwind directives to @import
- Utility classes auto-migrated by upgrade tool"
```

---

## Task 4: Upgrade ESLint

**Files:**

- Modify: `package.json`
- Modify: `eslint.config.mjs`

**Step 1: Upgrade ESLint and related packages**

```bash
pnpm add -D eslint@latest @eslint/eslintrc@latest eslint-plugin-jsx-a11y@latest
```

**Step 2: Update eslint.config.mjs for ESLint 9 compatibility**

The current config uses `FlatCompat` which should still work. Verify it runs:

```bash
pnpm lint
```

If there are errors, update `eslint.config.mjs` to:

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettierConfig,

  // Accessibility rules for JSX
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
    },
  },

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

**Step 3: Verify lint passes**

```bash
pnpm lint
```

Expected: No errors (or only pre-existing warnings)

**Step 4: Run tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 5: Commit ESLint upgrade**

```bash
git add -A
git commit -m "chore: upgrade ESLint 8→9

- Updated to flat config compatible version
- eslint-config-next already upgraded with Next.js"
```

---

## Task 5: Upgrade Supabase CLI

**Files:**

- Modify: `package.json`

**Step 1: Upgrade Supabase CLI**

```bash
pnpm add -D supabase@latest
```

**Step 2: Verify Supabase commands work**

```bash
pnpm exec supabase --version
```

Expected: Shows version 2.x

**Step 3: Commit Supabase upgrade**

```bash
git add -A
git commit -m "chore: upgrade Supabase CLI 1→2"
```

---

## Task 6: Update @types/node

**Files:**

- Modify: `package.json`

**Step 1: Check current Node.js version**

```bash
node --version
```

**Step 2: Update @types/node to match**

If using Node.js 24.x:

```bash
pnpm add -D @types/node@^24
```

If using Node.js 22.x:

```bash
pnpm add -D @types/node@^22
```

If using Node.js 20.x:

```bash
pnpm add -D @types/node@^20
```

**Step 3: Verify TypeScript compilation**

```bash
pnpm build
```

Expected: Build succeeds

**Step 4: Commit types upgrade**

```bash
git add -A
git commit -m "chore: update @types/node to match runtime version"
```

---

## Task 7: Final Verification

**Files:**

- None

**Step 1: Clean install**

```bash
rm -rf node_modules .next
pnpm install
```

**Step 2: Full build**

```bash
pnpm build
```

Expected: Build succeeds

**Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 4: Run linting**

```bash
pnpm lint
```

Expected: No errors

**Step 5: Run E2E tests (if Supabase is running)**

```bash
pnpm test:e2e:chromium
```

Expected: E2E tests pass

**Step 6: Check for any remaining outdated packages**

```bash
pnpm outdated
```

Expected: No major version updates remaining

---

## Task 8: Merge to Main

**Files:**

- None

**Step 1: Push upgrade branch**

```bash
git push -u origin upgrade/dependencies-2026-01
```

**Step 2: Create PR or merge directly**

If merging directly:

```bash
git checkout master
git merge upgrade/dependencies-2026-01
git push
```

---

## Rollback Plan

If any task fails and cannot be fixed:

```bash
git checkout master
git branch -D upgrade/dependencies-2026-01
```

Start fresh with a more targeted upgrade approach.

---

## Summary of Version Changes

| Package            | Before  | After              |
| ------------------ | ------- | ------------------ |
| next               | 14.2.35 | 16.1.x             |
| react              | 18.3.1  | 19.x               |
| react-dom          | 18.3.1  | 19.x               |
| tailwindcss        | 3.4.x   | 4.x                |
| eslint             | 8.57.1  | 9.x                |
| eslint-config-next | 14.2.35 | 16.x               |
| supabase           | 1.200.3 | 2.x                |
| @types/node        | 20.x    | 24.x (or matching) |
| @types/react       | 18.x    | 19.x               |
| @types/react-dom   | 18.x    | 19.x               |
