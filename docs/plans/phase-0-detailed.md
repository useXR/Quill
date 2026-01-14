# Phase 0: Foundation & Testing Infrastructure - Detailed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish complete development environment, testing pyramid, and CI/CD pipeline before any feature work begins.

**Key Dependencies:**

- Node.js 20+
- Docker (for Supabase local development)
- pnpm 9+

---

## Pre-Flight Checklist

Before starting, verify prerequisites:

```bash
# Check git is installed
git --version

# Check Node.js version (must be 20+)
node --version

# Check pnpm is installed (must be 9+)
pnpm --version
# If not installed: npm install -g pnpm

# Check Docker is installed AND running
docker --version
docker ps  # Must not error - daemon must be running
```

---

## Task 0.1: Initialize Next.js Project with Git

**Files to create/modify:**

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `.gitignore`
- `.nvmrc`

### Step 1: Initialize git repository

```bash
git init
```

### Step 2: Create Node version file

Create `.nvmrc`:

```
20
```

### Step 3: Create Next.js project with TypeScript

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Expected output:** Project scaffolded with App Router structure

### Step 4: Add Node.js engine requirements and packageManager to package.json

Add to `package.json`:

```json
"packageManager": "pnpm@9.15.0",
"engines": {
  "node": ">=20.0.0"
}
```

**Note:** The `packageManager` field enables Corepack and ensures consistent pnpm version across team.

### Step 5: Verify dev server starts

```bash
pnpm dev
```

**Expected:** Server running on http://localhost:3000. Press Ctrl+C to stop.

### Step 6: Commit

```bash
git add .
git commit -m "chore: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

## Task 0.2: Configure ESLint and Prettier

**Files to create/modify:**

- `package.json` (modify)
- `.prettierrc` (create)
- `.prettierignore` (create)
- `eslint.config.mjs` (modify)

### Step 1: Install Prettier and ESLint compatibility packages

```bash
pnpm add -D prettier eslint-config-prettier
```

**Note:** Do NOT install `eslint-plugin-prettier` - it's deprecated for flat config.

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

const eslintConfig = [...compat.extends('next/core-web-vitals', 'next/typescript'), prettierConfig];

export default eslintConfig;
```

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

### Step 8: Commit

```bash
git add .
git commit -m "chore: configure ESLint and Prettier with flat config"
```

---

## Task 0.3: Set Up Vitest for Unit/Integration Testing

**Files to create/modify:**

- `package.json` (modify)
- `vitest.config.ts` (create)
- `vitest.setup.ts` (create)
- `src/test-utils/next-mocks.ts` (create)
- `src/test-utils/render.tsx` (create)
- `src/test-utils/index.ts` (create)
- `src/lib/__tests__/example.test.ts` (create)

### Step 1: Install Vitest and all testing utilities

```bash
pnpm add -D vitest @vitejs/plugin-react @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
```

**Note:** Includes `@vitest/ui` for test:ui script and `@vitest/coverage-v8` for coverage.

### Step 2: Create comprehensive Vitest config

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'e2e'],

    // Test isolation and performance
    isolate: true,
    pool: 'threads',
    testTimeout: 10000,
    hookTimeout: 10000,

    // Mock cleanup between tests - ensures test isolation
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },

    // Reporters for CI integration
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: {
      junit: './test-results/vitest-junit.xml',
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'src/middleware.ts',
        '.next/**',
        'e2e/**',
        'src/test-utils/**',
      ],
      // Coverage thresholds - fail if not met
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

### Step 3: Create Vitest setup file

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test - ensures DOM is reset
afterEach(() => {
  cleanup();
});

// ============================================
// BROWSER API MOCKS
// These are required for UI libraries (Radix, shadcn, Framer Motion)
// ============================================

// Mock window.matchMedia (required for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (required for Radix UI, many component libraries)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver (for lazy loading, infinite scroll)
global.IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as unknown as typeof IntersectionObserver;

// NOTE: We intentionally do NOT add global mocks for next/navigation or
// next/headers here. Tests should explicitly opt-in to mocks using the
// utilities in src/test-utils/next-mocks.ts. This follows the TDD principle
// of avoiding mocks unless unavoidable, and makes test dependencies explicit.
```

### Step 4: Create opt-in Next.js mock utilities

Create `src/test-utils/next-mocks.ts`:

```typescript
import { vi } from 'vitest';

/**
 * Mock next/navigation hooks for component tests.
 * Call this at the top of test files that need router mocking.
 *
 * @example
 * import { mockNextNavigation } from '@/test-utils/next-mocks';
 * mockNextNavigation();
 *
 * describe('MyComponent', () => { ... });
 */
export function mockNextNavigation() {
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  }));
}

/**
 * Mock next/headers for server component tests.
 * Call this at the top of test files that need headers/cookies mocking.
 */
export function mockNextHeaders() {
  vi.mock('next/headers', () => ({
    cookies: () => ({
      get: vi.fn(),
      getAll: vi.fn(() => []),
      set: vi.fn(),
      delete: vi.fn(),
    }),
    headers: () => new Headers(),
  }));
}
```

### Step 5: Create React Testing Library render utilities

Create `src/test-utils/render.tsx`:

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Wrapper component with all providers.
 * Add providers here as you add them to the app (e.g., QueryClientProvider).
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with providers
 * and sets up userEvent.
 *
 * @example
 * const { user } = render(<MyButton />);
 * await user.click(screen.getByRole('button'));
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };
```

