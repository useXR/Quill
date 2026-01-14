# Task 3.6: CLI Validation Function

> **Phase 3** | [← Claude CLI Wrapper](./05-claude-cli-wrapper.md) | [Next: Streaming Module →](./07-streaming-module.md)

---

## Context

**This task adds CLI validation and the AIProvider implementation to the CLI wrapper.** This enables the application to check CLI availability before use and provides a standardized provider interface.

### Prerequisites

- **Task 3.5** completed (Claude CLI Wrapper) - base module to extend

### What This Task Creates

- Adds `validateClaudeCLI` function to `src/lib/ai/claude-cli.ts`
- Adds `ClaudeCLIProvider` class implementing `AIProvider`
- Updates `src/lib/ai/__tests__/claude-cli.test.ts` with new tests

### Tasks That Depend on This

- **Task 3.10** (SSE API Route) - can use the provider factory

### Design System: Validation Status UI

When displaying CLI validation status to users, follow the [Quill Design System](../../design-system.md) patterns:

**Validation Progress Display:**

```tsx
<div className="flex items-center gap-3 p-4 bg-surface rounded-lg border border-ink-faint">
  {/* Loading state */}
  <Loader2 className="w-5 h-5 text-quill animate-spin" />
  <span className="font-ui text-sm text-ink-secondary">Checking Claude CLI status...</span>
</div>
```

**Version Display (when ready):**

```tsx
<div className="flex items-center gap-2">
  <CheckCircle className="w-4 h-4 text-success" />
  <span className="font-ui text-sm text-ink-primary">Claude CLI</span>
  <span className="font-mono text-xs text-ink-tertiary bg-bg-secondary px-1.5 py-0.5 rounded">v{version}</span>
</div>
```

**Outdated Warning:**

```tsx
<div role="alert" className="flex items-start gap-3 p-4 bg-warning-light border border-warning/20 rounded-lg">
  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
  <div>
    <p className="text-sm font-ui font-medium text-warning-dark">CLI Update Required</p>
    <p className="text-sm font-ui text-ink-secondary mt-1">
      Version {version} is outdated. Please update to {AI.MINIMUM_CLI_VERSION}+.
    </p>
  </div>
</div>
```

---

## Files to Create/Modify

- `src/lib/ai/claude-cli.ts` (modify)
- `src/lib/ai/__tests__/claude-cli.test.ts` (modify)

---

## Steps

### Step 1: Write the failing test for validateClaudeCLI

Add to `src/lib/ai/__tests__/claude-cli.test.ts`:

```typescript
import { validateClaudeCLI } from '../claude-cli';
import * as childProcess from 'child_process';
import { promisify } from 'util';

// Mock child_process.exec at module level
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    exec: vi.fn(),
  };
});

describe('validateClaudeCLI', () => {
  const mockExec = vi.mocked(childProcess.exec);

  beforeEach(() => {
    mockExec.mockReset();
  });

  it('should return ready status with version', async () => {
    // Mock version check succeeds
    mockExec.mockImplementation((cmd, opts, callback) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd === 'claude --version') {
        cb!(null, { stdout: 'claude version 1.2.3', stderr: '' });
      } else {
        // Auth test succeeds
        cb!(null, { stdout: '', stderr: '' });
      }
      return {} as any;
    });

    const status = await validateClaudeCLI();

    expect(status.status).toBe('ready');
    expect(status.version).toBe('1.2.3');
  });

  it('should return not_installed when CLI missing', async () => {
    mockExec.mockImplementation((cmd, opts, callback) => {
      const cb = typeof opts === 'function' ? opts : callback;
      const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      cb!(error, { stdout: '', stderr: '' });
      return {} as any;
    });

    const status = await validateClaudeCLI();

    expect(status.status).toBe('not_installed');
  });

  it('should return auth_required when auth test fails', async () => {
    mockExec.mockImplementation((cmd, opts, callback) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd === 'claude --version') {
        cb!(null, { stdout: 'claude version 1.2.3', stderr: '' });
      } else {
        // Auth test fails
        cb!(new Error('Authentication required'), { stdout: '', stderr: '' });
      }
      return {} as any;
    });

    const status = await validateClaudeCLI();

    expect(status.status).toBe('auth_required');
    expect(status.version).toBe('1.2.3');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/claude-cli.test.ts
```

