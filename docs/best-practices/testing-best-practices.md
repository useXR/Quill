# Testing Best Practices

A comprehensive guide to testing infrastructure patterns for TypeScript, React, Next.js, and Supabase applications.

---

## Phase 0 Implementation Status

> **Note for future phases:** The following best practices are **fully implemented in Phase 0** and do NOT need to be repeated. Later phases should use these existing utilities rather than recreating them.

### ✅ Already Implemented in Phase 0

| Best Practice                                                            | Implemented In | Files Created                                               |
| ------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------- |
| **Vitest Configuration**                                                 | Task 0.3       | `vitest.config.ts`, `vitest.setup.ts`                       |
| **Browser API Mocks** (matchMedia, ResizeObserver, IntersectionObserver) | Task 0.3       | `vitest.setup.ts`                                           |
| **ESLint Test File Relaxation**                                          | Task 0.2       | `eslint.config.mjs`                                         |
| **Custom Render with Providers**                                         | Task 0.3       | `src/test-utils/render.tsx`                                 |
| **Opt-in Next.js Mocks**                                                 | Task 0.3       | `src/test-utils/next-mocks.ts`                              |
| **Test Data Factories**                                                  | Task 0.8       | `src/test-utils/factories.ts`                               |
| **Playwright Configuration** (serial/parallel projects)                  | Task 0.4       | `playwright.config.ts`                                      |
| **Centralized Timeout Constants**                                        | Task 0.4       | `e2e/config/timeouts.ts`                                    |
| **Test Account Definitions**                                             | Task 0.4       | `e2e/fixtures/test-accounts.ts`                             |
| **Worker Isolation Pattern**                                             | Task 0.4       | `e2e/fixtures/test-fixtures.ts`                             |
| **React Hydration Helpers**                                              | Task 0.4       | `e2e/helpers/hydration.ts`                                  |
| **Authentication Helpers**                                               | Task 0.4       | `e2e/helpers/auth.ts`                                       |
| **Accessibility Testing (axe-core)**                                     | Task 0.4       | `e2e/helpers/axe.ts`                                        |
| **Test Data Cleanup Utilities**                                          | Task 0.4       | `e2e/helpers/cleanup.ts`                                    |
| **Page Object Model Base**                                               | Task 0.4       | `e2e/pages/LoginPage.ts`                                    |
| **Global Setup/Teardown**                                                | Task 0.4       | `e2e/setup/global-setup.ts`, `e2e/setup/global-teardown.ts` |
| **Environment Isolation** (port 3000 dev, 3099 test)                     | Task 0.4       | `playwright.config.ts`, `.env.test`                         |
| **Supabase Test Utilities** (service role client, user creation)         | Task 0.8       | `src/lib/supabase/test-utils.ts`                            |
| **TestData Class with Auto-cleanup**                                     | Task 0.8       | `src/lib/supabase/test-utils.ts`                            |
| **GitHub Actions CI Workflow**                                           | Task 0.9       | `.github/workflows/ci.yml`                                  |

### What Later Phases Should Do

1. **Use existing utilities** - Import from `@/test-utils` and `e2e/helpers/`
2. **Extend Page Objects** - Add new page classes in `e2e/pages/` following `LoginPage.ts` pattern
3. **Add feature tests** - Create test specs in `e2e/[feature]/` directories
4. **Use existing timeouts** - Import from `e2e/config/timeouts.ts`, don't hardcode
5. **Use existing fixtures** - Use `workerCtx` and `loginAsWorker` from test-fixtures.ts
6. **Add new factories** - Extend `src/test-utils/factories.ts` for new entity types

---

## Phase 1 Implementation Status

> **Note for future phases:** The following utilities are **added in Phase 1** and should be used by later phases.

### ✅ Added in Phase 1

| Utility                  | Purpose                                                       | Files Created                     |
| ------------------------ | ------------------------------------------------------------- | --------------------------------- |
| **Supabase Mock**        | Unit test Supabase operations without database                | `src/test-utils/supabase-mock.ts` |
| **TipTap Mock**          | Unit test editor-related components                           | `src/test-utils/tiptap-mock.ts`   |
| **Auth Constants**       | Centralized auth magic values (rate limits, session duration) | `src/lib/constants/auth.ts`       |
| **Editor Constants**     | Centralized editor magic values (autosave timing, retries)    | `src/lib/constants/editor.ts`     |
| **Structured Logger**    | Production logging with pino                                  | `src/lib/logger.ts`               |
| **API Error Classes**    | Consistent API error handling                                 | `src/lib/api/errors.ts`           |
| **Zod Error Formatting** | User-friendly validation error messages                       | `src/lib/api/format-errors.ts`    |
| **API Error Handler**    | Centralized route error handling                              | `src/lib/api/handle-error.ts`     |
| **Projects Page Object** | E2E page object for projects                                  | `e2e/pages/ProjectsPage.ts`       |
| **Editor Page Object**   | E2E page object for document editor                           | `e2e/pages/EditorPage.ts`         |

### When to Use Phase 1 Utilities

**Unit Tests - Use Supabase Mock when:**

- Testing components/hooks that call Supabase
- You want fast tests without database dependencies
- Testing error handling paths

```typescript
import { createMockSupabaseClient, createUnauthenticatedMock } from '@/test-utils';

// Authenticated user mock
const mockClient = createMockSupabaseClient({ userId: 'user-123' });

// Unauthenticated mock (for testing auth guards)
const unauthMock = createUnauthenticatedMock();

// Configure mock responses
const queryBuilder = mockClient.from('projects');
queryBuilder.mockResolve({ id: '1', title: 'Test Project' });
```

**Unit Tests - Use TipTap Mock when:**

- Testing toolbar components
- Testing hooks that interact with the editor
- Testing formatting logic

```typescript
import { createMockEditor } from '@/test-utils';

const editor = createMockEditor();
editor.chain().toggleBold().run();
expect(editor.chain().toggleBold).toHaveBeenCalled();

// Set mock state
editor._setActive('bold', true);
expect(editor.isActive('bold')).toBe(true);
```

**API Routes - Use Error Utilities:**

```typescript
import { handleApiError, formatZodError, ApiError, ErrorCodes } from '@/lib/api';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    // ... route logic
  } catch (error) {
    return handleApiError(error, logger, 'Failed to process request');
  }
}
```

**Use Constants Instead of Magic Values:**

```typescript
import { AUTH, EDITOR } from '@/lib/constants';

// Instead of: const DEBOUNCE_MS = 1000;
const { AUTOSAVE_DEBOUNCE_MS } = EDITOR;

// Instead of: const MAX_ATTEMPTS = 5;
const { MAX_LOGIN_ATTEMPTS } = AUTH;
```

### What Later Phases Should Add

1. **Extend mocks** - Add methods to existing mocks for new features
2. **Add Page Objects** - Create page objects in `e2e/pages/` for new pages
3. **Add constants** - Create new constant files for domain-specific values
4. **Use existing patterns** - Follow the `handleApiError` + `formatZodError` pattern for all API routes

---

## Phase 2 Implementation Status

> **Note for future phases:** The following utilities are **added in Phase 2** and should be used by later phases.

### ✅ Added in Phase 2

| Utility                   | Purpose                                 | Files Created                         |
| ------------------------- | --------------------------------------- | ------------------------------------- |
| **Vault Test Fixtures**   | Factory functions for vault test data   | `src/lib/vault/__tests__/fixtures.ts` |
| **VaultPage Page Object** | E2E page object for vault functionality | `e2e/pages/VaultPage.ts`              |
| **Vault E2E Tests**       | Complete E2E coverage for vault feature | `e2e/vault/*.spec.ts`                 |

### Patterns Established (Must Follow in Later Phases)