### Step 6: Create test-utils barrel export

Create `src/test-utils/index.ts`:

```typescript
export * from './render';
export * from './next-mocks';
```

### Step 7: Write first test (should pass)

Create `src/lib/__tests__/example.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Example test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with arrays', () => {
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('should work with objects', () => {
    expect({ name: 'test' }).toHaveProperty('name', 'test');
  });
});
```

### Step 8: Add test scripts to package.json

Add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:ui": "vitest --ui"
```

### Step 9: Run tests

```bash
pnpm test
```

**Expected:** 3 tests passing

### Step 10: Commit

```bash
git add .
git commit -m "chore: configure Vitest with test utilities and coverage"
```

---

## Task 0.4: Set Up Playwright for E2E Testing

**Files to create/modify:**

- `playwright.config.ts` (create)
- `e2e/config/timeouts.ts` (create)
- `e2e/fixtures/test-accounts.ts` (create)
- `e2e/fixtures/test-fixtures.ts` (create)
- `e2e/helpers/hydration.ts` (create)
- `e2e/helpers/auth.ts` (create)
- `e2e/helpers/axe.ts` (create)
- `e2e/setup/global-setup.ts` (create)
- `e2e/setup/global-teardown.ts` (create)
- `e2e/home/example.spec.ts` (create)
- `.env.test` (create)
- `package.json` (modify)

### Step 1: Install Playwright and accessibility testing

```bash
pnpm add -D @playwright/test @axe-core/playwright
```

**Note:** `@axe-core/playwright` provides WCAG accessibility testing.

### Step 2: Install browsers with system dependencies

```bash
pnpm exec playwright install --with-deps chromium firefox webkit
```

**Note:** The `--with-deps` flag installs required system libraries.

### Step 3: Create test environment file

Create `.env.test`:

```bash
# Test environment - isolated from development
# Use port 3099 to avoid conflicts with dev server on 3000
NEXT_PUBLIC_APP_URL=http://localhost:3099
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
NODE_ENV=test
```

### Step 4: Create centralized timeout constants

Create `e2e/config/timeouts.ts`:

```typescript
/**
 * Centralized timeout constants for E2E tests.
 * NEVER hardcode timeout values in tests - import from here.
 */
export const TIMEOUTS = {
  // Page-level
  PAGE_LOAD: 60000, // Initial page load (includes build)
  NAVIGATION: 10000, // Between pages

  // Elements
  ELEMENT_VISIBLE: 3000, // Element visibility
  TOAST: 5000, // Toast/notification display
  DIALOG: 5000, // Modal/dialog animations

  // Forms & Input
  HYDRATION: 10000, // React hydration completion
  INPUT_STABLE: 2000, // Form input stabilization
  DEBOUNCE_SEARCH: 300, // Search input debounce

  // API & Auth
  API_CALL: 5000, // API request completion
  AUTH: 5000, // Auth operations
  LOGIN_REDIRECT: 30000, // Login to dashboard redirect

  // Animations
  ANIMATION: 100, // Short CSS transitions
  ANIMATION_SETTLE: 600, // Longer animations (a11y testing)

  // DOM
  DOM_UPDATE: 100, // DOM update propagation
  POST_FILTER: 200, // Post-filter DOM updates
  SHORT: 2000, // Quick UI updates
} as const;

// Pre-built wait options for common patterns
export const NAVIGATION_WAIT = { timeout: TIMEOUTS.NAVIGATION };
export const VISIBILITY_WAIT = { timeout: TIMEOUTS.ELEMENT_VISIBLE };
export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST };
export const PAGE_LOAD_WAIT = { timeout: TIMEOUTS.PAGE_LOAD };
export const HYDRATION_WAIT = { timeout: TIMEOUTS.HYDRATION };
```

### Step 5: Create test account definitions

Create `e2e/fixtures/test-accounts.ts`:

```typescript
/**
 * Single source of truth for test accounts.
 * Never duplicate account definitions elsewhere.
 */
export const TEST_PASSWORD = 'password123';

// Shared accounts (for serial tests requiring specific roles)
export const SHARED_ACCOUNTS = {
  owner: { email: 'owner@test.local', password: TEST_PASSWORD, role: 'owner' as const },
  admin: { email: 'admin@test.local', password: TEST_PASSWORD, role: 'admin' as const },
  member: { email: 'member@test.local', password: TEST_PASSWORD, role: 'member' as const },
  viewer: { email: 'viewer@test.local', password: TEST_PASSWORD, role: 'viewer' as const },
} as const;

// Worker accounts (for parallel tests - each worker gets isolated data)
export const MAX_WORKERS = 8;

export function getWorkerAccount(index: number) {
  return {
    email: `worker${index}@test.local`,
    password: TEST_PASSWORD,
    name: `Worker ${index}`,
  };
}

export type SharedAccountKey = keyof typeof SHARED_ACCOUNTS;
```

### Step 6: Create React hydration helpers

Create `e2e/helpers/hydration.ts`:

```typescript
/**
 * React SSR hydration resets controlled form inputs.
 * These helpers ensure forms are ready before interaction.
 */
import { Page, expect } from '@playwright/test';
import { TIMEOUTS, HYDRATION_WAIT } from '../config/timeouts';

/**
 * Wait for a form to be hydrated (React has taken over).
 * Forms should set data-hydrated="true" in useEffect.
 *
 * @example
 * // In React component:
 * useEffect(() => {
 *   formRef.current?.setAttribute('data-hydrated', 'true');
 * }, []);
 */