**Expected:** FAIL (validateClaudeCLI not exported)

### Step 3: Add implementation to claude-cli.ts

Add to `src/lib/ai/claude-cli.ts`:

```typescript
import { promisify } from 'util';
import { exec } from 'child_process';
import type { CLIStatus, AIProvider } from './types';
import { AI } from '@/lib/constants/ai';
import { aiLogger } from './claude-cli';

const execPromise = promisify(exec);
const log = aiLogger({});

export async function validateClaudeCLI(): Promise<CLIStatus> {
  try {
    const { stdout } = await execPromise('claude --version');
    const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);

    if (!versionMatch) {
      return { status: 'error', message: 'Could not parse CLI version' };
    }

    const version = versionMatch[1];

    if (version < AI.MINIMUM_CLI_VERSION) {
      log.warn({ version, required: AI.MINIMUM_CLI_VERSION }, 'Claude CLI version outdated');
      return {
        status: 'outdated',
        version,
        message: `Claude CLI ${version} found, but ${AI.MINIMUM_CLI_VERSION}+ required`,
      };
    }

    try {
      await execPromise('claude -p "test" --max-turns 1', { timeout: AI.CLI_AUTH_TEST_TIMEOUT_MS });
      log.info({ version }, 'Claude CLI validated successfully');
      return { status: 'ready', version };
    } catch {
      return { status: 'auth_required', version, message: 'Please run: claude login' };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { status: 'not_installed' };
    }
    return { status: 'error', message: err.message };
  }
}

export class ClaudeCLIProvider implements AIProvider {
  private manager = new ClaudeProcessManager();

  async generate(request: ClaudeRequest): Promise<ClaudeResponse> {
    return this.manager.invoke(request);
  }

  async *stream(request: ClaudeRequest): AsyncIterable<string> {
    throw new Error('Use streamClaude for streaming');
  }

  cancel(): void {
    this.manager.cancel();
  }

  getStatus(): Promise<CLIStatus> {
    return validateClaudeCLI();
  }
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/claude-cli.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/claude-cli.ts src/lib/ai/__tests__/claude-cli.test.ts
git commit -m "feat(ai): add CLI validation and AIProvider implementation"
```

---

## E2E Tests for CLI Status Error Display

After implementing the CLI validation logic, add E2E tests to verify that CLI status errors are properly displayed to users.

### Step 6: Create CLI Status E2E Test File

Create `e2e/ai/ai-cli-status.spec.ts`:

