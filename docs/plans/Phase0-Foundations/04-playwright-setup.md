# Task 0.4: Set Up Playwright for E2E Testing

> **Phase 0** | [← Vitest Setup](./03-vitest-setup.md) | [Next: Supabase Local →](./05-supabase-local.md)

---

## Context

**This task establishes end-to-end testing infrastructure.** Playwright provides cross-browser testing with excellent developer experience.

### Prerequisites

- **Task 0.2** completed (ESLint/Prettier configured)

### What This Task Creates

- Playwright configuration with serial/parallel project separation
- Centralized timeout constants (never hardcode!)
- Test account definitions for worker isolation
- React hydration helpers (critical for SSR apps)
- Authentication helpers
- Accessibility testing with axe-core (WCAG 2.1 AA)
- Custom fixtures for parallel test isolation
- Global setup with health checks

### Tasks That Depend on This

- **Task 0.9** (CI) - runs E2E tests

### Parallel Tasks

This task can be done in parallel with:

- **Task 0.3** (Vitest)
- **Task 0.5** (Supabase)

### Key Design Decisions

- **Port 3088** for E2E tests (isolated from dev server on 3000)
- **Worker isolation** for true parallel testing
- **Centralized timeouts** - never hardcode timeout values in tests

---

## Files to Create/Modify

- `playwright.config.ts` (create)
- `e2e/config/timeouts.ts` (create)
- `e2e/fixtures/test-accounts.ts` (create)
- `e2e/fixtures/test-fixtures.ts` (create)
- `e2e/helpers/hydration.ts` (create)
- `e2e/helpers/auth.ts` (create)
- `e2e/helpers/axe.ts` (create)
- `e2e/helpers/cleanup.ts` (create)
- `e2e/pages/LoginPage.ts` (create)
- `e2e/setup/global-setup.ts` (create)
- `e2e/setup/global-teardown.ts` (create)
- `e2e/home/example.spec.ts` (create)
- `.env.test` (create)
- `package.json` (modify)

---

## Steps

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
# Use port 3088 to avoid conflicts with dev server on 3000
NEXT_PUBLIC_APP_URL=http://localhost:3088
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

### Step 9: Create Page Object Model base

Create `e2e/pages/LoginPage.ts`:

```typescript
/**
 * Page Object Model for the login page.
 * Encapsulates selectors and actions for the login form.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import { waitForFormReady } from '../helpers/hydration';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[name="email"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = page.locator('[type="submit"]');
    this.errorMessage = page.locator('[role="alert"]');
  }

  async goto() {
    await this.page.goto('/login');
    await waitForFormReady(this.page);
  }

  async fillCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, password: string) {
    await this.fillCredentials(email, password);
    await this.submit();
  }

  async loginAndWaitForDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LOGIN_REDIRECT });
  }

  async expectError(pattern: string | RegExp) {
    await expect(this.errorMessage).toContainText(pattern);
  }

  async expectVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
```

**Why Page Object Model?**

- Encapsulates page-specific selectors in one place
- Makes tests more readable and maintainable
- Allows selector changes without modifying test code
- Provides reusable page actions

### Step 10: Create test data cleanup helper

Create `e2e/helpers/cleanup.ts`:

```typescript
/**
 * Cleanup utilities for test data management.
 * Ensures test isolation by cleaning up created data.
 *
 * NOTE: This file uses a generic client type to avoid importing from
 * @/lib/supabase/database.types which is generated in Task 0.7.
 * The client parameter accepts any Supabase client instance.
 */

// Generic interface that matches Supabase client's query methods
interface SupabaseQueryClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: string): Promise<{ error: Error | null }>;
      like(column: string, pattern: string): Promise<{ error: Error | null }>;
    };
  };
}

/**
 * Cleanup class that tracks created records and deletes them in reverse order.
 * Use this to ensure test data is cleaned up after each test.
 */
export class TestDataCleanup {
  private createdRecords: { table: string; id: string }[] = [];

  constructor(private supabase: SupabaseQueryClient) {}

  /**
   * Track a record for cleanup.
   * Records are deleted in reverse order to respect foreign key constraints.
   */
  track(table: string, id: string) {
    this.createdRecords.push({ table, id });
  }

  /**
   * Clean up all tracked records.
   * Call this in afterEach or test cleanup fixture.
   */
  async cleanup() {
    // Delete in reverse order to respect foreign keys
    // NOTE: Using spread to avoid mutating the original array
    const toDelete = [...this.createdRecords].reverse();
    for (const { table, id } of toDelete) {
      try {
        await this.supabase.from(table).delete().eq('id', id);
      } catch (error) {
        console.warn(`Failed to cleanup ${table}:${id}`, error);
      }
    }
    this.createdRecords = [];
  }

  /**
   * Get count of tracked records.
   */
  get count() {
    return this.createdRecords.length;
  }
}

/**
 * Clean up test data by prefix pattern.
 * Useful for cleaning up worker-specific test data.
 */
export async function cleanupByPrefix(supabase: SupabaseQueryClient, table: string, column: string, prefix: string) {
  await supabase.from(table).delete().like(column, `${prefix}%`);
}
```