| Pattern                  | Phase 2 Example                 | Later Phases Must...                        |
| ------------------------ | ------------------------------- | ------------------------------------------- |
| **Logger Mocking**       | `vi.mock('@/lib/logger', ...)`  | Mock domain loggers in unit tests           |
| **Async Processing E2E** | `waitForExtractionComplete()`   | Wait for background jobs before assertions  |
| **File Upload E2E**      | `setInputFiles({ buffer })`     | Use buffer-based uploads for E2E file tests |
| **Request Cancellation** | AbortController in search tests | Test that new requests cancel stale ones    |
| **Client Error Testing** | Test error state UI display     | Verify errors show in UI, not console       |

### When to Use Phase 2 Utilities

**Unit Tests - Use Vault Fixtures when:**

- Testing components that display vault items
- Testing hooks that operate on vault data
- You need consistent test data for vault-related tests

```typescript
import { createMockVaultItem, mockVaultItems } from '@/lib/vault/__tests__/fixtures';

// Create a single mock item with overrides
const item = createMockVaultItem({
  filename: 'test.pdf',
  extraction_status: 'success',
  chunk_count: 5,
});

// Use pre-built collection for list testing
render(<VaultItemList items={mockVaultItems} />);
```

**E2E Tests - Use VaultPage when:**

- Testing vault upload, search, or delete functionality
- Writing new vault-related E2E tests

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { VaultPage } from '../pages/VaultPage';
import { TIMEOUTS } from '../config/timeouts';