export async function waitForFormReady(page: Page, formSelector = 'form') {
  await page.waitForSelector(`${formSelector}[data-hydrated="true"]`, {
    state: 'attached',
    ...HYDRATION_WAIT,
  });
  // Small delay for any final React updates
  await page.waitForTimeout(TIMEOUTS.ANIMATION);
}

/**
 * Fill a form field and verify the value wasn't cleared by hydration.
 */
export async function fillFormField(page: Page, selector: string, value: string) {
  const field = page.locator(selector);
  await field.fill(value);
  // Verify value wasn't cleared by hydration
  await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INPUT_STABLE });
}
```

### Step 7: Create authentication helpers

Create `e2e/helpers/auth.ts`:

```typescript
import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import { waitForFormReady } from './hydration';

/**
 * Log in a user via the login form.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await waitForFormReady(page);

  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LOGIN_REDIRECT });
}

/**
 * Log out the current user.
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login', { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Assert the user is logged in.
 */
export async function expectToBeLoggedIn(page: Page) {
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

/**
 * Assert the user is logged out.
 */
export async function expectToBeLoggedOut(page: Page) {
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
}

/**
 * Generate a unique email for test isolation.
 */
export function generateUniqueEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`;
}
```

### Step 8: Create accessibility testing helpers

Create `e2e/helpers/axe.ts`:

```typescript
/**
 * Accessibility testing with axe-core.
 * Ensures WCAG 2.1 AA compliance.
 */
import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TIMEOUTS } from '../config/timeouts';

interface A11yOptions {
  skipFailures?: boolean;
  detailedReport?: boolean;
  skipNetworkidle?: boolean;
}

/**
 * Run accessibility audit on current page.
 */
export async function checkA11y(page: Page, options: A11yOptions = {}) {
  // Wait for page stability
  await page.waitForLoadState('domcontentloaded');

  if (!options.skipNetworkidle) {
    await page.waitForLoadState('networkidle').catch(() => {
      // Network idle timeout is acceptable
    });
  }

  // Disable animations to prevent false color contrast violations
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    `,
  });

  await page.waitForTimeout(TIMEOUTS.ANIMATION_SETTLE);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

  if (options.detailedReport && results.violations.length > 0) {
    console.log('\nAccessibility Violations:');
    results.violations.forEach((violation) => {
      console.log(`\n[${violation.impact}] ${violation.id}: ${violation.description}`);
      console.log(`Help: ${violation.helpUrl}`);
      violation.nodes.forEach((node) => {
        console.log(`  - ${node.failureSummary}`);
        console.log(`    Target: ${node.target.join(', ')}`);
      });
    });
  }

  if (!options.skipFailures) {
    expect(results.violations, `Found ${results.violations.length} accessibility violations`).toHaveLength(0);
  }

  return results;
}

/**
 * Run accessibility audit on a specific element.
 */
export async function checkElementA11y(page: Page, selector: string, options: A11yOptions = {}) {
  const results = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa']).analyze();

  if (!options.skipFailures) {
    expect(results.violations).toHaveLength(0);
  }

  return results;
}
```

### Step 9: Create custom Playwright fixtures

Create `e2e/fixtures/test-fixtures.ts`:

```typescript
/**
 * Custom Playwright fixtures for worker isolation and test data management.
 */
import { test as base, expect } from '@playwright/test';
import { getWorkerAccount } from './test-accounts';
import { TIMEOUTS, HYDRATION_WAIT } from '../config/timeouts';

// Worker context for parallel test isolation
interface WorkerContext {
  workerIndex: number;
  account: { email: string; password: string; name: string };
  prefix: (name: string) => string;
}

// Define custom fixtures
type Fixtures = {
  workerCtx: WorkerContext;
  loginAsWorker: () => Promise<void>;
};

export const test = base.extend<Fixtures, { workerCtx: WorkerContext }>({
  // Worker-scoped: shared across all tests in a worker
  workerCtx: [
    async ({}, use, workerInfo) => {
      const runId = Math.random().toString(36).substring(2, 6);
      const account = getWorkerAccount(workerInfo.parallelIndex);

      const ctx: WorkerContext = {
        workerIndex: workerInfo.parallelIndex,
        account,
        prefix: (name: string) => `W${workerInfo.parallelIndex}_${runId}_${name}`,
      };

      await use(ctx);
    },
    { scope: 'worker' },
  ],

  // Test-scoped: fresh for each test
  loginAsWorker: async ({ page, workerCtx }, use) => {
    const login = async () => {
      const { email, password } = workerCtx.account;

      for (let attempt = 1; attempt <= 2; attempt++) {
        await page.goto('/login');
        await page.waitForSelector('form[data-hydrated="true"]', HYDRATION_WAIT);
        await page.waitForTimeout(TIMEOUTS.ANIMATION);

        await page.fill('[name="email"]', email);
        await page.fill('[name="password"]', password);

        // Verify values weren't cleared by hydration
        await expect(page.locator('[name="email"]')).toHaveValue(email);

        await page.click('[type="submit"]');

        // Race: success vs failure
        const result = await Promise.race([
          page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LOGIN_REDIRECT }).then(() => 'success' as const),
          page
            .locator('[role="alert"], [data-error="true"]')
            .waitFor({ timeout: TIMEOUTS.TOAST })
            .then(() => 'error' as const),
        ]).catch(() => 'timeout' as const);

        if (result === 'success') return;

        if (attempt < 2 && result !== 'error') {
          await page.waitForTimeout(1000);
          continue;
        }

        throw new Error(`Login failed for ${email}`);
      }
    };

    await use(login);
  },
});

