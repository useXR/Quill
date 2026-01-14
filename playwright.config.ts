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
