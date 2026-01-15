/**
 * Custom Playwright fixtures for worker isolation and test data management.
 *
 * Authentication is handled via storageState from the auth.setup.ts project.
 * Tests using this fixture will already be authenticated.
 */
/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, type WorkerInfo, type Page, request as playwrightRequest } from '@playwright/test';
import { getWorkerAccount } from './test-accounts';
import { loginWithMagicLink, generateTestEmail } from '../helpers/auth';
import * as path from 'path';

// Worker context for parallel test isolation
export interface WorkerContext {
  workerIndex: number;
  account: { email: string; name: string };
  prefix: (name: string) => string;
  projectId: string; // Required for Phase 4 E2E tests
  documentId: string; // Required for Phase 4 E2E tests
}

// Base URL for API calls
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3088}`;
const AUTH_FILE = path.join(__dirname, '../../.playwright/.auth/user.json');

/**
 * Create a test project via API.
 * Uses stored auth state from auth.setup.ts.
 */
async function createTestProject(title: string): Promise<string> {
  const context = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    storageState: AUTH_FILE,
  });

  const response = await context.post('/api/projects', {
    data: { title, description: 'Auto-created test project for E2E worker isolation' },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create test project: ${response.status()} - ${text}`);
  }

  const project = await response.json();
  await context.dispose();
  return project.id;
}

/**
 * Create a test document via API.
 */
async function createTestDocument(projectId: string, title: string): Promise<string> {
  const context = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    storageState: AUTH_FILE,
  });

  const response = await context.post('/api/documents', {
    data: { project_id: projectId, title },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create test document: ${response.status()} - ${text}`);
  }

  const document = await response.json();
  await context.dispose();
  return document.id;
}

/**
 * Delete a test project via API.
 */
async function cleanupTestProject(projectId: string): Promise<void> {
  try {
    const context = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: AUTH_FILE,
    });

    await context.delete(`/api/projects/${projectId}`);
    await context.dispose();
  } catch (error) {
    console.warn(`Failed to cleanup project ${projectId}:`, error);
  }
}

/**
 * Delete a test document via API.
 */
async function cleanupTestDocument(documentId: string): Promise<void> {
  try {
    const context = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: AUTH_FILE,
    });

    await context.delete(`/api/documents/${documentId}`);
    await context.dispose();
  } catch (error) {
    console.warn(`Failed to cleanup document ${documentId}:`, error);
  }
}

// Define custom fixtures
type TestFixtures = {
  /** Ensures the page is authenticated (via storage state or fresh login) */
  authenticatedPage: Page;
  /** Login with a fresh magic link (for tests that need a specific email) */
  loginWithFreshMagicLink: (email?: string) => Promise<void>;
  /** Login with worker credentials (for Phase 4 tests) */
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

      // Create test project and document for this worker
      const projectId = await createTestProject(`Test Project W${workerInfo.parallelIndex}_${runId}`);
      const documentId = await createTestDocument(projectId, `Test Document W${workerInfo.parallelIndex}_${runId}`);

      const ctx: WorkerContext = {
        workerIndex: workerInfo.parallelIndex,
        account: { email: account.email, name: account.name },
        prefix: (name: string) => `W${workerInfo.parallelIndex}_${runId}_${name}`,
        projectId,
        documentId,
      };

      await use(ctx);

      // Cleanup after worker tests complete
      await cleanupTestDocument(documentId);
      await cleanupTestProject(projectId);
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

  // Login with worker credentials - for Phase 4 tests that need worker-specific auth
  loginAsWorker: async ({ page, workerCtx }, use) => {
    const login = async () => {
      await loginWithMagicLink(page, workerCtx.account.email);
    };
    await use(login);
  },
});

export { expect };