export { expect };
```

### Step 10: Create comprehensive Playwright config

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

// Use isolated port 3099 to avoid conflicts with dev server
const PORT = process.env.PORT || 3099;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Timeouts - use centralized constants in tests, these are fallbacks
  timeout: 30000,
  expect: { timeout: 5000 },

  // Parallel execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // Retries and workers
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,

  // Reporting - includes JSON for CI integration
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
    ...(process.env.CI
      ? [['github'] as const, ['junit', { outputFile: 'test-results/playwright-junit.xml' }] as const]
      : []),
  ],

  // Global setup/teardown
  globalSetup: require.resolve('./e2e/setup/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/setup/global-teardown.ts'),

  // Shared settings
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    testIdAttribute: 'data-testid',
  },

  // Browser projects with serial/parallel separation
  projects: [
    // ============================================
    // SERIAL TESTS - Shared state, role-based
    // Use for onboarding flows, invite sequences
    // ============================================
    {
      name: 'serial',
      testMatch: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },

    // ============================================
    // PARALLEL TESTS - Worker-isolated
    // Use for most tests
    // ============================================
    {
      name: 'chromium',
      testIgnore: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile',
      testIgnore: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration
  // NOTE: In CI, we use 'pnpm start' because the build artifact is downloaded.
  // Locally, we use 'pnpm dev' with the test port for isolation.
  webServer: {
    command: process.env.CI ? `PORT=${PORT} pnpm start` : `PORT=${PORT} pnpm dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

### Step 11: Create global setup with health checks

Create `e2e/setup/global-setup.ts`:

```typescript
import { FullConfig } from '@playwright/test';
import * as fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('\n🎭 Playwright global setup starting...');

  // Check for CRLF line endings in env file (breaks bash sourcing)
  const envTestPath = '.env.test';
  if (fs.existsSync(envTestPath)) {
    const envContent = fs.readFileSync(envTestPath, 'utf-8');
    if (envContent.includes('\r\n')) {
      console.warn('[Setup] Warning: .env.test has CRLF line endings, converting...');
      fs.writeFileSync(envTestPath, envContent.replace(/\r\n/g, '\n'));
    }
  }

  // Verify environment
  if (!process.env.CI) {
    console.log('[Setup] Running in local development mode');
  }

  // Check if Supabase is healthy (if URL is configured)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const isHealthy = await checkSupabaseHealth(supabaseUrl);
    if (!isHealthy) {
      console.warn('[Setup] Warning: Supabase health check failed. Some tests may fail.');
      console.warn('[Setup] Run: pnpm exec supabase start');
    } else {
      console.log('[Setup] ✅ Supabase is healthy');
    }
  }

  console.log('🎭 Global setup complete\n');
}

async function checkSupabaseHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    });
    return response.ok || response.status === 400; // 400 means API is responding
  } catch {
    return false;
  }
}

export default globalSetup;
```

### Step 12: Create global teardown

Create `e2e/setup/global-teardown.ts`:

```typescript
async function globalTeardown() {
  console.log('\n🎭 Playwright global teardown complete');
}

export default globalTeardown;
```

### Step 13: Write first E2E test

Create `e2e/home/example.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    // Use domcontentloaded for faster tests - don't wait for all resources
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify the page loads
    await expect(page).toHaveURL('/');

    // Check page is not empty
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should have valid HTML structure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Use getByRole for accessibility-focused selectors
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'load' });
    const loadTime = Date.now() - startTime;

    // Basic performance assertion - page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should pass accessibility audit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Run axe-core accessibility audit
    // Note: May need skipFailures: true initially until app is accessible
    await checkA11y(page, { skipFailures: true, detailedReport: true });
  });
});
```

### Step 14: Add E2E scripts to package.json

Add to `scripts`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug",
"test:e2e:chromium": "playwright test --project=chromium",
"test:e2e:serial": "playwright test --project=serial"
```

### Step 15: Run E2E tests (Chromium only for speed)

```bash
pnpm test:e2e:chromium
```

**Expected:** 4 tests passing (including accessibility test)

### Step 16: Add to .gitignore

Append to `.gitignore`:

```
# Playwright
playwright-report/
test-results/
playwright/.auth/

# Test environment
.env.test.local
```

### Step 17: Commit

```bash
git add .
git commit -m "chore: configure Playwright with comprehensive E2E infrastructure"
```

---

## Task 0.5: Set Up Supabase Local Development

**Files to create/modify:**

- `supabase/config.toml` (generated)
- `.env.local` (create)
- `.env.local.example` (create)
- `src/lib/supabase/client.ts` (create)
- `src/lib/supabase/server.ts` (create)
- `package.json` (modify)

> **Note:** Supabase auth middleware (`src/middleware.ts`) is required for production
> auth flows but will be implemented in **Phase 1** when we add authentication.
> The server client created here is sufficient for Phase 0's testing needs.

### Step 1: Verify Docker is running

```bash
docker ps
```

**If error:** Start Docker Desktop or Docker daemon first.

### Step 2: Install Supabase CLI and client libraries

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D supabase
```

### Step 3: Initialize Supabase

```bash
pnpm exec supabase init
```

