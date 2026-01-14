# Task 4.11: Tests

> **Phase 4** | [← Integration](./10-integration.md) | [Next: Verification →](./99-verification.md)

---

## Context

**This task runs all unit tests and creates E2E tests for the chat and diff features.** It ensures everything works together correctly in real browser scenarios.

### Prerequisites

- **Task 4.10** completed (Integration)

### What This Task Creates

- `src/test-utils/factories.ts` (extend) - Chat message and AI operation factories
- `e2e/fixtures/claude-cli-mock.ts` - SSE mock for E2E tests
- `e2e/pages/ChatPage.ts` - Page Object for chat sidebar
- `e2e/pages/DiffPanelPage.ts` - Page Object for diff panel
- `e2e/chat/chat-sidebar.spec.ts` - Chat sidebar tests
- `e2e/diff/diff-panel.spec.ts` - Diff panel tests
- `e2e/ai-undo/ai-undo.spec.ts` - AI undo tests
- `e2e/chat/chat-errors.spec.ts` - Error handling tests

### Tasks That Depend on This

- **99-verification.md** - Final verification

---

## Files to Create/Modify

- `src/test-utils/factories.ts` (modify - extend with chat factories)
- `e2e/fixtures/claude-cli-mock.ts` (create)
- `e2e/pages/ChatPage.ts` (create)
- `e2e/pages/DiffPanelPage.ts` (create)
- `e2e/chat/chat-sidebar.spec.ts` (create)
- `e2e/diff/diff-panel.spec.ts` (create)
- `e2e/ai-undo/ai-undo.spec.ts` (create)
- `e2e/chat/chat-errors.spec.ts` (create)

---

## Task 28: Extend AI Test Factories

> **Best Practice:** Extend `src/test-utils/factories.ts` with new entity types for each phase (from testing-best-practices.md Phase 3 section)

### Step 1: Add chat message and global edit factories

Add to `src/test-utils/factories.ts`:

```typescript
import type { ChatMessage } from '@/contexts/ChatContext';
import type { DiffChange } from '@/lib/ai/diff-generator';

// Chat message factory
export function createMockChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'Test message content',
    createdAt: new Date(),
    status: 'sent',
    mode: 'discussion',
    ...overrides,
  };
}

// Streaming message factory
export function createMockStreamingMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return createMockChatMessage({
    role: 'assistant',
    content: '',
    status: 'streaming',
    ...overrides,
  });
}

// Diff change factory
export function createMockDiffChange(overrides: Partial<DiffChange> = {}): DiffChange {
  return {
    type: 'add',
    value: 'New content\n',
    lineNumber: 1,
    ...overrides,
  };
}

// Mock diff set for testing
export const mockDiffChanges: DiffChange[] = [
  { type: 'unchanged', value: 'Line 1\n', lineNumber: 1 },
  { type: 'remove', value: 'Old line 2\n', lineNumber: 2 },
  { type: 'add', value: 'New line 2\n', lineNumber: 2 },
  { type: 'unchanged', value: 'Line 3\n', lineNumber: 3 },
];

// Chat history factory
export function createMockChatHistory(messageCount = 3): ChatMessage[] {
  return Array.from({ length: messageCount }, (_, i) =>
    createMockChatMessage({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
    })
  );
}
```

### Step 2: Run unit tests to ensure no regressions

```bash
npm test
```

**Expected:** All tests pass

### Step 3: Run type check

```bash
npm run typecheck
```

**Expected:** No type errors

### Step 4: Commit

```bash
git add src/test-utils/factories.ts
git commit -m "feat: extend test factories with chat message and diff types"
```

---

## Task 29: E2E Test Infrastructure - Claude CLI Mock

> **Best Practice:** Use ReadableStream pattern for SSE mocking (from testing-best-practices.md Phase 3 section)

### Step 1: Write the mock fixture using SSE streaming pattern

Create `e2e/fixtures/claude-cli-mock.ts`:

