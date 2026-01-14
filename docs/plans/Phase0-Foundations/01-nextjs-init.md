# Task 0.1: Initialize Next.js Project with Git

> **Phase 0** | [← Overview](./00-overview.md) | [Next: ESLint/Prettier →](./02-eslint-prettier.md)

---

## Context

**This is the first task in Phase 0.** It creates the foundation that all other tasks build upon.

### Prerequisites

- Pre-flight checklist completed (see [Overview](./00-overview.md))
- Git, Node.js 20+, pnpm 9+, and Docker installed and running

### What This Task Creates

- Git repository
- Next.js 14+ project with App Router
- TypeScript configuration
- Tailwind CSS setup
- Basic project structure

### Tasks That Depend on This

- **Task 0.2** (ESLint/Prettier) - needs package.json and project structure
- All subsequent tasks depend on this foundation

---

## Files to Create/Modify

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `.gitignore`
- `.nvmrc`
- `.gitattributes`

---

## Steps

### Step 1: Initialize git repository

```bash
git init
```

### Step 2: Create Node version file

Create `.nvmrc`:

```
20
```

### Step 3: Create .gitattributes for consistent line endings

Create `.gitattributes`:

```
# Ensure LF line endings for scripts and SQL (prevents issues on Windows/WSL)
*.sh text eol=lf
*.sql text eol=lf
*.bash text eol=lf

# Auto-detect for other text files
* text=auto
```

**Why:** Windows CRLF line endings break bash scripts. This ensures scripts work across all platforms.

### Step 4: Create Next.js project with TypeScript

```bash
# Pin to Next.js 14.x for stability - update when ready to migrate
pnpm create next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Expected output:** Project scaffolded with App Router structure

**Note on version pinning:** Using `@14` instead of `@latest` ensures all developers get the same Next.js version. Tailwind CSS will be the version bundled with create-next-app. To upgrade later, explicitly update the dependencies.

### Step 5: Add Node.js engine requirements and packageManager to package.json

Add to `package.json`:

```json
"packageManager": "pnpm@9.15.0",
"engines": {
  "node": ">=20.0.0"
}
```

**Note:** The `packageManager` field enables Corepack and ensures consistent pnpm version across team.

### Step 6: Configure Next.js for standalone output (Docker-ready)

Update `next.config.ts` to enable standalone output:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

**Why:** The `standalone` output creates a minimal production build that can be deployed in Docker containers without `node_modules`. This is required for the multi-stage Docker build pattern recommended in infrastructure best practices.

### Step 7: Verify dev server starts

```bash
pnpm dev
```

**Expected:** Server running on http://localhost:3000. Press Ctrl+C to stop.

### Step 8: Commit

```bash
git add .
git commit -m "chore: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

## Verification Checklist

- [ ] Git repository initialized
- [ ] `.nvmrc` contains `20`
- [ ] `.gitattributes` created with LF line endings for scripts
- [ ] `package.json` has `packageManager` and `engines` fields
- [ ] `next.config.ts` has `output: 'standalone'`
- [ ] `pnpm dev` starts server on localhost:3000
- [ ] Initial commit created

---

## Next Steps

Once this task is complete, proceed to **[Task 0.2: Configure ESLint and Prettier](./02-eslint-prettier.md)**.