**Expected:** Creates `supabase/` directory with `config.toml`

### Step 4: Start local Supabase

```bash
echo "⏳ Starting Supabase (this takes 2-3 minutes on first run)..."
pnpm exec supabase start
```

**Expected output:** Local Supabase running with URLs printed.

**Save these values from output:**

- `API URL`: http://127.0.0.1:54321
- `anon key`: (long JWT string starting with `eyJ`)
- `service_role key`: (another long JWT string)

### Step 5: Create environment example file

Create `.env.local.example`:

```bash
# Supabase - get these from `pnpm exec supabase status`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-status
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-status

# OpenAI - for embeddings (Phase 2)
OPENAI_API_KEY=your-openai-key
```

### Step 6: Create actual environment file

Create `.env.local` with actual values from Step 4:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here>
```

### Step 7: Create Supabase client for browser

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
```

### Step 8: Create Supabase client for server

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component - ignore
        }
      },
    },
  });
}
```

### Step 9: Add Supabase scripts to package.json

Add to `scripts`:

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:status": "supabase status",
"db:push": "supabase db push",
"test:all": "pnpm lint && pnpm format:check && pnpm test && pnpm test:e2e:chromium"
```

### Step 10: Update .gitignore

Append to `.gitignore`:

```
# Environment
.env.local
.env*.local

# Supabase
supabase/.branches
supabase/.temp
```

### Step 11: Commit

```bash
git add .
git commit -m "chore: configure Supabase local development"
```

---

## Task 0.6: Create Database Schema Migration

**Files to create:**

- `supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql`

### Step 1: Create migration file

```bash
pnpm exec supabase migration new initial_schema
```

This creates a timestamped file in `supabase/migrations/`.

### Step 2: Write schema migration

Edit the created migration file (e.g., `supabase/migrations/20260113120000_initial_schema.sql`):

```sql
-- Enable pgvector extension for semantic search
create extension if not exists vector with schema extensions;

-- ============================================
-- USERS / PROFILES
-- ============================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================
-- PROJECTS
-- ============================================

create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  status text check (status in ('draft', 'submitted', 'funded')) default 'draft',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.projects enable row level security;

create policy "Users can CRUD own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- Performance index
create index idx_projects_user_id on public.projects(user_id);

-- ============================================
-- DOCUMENTS
-- ============================================

create table public.documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  content jsonb default '{}',
  content_text text default '',
  sort_order integer default 0,
  version integer default 1,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.documents enable row level security;

create policy "Users can CRUD documents in own projects"
  on public.documents for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Performance indexes
create index idx_documents_project_id on public.documents(project_id);
create index idx_documents_content on public.documents using gin(content);

-- ============================================
-- VAULT ITEMS (uploaded files)
-- ============================================

create table public.vault_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  type text check (type in ('pdf', 'docx', 'url', 'text')) not null,
  filename text,
  storage_path text,
  extracted_text text,
  extraction_status text check (extraction_status in ('pending', 'success', 'partial', 'failed')) default 'pending',
  chunk_count integer default 0,
  created_at timestamptz default now() not null
);

alter table public.vault_items enable row level security;

create policy "Users can CRUD own vault items"
  on public.vault_items for all
  using (auth.uid() = user_id);

-- Performance index
create index idx_vault_items_project_id on public.vault_items(project_id);

-- ============================================
-- VAULT CHUNKS (for semantic search)
-- ============================================

create table public.vault_chunks (
  id uuid default gen_random_uuid() primary key,
  vault_item_id uuid references public.vault_items(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null,
  constraint unique_vault_chunk_index unique(vault_item_id, chunk_index)
);

alter table public.vault_chunks enable row level security;

create policy "Users can access chunks of own vault items"
  on public.vault_chunks for all
  using (
    vault_item_id in (
      select id from public.vault_items where user_id = auth.uid()
    )
  );

-- Vector similarity search index
-- NOTE: Using HNSW instead of IVFFlat because IVFFlat requires training data
-- and will fail on empty tables. HNSW works without pre-existing data.
create index idx_vault_chunks_embedding on public.vault_chunks
  using hnsw (embedding vector_cosine_ops);

-- ============================================
-- CITATIONS
-- ============================================

create table public.citations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  authors text,
  year integer,
  journal text,
  doi text,
  url text,
  abstract text,
  source text check (source in ('user_added', 'ai_fetched')) default 'user_added',
  verified boolean default false,
  created_at timestamptz default now() not null
);

alter table public.citations enable row level security;

create policy "Users can CRUD citations in own projects"
  on public.citations for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- ============================================
-- CHAT HISTORY
-- ============================================

create table public.chat_history (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete set null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.chat_history enable row level security;

create policy "Users can CRUD chat in own projects"
  on public.chat_history for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Performance index
create index idx_chat_history_project_id on public.chat_history(project_id);

-- ============================================
-- AI OPERATIONS (for undo/history)
-- ============================================

create table public.ai_operations (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  operation_type text check (operation_type in ('selection', 'cursor', 'global')) not null,
  input_summary text,
  output_content text,
  status text check (status in ('pending', 'accepted', 'rejected', 'partial')) default 'pending',
  snapshot_before jsonb,
  created_at timestamptz default now() not null
);

alter table public.ai_operations enable row level security;

create policy "Users can CRUD ai_operations in own documents"
  on public.ai_operations for all
  using (
    document_id in (
      select d.id from public.documents d
      join public.projects p on d.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- SEARCH FUNCTION (for semantic search)
-- ============================================

-- NOTE: This function uses SECURITY INVOKER (default) so RLS policies apply.
-- The user ownership check via vault_items.user_id ensures users can only
-- search their own vault content.
create or replace function search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
returns table (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text
)
language sql stable
as $$
  select
    vc.content,
    1 - (vc.embedding <=> query_embedding) as similarity,
    vc.vault_item_id,
    vi.filename
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and vi.user_id = auth.uid()  -- Explicit user ownership check
    and 1 - (vc.embedding <=> query_embedding) > match_threshold
  order by vc.embedding <=> query_embedding
  limit match_count;
$$;
```

