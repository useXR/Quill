/**
 * Custom Playwright fixtures for worker isolation and test data management.
 *
 * Authentication is handled via storageState from the auth.setup.ts project.
 * Tests using this fixture will already be authenticated.
 */
/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, type WorkerInfo, type Page } from '@playwright/test';
import { getWorkerAccount } from './test-accounts';
import { loginWithMagicLink, generateTestEmail } from '../helpers/auth';

// Worker context for parallel test isolation
export interface WorkerContext {
  workerIndex: number;
  account: { email: string; name: string };
  prefix: (name: string) => string;
}

// Define custom fixtures
type TestFixtures = {
  /** Ensures the page is authenticated (via storage state or fresh login) */
  authenticatedPage: Page;
  /** Login with a fresh magic link (for tests that need a specific email) */
  loginWithFreshMagicLink: (email?: string) => Promise<void>;
};

type WorkerFixtures = {
  workerCtx: WorkerContext;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped: shared across all tests in a worker
  workerCtx: [
    async ({}, use: (ctx: WorkerContext) => Promise<void>, workerInfo: WorkerInfo) => {
      const runId = Math.random().toString(36).substring(2, 6);
      const account = getWorkerAccount(workerInfo.parallelIndex);

      const ctx: WorkerContext = {
        workerIndex: workerInfo.parallelIndex,
        account: { email: account.email, name: account.name },
        prefix: (name: string) => `W${workerInfo.parallelIndex}_${runId}_${name}`,
      };

      await use(ctx);
    },
    { scope: 'worker' },
  ],

  // Authenticated page - verifies auth state is loaded from storageState
  authenticatedPage: async ({ page }, use) => {
    // Storage state should already be loaded from the project config
    // Verify we're authenticated by checking we can access a protected route
    await page.goto('/projects');

    // If redirected to login, storage state wasn't loaded properly
    if (page.url().includes('/login')) {
      throw new Error(
        'Not authenticated. Make sure tests depend on the "setup" project ' +
          'and storageState is configured in playwright.config.ts'
      );
    }

    await use(page);
  },

  // Login with fresh magic link - for tests that need specific auth or fresh session
  loginWithFreshMagicLink: async ({ page }, use) => {
    const login = async (email?: string) => {
      const testEmail = email || generateTestEmail('test');
      await loginWithMagicLink(page, testEmail);
    };

    await use(login);
  },
});

export { expect };