```typescript
// e2e/ai/ai-cli-status.spec.ts
import { test, expect } from '@playwright/test';
import { waitForFormReady } from '../helpers/hydration';
import { VISIBILITY_WAIT } from '../config/timeouts';

test.describe('CLI Status Error Display', () => {
  test.describe('CLI Not Installed', () => {
    test.beforeEach(async ({ page }) => {
      // Mock CLI status endpoint to return not_installed
      await page.route('/api/ai/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'not_installed',
            message: 'Claude CLI not found. Please install it first.',
          }),
        });
      });
    });

    test('should display "CLI not installed" error message to user', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test text');
      await page.keyboard.press('Control+a');

      const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
      await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

      // Click any action button
      await toolbar.getByRole('button', { name: /refine/i }).click();

      // Should display CLI not installed error
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 3000 });
      await expect(errorAlert).toContainText(/not installed|CLI not found/i);

      // Should show installation instructions
      await expect(errorAlert).toContainText(/install/i);
    });

    test('should show installation link in error message', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test');
      await page.keyboard.press('Control+a');

      await page
        .getByRole('toolbar', { name: /text formatting/i })
        .getByRole('button', { name: /refine/i })
        .click();

      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 3000 });

      // Should have a link or button to help with installation
      const installLink = errorAlert.getByRole('link', { name: /install|get started/i });
      await expect(installLink).toBeVisible();
    });
  });

  test.describe('Authentication Required', () => {
    test.beforeEach(async ({ page }) => {
      // Mock CLI status endpoint to return auth_required
      await page.route('/api/ai/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'auth_required',
            version: '1.2.3',
            message: 'Please run: claude login',
          }),
        });
      });
    });

    test('should display "authentication required" error message to user', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test text');
      await page.keyboard.press('Control+a');

      const toolbar = page.getByRole('toolbar', { name: /text formatting/i });
      await expect(toolbar).toBeVisible(VISIBILITY_WAIT);

      await toolbar.getByRole('button', { name: /refine/i }).click();

      // Should display auth required error
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 3000 });
      await expect(errorAlert).toContainText(/authentication|login|auth required/i);
    });

    test('should show login command in error message', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test');
      await page.keyboard.press('Control+a');

      await page
        .getByRole('toolbar', { name: /text formatting/i })
        .getByRole('button', { name: /refine/i })
        .click();

      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 3000 });

      // Should show the command to run
      await expect(errorAlert).toContainText(/claude login/i);
    });

    test('should display auth error with proper design system styling', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test');
      await page.keyboard.press('Control+a');

      await page
        .getByRole('toolbar', { name: /text formatting/i })
        .getByRole('button', { name: /refine/i })
        .click();

      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 3000 });

      // Verify design system warning styling
      await expect(errorAlert).toHaveClass(/bg-warning-light|bg-error-light/);
    });
  });

  test.describe('CLI Version Outdated', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('/api/ai/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'outdated',
            version: '0.5.0',
            message: 'Claude CLI 0.5.0 found, but 1.0.0+ required',
          }),
        });
      });
    });

    test('should display version outdated warning to user', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test');
      await page.keyboard.press('Control+a');

      await page
        .getByRole('toolbar', { name: /text formatting/i })
        .getByRole('button', { name: /refine/i })
        .click();

      const warningAlert = page.locator('[role="alert"]');
      await expect(warningAlert).toBeVisible({ timeout: 3000 });
      await expect(warningAlert).toContainText(/outdated|update|upgrade/i);
      await expect(warningAlert).toContainText(/0\.5\.0/); // Current version
    });
  });

  test.describe('CLI Ready State', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('/api/ai/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ready',
            version: '1.2.3',
          }),
        });
      });

      // Mock AI endpoint for successful generation
      await page.route('/api/ai/generate', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"content":"Refined content"}\n\ndata: [DONE]\n\n',
        });
      });
    });

    test('should proceed with AI operation when CLI is ready', async ({ page }) => {
      await page.goto('/projects/test-project/documents/test-doc');
      await waitForFormReady(page);

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.pressSequentially('Test');
      await page.keyboard.press('Control+a');

      await page
        .getByRole('toolbar', { name: /text formatting/i })
        .getByRole('button', { name: /refine/i })
        .click();

      // Should NOT show error, should show loading/streaming
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).not.toBeVisible({ timeout: 1000 });

      // Should show accept button after streaming completes
      const acceptButton = page.getByRole('button', { name: /accept/i });
      await expect(acceptButton).toBeVisible({ timeout: 10000 });
    });
  });
});
```

### Step 7: Run E2E Tests (Gate)

**Run these tests before proceeding to the next task:**

```bash
npx playwright test e2e/ai/ai-cli-status.spec.ts
```

**Gate:** All CLI status error display tests must pass before proceeding to Task 3.7.

---

## Verification Checklist

- [ ] `validateClaudeCLI` function is exported
- [ ] `ClaudeCLIProvider` class is exported
- [ ] Tests pass: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
- [ ] Validation checks: version, authentication status
- [ ] Provider implements `AIProvider` interface
- [ ] E2E test file exists: `e2e/ai/ai-cli-status.spec.ts`
- [ ] "CLI not installed" error displays correctly to user
- [ ] "Authentication required" error displays correctly to user
- [ ] "CLI outdated" warning displays correctly to user
- [ ] E2E tests pass: `npx playwright test e2e/ai/ai-cli-status.spec.ts`
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.7: Streaming Module](./07-streaming-module.md)**.