```typescript
import { Page, Route } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export interface MockClaudeResponse {
  content: string;
  streamChunks?: string[];
  delayMs?: number;
  error?: { type: 'network' | 'timeout' | 'api'; message: string };
}

export class ClaudeCLIMock {
  private responses: Map<string, MockClaudeResponse> = new Map();

  registerResponse(promptPattern: string, response: MockClaudeResponse): void {
    this.responses.set(promptPattern, response);
  }

  async setupRoutes(page: Page): Promise<void> {
    await page.route('**/api/ai/chat', (route) => this.handleChatRoute(route));
    await page.route('**/api/ai/global-edit', (route) => this.handleGlobalEditRoute(route));
  }

  private async handleChatRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const mockResponse = this.findMatchingResponse(postData.content || '');

    if (mockResponse?.error) {
      if (mockResponse.error.type === 'network') {
        await route.abort('connectionfailed');
      } else {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: mockResponse.error.message }) });
      }
      return;
    }

    // Use ReadableStream pattern from Phase 3 best practices
    const content = mockResponse?.content || 'Mock response';
    const chunks = mockResponse?.streamChunks || [content];
    const delayMs = mockResponse?.delayMs ?? 50;

    const sseChunks = chunks.map(
      (chunk, i) => `data: {"id":"chunk-${i}","sequence":${i},"type":"content","content":"${chunk}"}\n\n`
    );
    sseChunks.push('data: {"type":"done"}\n\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of sseChunks) {
          await new Promise((r) => setTimeout(r, delayMs));
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
  }

  private async handleGlobalEditRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const mockResponse = this.findMatchingResponse(postData.instruction || '');

    if (mockResponse?.error) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: mockResponse.error.message }) });
      return;
    }

    const modifiedContent = mockResponse?.content || 'Modified content.';
    const chunks = [
      `data: {"type":"content","content":"${modifiedContent}"}\n\n`,
      `data: {"type":"done","operationId":"test-op-id","modifiedContent":"${modifiedContent}","diff":[{"type":"remove","value":"${postData.currentContent || 'Original'}","lineNumber":1},{"type":"add","value":"${modifiedContent}","lineNumber":1}]}\n\n`,
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await new Promise((r) => setTimeout(r, 50));
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
  }

  private findMatchingResponse(input: string): MockClaudeResponse | undefined {
    for (const [pattern, response] of this.responses) {
      if (input.toLowerCase().includes(pattern.toLowerCase())) {
        return response;
      }
    }
    return undefined;
  }
}

export const mockResponses = {
  simpleDiscussion: { content: 'This is a helpful response about your document.' },
  globalEdit: { content: 'The document has been updated with your requested changes.' },
  networkError: { content: '', error: { type: 'network' as const, message: 'Connection failed' } },
  slowResponse: { content: 'Slow response', delayMs: TIMEOUTS.API_CALL },
};
```

### Step 2: Commit

```bash
git add e2e/fixtures/claude-cli-mock.ts
git commit -m "feat: add Claude CLI mock fixture with SSE streaming pattern"
```

---

## Task 30: Page Objects - ChatPage and DiffPanelPage

> **Best Practice:** Use Page Object Model for E2E tests, add waitFor\* methods for streaming (from testing-best-practices.md)

### Step 1: Create ChatPage page object

Create `e2e/pages/ChatPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class ChatPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly toggleButton: Locator;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly cancelButton: Locator;
  readonly retryButton: Locator;
  readonly messageList: Locator;
  readonly modeIndicator: Locator;
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.getByTestId('chat-sidebar');
    this.toggleButton = page.getByTestId('chat-sidebar-toggle');
    this.input = page.getByTestId('chat-input');
    this.sendButton = page.getByTestId('chat-send-button');
    this.cancelButton = page.getByTestId('chat-cancel-stream');
    this.retryButton = page.getByTestId('chat-retry');
    this.messageList = page.getByTestId('chat-message-list');
    this.modeIndicator = page.getByTestId('chat-mode-indicator');
    this.errorMessage = page.getByTestId('chat-error');
    this.loadingIndicator = page.getByTestId('chat-loading');
  }

  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async open() {
    await this.toggleButton.click();
    await expect(this.sidebar).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async close() {
    await this.toggleButton.click();
    await expect(this.sidebar).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async sendMessage(content: string) {
    await this.input.fill(content);
    await this.sendButton.click();
  }

  async getMessages() {
    return this.page.getByTestId('chat-message');
  }

  async waitForStreamingComplete() {
    // Use expect().toPass() pattern from best practices for streaming
    await expect(async () => {
      await expect(this.loadingIndicator).not.toBeVisible();
      await expect(this.cancelButton).not.toBeVisible();
    }).toPass({ timeout: TIMEOUTS.API_CALL * 2 });
  }

  async waitForResponse() {
    await this.waitForStreamingComplete();
    const messages = await this.getMessages();
    await expect(messages.last()).toBeVisible({ timeout: TIMEOUTS.API_CALL });
  }

  async expectMode(mode: 'discussion' | 'global_edit' | 'research') {
    await expect(this.modeIndicator).toHaveAttribute('data-mode', mode);
  }

  async expectError() {
    await expect(this.errorMessage).toBeVisible({ timeout: TIMEOUTS.TOAST });
  }

  async expectEmptyState() {
    await expect(this.page.getByText('Start a conversation')).toBeVisible();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async retry() {
    await this.retryButton.click();
  }
}
```