### Step 3: Apply migration

```bash
pnpm exec supabase db reset
```

**Expected:** Migration applied, all tables created

### Step 4: Verify tables exist

```bash
pnpm exec supabase db dump --schema public | head -100
```

### Step 5: Commit

```bash
git add .
git commit -m "feat: add initial database schema with RLS policies"
```

---

## Task 0.7: Generate TypeScript Types from Database

**Files to create/modify:**

- `src/lib/supabase/database.types.ts` (create)
- `src/lib/supabase/types.ts` (create)
- `src/lib/supabase/index.ts` (create - barrel export)
- `package.json` (modify)

### Step 1: Ensure Supabase is running

```bash
pnpm exec supabase status
```

If not running: `pnpm exec supabase start`

### Step 2: Generate types

```bash
pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

### Step 3: Verify types were generated correctly

```bash
# Should show Database interface with Tables including profiles, projects, etc.
head -100 src/lib/supabase/database.types.ts
```

**Expected:** File should contain `export type Database = {` with `public: { Tables: { ... } }`

### Step 4: Create type helpers

Create `src/lib/supabase/types.ts`:

```typescript
import type { Database } from './database.types';

// Table row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type VaultItem = Database['public']['Tables']['vault_items']['Row'];
export type VaultChunk = Database['public']['Tables']['vault_chunks']['Row'];
export type Citation = Database['public']['Tables']['citations']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_history']['Row'];
export type AIOperation = Database['public']['Tables']['ai_operations']['Row'];

// Insert types
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type VaultItemInsert = Database['public']['Tables']['vault_items']['Insert'];

// Update types
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
```

### Step 5: Create barrel export for cleaner imports

Create `src/lib/supabase/index.ts`:

```typescript
export { createClient } from './client';
export { createClient as createServerClient } from './server';
export * from './types';
export type { Database } from './database.types';
```

### Step 6: Update Supabase clients with types

Update `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Update `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
```

### Step 7: Add type generation script to package.json

Add to `scripts`:

```json
"db:types": "pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts"
```

### Step 8: Commit

```bash
git add .
git commit -m "chore: generate TypeScript types from database schema"
```

---

## Task 0.8: Set Up Test Database Utilities

**Files to create:**

- `src/lib/supabase/test-utils.ts`
- `src/test-utils/factories.ts`
- `src/lib/supabase/__tests__/client.test.ts`

### Step 1: Create test utilities

Create `src/lib/supabase/test-utils.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * ⚠️ WARNING: Service role key bypasses RLS
 * Only use in test environment with test data
 */
export function createTestClient() {
  // Safety check: only allow in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'createTestClient should only be used in test environment. ' + `Current NODE_ENV: ${process.env.NODE_ENV}`
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a test user and returns the user object
 */
export async function createTestUser(email: string, password: string) {
  const client = createTestClient();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;
  return data.user;
}

/**
 * Deletes a test user by ID
 */
export async function deleteTestUser(userId: string) {
  const client = createTestClient();
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/**
 * Cleans up all test data for a user
 */
export async function cleanupTestData(userId: string) {
  const client = createTestClient();

  // Delete in order respecting foreign keys
  // Projects cascade to documents, vault_items, etc.
  await client.from('projects').delete().eq('user_id', userId);
  await client.from('profiles').delete().eq('id', userId);
}
```

### Step 2: Create factory functions for test data

Create `src/test-utils/factories.ts`:

```typescript
import type { ProjectInsert, DocumentInsert, VaultItemInsert } from '@/lib/supabase/types';

// Counter for generating unique test data
let counter = 0;

/**
 * Reset counter between test suites if needed
 */
export function resetFactoryCounter() {
  counter = 0;
}

/**
 * Create test project data
 */
export function createTestProject(userId: string, overrides: Partial<ProjectInsert> = {}): ProjectInsert {
  counter++;
  return {
    user_id: userId,
    title: `Test Project ${counter}`,
    status: 'draft',
    ...overrides,
  };
}

/**
 * Create test document data
 */
export function createTestDocument(projectId: string, overrides: Partial<DocumentInsert> = {}): DocumentInsert {
  counter++;
  return {
    project_id: projectId,
    title: `Test Document ${counter}`,
    content: {},
    content_text: '',
    sort_order: counter,
    version: 1,
    ...overrides,
  };
}

/**
 * Create test vault item data
 */
export function createTestVaultItem(
  userId: string,
  projectId: string,
  overrides: Partial<VaultItemInsert> = {}
): VaultItemInsert {
  counter++;
  return {
    user_id: userId,
    project_id: projectId,
    type: 'text',
    filename: `test-file-${counter}.txt`,
    extraction_status: 'pending',
    ...overrides,
  };
}
```

Update `src/test-utils/index.ts` to include factories:

```typescript
export * from './render';
export * from './next-mocks';
export * from './factories';
```

### Step 3: Write client tests

Create `src/lib/supabase/__tests__/client.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Supabase client', () => {
  it('should have required environment variables defined in test env', () => {
    // These are set in vitest.config.ts
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });

  it('should export createClient function', async () => {
    const clientModule = await import('../client');
    expect(clientModule.createClient).toBeDefined();
    expect(typeof clientModule.createClient).toBe('function');
  });

  it('should return a client with expected methods', async () => {
    const { createClient } = await import('../client');
    const client = createClient();

    // Verify real behavior - client should have Supabase methods
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth.getSession).toBe('function');
    expect(typeof client.auth.signInWithOtp).toBe('function');
  });
});
```

### Step 4: Run tests

```bash
pnpm test src/lib/supabase
```

**Expected:** All tests pass (3 tests)

### Step 5: Commit

```bash
git add .
git commit -m "chore: add Supabase test utilities and factories"
```

---

## Task 0.9: Set Up GitHub Actions CI

**Files to create:**

- `.github/workflows/ci.yml`

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
        run: pnpm lint

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

      - name: Run Vitest
        run: pnpm test:coverage
        env:
          NODE_ENV: test
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-key

      - name: Upload coverage reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

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
      - name: Run Playwright tests (Chromium only in CI)
        run: pnpm exec playwright test --project=chromium
        env:
          PORT: '3099'
          BASE_URL: 'http://localhost:3099'
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-key
          CI: 'true'

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
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

## Task 0.10: Create Development Scripts and Documentation

**Files to create:**

- `scripts/dev-setup.sh`
- `DEVELOPMENT.md`

> **Note on cross-platform support:** The dev-setup.sh script uses bash and is
> designed for macOS and Linux. Windows users should use WSL (Windows Subsystem
> for Linux) or Git Bash to run it. A PowerShell equivalent could be added in
> a future iteration if there's demand.

### Step 1: Create dev setup script

Create `scripts/dev-setup.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Setting up Quill development environment..."
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ is required. Found: $(node -v)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm is required but not installed."
  echo "   Install with: npm install -g pnpm"
  exit 1
fi
echo "✅ pnpm $(pnpm -v)"

if ! command -v docker &> /dev/null; then
  echo "❌ Docker is required for Supabase local development."
  exit 1
fi
echo "✅ Docker installed"

if ! docker ps &> /dev/null; then
  echo "❌ Docker daemon is not running. Start Docker and try again."
  exit 1
fi
echo "✅ Docker daemon running"

echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install || { echo "❌ pnpm install failed"; exit 1; }
echo "✅ Dependencies installed"

echo ""

# Start Supabase
echo "🗄️  Starting Supabase local development..."
if pnpm exec supabase status &> /dev/null; then
  echo "✅ Supabase is already running"
else
  echo "⏳ Starting Supabase (this takes 2-3 minutes on first run)..."
  pnpm exec supabase start
fi

# Get Supabase credentials
echo ""
echo "📋 Supabase credentials:"
pnpm exec supabase status

# Wait for Supabase to be fully ready
echo ""
echo "⏳ Waiting for Supabase to be ready..."
sleep 2

# Generate types
echo ""
echo "📝 Generating TypeScript types..."
pnpm db:types || { echo "❌ Type generation failed"; exit 1; }

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.local.example to .env.local"
echo "2. Fill in the values from the Supabase status above"
echo "3. Run 'pnpm dev' to start the development server"
echo ""
echo "Supabase Studio: http://localhost:54323"
```

### Step 2: Make script executable

```bash
chmod +x scripts/dev-setup.sh
```

### Step 3: Create development documentation

Create `DEVELOPMENT.md`:

````markdown
# Quill Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker (for Supabase local development)

## Quick Start

```bash
# First time setup
./scripts/dev-setup.sh

# Copy environment template
cp .env.local.example .env.local
# Edit .env.local with values from `pnpm exec supabase status`

# Start development
pnpm dev
```
````

## Accessing Supabase Studio

After running `pnpm db:start`, Supabase Studio is available at:
http://localhost:54323

## Available Scripts

### Development

- `pnpm dev` - Start Next.js dev server
- `pnpm build` - Build for production
- `pnpm start` - Start production server

### Testing

- `pnpm test` - Run unit/integration tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage
- `pnpm test:ui` - Open Vitest UI
- `pnpm test:e2e` - Run all Playwright E2E tests
- `pnpm test:e2e:chromium` - Run E2E tests (Chromium only)
- `pnpm test:e2e:ui` - Run E2E tests with UI
- `pnpm test:e2e:debug` - Debug E2E tests

### Database

- `pnpm db:start` - Start local Supabase
- `pnpm db:stop` - Stop local Supabase
- `pnpm db:status` - Show Supabase status
- `pnpm db:reset` - Reset database (runs migrations)
- `pnpm exec supabase migration new <name>` - Create new migration
- `pnpm db:types` - Regenerate TypeScript types

### All Tests

- `pnpm test:all` - Run lint, format check, unit tests, and E2E tests

### Code Quality

- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check formatting

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── ui/             # Base UI components
│   ├── editor/         # TipTap editor components
│   └── ...
├── lib/                 # Shared utilities
│   ├── supabase/       # Supabase clients and types
│   ├── ai/             # Claude Code CLI integration
│   └── ...
├── hooks/              # Custom React hooks
└── test-utils/         # Unit test utilities

e2e/                    # Playwright E2E tests
├── config/             # Centralized timeout constants
├── fixtures/           # Test accounts, worker fixtures
├── helpers/            # Hydration, auth, accessibility helpers
├── setup/              # Global setup/teardown
└── [feature]/          # Test specs organized by feature

supabase/
├── migrations/         # Database migrations
└── config.toml        # Supabase config
```

## Development Workflow

This project follows Test-Driven Development (TDD) principles:

1. **RED** - Write a failing test that defines the desired behavior
2. **GREEN** - Write the minimum code to make the test pass
3. **REFACTOR** - Clean up while keeping tests green

**Important:** All PRs should include tests for new functionality. Write tests
before or alongside implementation, not as an afterthought.

## Testing Strategy

### Unit Tests (Vitest)

- Test pure functions and utilities
- Test React components in isolation
- Located in `__tests__` folders near source
- Use factories from `@/test-utils` for test data

### Integration Tests (Vitest)

- Test component interactions
- Test API route handlers
- Test Supabase queries (with test database)

### E2E Tests (Playwright)

- Test complete user flows
- Test AI interactions (mocked)
- Test accessibility (WCAG 2.1 AA via axe-core)
- Located in `e2e/` folder organized by feature
- Use `data-testid` attributes for stable selectors
- Use centralized timeouts from `e2e/config/timeouts.ts`
- Use port 3099 (isolated from dev server on 3000)

### Test Utilities

- `src/test-utils/render.tsx` - Custom render with providers
- `src/test-utils/next-mocks.ts` - Opt-in Next.js mocks
- `src/test-utils/factories.ts` - Test data factories
- `src/lib/supabase/test-utils.ts` - Database test utilities
- `e2e/fixtures/test-fixtures.ts` - Worker isolation fixtures
- `e2e/helpers/hydration.ts` - React hydration helpers
- `e2e/helpers/axe.ts` - Accessibility testing

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# For testing
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For AI features (Phase 2+)
OPENAI_API_KEY=your-openai-key
```

## Troubleshooting

### Supabase won't start

1. Ensure Docker is running: `docker ps`
2. Check for port conflicts: `lsof -i :54321`
3. Reset Supabase: `pnpm exec supabase stop && pnpm exec supabase start`

### Tests failing with env errors

1. Ensure `.env.local` exists with valid values
2. Run `pnpm exec supabase status` to verify Supabase is running
3. Regenerate types: `pnpm db:types`

### TypeScript type errors after schema change

1. Run migrations: `pnpm exec supabase db reset`
2. Regenerate types: `pnpm db:types`

````

### Step 4: Commit

```bash
git add .
git commit -m "docs: add development setup scripts and documentation"
````

---

## Phase 0 Complete - Verification

Run through this checklist to verify Phase 0 is complete:

```bash
# 1. Dev server starts
pnpm dev
# Visit http://localhost:3000 - should see Next.js page

# 2. Unit tests pass
pnpm test

# 3. E2E tests pass (Chromium only for speed)
pnpm test:e2e:chromium

# 4. Linting passes
pnpm lint

# 5. Formatting passes
pnpm format:check

# 6. Build succeeds
pnpm build

# 7. Supabase is running
pnpm exec supabase status
# Should show running services

# 8. Database has tables
pnpm exec supabase db dump --schema public | head -50
# Should show table definitions
```

**All checks passing? Phase 0 is complete. Proceed to Phase 1.**

---

## Summary of Phase 0 Deliverables

| Task | Description          | Key Files                                                                         |
| ---- | -------------------- | --------------------------------------------------------------------------------- |
| 0.1  | Next.js project init | package.json, .nvmrc                                                              |
| 0.2  | ESLint + Prettier    | eslint.config.mjs, .prettierrc                                                    |
| 0.3  | Vitest setup         | vitest.config.ts, vitest.setup.ts (with browser API mocks)                        |
| 0.4  | Playwright setup     | playwright.config.ts, e2e/config/timeouts.ts, e2e/fixtures/_.ts, e2e/helpers/_.ts |
| 0.5  | Supabase local dev   | src/lib/supabase/\*.ts, .env.local                                                |
| 0.6  | Database schema      | supabase/migrations/\*.sql                                                        |
| 0.7  | TypeScript types     | src/lib/supabase/database.types.ts                                                |
| 0.8  | Test utilities       | src/lib/supabase/test-utils.ts, src/test-utils/factories.ts                       |
| 0.9  | GitHub Actions CI    | .github/workflows/ci.yml                                                          |
| 0.10 | Dev scripts & docs   | scripts/dev-setup.sh, DEVELOPMENT.md                                              |

### E2E Infrastructure Details (Task 0.4)

| Directory       | Files                               | Purpose                                                 |
| --------------- | ----------------------------------- | ------------------------------------------------------- |
| `e2e/config/`   | timeouts.ts                         | Centralized timeout constants                           |
| `e2e/fixtures/` | test-accounts.ts, test-fixtures.ts  | Test account definitions, worker isolation fixtures     |
| `e2e/helpers/`  | hydration.ts, auth.ts, axe.ts       | Hydration handling, auth helpers, accessibility testing |
| `e2e/setup/`    | global-setup.ts, global-teardown.ts | Health checks, CRLF fix, cleanup                        |
| `e2e/home/`     | example.spec.ts                     | Homepage tests with accessibility audit                 |
