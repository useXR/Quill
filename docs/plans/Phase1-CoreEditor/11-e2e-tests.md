# Task 10: E2E Tests with Playwright

> **Phase 1** | [← Word Count](./10-word-count.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task adds end-to-end tests validating the complete user flow.** Tests auth, projects, and editor functionality with proper infrastructure for reliability and maintainability.

> **Note:** This task follows the patterns from `docs/best-practices/testing-best-practices.md` including centralized timeouts, test account strategy, hydration handling, and accessibility testing.

### Prerequisites

- **All previous tasks** completed (full application implemented)

### What This Task Creates

**Configuration:**

- `playwright.config.ts` - Playwright configuration with separate test port
- `.env.test` - Test environment variables
- `.gitattributes` - Line ending enforcement

**Infrastructure (`e2e/config/`):**

- `e2e/config/timeouts.ts` - Centralized timeout constants

**Fixtures (`e2e/fixtures/`):**

- `e2e/fixtures/test-accounts.ts` - Test account definitions (shared + worker)
- `e2e/fixtures/worker-context.ts` - Worker isolation context
- `e2e/fixtures/test-fixtures.ts` - Custom Playwright fixtures with worker isolation

**Helpers (`e2e/helpers/`):**

- `e2e/helpers/hydration.ts` - React hydration handling
- `e2e/helpers/auth.ts` - Authentication utilities
- `e2e/helpers/axe.ts` - Accessibility testing utilities

**Pages (`e2e/pages/`):**

- `e2e/pages/LoginPage.ts` - Login page object

**Setup:**

- `e2e/setup/global-setup.ts` - Pre-test setup
- `e2e/setup/global-teardown.ts` - Post-test cleanup
- `e2e/setup/auth.setup.ts` - Auth state setup

**Tests (`e2e/`):**

- `e2e/auth/auth.spec.ts` - Auth E2E tests
- `e2e/projects/projects.spec.ts` - Projects E2E tests
- `e2e/editor/editor.spec.ts` - Editor E2E tests

---

## E2E Directory Structure

```
e2e/
├── config/
│   └── timeouts.ts        # Centralized timeout constants
├── fixtures/
│   ├── test-accounts.ts   # Test account definitions (shared + worker)
│   ├── worker-context.ts  # Worker isolation context
│   └── test-fixtures.ts   # Custom Playwright fixtures
├── helpers/
│   ├── auth.ts            # Authentication utilities
│   ├── hydration.ts       # React hydration helpers
│   ├── cleanup.ts         # Test data cleanup utilities
│   └── axe.ts             # Accessibility testing
├── pages/
│   └── LoginPage.ts       # Page Object Model classes
├── setup/
│   ├── global-setup.ts    # Pre-test setup with verification
│   ├── global-teardown.ts
│   └── auth.setup.ts      # Auth state setup
├── auth/
│   └── auth.spec.ts       # Auth tests (chromium-unauth project)
├── projects/
│   └── projects.spec.ts   # Project tests (parallel)
└── editor/
    └── editor.spec.ts     # Editor tests (parallel)
```

---

## Files to Create/Modify

- `playwright.config.ts` (create)
- `.gitattributes` (create)
- `e2e/config/timeouts.ts` (create)
- `e2e/fixtures/test-accounts.ts` (create)
- `e2e/fixtures/worker-context.ts` (create)
- `e2e/fixtures/test-fixtures.ts` (create)
- `e2e/helpers/hydration.ts` (create)
- `e2e/helpers/auth.ts` (create)
- `e2e/helpers/cleanup.ts` (create)
- `e2e/helpers/axe.ts` (create)
- `e2e/pages/LoginPage.ts` (create)
- `e2e/setup/global-setup.ts` (create)
- `e2e/setup/global-teardown.ts` (create)
- `e2e/setup/auth.setup.ts` (create)
- `e2e/auth/auth.spec.ts` (create)
- `e2e/projects/projects.spec.ts` (create)
- `e2e/editor/editor.spec.ts` (create)
- `.env.test` (create - gitignored)
- `.gitignore` (modify)

---

## Steps

### Step 10.1: Install Playwright and dependencies

```bash
npm install -D @playwright/test dotenv @axe-core/playwright
npx playwright install
```

**Expected:** Playwright browsers and accessibility testing tools installed

### Step 10.2: Create test environment file

Create `.env.test`:

```bash
# Test environment - uses separate port to avoid conflicts with dev
NEXT_PUBLIC_APP_URL=http://localhost:3099
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322  # Local Supabase
NODE_ENV=test

# Service role for test setup (bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Test user (created by global setup)
E2E_TEST_EMAIL=e2e-test@test.local
```

**Note:** Add `.env.test` to `.gitignore`. Use port 3099 to avoid conflicts with development server on 3000.

### Step 10.3: Create centralized timeout constants

Create `e2e/config/timeouts.ts`:

```typescript
/**
 * Centralized timeout constants for E2E tests.
 * NEVER hardcode timeout values in tests - always use these constants.
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

  // Editor
  AUTOSAVE_WAIT: 1500, // Wait for autosave debounce + save
} as const;

// Pre-built wait options for common patterns
export const NAVIGATION_WAIT = { timeout: TIMEOUTS.NAVIGATION };
export const VISIBILITY_WAIT = { timeout: TIMEOUTS.ELEMENT_VISIBLE };
export const TOAST_WAIT = { timeout: TIMEOUTS.TOAST };
export const PAGE_LOAD_WAIT = { timeout: TIMEOUTS.PAGE_LOAD };
export const HYDRATION_WAIT = { timeout: TIMEOUTS.HYDRATION };
```

### Step 10.4: Create test account strategy

Create `e2e/fixtures/test-accounts.ts`:

```typescript
/**
 * Single source of truth for test accounts.
 * All test accounts share the same password for simplicity.
 */
export const TEST_PASSWORD = 'test-password-123';

/**
 * Shared accounts for serial tests requiring specific roles.
 * Use these when tests need a known user state.
 */
export const SHARED_ACCOUNTS = {
  primary: {
    email: 'e2e-test@test.local',
    password: TEST_PASSWORD,
    name: 'E2E Test User',
  },
} as const;

/**
 * Worker accounts for parallel tests.
 * Each worker gets isolated data, preventing flaky tests from shared state.
 */
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

### Step 10.4b: Create worker isolation context

Create `e2e/fixtures/worker-context.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getWorkerAccount } from './test-accounts';