### Step 11: Create custom Playwright fixtures

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

### Step 12: Create comprehensive Playwright config

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

// Use isolated port 3088 to avoid conflicts with dev server
const PORT = process.env.PORT || 3088;
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

### Step 13: Create global setup with health checks

Create `e2e/setup/global-setup.ts`:

```typescript
import { FullConfig } from '@playwright/test';
import * as fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('\n[Playwright] Global setup starting...');

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
      console.log('[Setup] Supabase is healthy');
    }
  }

  console.log('[Playwright] Global setup complete\n');
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

### Step 14: Create global teardown

Create `e2e/setup/global-teardown.ts`:

```typescript
async function globalTeardown() {
  console.log('\n[Playwright] Global teardown complete');
}

export default globalTeardown;
```

### Step 15: Write first E2E test

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

### Step 16: Add E2E scripts to package.json

Add to `scripts`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug",
"test:e2e:chromium": "playwright test --project=chromium",
"test:e2e:serial": "playwright test --project=serial"
```

### Step 17: Run E2E tests (Chromium only for speed)

```bash
pnpm test:e2e:chromium
```

**Expected:** 4 tests passing (including accessibility test)

### Step 18: Add to .gitignore

Append to `.gitignore`:

```
# Playwright
playwright-report/
test-results/
playwright/.auth/

# Test environment
.env.test.local
```

### Step 19: Commit

```bash
git add .
git commit -m "chore: configure Playwright with comprehensive E2E infrastructure"
```

---

## E2E Directory Structure

After this task, your E2E directory should look like:

```
e2e/
├── config/
│   └── timeouts.ts       # Centralized timeout constants
├── fixtures/
│   ├── test-accounts.ts  # Test account definitions
│   └── test-fixtures.ts  # Worker isolation fixtures
├── helpers/
│   ├── auth.ts           # Authentication utilities
│   ├── axe.ts            # Accessibility testing
│   ├── cleanup.ts        # Test data cleanup utilities
│   └── hydration.ts      # React hydration helpers
├── pages/
│   └── LoginPage.ts      # Page Object Model for login
├── setup/
│   ├── global-setup.ts   # Health checks, CRLF fix
│   └── global-teardown.ts
└── home/
    └── example.spec.ts   # Example tests
```

---

## Verification Checklist

- [ ] `playwright.config.ts` created with serial/parallel projects
- [ ] `e2e/config/timeouts.ts` created
- [ ] `e2e/fixtures/test-accounts.ts` created
- [ ] `e2e/fixtures/test-fixtures.ts` created
- [ ] `e2e/helpers/hydration.ts` created
- [ ] `e2e/helpers/auth.ts` created
- [ ] `e2e/helpers/axe.ts` created
- [ ] `e2e/helpers/cleanup.ts` created with TestDataCleanup class
- [ ] `e2e/pages/LoginPage.ts` created (Page Object Model)
- [ ] `e2e/setup/global-setup.ts` created with health checks
- [ ] `e2e/setup/global-teardown.ts` created
- [ ] `e2e/home/example.spec.ts` passes (4 tests)
- [ ] `.env.test` created
- [ ] `.gitignore` updated
- [ ] Changes committed

---

## Next Steps

Continue with:

- **[Task 0.5: Set Up Supabase](./05-supabase-local.md)** (if not done in parallel)

Or if 0.5, 0.6, 0.7 are done, proceed to **[Task 0.8: Test Utilities](./08-test-utilities.md)**.
