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

## Verification Checklist

- [ ] `validateClaudeCLI` function is exported
- [ ] `ClaudeCLIProvider` class is exported
- [ ] Tests pass: `npm test src/lib/ai/__tests__/claude-cli.test.ts`
- [ ] Validation checks: version, authentication status
- [ ] Provider implements `AIProvider` interface
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.7: Streaming Module](./07-streaming-module.md)**.