test('can upload and search vault', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();

  const vaultPage = new VaultPage(page);
  await vaultPage.goto(workerCtx.organizationId);

  await vaultPage.uploadFile('e2e/fixtures/test.txt');
  await vaultPage.waitForExtractionComplete('test.txt');
  await vaultPage.search('test content');

  await expect(async () => {
    const count = await vaultPage.getSearchResults().count();
    expect(count).toBeGreaterThan(0);
  }).toPass({ timeout: TIMEOUTS.API_CALL });
});
```

### How to Mock Domain Loggers

When testing code that uses domain-specific child loggers (like `vaultLogger`):

```typescript
// In your test file
vi.mock('@/lib/logger', () => ({
  vaultLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Then in your test
it('logs extraction completion', async () => {
  await processExtraction(itemId);

  const { vaultLogger } = await import('@/lib/logger');
  expect(vaultLogger).toHaveBeenCalledWith(expect.objectContaining({ itemId }));
});
```

### How to Test Async Background Processing (E2E)

For features with background jobs (extraction, AI processing, etc.), use polling with `expect().toPass()`:

```typescript
// In your Page Object
async waitForProcessingComplete(identifier: string) {
  await expect(async () => {
    const status = this.page.locator(`text=${identifier}`).locator('..').getByText(/success|complete/i);
    await expect(status).toBeVisible();
  }).toPass({ timeout: TIMEOUTS.API_CALL * 6 }); // Allow time for background processing
}

// In your test
test('processes uploaded file', async () => {
  await page.uploadFile('test.pdf');
  await page.waitForProcessingComplete('test.pdf'); // Waits for background job
  // Now safe to test results
});
```

### How to Test File Uploads (E2E)

Use buffer-based uploads for programmatic file creation:

```typescript
// Upload from file path
await fileInput.setInputFiles('e2e/fixtures/test.txt');

// Upload with programmatic buffer (for testing validation)
await fileInput.setInputFiles({
  name: 'test.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('test content'),
});

// Test file size validation
const largeBuffer = Buffer.alloc(101 * 1024 * 1024, 'x');
await fileInput.setInputFiles({
  name: 'large.pdf',
  mimeType: 'application/pdf',
  buffer: largeBuffer,
});
await expect(page.getByText(/file exceeds/i)).toBeVisible();
```

### How to Test Request Cancellation

When components cancel in-flight requests (e.g., search with AbortController):

```typescript
test('cancels previous request when new search started', async ({ page }) => {
  // Start first search
  await searchInput.fill('first query');
  await searchButton.click();

  // Immediately start second search (should cancel first)
  await searchInput.fill('second query');
  await searchButton.click();

  // Wait for results
  await page.waitForTimeout(TIMEOUTS.API_CALL);

  // Should not show errors from aborted request
  await expect(page.getByText(/error/i)).not.toBeVisible();

  // Results should be from second query, not first
  await expect(page.getByText(/second/i)).toBeVisible();
});
```

### What Later Phases Should Add

1. **Extend vault fixtures** - Add factory functions for new vault-related entities
2. **Add new Page Objects** - Create page objects for new features following `VaultPage.ts` pattern
3. **Follow error handling pattern** - Use error state instead of `console.error` in client components
4. **Add `waitFor*` methods** - For any new background processing, add polling methods to Page Objects

---

## Phase 3 Implementation Status

> **Note for future phases:** The following utilities are **added in Phase 3** and should be used by later phases.

### ✅ Added in Phase 3

| Utility                       | Purpose                                                  | Files Created                                   |
| ----------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| **AI Constants**              | Centralized AI magic values (timeouts, limits, versions) | `src/lib/constants/ai.ts`                       |
| **AI Test Factories**         | Factory functions for AI test data                       | `src/test-utils/factories.ts` (extended)        |
| **AI Domain Logger**          | Production logging for AI operations                     | `src/lib/ai/claude-cli.ts` (aiLogger)           |
| **Claude CLI Mock Factory**   | Mock subprocess/streaming for unit tests                 | `src/lib/ai/__tests__/mocks/mock-claude-cli.ts` |
| **AIToolbarPage Page Object** | E2E page object for AI toolbar                           | `e2e/pages/AIToolbarPage.ts`                    |
| **SSE Mock Helpers**          | E2E helpers for mocking streaming endpoints              | Pattern in E2E tests                            |

### Patterns Established (Must Follow in Later Phases)

| Pattern                      | Phase 3 Example                        | Later Phases Must...                            |
| ---------------------------- | -------------------------------------- | ----------------------------------------------- |
| **AI Domain Logger Mocking** | `vi.mock('@/lib/ai/claude-cli', ...)`  | Mock `aiLogger` in AI-related unit tests        |
| **Streaming E2E Testing**    | `waitForStreamingComplete()`           | Use polling for streaming/SSE completion        |
| **SSE Endpoint Mocking**     | `page.route('/api/ai/generate', ...)`  | Mock SSE with ReadableStream chunks             |
| **Abort Error Handling**     | `AbortError` doesn't trigger `onError` | Test that user cancellation doesn't show errors |
| **AI Operation Factories**   | `createMockAIOperation()`              | Use factories for AI operation test data        |

### When to Use Phase 3 Utilities

**Unit Tests - Use AI Factories when:**

- Testing components that display AI operations
- Testing hooks that manage AI state
- You need consistent test data for AI-related tests

```typescript
import {
  createMockAIOperation,
  createMockStreamChunk,
  createMockClaudeError,
  mockStreamChunks,
} from '@/test-utils/factories';

// Create a single mock operation with overrides
const operation = createMockAIOperation({
  type: 'selection',
  status: 'streaming',
  output: 'Partial content...',
});

// Create a mock error
const error = createMockClaudeError({
  code: 'RATE_LIMITED',
  retryable: true,
  retryAfterMs: 5000,
});

// Use pre-built collection for streaming tests
for (const chunk of mockStreamChunks) {
  callbacks.onChunk(chunk);
}
```

**Unit Tests - Mock AI Logger when:**

- Testing AI modules that use structured logging
- Verifying log calls for audit/debugging

```typescript
// Mock the AI domain logger (follows Phase 2 pattern)
vi.mock('@/lib/ai/claude-cli', () => ({
  aiLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

// Verify logging in test
it('logs AI generation start', async () => {
  await generateContent(prompt);

  const { aiLogger } = await import('@/lib/ai/claude-cli');
  expect(aiLogger).toHaveBeenCalledWith(expect.objectContaining({ streamId: expect.any(String) }));
});
```

**E2E Tests - Use AIToolbarPage when:**

- Testing selection toolbar functionality
- Testing AI generation flows
- Verifying streaming behavior

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { AIToolbarPage } from '../pages/AIToolbarPage';
import { TIMEOUTS } from '../config/timeouts';

test('can refine selected text', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();

  const aiPage = new AIToolbarPage(page);
  await aiPage.goto(workerCtx.projectId, workerCtx.documentId);

  await aiPage.selectText('Text to refine');
  await aiPage.waitForToolbar();
  await aiPage.clickRefine();

  // Use polling pattern for streaming completion
  await aiPage.waitForStreamingComplete();

  await aiPage.accept();
  await expect(aiPage.editor).toContainText('Refined');
});
```

**E2E Tests - Mock SSE Endpoints:**
When testing AI features that use Server-Sent Events:

```typescript
// Mock SSE endpoint with controlled streaming response
await page.route('/api/ai/generate', async (route) => {
  const chunks = [
    'data: {"id":"chunk-0","sequence":0,"content":"Hello "}\n\n',
    'data: {"id":"chunk-1","sequence":1,"content":"world"}\n\n',
    'data: [DONE]\n\n',
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, 50)); // Simulate streaming delay
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  await route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    body: Buffer.from(await new Response(stream).arrayBuffer()),
  });
});
```

### How to Test Abort/Cancellation

When testing components that support cancellation (AbortController):

```typescript
// Unit test - verify abort doesn't trigger error callback
it('should not call onError for user-initiated abort', async () => {
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
      })
  );

  const onError = vi.fn();
  const { result } = renderHook(() => useAIStream({ onError }));

  act(() => {
    result.current.startStream('test');
  });

  act(() => {
    result.current.cancel();
  });

  await waitFor(() => {
    expect(result.current.isStreaming).toBe(false);
  });

  // AbortError should NOT trigger onError
  expect(onError).not.toHaveBeenCalled();
});
```

### How to Use Mock Claude CLI Factory

For testing code that spawns Claude CLI processes:

```typescript
import { setupMockClaude, createMockClaudeProcess } from '@/lib/ai/__tests__/mocks/mock-claude-cli';
import { spawn } from 'child_process';

vi.mock('child_process');

describe('ClaudeStream', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should emit chunks as they arrive', async () => {
    // Setup mock with specific scenario
    setupMockClaude({
      scenario: 'success',
      responseChunks: ['{"content":"Hello"}', '{"content":" world"}'],
      delayMs: 10,
    });

    const chunks: string[] = [];
    const stream = new ClaudeStream();

    await stream.stream('prompt', {
      onChunk: (chunk) => chunks.push(chunk.content),
      onComplete: () => {},
      onError: () => {},
    });

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('should handle CLI not found', async () => {
    setupMockClaude({ scenario: 'cli_not_found' });

    const stream = new ClaudeStream();
    let errorReceived: any;

    await stream.stream('prompt', {
      onChunk: () => {},
      onComplete: () => {},
      onError: (err) => {
        errorReceived = err;
      },
    });

    expect(errorReceived.code).toBe('CLI_NOT_FOUND');
  });
});
```

### What Later Phases Should Add

1. **Extend chat factories** - Add factory functions for new chat-related entities
2. **Add new Page Objects** - Create page objects for new features following `ChatPage.ts` pattern
3. **Follow AI logger pattern** - Use `aiLogger` for all AI module logging, not `console.log`
4. **Add `waitFor*` methods** - For any new streaming operations, add polling methods to Page Objects
5. **Test abort handling** - Verify user cancellation doesn't trigger error states

---

## Phase 4 Implementation Status

> **Note for future phases:** The following utilities are **added in Phase 4** and should be used by later phases.

### ✅ Added in Phase 4

| Utility                       | Purpose                                              | Files Created                            |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| **Chat Test Factories**       | Factory functions for chat messages and diff changes | `src/test-utils/factories.ts` (extended) |
| **ChatPage Page Object**      | E2E page object for chat sidebar                     | `e2e/pages/ChatPage.ts`                  |
| **DiffPanelPage Page Object** | E2E page object for diff panel and undo              | `e2e/pages/DiffPanelPage.ts`             |
| **Claude CLI Mock**           | SSE streaming mock for E2E tests                     | `e2e/fixtures/claude-cli-mock.ts`        |

### Patterns Established (Must Follow in Later Phases)

| Pattern                            | Phase 4 Example                        | Later Phases Must...                          |
| ---------------------------------- | -------------------------------------- | --------------------------------------------- |
| **Chat Factory Functions**         | `createMockChatMessage()`              | Use for testing chat-related components       |
| **Streaming Completion Wait**      | `chatPage.waitForStreamingComplete()`  | Use `expect().toPass()` pattern for SSE       |
| **Abort Non-Error Testing**        | Cancel test verifies no error shown    | Test that user abort doesn't trigger error UI |
| **SSE Mock with ReadableStream**   | `ClaudeCLIMock` with chunked responses | Use same pattern for AI endpoint mocks        |
| **Worker Isolation in Chat Tests** | `loginAsWorker()` before chat tests    | Always authenticate before E2E chat tests     |

### When to Use Phase 4 Utilities

**Unit Tests - Use Chat Factories when:**

- Testing components that display chat messages
- Testing hooks that manage chat state
- You need consistent test data for chat-related tests

```typescript
import {
  createMockChatMessage,
  createMockStreamingMessage,
  createMockDiffChange,
  mockDiffChanges,
  createMockChatHistory,
} from '@/test-utils/factories';

// Create a single mock chat message
const message = createMockChatMessage({
  role: 'assistant',
  content: 'Hello!',
  status: 'sent',
});

// Create a streaming message
const streamingMsg = createMockStreamingMessage({
  content: 'Partial response...',
});

// Create a diff change
const change = createMockDiffChange({
  type: 'add',
  value: 'New content\n',
  lineNumber: 5,
});

// Use pre-built collection for diff testing
render(<DiffPanel changes={mockDiffChanges} />);

// Create chat history for conversation testing
const history = createMockChatHistory(5); // 5 messages
```

**E2E Tests - Use ChatPage when:**

- Testing chat sidebar functionality
- Testing message sending and receiving
- Verifying mode detection UI

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test('chat interaction flow', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();

  const chatPage = new ChatPage(page);
  const claudeMock = new ClaudeCLIMock();
  await claudeMock.setupRoutes(page);
  claudeMock.registerResponse('hello', mockResponses.simpleDiscussion);

  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();
  await chatPage.sendMessage('Hello, can you help?');
  await chatPage.waitForStreamingComplete();

  const messages = await chatPage.getMessages();
  await expect(messages.last()).toContainText('helpful response');
});
```

**E2E Tests - Use DiffPanelPage when:**

- Testing diff accept/reject functionality
- Testing AI undo operations
- Verifying change progress UI

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';

test('diff accept flow', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();

  const chatPage = new ChatPage(page);
  const diffPage = new DiffPanelPage(page);
  const claudeMock = new ClaudeCLIMock();
  await claudeMock.setupRoutes(page);
  claudeMock.registerResponse('edit', { content: 'Modified content' });

  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();
  await chatPage.sendMessage('Edit this document');
  await chatPage.waitForStreamingComplete();

  await diffPage.waitForPanelVisible();
  await diffPage.acceptAll();

  // Verify undo is available
  await diffPage.expectUndoCount(1);
});
```

### How to Mock SSE Endpoints (E2E)

Use the `ClaudeCLIMock` class for consistent AI endpoint mocking:

```typescript
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test.beforeEach(async ({ page }) => {
  const claudeMock = new ClaudeCLIMock();
  await claudeMock.setupRoutes(page);

  // Register custom responses
  claudeMock.registerResponse('summarize', {
    content: 'This is a summary of your document.',
    streamChunks: ['This is ', 'a summary ', 'of your document.'],
    delayMs: 50,
  });

  // Register error response
  claudeMock.registerResponse('fail', mockResponses.networkError);

  // Register slow response for cancel testing
  claudeMock.registerResponse('slow', mockResponses.slowResponse);
});
```

### How to Test Streaming Cancellation

**CRITICAL:** User-initiated abort should NOT trigger error UI. Test this explicitly:

```typescript
test('should not show error when user cancels streaming', async ({ workerCtx }) => {
  claudeMock.registerResponse('cancel', mockResponses.slowResponse);

  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();
  await chatPage.sendMessage('cancel test');

  // Wait for cancel button to appear
  await expect(chatPage.cancelButton).toBeVisible();

  // Cancel the request
  await chatPage.cancel();

  // Wait a moment for any potential error to appear
  await chatPage.page.waitForTimeout(TIMEOUTS.ANIMATION);

  // CRITICAL: User-initiated abort should NOT trigger error state
  await expect(chatPage.errorMessage).not.toBeVisible();
  await expect(chatPage.cancelButton).not.toBeVisible();
});
```

### What Later Phases Should Add

1. **Extend chat factories** - Add factory functions for new chat-related entities (citations, research results)
2. **Extend Page Objects** - Add methods to ChatPage/DiffPanelPage for new functionality
3. **Add new Page Objects** - Create page objects for new features (CitationPage, ExportPage)
4. **Follow abort testing pattern** - Any cancellable operation must verify no error on user abort
5. **Use ClaudeCLIMock** - For any new AI endpoints, register responses with the mock

---

## Phase 5 Implementation Status

> **Note for future phases:** The following utilities are **added in Phase 5** and should be used by later phases.

### ✅ Added in Phase 5

| Utility                            | Purpose                                                   | Files Created                            |
| ---------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| **Citation Test Factories**        | Factory functions for papers, citations, search responses | `src/test-utils/factories.ts` (extended) |
| **Citation Domain Logger**         | Production logging for citation operations                | `src/lib/citations/logger.ts`            |
| **Semantic Scholar Mocks**         | Mock responses for external API testing                   | `e2e/fixtures/citation-mocks.ts`         |
| **CitationSearchPage Page Object** | E2E page object for citation search                       | `e2e/pages/CitationSearchPage.ts`        |
| **CitationListPage Page Object**   | E2E page object for citation list                         | `e2e/pages/CitationListPage.ts`          |
| **CitationPickerPage Page Object** | E2E page object for citation picker                       | `e2e/pages/CitationPickerPage.ts`        |

### Patterns Established (Must Follow in Later Phases)

| Pattern                            | Phase 5 Example                          | Later Phases Must...                                |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| **External API Client Testing**    | Semantic Scholar client tests            | Mock responses, test rate limiting, test cache TTL  |
| **Citation Domain Logger Mocking** | `vi.mock('@/lib/citations/logger', ...)` | Mock `citationLogger` in citation-related tests     |
| **TipTap Mark Extension Testing**  | Citation mark tests                      | Test mark commands, HTML parsing/rendering          |
| **External API Mock Fixtures**     | `e2e/fixtures/citation-mocks.ts`         | Create mock fixtures for external service E2E tests |
| **Rate Limit E2E Testing**         | Citation search rate limiting            | Mock 429 responses, verify retry behavior           |

### When to Use Phase 5 Utilities

**Unit Tests - Use Citation Factories when:**

- Testing components that display papers or citations
- Testing hooks that manage citation state
- You need consistent test data for citation-related tests

```typescript
import { createMockPaper, createMockCitation, createMockSearchResponse } from '@/test-utils/factories';

// Create a single mock paper with overrides
const paper = createMockPaper({
  title: 'Test Paper Title',
  year: 2024,
  citationCount: 42,
});

// Create a citation linked to project
const citation = createMockCitation({
  projectId: 'project-123',
  paperId: paper.paperId,
});

// Create search response for list testing
const response = createMockSearchResponse({
  total: 100,
  papers: [paper],
});
```

**Unit Tests - Mock Citation Logger when:**

- Testing citation modules that use structured logging
- Verifying log calls for audit/debugging

```typescript
// Mock the citation domain logger (follows Phase 2-3 pattern)
vi.mock('@/lib/citations/logger', () => ({
  citationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

// Verify logging in test
it('logs citation creation', async () => {
  await createCitation(data);

  const { citationLogger } = await import('@/lib/citations/logger');
  expect(citationLogger).toHaveBeenCalledWith(expect.objectContaining({ projectId: expect.any(String) }));
});
```

**E2E Tests - Use Citation Page Objects when:**

- Testing citation search functionality
- Testing citation management flows
- Verifying citation picker in editor

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { CitationSearchPage } from '../pages/CitationSearchPage';
import { CitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test('can search and add citation', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();

  const citationSearch = new CitationSearchPage(page);
  await CitationMocks.setupRoutes(page);

  await citationSearch.goto(workerCtx.projectId);
  await citationSearch.search('machine learning');

  await expect(async () => {
    const count = await citationSearch.getResultCount();
    expect(count).toBeGreaterThan(0);
  }).toPass({ timeout: TIMEOUTS.API_CALL });

  await citationSearch.selectFirstResult();
  await citationSearch.addCitation();

  await expect(citationSearch.successToast).toBeVisible();
});
```

### How to Test External API Clients

When testing clients that call external APIs (Semantic Scholar, etc.):

```typescript
// Unit test - mock fetch responses
vi.mock('global', () => ({
  fetch: vi.fn(),
}));

describe('SemanticScholarClient', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('should return papers from search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 1,
          data: [createMockPaper()],
        }),
        { status: 200 }
      )
    );

    const results = await searchPapers('query');
    expect(results.papers).toHaveLength(1);
  });

  it('should handle rate limiting (429)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '5' } }));

    await expect(searchPapers('query')).rejects.toThrow(SemanticScholarError);
  });

  it('should use cached results within TTL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ total: 1, data: [createMockPaper()] }), { status: 200 })
    );

    // First call hits API
    await searchPapersWithCache('query');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call uses cache
    await searchPapersWithCache('query');
    expect(fetch).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should refetch after cache TTL expires', async () => {
    vi.useFakeTimers();

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ total: 1, data: [createMockPaper()] }), { status: 200 })
    );

    await searchPapersWithCache('query');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance past TTL (5 minutes)
    vi.advanceTimersByTime(6 * 60 * 1000);

    await searchPapersWithCache('query');
    expect(fetch).toHaveBeenCalledTimes(2); // Cache expired, refetched

    vi.useRealTimers();
  });
});
```

### How to Test TipTap Mark Extensions

When testing TipTap Mark extensions (vs Node/Extension):

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Citation } from '@/components/editor/extensions/citation';

describe('Citation Mark Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, Citation],
      content: '<p>Test content</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should register citation mark', () => {
    expect(editor.extensionManager.extensions.find((ext) => ext.name === 'citation')).toBeDefined();
  });

  it('should set citation via command', () => {
    editor
      .chain()
      .focus()
      .selectAll()
      .setCitation({
        citationId: 'cit-123',
        number: 1,
      })
      .run();

    const marks = editor.state.selection.$from.marks();
    expect(marks.some((m) => m.type.name === 'citation')).toBe(true);
  });

  it('should unset citation via command', () => {
    // First set citation
    editor
      .chain()
      .focus()
      .selectAll()
      .setCitation({
        citationId: 'cit-123',
        number: 1,
      })
      .run();

    // Then unset
    editor.chain().focus().selectAll().unsetCitation().run();

    const marks = editor.state.selection.$from.marks();
    expect(marks.some((m) => m.type.name === 'citation')).toBe(false);
  });

  it('should parse citation from HTML', () => {
    const html = '<p>Text with <cite data-citation-id="cit-123" data-number="1">citation</cite></p>';
    editor.commands.setContent(html);

    const marks = editor.state.doc.firstChild?.firstChild?.marks || [];
    const citationMark = marks.find((m) => m.type.name === 'citation');

    expect(citationMark).toBeDefined();
    expect(citationMark?.attrs.citationId).toBe('cit-123');
  });

  it('should render citation to HTML', () => {
    editor
      .chain()
      .focus()
      .selectAll()
      .setCitation({
        citationId: 'cit-123',
        number: 1,
      })
      .run();

    const html = editor.getHTML();
    expect(html).toContain('data-citation-id="cit-123"');
    expect(html).toContain('data-number="1"');
  });
});
```