export interface WorkerContext {
  workerIndex: number;
  account: { email: string; password: string; name: string };
  supabase: SupabaseClient;
  /** Prefix function to create unique names per worker/run */
  prefix: (name: string) => string;
}

/**
 * Create isolated context for a worker.
 * Each worker gets its own account and unique prefix for test data.
 */
export async function createWorkerContext(parallelIndex: number): Promise<WorkerContext> {
  const runId = Math.random().toString(36).substring(2, 6);
  const account = getWorkerAccount(parallelIndex);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin access for setup
  );

  return {
    workerIndex: parallelIndex,
    account,
    supabase,
    prefix: (name: string) => `W${parallelIndex}_${runId}_${name}`,
  };
}
```

### Step 10.5: Create hydration helpers

Create `e2e/helpers/hydration.ts`:

```typescript
import { Page, expect } from '@playwright/test';
import { TIMEOUTS, HYDRATION_WAIT } from '../config/timeouts';

/**
 * Wait for React hydration to complete on a form.
 * Forms must set data-hydrated="true" after hydration via useEffect.
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
  // Verify value wasn't cleared by React re-render
  await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INPUT_STABLE });
}
```

### Step 10.6: Create auth helpers

Create `e2e/helpers/auth.ts`:

```typescript
import { Page, expect } from '@playwright/test';
import { TIMEOUTS, NAVIGATION_WAIT } from '../config/timeouts';
import { waitForFormReady, fillFormField } from './hydration';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await waitForFormReady(page);

  await fillFormField(page, '[name="email"]', email);
  await page.click('[type="submit"]');

  // For magic link flow, we'll need to handle differently in actual tests
  // This is a placeholder for password-based auth
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login', NAVIGATION_WAIT);
}

export async function expectToBeLoggedIn(page: Page) {
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

export async function expectToBeLoggedOut(page: Page) {
  await expect(page.locator('form[data-testid="login-form"]')).toBeVisible();
}
```

### Step 10.7: Create accessibility testing helpers

Create `e2e/helpers/axe.ts`:

```typescript
import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TIMEOUTS } from '../config/timeouts';

interface A11yOptions {
  skipFailures?: boolean;
  detailedReport?: boolean;
  skipNetworkidle?: boolean;
}

/**
 * Run accessibility checks on the current page.
 * Disables animations to prevent false color contrast violations.
 */
