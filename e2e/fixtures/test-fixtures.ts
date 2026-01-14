/**
 * Custom Playwright fixtures for worker isolation and test data management.
 */
import { test as base, expect, type WorkerInfo } from '@playwright/test';
import { getWorkerAccount } from './test-accounts';
import { TIMEOUTS, HYDRATION_WAIT } from '../config/timeouts';

// Worker context for parallel test isolation
export interface WorkerContext {
  workerIndex: number;
  account: { email: string; password: string; name: string };
  prefix: (name: string) => string;
}

// Define custom fixtures
type TestFixtures = {
  loginAsWorker: () => Promise<void>;
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