### Step 2: Create DiffPanelPage page object

Create `e2e/pages/DiffPanelPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class DiffPanelPage {
  readonly page: Page;
  readonly panel: Locator;
  readonly acceptAllButton: Locator;
  readonly rejectAllButton: Locator;
  readonly closeButton: Locator;
  readonly progress: Locator;
  readonly changeList: Locator;
  readonly undoButton: Locator;
  readonly undoCount: Locator;
  readonly historyToggle: Locator;
  readonly historyPanel: Locator;
  readonly snapshotList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('diff-panel');
    this.acceptAllButton = page.getByTestId('diff-accept-all');
    this.rejectAllButton = page.getByTestId('diff-reject-all');
    this.closeButton = page.getByTestId('diff-close');
    this.progress = page.getByTestId('diff-progress');
    this.changeList = page.getByTestId('diff-change');
    this.undoButton = page.getByTestId('ai-undo-button');
    this.undoCount = page.getByTestId('undo-count');
    this.historyToggle = page.getByTestId('ai-history-toggle');
    this.historyPanel = page.getByTestId('ai-history-panel');
    this.snapshotList = page.getByTestId('ai-snapshot-list');
  }

  async waitForPanelVisible() {
    await expect(this.panel).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async waitForPanelHidden() {
    await expect(this.panel).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async acceptAll() {
    await this.acceptAllButton.click();
    await this.waitForPanelHidden();
  }

  async rejectAll() {
    await this.rejectAllButton.click();
    await this.waitForPanelHidden();
  }

  async acceptChange(index: number) {
    const acceptButtons = this.page.getByTestId('accept-change');
    await acceptButtons.nth(index).click();
  }

  async rejectChange(index: number) {
    const rejectButtons = this.page.getByTestId('reject-change');
    await rejectButtons.nth(index).click();
  }

  async expectProgress(text: string) {
    await expect(this.progress).toContainText(text);
  }

  async expectUndoCount(count: number) {
    if (count === 0) {
      await expect(this.undoCount).not.toBeVisible();
    } else {
      await expect(this.undoCount).toContainText(String(count));
    }
  }

  async undo() {
    await this.undoButton.click();
  }

  async openHistory() {
    await this.historyToggle.click();
    await expect(this.historyPanel).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async restoreSnapshot(index: number) {
    const restoreButtons = this.page.getByTestId('restore-snapshot');
    await restoreButtons.nth(index).click();
    await expect(this.historyPanel).not.toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }
}
```

### Step 3: Commit

```bash
git add e2e/pages/ChatPage.ts e2e/pages/DiffPanelPage.ts
git commit -m "feat: add ChatPage and DiffPanelPage page objects"
```

---

## Task 31: E2E Tests - Chat Sidebar Basic

> **Best Practice:** Use worker isolation with test fixtures, use Page Objects (from testing-best-practices.md)

### Step 1: Write chat sidebar E2E tests

