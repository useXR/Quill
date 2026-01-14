import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Use isolated port 3088 for tests to avoid conflicts with dev server on port 3000
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
    // AUTH SETUP - Runs first, creates storage state
    // ============================================
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ============================================
    // UNAUTHENTICATED TESTS - No auth state needed
    // Use for login form, public pages, auth redirects
    // ============================================
    {
      name: 'chromium-unauth',
      testMatch: ['**/auth/**/*.spec.ts', '**/projects/projects.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },

    // ============================================
    // SERIAL TESTS - Shared state, role-based
    // Use for onboarding flows, invite sequences
    // ============================================
    {
      name: 'serial',
      testMatch: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      fullyParallel: false,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/.auth/user.json',
      },
    },

    // ============================================
    // PARALLEL TESTS - Worker-isolated (authenticated)
    // Use for most tests
    // ============================================
    {
      name: 'chromium',
      testIgnore: [
        '**/auth/**/*.spec.ts',
        '**/onboarding/**/*.spec.ts',
        '**/invites/**/*.spec.ts',
        '**/projects/projects.spec.ts',
        /auth\.setup\.ts/,
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/.auth/user.json',
      },
    },
    {
      name: 'firefox',
      testIgnore: [
        '**/auth/**/*.spec.ts',
        '**/onboarding/**/*.spec.ts',
        '**/invites/**/*.spec.ts',
        '**/projects/projects.spec.ts',
        /auth\.setup\.ts/,
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: '.playwright/.auth/user.json',
      },
    },
    {
      name: 'webkit',
      testIgnore: [
        '**/auth/**/*.spec.ts',
        '**/onboarding/**/*.spec.ts',
        '**/invites/**/*.spec.ts',
        '**/projects/projects.spec.ts',
        /auth\.setup\.ts/,
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Safari'],
        storageState: '.playwright/.auth/user.json',
      },
    },
    {
      name: 'mobile',
      testIgnore: [
        '**/auth/**/*.spec.ts',
        '**/onboarding/**/*.spec.ts',
        '**/invites/**/*.spec.ts',
        '**/projects/projects.spec.ts',
        /auth\.setup\.ts/,
      ],
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 12'],
        storageState: '.playwright/.auth/user.json',
      },
    },
  ],

  // Web server configuration
  // NOTE: In CI, we use 'pnpm start' because the build artifact is downloaded.
  // Locally, we use 'pnpm dev' with the test port for isolation.
  // Next.js automatically loads .env.test when NODE_ENV=test.
  webServer: {
    command: process.env.CI ? `PORT=${PORT} pnpm start` : `PORT=${PORT} NODE_ENV=test pnpm dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