### How to Mock External API in E2E Tests

Create fixture files for external API mocking:

```typescript
// e2e/fixtures/citation-mocks.ts
import { Page } from '@playwright/test';
import { createMockPaper, createMockSearchResponse } from '@/test-utils/factories';

export const mockSearchResults = {
  empty: createMockSearchResponse({ total: 0, papers: [] }),
  singleResult: createMockSearchResponse({
    total: 1,
    papers: [createMockPaper({ title: 'Machine Learning Fundamentals' })],
  }),
  multipleResults: createMockSearchResponse({
    total: 50,
    papers: Array.from({ length: 10 }, (_, i) => createMockPaper({ title: `Paper ${i + 1}`, year: 2024 - i })),
  }),
  rateLimited: { status: 429, headers: { 'Retry-After': '5' } },
  serverError: { status: 500, body: { error: 'Internal server error' } },
};

export class CitationMocks {
  static async setupRoutes(page: Page) {
    // Mock Semantic Scholar API
    await page.route('**/api/citations/search**', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') || '';

      if (query === 'rate-limit-test') {
        return route.fulfill({
          status: 429,
          headers: { 'Retry-After': '5' },
        });
      }

      if (query === 'error-test') {
        return route.fulfill({
          status: 500,
          json: { error: 'Internal server error' },
        });
      }

      // Default: return mock results
      return route.fulfill({
        status: 200,
        json: mockSearchResults.multipleResults,
      });
    });
  }

  static async mockRateLimit(page: Page) {
    await page.route('**/api/citations/search**', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '5' },
      })
    );
  }

  static async mockEmpty(page: Page) {
    await page.route('**/api/citations/search**', (route) =>
      route.fulfill({
        status: 200,
        json: mockSearchResults.empty,
      })
    );
  }
}
```