Create `e2e/chat/chat-sidebar.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';

test.describe('Chat Sidebar', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    // Authenticate using worker isolation pattern
    await loginAsWorker();

    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should open and close sidebar', async ({ workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);

    await expect(chatPage.sidebar).not.toBeVisible();
    await chatPage.open();
    await expect(chatPage.sidebar).toBeVisible();
    await chatPage.close();
    await expect(chatPage.sidebar).not.toBeVisible();
  });

  test('should send message and receive response', async ({ workerCtx }) => {
    claudeMock.registerResponse('hello', mockResponses.simpleDiscussion);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Hello, can you help me?');
    await chatPage.waitForResponse();

    const messages = await chatPage.getMessages();
    await expect(messages.first()).toContainText('Hello, can you help me?');
    await expect(messages.nth(1)).toContainText('helpful response');
  });

  test('should detect global edit mode', async ({ workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.input.fill('Change all headings to title case');
    await chatPage.expectMode('global_edit');
  });

  test('should handle error and allow retry', async ({ workerCtx }) => {
    claudeMock.registerResponse('error', mockResponses.networkError);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('error test');
    await chatPage.expectError();
    await expect(chatPage.retryButton).toBeVisible();
  });

  test('should show empty state when no messages', async ({ workerCtx }) => {
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.expectEmptyState();
  });
});
```

### Step 2: Run E2E test to verify setup

```bash
npm run test:e2e e2e/chat/chat-sidebar.spec.ts
```

**Expected:** Tests run (may fail if app not set up, but verifies test infrastructure)

### Step 3: Commit

```bash
git add e2e/chat/chat-sidebar.spec.ts
git commit -m "test: add chat sidebar E2E tests with Page Objects"
```

---

## Task 32: E2E Tests - Diff Panel

### Step 1: Write diff panel E2E tests

Create `e2e/diff/diff-panel.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';

test.describe('Diff Panel', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should show diff panel after global edit', async ({ workerCtx }) => {
    claudeMock.registerResponse('simplify', { content: 'Simplified content here.' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Simplify all paragraphs');
    await chatPage.waitForStreamingComplete();

    await diffPage.waitForPanelVisible();
  });

  test('should accept all changes', async ({ workerCtx }) => {
    claudeMock.registerResponse('rewrite', { content: 'Completely rewritten content.' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Rewrite everything');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    await diffPage.acceptAll();
    await diffPage.waitForPanelHidden();
  });

  test('should reject all changes', async ({ workerCtx }) => {
    claudeMock.registerResponse('reject', { content: 'This will be rejected.' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Reject test');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    await diffPage.rejectAll();
    await diffPage.waitForPanelHidden();
  });

  test('should accept individual changes', async ({ workerCtx }) => {
    claudeMock.registerResponse('partial', { content: 'Line 1 changed.\n\nLine 2 changed.' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Partial accept test');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    await diffPage.acceptChange(0);
    await diffPage.expectProgress('1 /');
  });
});
```

### Step 2: Run E2E test

```bash
npm run test:e2e e2e/diff/diff-panel.spec.ts
```

**Expected:** Tests run

### Step 3: Commit

```bash
git add e2e/diff/diff-panel.spec.ts
git commit -m "test: add diff panel E2E tests with Page Objects"
```

---

## Task 33: E2E Tests - AI Undo

### Step 1: Write AI undo E2E tests

Create `e2e/ai-undo/ai-undo.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { DiffPanelPage } from '../pages/DiffPanelPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';

test.describe('AI Undo', () => {
  let chatPage: ChatPage;
  let diffPage: DiffPanelPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    chatPage = new ChatPage(page);
    diffPage = new DiffPanelPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should show undo button with operation count', async ({ workerCtx }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Edit this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();

    // Check undo button
    await expect(diffPage.undoButton).toBeVisible();
    await diffPage.expectUndoCount(1);
  });

  test('should restore content when undo clicked', async ({ workerCtx }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Edit this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();

    // Click undo
    await diffPage.undo();

    // Verify undo count decremented
    await diffPage.expectUndoCount(0);
  });

  test('should open history panel', async ({ workerCtx }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Edit this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();

    // Open history
    await diffPage.openHistory();
    await expect(diffPage.snapshotList).toBeVisible();
  });

  test('should restore specific snapshot from history', async ({ workerCtx }) => {
    claudeMock.registerResponse('edit', { content: 'Edited content' });

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('Edit this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();

    // Open history and restore
    await diffPage.openHistory();
    await diffPage.restoreSnapshot(0);

    // restoreSnapshot already waits for panel to close
  });
});
```