export async function checkA11y(page: Page, options: A11yOptions = {}) {
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
    });
  }

  if (!options.skipFailures) {
    expect(results.violations, `Found ${results.violations.length} accessibility violations`).toHaveLength(0);
  }

  return results;
}
```

### Step 10.7b: Create cleanup utilities

Create `e2e/helpers/cleanup.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * TestData class for automatic cleanup of test-created records.
 * Tracks created records and deletes them in reverse order (respecting foreign keys).
 */
export class TestData {
  private createdRecords: { table: string; id: string }[] = [];

  constructor(
    private supabase: SupabaseClient,
    private prefix: (name: string) => string
  ) {}

  async createProject(name: string, userId: string) {
    const { data, error } = await this.supabase
      .from('projects')
      .insert({ title: this.prefix(name), user_id: userId })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'projects', id: data.id });
    return data;
  }

  async createDocument(name: string, projectId: string) {
    const { data, error } = await this.supabase
      .from('documents')
      .insert({ title: this.prefix(name), project_id: projectId })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'documents', id: data.id });
    return data;
  }

  /**
   * Clean up all created records in reverse order.
   * Call this in afterEach or afterAll.
   */
  async cleanup() {
    for (const { table, id } of this.createdRecords.reverse()) {
      await this.supabase.from(table).delete().eq('id', id);
    }
    this.createdRecords = [];
  }
}
```

### Step 10.8: Create Login Page Object

Create `e2e/pages/LoginPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, TOAST_WAIT } from '../config/timeouts';
import { waitForFormReady, fillFormField } from '../helpers/hydration';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[name="email"]');
    this.submitButton = page.locator('[type="submit"]');
    this.successMessage = page.locator('text=Check your email');
    this.errorMessage = page.locator('[role="alert"], .text-red-600');
  }

  async goto() {
    await this.page.goto('/login');
    await waitForFormReady(this.page);
  }

  async fillEmail(email: string) {
    await fillFormField(this.page, '[name="email"]', email);
  }

  async submit() {
    await this.submitButton.click();
  }

  async submitMagicLink(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }

  async expectSuccess() {
    await expect(this.successMessage).toBeVisible(TOAST_WAIT);
  }

  async expectError(pattern?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (pattern) {
      await expect(this.errorMessage).toContainText(pattern);
    }
  }

  async expectFormVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
```

### Step 10.9: Create global setup

Create `e2e/setup/global-setup.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { MAX_WORKERS, getWorkerAccount, SHARED_ACCOUNTS } from '../fixtures/test-accounts';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

async function globalSetup() {
  console.log('\n[Setup] Starting E2E test infrastructure...');

  // Check for CRLF line endings in env file (breaks bash sourcing)
  const envPath = path.resolve(__dirname, '../../.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    if (envContent.includes('\r\n')) {
      console.warn('[Setup] Warning: .env.test has CRLF line endings, converting...');
      fs.writeFileSync(envPath, envContent.replace(/\r\n/g, '\n'));
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('[Setup] Missing Supabase credentials in .env.test');
  }

  // Wait for Supabase with retry loop
  const dbHealthy = await waitForDatabase(supabaseUrl);
  if (!dbHealthy) {
    console.error('[Setup] Supabase is not running. Start it with: npx supabase start');
    throw new Error('Supabase not available');
  }

  // Create admin client (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Create shared test accounts
  console.log('[Setup] Creating shared test accounts...');
  for (const account of Object.values(SHARED_ACCOUNTS)) {
    await ensureUserExists(supabase, account.email);
  }

  // Create worker accounts for parallel tests
  console.log('[Setup] Creating worker accounts...');
  for (let i = 0; i < MAX_WORKERS; i++) {
    const workerAccount = getWorkerAccount(i);
    await ensureUserExists(supabase, workerAccount.email);
  }

  // Verify test data exists
  const verified = await verifyTestData(supabase);
  if (!verified) {
    throw new Error('[Setup] Test data verification failed');
  }

  console.log('[Setup] Complete!\n');
}