### What Later Phases Should Add

1. **Extend citation factories** - Add factory functions for new citation-related entities
2. **Extend Page Objects** - Add methods to CitationSearchPage for new functionality
3. **Follow external API testing pattern** - Test caching, rate limiting, and error handling
4. **Add domain logger mocks** - Follow the `citationLogger` pattern for new domains
5. **Test TipTap extensions thoroughly** - Commands, HTML parsing, and rendering

---

## Phase 6 Implementation Status

> **Note for future phases:** The following utilities are **added in Phase 6** and should be used by later phases.

### ✅ Added in Phase 6

| Utility                            | Purpose                                            | Files Created                             |
| ---------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| **Export Test Factories**          | Factory functions for export documents and options | `src/test-utils/factories.ts` (extended)  |
| **ExportPage Page Object**         | E2E page object for document export                | `e2e/pages/ExportPage.ts`                 |
| **ToastPage Page Object**          | E2E page object for toast notifications            | `e2e/pages/ToastPage.ts`                  |
| **CommandPalettePage Page Object** | E2E page object for command palette                | `e2e/pages/CommandPalettePage.ts`         |
| **MobileNavPage Page Object**      | E2E page object for mobile navigation              | `e2e/pages/MobileNavPage.ts`              |
| **Phase 6 Timeout Constants**      | Export and toast-specific timeouts                 | `e2e/config/timeouts.ts` (extended)       |
| **Puppeteer Mock Pattern**         | Mocking headless browser for PDF generation        | Unit tests in `src/lib/export/__tests__/` |
| **useMediaQuery Test Pattern**     | Testing responsive hooks with matchMedia mocks     | Unit tests in `src/hooks/__tests__/`      |
| **Custom Error Class Tests**       | Testing error hierarchies with instanceof          | Unit tests in `src/lib/__tests__/`        |
| **Toast Auto-Dismiss Pattern**     | Testing timers with vi.useFakeTimers()             | Unit tests in `src/hooks/__tests__/`      |

### Patterns Established (Must Follow in Later Phases)

**E2E Testing Patterns:**

| Pattern                            | Phase 6 Example                                           | Later Phases Must...                                            |
| ---------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| **Extend Existing Infrastructure** | Uses Phase 0 `TIMEOUTS`, `checkA11y()`, `loginAsWorker`   | Never recreate existing utilities; extend them                  |
| **Page Objects in `e2e/pages/`**   | `ExportPage.ts`, `ToastPage.ts` in `e2e/pages/`           | Place all page objects in `e2e/pages/`, not `e2e/page-objects/` |
| **Use Existing Fixtures**          | Uses `workerCtx`, `loginAsWorker` from `test-fixtures.ts` | Use existing auth fixtures, don't create new auth setup         |
| **Use Existing Helpers**           | Uses `checkA11y()`, `waitForFormReady()`                  | Import from `e2e/helpers/`, don't recreate                      |
| **Export Factory Functions**       | `createMockExportDocument()`                              | Use factories for export-related test data                      |
| **Toast ARIA Testing**             | `toHaveAttribute('aria-live', 'polite')`                  | Verify ARIA attributes for notifications                        |
| **Touch Target Testing**           | `boundingBox()` with 44px assertions                      | Test all interactive elements meet 44px minimum                 |

**Unit Testing Patterns:**

| Pattern                          | Phase 6 Example                                   | Later Phases Must...                                 |
| -------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| **Puppeteer Mocking**            | Mock browser, page, and pdf methods               | Mock external process tools, verify cleanup on error |
| **matchMedia Testing**           | Track listeners, simulate media changes           | Test responsive hooks with listener tracking         |
| **Custom Error Classes**         | instanceof checks, name/statusCode verification   | Test error inheritance chain and properties          |
| **Fake Timers for Auto-Dismiss** | `vi.useFakeTimers()` + `vi.advanceTimersByTime()` | Test time-dependent behavior with constants          |
| **Use Constants in Timer Tests** | `TOAST.DEFAULT_TIMEOUT_MS`                        | Never hardcode timeout values in timer tests         |

### Unit Testing Patterns from Phase 6

**How to Mock Puppeteer for PDF Tests:**

When testing code that uses Puppeteer for PDF generation, mock the browser:

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock puppeteer module
vi.mock('puppeteer', () => ({
  launch: vi.fn(),
}));

import puppeteer from 'puppeteer';