### Step 2: Run E2E test

```bash
npm run test:e2e e2e/ai-undo/ai-undo.spec.ts
```

**Expected:** Tests run

### Step 3: Commit

```bash
git add e2e/ai-undo/ai-undo.spec.ts
git commit -m "test: add AI undo E2E tests with Page Objects"
```

---

## Task 34: E2E Tests - Error Handling and Cancellation

> **Best Practice:** Test abort handling - verify user cancellation doesn't trigger error states (from testing-best-practices.md Phase 3)

### Step 1: Write error handling E2E tests

Create `e2e/chat/chat-errors.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock, mockResponses } from '../fixtures/claude-cli-mock';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat Error Handling', () => {
  let chatPage: ChatPage;
  let claudeMock: ClaudeCLIMock;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    chatPage = new ChatPage(page);
    claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
  });

  test('should display error message on network failure', async ({ workerCtx }) => {
    claudeMock.registerResponse('fail', mockResponses.networkError);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('This will fail');
    await chatPage.expectError();
  });

  test('should show retry button after error', async ({ workerCtx }) => {
    claudeMock.registerResponse('retry', mockResponses.networkError);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('retry test');
    await chatPage.expectError();
    await expect(chatPage.retryButton).toBeVisible();
  });

  test('should show cancel button during streaming', async ({ workerCtx }) => {
    claudeMock.registerResponse('slow', mockResponses.slowResponse);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('slow request');

    // Should show cancel button during streaming
    await expect(chatPage.cancelButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('should not show error when user cancels streaming', async ({ workerCtx }) => {
    // Use slow response to give time to cancel
    claudeMock.registerResponse('cancel', mockResponses.slowResponse);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('cancel test');

    // Wait for cancel button to appear
    await expect(chatPage.cancelButton).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Cancel the request
    await chatPage.cancel();

    // Wait a moment for any potential error to appear
    await chatPage.page.waitForTimeout(TIMEOUTS.ANIMATION);

    // CRITICAL: User-initiated abort should NOT trigger error state
    // This follows Phase 3 best practice: "AbortError doesn't trigger onError"
    await expect(chatPage.errorMessage).not.toBeVisible();
    await expect(chatPage.cancelButton).not.toBeVisible();
  });

  test('retry should work after error', async ({ workerCtx }) => {
    // First request fails
    claudeMock.registerResponse('retry-success', mockResponses.networkError);

    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
    await chatPage.sendMessage('retry-success test');
    await chatPage.expectError();

    // Register success response for retry
    claudeMock.registerResponse('retry-success', mockResponses.simpleDiscussion);

    // Click retry
    await chatPage.retry();
    await chatPage.waitForResponse();

    // Error should be gone
    await expect(chatPage.errorMessage).not.toBeVisible();
  });
});
```

### Step 2: Run E2E test

```bash
npm run test:e2e e2e/chat/chat-errors.spec.ts
```

**Expected:** Tests run

### Step 3: Commit

```bash
git add e2e/chat/chat-errors.spec.ts
git commit -m "test: add chat error and cancellation E2E tests"
```

---

## Task 35: Run All E2E Tests

### Step 1: Run complete E2E test suite

```bash
npm run test:e2e
```

**Expected:** All E2E tests pass

### Step 2: Commit any fixes

```bash
git add .
git commit -m "fix: resolve E2E test issues"
```

---

## Verification Checklist

- [ ] AI test factories extended with chat/diff types
- [ ] All unit tests pass: `npm test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Claude CLI mock fixture created (SSE streaming pattern)
- [ ] ChatPage page object created
- [ ] DiffPanelPage page object created
- [ ] Chat sidebar E2E tests use worker isolation
- [ ] Diff panel E2E tests use Page Objects
- [ ] AI undo E2E tests pass
- [ ] Error/cancellation E2E tests verify no error on abort
- [ ] All E2E tests pass: `npm run test:e2e`
- [ ] Changes committed (8 commits for Tasks 28-35)

---

## Next Steps

After this task, proceed to **[99-verification.md](./99-verification.md)** for final phase verification.