async function waitForDatabase(supabaseUrl: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${supabaseUrl}/health`);
      if (response.ok) return true;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function ensureUserExists(supabase: ReturnType<typeof createClient>, email: string) {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const exists = existingUsers?.users?.some((u) => u.email === email);

  if (!exists) {
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
  }
}

async function verifyTestData(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  // Query for expected worker accounts
  const { data } = await supabase.auth.admin.listUsers();
  const workerCount = data?.users?.filter((u) => u.email?.startsWith('worker')).length ?? 0;
  return workerCount >= MAX_WORKERS;
}

export default globalSetup;
```

Create `e2e/setup/global-teardown.ts`:

```typescript
async function globalTeardown() {
  console.log('\n[Teardown] Cleaning up E2E test infrastructure...');
  // Add cleanup logic if needed
  console.log('[Teardown] Complete!\n');
}

export default globalTeardown;
```

### Step 10.10: Create Playwright config

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const PORT = process.env.PORT || 3099;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup - runs first
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Serial tests - shared state, run one at a time
    // Use for tests that require specific order or shared accounts
    {
      name: 'serial',
      testMatch: ['**/onboarding/**/*.spec.ts'],
      fullyParallel: false,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
    // Parallel tests - worker-isolated, can run concurrently
    {
      name: 'parallel',
      testIgnore: ['**/onboarding/**/*.spec.ts', '**/auth/**/*.spec.ts'],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
    // Unauthenticated tests - for login/logout flows
    {
      name: 'chromium-unauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\/.*\.spec\.ts/,
    },
  ],

  globalSetup: require.resolve('./e2e/setup/global-setup'),
  globalTeardown: require.resolve('./e2e/setup/global-teardown'),

  webServer: {
    command: `PORT=${PORT} npm run start:test`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Note:** Add these scripts to package.json:

```json
{
  "scripts": {
    "start:test": "next build && next start",
    "test:e2e:fresh": "FORCE_BUILD=1 E2E_FRESH_DB=1 playwright test"
  }
}
```

### Step 10.11: Create auth setup file

Create `e2e/setup/auth.setup.ts`:

```typescript
import { test as setup, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from '../fixtures/test-accounts';
import { LoginPage } from '../pages/LoginPage';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // For magic link auth, we need to use a service role approach
  // or implement a test bypass endpoint
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // Note: Magic link flow requires special handling in tests
  // Option 1: Create test bypass endpoint
  // Option 2: Use Supabase service role to generate session
  // Option 3: Store auth state after manual login

  // Placeholder - implement based on your auth strategy
  await page.context().storageState({ path: authFile });
});
```

### Step 10.12: Add .gitignore entries

Add to `.gitignore`:

```
# Playwright
/e2e/.auth/
/playwright-report/
/blob-report/
/playwright/.cache/
/test-results/
.env.test
```

### Step 10.12b: Create .gitattributes for line ending enforcement

Create `.gitattributes`:

```
# Enforce LF line endings (prevents CRLF issues that break bash scripts)
* text=auto eol=lf

# Explicitly mark binary files
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.pdf binary
```

**Why:** CRLF line endings break bash sourcing of `.env` files. This ensures consistent line endings across all platforms.

### Step 10.13: Create auth E2E tests

Create `e2e/auth/auth.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS, NAVIGATION_WAIT } from '../config/timeouts';

test.describe('Authentication', () => {
  test('should show login form with accessible elements', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectFormVisible();

    // Accessibility check
    await checkA11y(page);
  });

  test('should show success after email submission', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.submitMagicLink('test@example.com');
    await loginPage.expectSuccess();
  });

  test('should show rate limit error after too many attempts', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Attempt multiple logins to trigger rate limit
    for (let i = 0; i < 6; i++) {
      await loginPage.fillEmail(`spam${i}@example.com`);
      await loginPage.submit();
      await page.waitForTimeout(TIMEOUTS.API_CALL);
    }

    await loginPage.expectError(/Too many attempts/);
  });

  test('should redirect protected routes to login', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/, NAVIGATION_WAIT);
  });
});
```

### Step 10.14: Create projects E2E tests

Create `e2e/projects/projects.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { waitForFormReady, fillFormField } from '../helpers/hydration';
import { TIMEOUTS, VISIBILITY_WAIT, NAVIGATION_WAIT } from '../config/timeouts';

test.describe('Projects', () => {
  test('should list projects with accessible layout', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible(VISIBILITY_WAIT);

    // Accessibility check
    await checkA11y(page);
  });

  test('should create new project', async ({ page }) => {
    await page.goto('/projects/new');
    await waitForFormReady(page);

    await fillFormField(page, 'input#title', 'New E2E Project');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, NAVIGATION_WAIT);
    await expect(page.getByRole('heading', { name: 'New E2E Project' })).toBeVisible(VISIBILITY_WAIT);
  });

  test('should show empty state when no projects', async ({ page }) => {
    // This test assumes we can reach an empty state
    await page.goto('/projects');
    // Either empty state or project list should be visible
    await expect(
      page.getByText(/No projects|Create your first project/).or(page.locator('[data-testid="project-card"]'))
    ).toBeVisible(VISIBILITY_WAIT);
  });
});
```

### Step 10.15: Create editor E2E tests

Create `e2e/editor/editor.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

test.describe('Document Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to first project's document
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    await page.waitForSelector('[data-testid="editor"]', { timeout: TIMEOUTS.PAGE_LOAD });
  });

  test('should render editor with accessible toolbar', async ({ page }) => {
    await expect(page.getByRole('toolbar')).toBeVisible(VISIBILITY_WAIT);
    await expect(page.locator('.ProseMirror')).toBeVisible(VISIBILITY_WAIT);

    // Accessibility check
    await checkA11y(page);
  });

  test('should apply bold formatting', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Bold text');
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: /bold/i }).click();

    await expect(page.locator('.ProseMirror strong')).toContainText('Bold text');
  });

  test('should show word count', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('one two three four five');

    await expect(page.getByText(/5 words/)).toBeVisible(VISIBILITY_WAIT);
  });

  test('should autosave after typing', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Autosave test content');

    await expect(page.getByText('Unsaved changes')).toBeVisible(VISIBILITY_WAIT);

    // Wait for autosave debounce + save using centralized timeout
    await page.waitForTimeout(TIMEOUTS.AUTOSAVE_WAIT);

    await expect(page.getByText(/Saved/)).toBeVisible(VISIBILITY_WAIT);
  });

  test('should persist content after reload', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Persistent content');

    // Wait for autosave
    await page.waitForTimeout(TIMEOUTS.AUTOSAVE_WAIT);
    await expect(page.getByText(/Saved/)).toBeVisible(VISIBILITY_WAIT);

    await page.reload();
    await page.waitForSelector('[data-testid="editor"]', { timeout: TIMEOUTS.PAGE_LOAD });

    await expect(page.locator('.ProseMirror')).toContainText('Persistent content');
  });
});
```

### Step 10.16: Add package.json scripts

Add to `package.json`:

```json
{
  "scripts": {
    "start:test": "next build && next start",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

### Step 10.17: Run E2E tests

```bash
npm run test:e2e
```

**Expected:** All E2E tests pass

### Step 10.18: Commit

```bash
git add playwright.config.ts e2e .gitignore .gitattributes package.json
git commit -m "test: add Playwright E2E tests with worker isolation, timeouts, fixtures, and a11y"
```

---

## Verification Checklist

- [ ] Playwright and axe-core installed
- [ ] Test environment configured (port 3099)
- [ ] `.gitattributes` created for line ending enforcement
- [ ] Centralized timeout constants created (`e2e/config/timeouts.ts`)
- [ ] Test account strategy file created (shared + worker accounts)
- [ ] Worker context file created (`e2e/fixtures/worker-context.ts`)
- [ ] Cleanup utilities created (`e2e/helpers/cleanup.ts`)
- [ ] Hydration helpers created (`e2e/helpers/hydration.ts`)
- [ ] Auth helpers created (`e2e/helpers/auth.ts`)
- [ ] Accessibility helpers created (`e2e/helpers/axe.ts`)
- [ ] Login Page Object created (`e2e/pages/LoginPage.ts`)
- [ ] Global setup with CRLF check and verification
- [ ] Serial/parallel project separation in playwright.config
- [ ] Auth setup working
- [ ] Auth tests pass with accessibility checks
- [ ] Projects tests pass with hydration handling
- [ ] Editor tests pass with centralized timeouts
- [ ] No hardcoded timeout values in test files
- [ ] Video retained on failure
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Phase 1 Verification](./99-verification.md)** to confirm all features work.