describe('PDF Export', () => {
  const mockPage = {
    setContent: vi.fn(),
    pdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    close: vi.fn(),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates PDF with correct options', async () => {
    const result = await exportToPdf('<p>Content</p>', { title: 'Test' });

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox'],
    });
    expect(mockPage.setContent).toHaveBeenCalled();
    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        printBackground: true,
      })
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it('closes browser after PDF generation', async () => {
    await exportToPdf('<p>Content</p>', { title: 'Test' });

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('closes browser even on error', async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error('PDF failed'));

    await expect(exportToPdf('<p>Content</p>', { title: 'Test' })).rejects.toThrow();
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
```

**How to Test useMediaQuery with matchMedia Mock:**

Testing responsive hooks that use `window.matchMedia`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMediaQuery } from '@/hooks/useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Map<string, Set<(e: MediaQueryListEvent) => void>>;

  beforeEach(() => {
    listeners = new Map();

    // Mock matchMedia with listener tracking
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false, // Default to not matching
      media: query,
      onchange: null,
      addEventListener: vi.fn((event, listener) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(listener);
      }),
      removeEventListener: vi.fn((event, listener) => {
        listeners.get(query)?.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for non-matching query', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('returns true when query matches', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as any
    );

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      const query = '(min-width: 768px)';
      listeners.get(query)?.forEach((listener) => {
        listener({ matches: true, media: query } as MediaQueryListEvent);
      });
    });

    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    const mockMql = window.matchMedia('(min-width: 768px)');
    unmount();

    expect(mockMql.removeEventListener).toHaveBeenCalled();
  });
});
```

**How to Test Custom Error Classes:**

Testing error hierarchies with instanceof checks:

```typescript
import { describe, it, expect } from 'vitest';
import { AppError, NetworkError, NotFoundError, ValidationError } from '@/lib/errors';

describe('Custom Error Classes', () => {
  describe('AppError (base class)', () => {
    it('creates error with message', () => {
      const error = new AppError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('AppError');
    });

    it('is instanceof Error', () => {
      const error = new AppError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('captures stack trace', () => {
      const error = new AppError('Test');
      expect(error.stack).toBeDefined();
    });
  });

  describe('NetworkError', () => {
    it('is instanceof AppError', () => {
      const error = new NetworkError('Network failed');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NetworkError);
    });

    it('stores status code', () => {
      const error = new NetworkError('Not found', 404);
      expect(error.statusCode).toBe(404);
    });

    it('has correct name', () => {
      const error = new NetworkError('Test');
      expect(error.name).toBe('NetworkError');
    });
  });

  describe('NotFoundError', () => {
    it('defaults to 404 status', () => {
      const error = new NotFoundError('Document');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Document not found');
    });
  });

  describe('ValidationError', () => {
    it('stores field errors', () => {
      const error = new ValidationError('Validation failed', {
        email: 'Invalid email',
        password: 'Too short',
      });
      expect(error.fieldErrors).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      });
    });
  });

  describe('Error type guards', () => {
    it('can distinguish error types', () => {
      const errors = [
        new AppError('Generic'),
        new NetworkError('Network', 500),
        new NotFoundError('Item'),
        new ValidationError('Invalid', {}),
      ];

      errors.forEach((error) => {
        if (error instanceof NotFoundError) {
          expect(error.statusCode).toBe(404);
        } else if (error instanceof ValidationError) {
          expect(error.fieldErrors).toBeDefined();
        } else if (error instanceof NetworkError) {
          expect(error.statusCode).toBeDefined();
        }
      });
    });
  });
});
```

**How to Test Toast Auto-Dismiss with Fake Timers:**

Testing time-dependent behavior like auto-dismiss:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useToast } from '@/hooks/useToast';
import { TOAST } from '@/lib/constants/toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds toast to queue', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Success!', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Success!');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('auto-dismisses success toast after default timeout', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Success!', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);

    // Advance time past default timeout
    act(() => {
      vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('error toasts have longer timeout (WCAG 2.2.1)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Error!', 'error');
    });

    // Advance past default timeout - should still be visible
    act(() => {
      vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS);
    });

    expect(result.current.toasts).toHaveLength(1);

    // Advance to error timeout - should be dismissed
    act(() => {
      vi.advanceTimersByTime(TOAST.ERROR_TIMEOUT_MS - TOAST.DEFAULT_TIMEOUT_MS);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('manually dismissing clears timeout', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Success!', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);

    // Advancing time should not cause errors (timeout should be cleared)
    act(() => {
      vi.advanceTimersByTime(TOAST.DEFAULT_TIMEOUT_MS * 2);
    });
  });

  it('limits queue size', () => {
    const { result } = renderHook(() => useToast());

    // Add more toasts than the limit
    act(() => {
      for (let i = 0; i < TOAST.MAX_VISIBLE + 5; i++) {
        result.current.addToast(`Toast ${i}`, 'info');
      }
    });

    expect(result.current.toasts.length).toBeLessThanOrEqual(TOAST.MAX_VISIBLE);
  });
});
```

### When to Use Phase 6 Utilities

**Unit Tests - Use Export Factories when:**

- Testing components that trigger exports
- Testing export option dialogs
- You need consistent test documents for export testing

```typescript
import {
  createMockExportDocument,
  createMockExportOptions,
  mockExportDocuments,
} from '@/test-utils/factories';

// Create a single mock document
const doc = createMockExportDocument({
  title: 'My Test Document',
  content_text: '<h1>Test</h1><p>Content</p>',
});

// Create export options
const options = createMockExportOptions({ format: 'pdf' });

// Use pre-built documents
render(<ExportPreview document={mockExportDocuments.withFormatting} />);
```

**E2E Tests - Use ExportPage when:**

- Testing document export functionality
- Testing export menu interactions
- Verifying download behavior

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ExportPage } from '../pages/ExportPage';
import { EditorPage } from '../pages/EditorPage';

test('exports document to PDF', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();

  const exportPage = new ExportPage(page);
  const editorPage = new EditorPage(page);

  await editorPage.goto(workerCtx.projectId, workerCtx.documentId);
  await editorPage.waitForEditorReady();

  const download = await exportPage.exportToPdf();
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
```

**E2E Tests - Use ToastPage when:**

- Testing notification appearance and dismissal
- Verifying auto-dismiss timing
- Testing ARIA attributes

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ToastPage } from '../pages/ToastPage';

test('toast auto-dismisses after timeout', async ({ page }) => {
  const toastPage = new ToastPage(page);

  // Trigger an action that shows a toast
  await triggerToastAction();

  // Verify auto-dismiss using Phase 6 timeout
  await toastPage.waitForAutoDismiss();
});
```

**E2E Tests - Use CommandPalettePage when:**

- Testing keyboard shortcut activation
- Testing command search and filtering
- Testing command execution

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { CommandPalettePage } from '../pages/CommandPalettePage';

test('filters commands as user types', async ({ page, loginAsWorker }) => {
  await loginAsWorker();

  const commandPalette = new CommandPalettePage(page);
  await page.goto('/projects');

  await commandPalette.open();
  await commandPalette.search('vault');
  await commandPalette.expectOptionVisible(/vault/i);
});
```

**E2E Tests - Use MobileNavPage when:**

- Testing responsive navigation
- Testing drawer open/close behavior
- Testing focus management in mobile nav

```typescript
import { test, expect, devices } from '@playwright/test';
import { MobileNavPage } from '../pages/MobileNavPage';

test.describe('Mobile Navigation', () => {
  test.use({ ...devices['iPhone 12'] });

  test('drawer has correct ARIA attributes', async ({ page }) => {
    const mobileNav = new MobileNavPage(page);
    await page.goto('/projects');

    await mobileNav.openDrawer();
    await expect(mobileNav.drawer).toHaveAttribute('role', 'dialog');
    await expect(mobileNav.drawer).toHaveAttribute('aria-modal', 'true');
  });
});
```

### Critical: Never Recreate Phase 0 Infrastructure

Phase 6 demonstrates the correct pattern: **extend, don't recreate**. Future phases must:

1. **Check for existing utilities first** - Run `ls e2e/config/ e2e/fixtures/ e2e/helpers/ e2e/pages/`
2. **Extend timeout constants** - Add to existing `TIMEOUTS` object, don't create new file
3. **Use existing auth fixtures** - Import `loginAsWorker` from `test-fixtures.ts`
4. **Use existing helpers** - Import `checkA11y`, `waitForFormReady`, etc.
5. **Place page objects in `e2e/pages/`** - Follow existing directory structure

### What Later Phases Should Add

1. **Extend export factories** - Add factory functions for new export formats
2. **Extend page objects** - Add methods to existing page objects for new functionality
3. **Follow accessibility testing pattern** - Use `checkA11y()` for all new pages
4. **Follow touch target testing pattern** - Verify 44px minimum for all interactive elements
5. **Use TIMEOUTS constants** - Never hardcode timeout values

---

## Table of Contents

1. [Phase 0 Implementation Status](#phase-0-implementation-status)
2. [Phase 1 Implementation Status](#phase-1-implementation-status)
3. [Phase 2 Implementation Status](#phase-2-implementation-status)
4. [Phase 3 Implementation Status](#phase-3-implementation-status)
5. [Phase 4 Implementation Status](#phase-4-implementation-status)
6. [Phase 5 Implementation Status](#phase-5-implementation-status)
7. [Phase 6 Implementation Status](#phase-6-implementation-status)
8. [Unit Testing (Vitest)](#unit-testing-vitest)
9. [E2E Testing (Playwright)](#e2e-testing-playwright)
10. [Test Infrastructure](#test-infrastructure)
11. [Patterns and Utilities](#patterns-and-utilities)
12. [Lessons Learned](#lessons-learned)
13. [Library-Specific Notes](#library-specific-notes)

---

## Unit Testing (Vitest)

### Recommended Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'happy-dom', // Faster than jsdom
    globals: true, // No need to import describe, it, expect
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules', '.next', 'src/test/**', '**/*.d.ts'],
    },
  },
});
```

### Essential Test Setup File

Create `src/test/setup.ts` with common mocks:

```typescript
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Auto-cleanup after each test
afterEach(cleanup);

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

// Mock ResizeObserver (required for many UI libraries)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver (for lazy loading, infinite scroll)
global.IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({})),
}));
```

### ESLint Configuration for Tests

Relax strict TypeScript rules for test files (mocks inherently produce `any`):

```javascript
// eslint.config.js (flat config)
{
  files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
  },
}
```

---

## E2E Testing (Playwright)

### Directory Structure

```
e2e/
├── config/
│   └── timeouts.ts       # Centralized timeout constants
├── fixtures/
│   ├── test-fixtures.ts  # Custom Playwright fixtures
│   ├── test-accounts.ts  # Test account definitions
│   └── worker-context.ts # Worker isolation context
├── helpers/
│   ├── auth.ts           # Authentication utilities
│   ├── cleanup.ts        # Test data cleanup
│   ├── hydration.ts      # React hydration helpers
│   └── axe.ts            # Accessibility testing
├── pages/
│   └── *.ts              # Page Object Model classes
├── setup/
│   ├── global-setup.ts   # Pre-test setup
│   └── global-teardown.ts
└── [feature]/
    └── *.spec.ts         # Test specs organized by feature
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

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
    ...(process.env.CI ? [['github']] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Serial tests (shared state, role-based)
    {
      name: 'serial',
      testMatch: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      fullyParallel: false,
    },
    // Parallel tests (worker-isolated)
    {
      name: 'parallel',
      testIgnore: ['**/onboarding/**/*.spec.ts', '**/invites/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
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

### Centralized Timeout Constants

**Never hardcode timeout values.** Create `e2e/config/timeouts.ts`:

```typescript
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

---

## Test Infrastructure

### Environment Isolation

Use separate ports and directories to avoid conflicts:

| Environment | App Port | Database | Build Directory |
| ----------- | -------- | -------- | --------------- |
| Development | 3000     | Default  | `.next`         |
| Test        | 3099     | Test DB  | `.next-test`    |

```bash
# .env.test
NEXT_PUBLIC_APP_URL=http://localhost:3099
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322  # Local Supabase
NODE_ENV=test
```

### Test Account Strategy

Create a single source of truth for test accounts:

```typescript
// e2e/fixtures/test-accounts.ts
export const TEST_PASSWORD = 'password123';

// Shared accounts (for serial tests requiring specific roles)
export const SHARED_ACCOUNTS = {
  owner: { email: 'owner@test.local', password: TEST_PASSWORD, role: 'owner' },
  admin: { email: 'admin@test.local', password: TEST_PASSWORD, role: 'admin' },
  member: { email: 'member@test.local', password: TEST_PASSWORD, role: 'member' },
  viewer: { email: 'viewer@test.local', password: TEST_PASSWORD, role: 'viewer' },
} as const;

// Worker accounts (for parallel tests - each worker gets isolated data)
export const MAX_WORKERS = 8;
export const getWorkerAccount = (index: number) => ({
  email: `worker${index}@test.local`,
  password: TEST_PASSWORD,
  name: `Worker ${index}`,
});

export type SharedAccountKey = keyof typeof SHARED_ACCOUNTS;
```

### Worker Isolation Pattern

Enable true parallelization without data conflicts:

```typescript
// e2e/fixtures/worker-context.ts
import { createClient } from '@supabase/supabase-js';
import { getWorkerAccount } from './test-accounts';

export interface WorkerContext {
  workerIndex: number;
  account: { email: string; password: string; name: string };
  organizationId: string;
  supabase: SupabaseClient;
  prefix: (name: string) => string;
}

export async function createWorkerContext(parallelIndex: number): Promise<WorkerContext> {
  const runId = Math.random().toString(36).substring(2, 6);
  const account = getWorkerAccount(parallelIndex);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin access for setup
  );

  // Get or create worker's organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', `Worker ${parallelIndex} Org`)
    .single();

  return {
    workerIndex: parallelIndex,
    account,
    organizationId: org?.id,
    supabase,
    prefix: (name: string) => `W${parallelIndex}_${runId}_${name}`,
  };
}
```

### Custom Playwright Fixtures

```typescript
// e2e/fixtures/test-fixtures.ts
import { test as base, expect } from '@playwright/test';
import { WorkerContext, createWorkerContext } from './worker-context';
import { TIMEOUTS } from '../config/timeouts';

// Extend the TestData class for auto-cleanup
class TestData {
  private createdRecords: { table: string; id: string }[] = [];

  constructor(
    private supabase: SupabaseClient,
    private prefix: (n: string) => string
  ) {}

  async createItem(name: string, data: Partial<Item> = {}) {
    const { data: item, error } = await this.supabase
      .from('items')
      .insert({ name: this.prefix(name), ...data })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'items', id: item.id });
    return item;
  }

  async cleanup() {
    // Delete in reverse order to respect foreign keys
    for (const { table, id } of this.createdRecords.reverse()) {
      await this.supabase.from(table).delete().eq('id', id);
    }
    this.createdRecords = [];
  }
}

// Define custom fixtures
type Fixtures = {
  workerCtx: WorkerContext;
  loginAsWorker: () => Promise<void>;
  testData: TestData;
};

export const test = base.extend<Fixtures, { workerCtx: WorkerContext }>({
  // Worker-scoped: shared across all tests in a worker
  workerCtx: [
    async ({}, use, workerInfo) => {
      const ctx = await createWorkerContext(workerInfo.parallelIndex);
      await use(ctx);
      ctx.supabase.auth.signOut();
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

  testData: async ({ workerCtx }, use) => {
    const testData = new TestData(workerCtx.supabase, workerCtx.prefix);
    await use(testData);
    await testData.cleanup();
  },
});

export { expect };
```

---

## Patterns and Utilities

### React Hydration Handling

React SSR hydration resets controlled form inputs. Handle this:

```typescript
// In your React component
function LoginForm() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  return <form ref={formRef}>...</form>;
}
```

```typescript
// e2e/helpers/hydration.ts
import { Page } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export async function waitForFormReady(page: Page, formSelector = 'form') {
  await page.waitForSelector(`${formSelector}[data-hydrated="true"]`, {
    state: 'attached',
    timeout: TIMEOUTS.HYDRATION,
  });
  // Small delay for any final React updates
  await page.waitForTimeout(TIMEOUTS.ANIMATION);
}

export async function fillFormField(page: Page, selector: string, value: string) {
  const field = page.locator(selector);
  await field.fill(value);
  // Verify value wasn't cleared
  await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INPUT_STABLE });
}
```

### Authentication Helpers

```typescript
// e2e/helpers/auth.ts
import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import { waitForFormReady } from './hydration';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await waitForFormReady(page);

  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LOGIN_REDIRECT });
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login', { timeout: TIMEOUTS.NAVIGATION });
}

export async function expectToBeLoggedIn(page: Page) {
  await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
}

export async function expectToBeLoggedOut(page: Page) {
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
}

export function generateUniqueEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`;
}
```

### Page Object Model

```typescript
// e2e/pages/LoginPage.ts
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

### Accessibility Testing

```typescript
// e2e/helpers/axe.ts
import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TIMEOUTS } from '../config/timeouts';

interface A11yOptions {
  skipFailures?: boolean;
  detailedReport?: boolean;
  skipNetworkidle?: boolean;
}

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

export async function checkElementA11y(page: Page, selector: string, options: A11yOptions = {}) {
  const results = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa']).analyze();

  if (!options.skipFailures) {
    expect(results.violations).toHaveLength(0);
  }

  return results;
}
```

### Global Setup Pattern

```typescript
// e2e/setup/global-setup.ts
import { execSync } from 'child_process';

async function globalSetup() {
  console.log('\n[Setup] Starting test infrastructure...');

  // Check for CRLF line endings in env file (breaks bash)
  const envContent = fs.readFileSync('.env.test', 'utf-8');
  if (envContent.includes('\r\n')) {
    console.warn('[Setup] Warning: .env.test has CRLF line endings, converting...');
    fs.writeFileSync('.env.test', envContent.replace(/\r\n/g, '\n'));
  }

  // Start test database if not running
  const dbHealthy = await checkDatabaseHealth();
  if (!dbHealthy || process.env.E2E_FRESH_DB === '1') {
    console.log('[Setup] Starting test database...');
    execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
    await waitForDatabase();
  }

  // Run seed script
  console.log('[Setup] Seeding test data...');
  execSync('npm run test:seed', { stdio: 'inherit' });

  // Verify test data exists
  const verified = await verifyTestData();
  if (!verified) {
    throw new Error('[Setup] Test data verification failed');
  }

  console.log('[Setup] Complete!\n');
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForDatabase(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkDatabaseHealth()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Database failed to start');
}

async function verifyTestData(): Promise<boolean> {
  // Query for expected test accounts
  const supabase = createAdminClient();
  const { data } = await supabase.from('users').select('email').like('email', 'worker%@test.local');
  return (data?.length ?? 0) >= 4;
}

export default globalSetup;
```

---

## Lessons Learned

### Selectors

1. **Use CSS `:not()` for exclusion** - Playwright's `filter({ hasNot })` checks descendants, not the element itself. Use CSS when excluding elements with specific classes.

2. **Add `aria-label` for unique targeting** - When multiple similar elements exist (e.g., delete buttons in a list), add `aria-label` with unique identifiers. Improves both accessibility and test reliability.

3. **Target active tabs with `[data-state="active"]`** - UI libraries like Radix use `data-state` attributes. Use these to target visible content.

### Timing

4. **Use `expect().toPass()` over `waitForFunction`** - Playwright's retry assertions integrate better with the test runner:

   ```typescript
   await expect(async () => {
     const count = await page.locator('.item').count();
     expect(count).toBeGreaterThan(0);
   }).toPass({ timeout: 5000 });
   ```

5. **Account for debounce in search tests** - Add waits after filling search inputs and after loading completes:

   ```typescript
   await searchInput.fill('query');
   await page.waitForTimeout(TIMEOUTS.DEBOUNCE_SEARCH);
   await page.waitForLoadState('networkidle');
   await page.waitForTimeout(TIMEOUTS.POST_FILTER);
   ```

6. **Wait for element stability before clicking** - Dynamically loaded elements may exist but not be ready:
   ```typescript
   await element.waitFor({ state: 'visible' });
   await element.click();
   ```

### Data Management

7. **Single source of truth for test accounts** - Define in one file, re-export elsewhere. Never duplicate definitions.

8. **Worker-scoped fixtures enable true parallelization** - Each worker gets isolated data, preventing flaky tests from shared state.

9. **Use unique prefixes for test data** - Pattern: `W${workerIndex}_${runId}_${name}` ensures no collisions across workers or runs.

10. **Track created records for cleanup** - Auto-cleanup fixtures prevent test pollution and ensure isolation.

### Infrastructure

11. **Force rebuild after code changes** - Build caches are aggressive. Use `FORCE_BUILD=1` when tests behave unexpectedly.

12. **Keep environment files with Unix line endings** - CRLF breaks bash sourcing. Use `.gitattributes` to enforce.

13. **Use separate ports for test environment** - Avoid conflicts with development servers and IDE port forwarding.

14. **Verify database state with admin auth** - Row-level security may hide data from unauthenticated queries. Use service role for verification.

15. **Health check before running tests** - Verify database and app are healthy before test execution.

### React-Specific

16. **React hydration clears form inputs** - Forms filled before hydration completes lose their values. Wait for `data-hydrated` attribute.

17. **Verify input values after filling** - Catch hydration issues early:

    ```typescript
    await input.fill(value);
    await expect(input).toHaveValue(value);
    ```

18. **Don't call impure functions during render** - `Date.now()` in render violates React's pure component rules. Use `useEffect` or event handlers.

---

## Library-Specific Notes

### Radix UI

- **ResizeObserver mock required** - Add to test setup file
- **Tab panels use `[data-state="active"]`** - Target visible content with this selector
- **Dialogs have portal rendering** - Locate elements globally, not within parent components

### Framer Motion

When using Framer Motion for animations:

- **Disable animations in a11y tests** - Inject CSS that sets `opacity: 1 !important` to prevent false color contrast violations during mid-animation states
- **Wait for animation completion** - Use `TIMEOUTS.ANIMATION_SETTLE` (500-600ms) for complex animations
- **Mock in unit tests** - Replace with simple div to avoid animation complexity

### shadcn/ui

- **Components are Radix-based** - Same patterns apply
- **Use data attributes for state** - `[data-state="open"]`, `[data-state="checked"]`
- **Toasts use specific role** - Locate with `[role="status"]` or specific toast selectors

### Supabase

- **Use service role for test setup** - Bypasses RLS for seeding and verification
- **Local development uses different URLs** - Port 54322 for local Supabase vs production URL
- **Auth state persists in localStorage** - Clear between tests if not using worker isolation

---

## Quick Reference: Test Commands

```bash
# Unit Tests
pnpm test              # Run all unit tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report

# E2E Tests
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:fresh    # Force rebuild before running
pnpm test:e2e:ui       # Interactive mode
pnpm test:e2e:debug    # Step-through debugger
pnpm test:e2e:headed   # Visible browser

# By pattern
pnpm exec playwright test --grep "login"
pnpm exec playwright test e2e/auth/

# Infrastructure
pnpm test:seed         # Seed test database
E2E_FRESH_DB=1 pnpm test:e2e  # Fresh database
FORCE_BUILD=1 pnpm test:e2e   # Force app rebuild
```
