# Phase 4 E2E Test Coverage Analysis

> **Generated:** 2026-01-14
> **Purpose:** Identify gaps in E2E test coverage to prevent issues seen in earlier phases where E2E tests were insufficient to cover implemented code.

---

## Executive Summary

The Phase 4 plan (Task 4.11) includes E2E tests, but there are significant **coverage gaps**:

1. **Missing integration tests** - Components from earlier phases are not tested in combination with new Phase 4 components
2. **No page integration tests** - ChatSidebar and DiffPanel are tested in isolation but not in the document editor page context
3. **Missing authentication flow tests** - Worker context lacks `documentId` and `projectId` which are required by E2E tests
4. **No persistence tests** - Chat history persistence and reload are not covered
5. **Missing ConfirmDialog integration tests** - The non-blocking dialog pattern is unit-tested but not E2E tested
6. **No cross-browser tests** - Design system visual verification not specified

---

## Step-by-Step Analysis

### Task 4.1: ChatContext Reducer

| Aspect            | What's Created                          | E2E Tests Specified? | Gap?    |
| ----------------- | --------------------------------------- | -------------------- | ------- |
| UI Components     | None (state management only)            | N/A                  | No      |
| User Interactions | None                                    | N/A                  | No      |
| API Endpoints     | None                                    | N/A                  | No      |
| Phase Integration | ChatMessage type used by Phase 1 editor | Not covered          | **YES** |

**Gap Details:**

- ChatContext is tested via unit tests only (appropriate)
- No E2E gap for this task itself

---

### Task 4.2: Intent Detection

| Aspect            | What's Created                    | E2E Tests Specified?              | Gap?    |
| ----------------- | --------------------------------- | --------------------------------- | ------- |
| UI Components     | ModeIndicator (via mode type)     | Partially                         | **YES** |
| User Interactions | Live mode detection as user types | In Task 31 (chat-sidebar.spec.ts) | Partial |
| API Endpoints     | None                              | N/A                               | No      |
| Phase Integration | None                              | N/A                               | No      |

**Gap Details:**

- E2E test "should detect global edit mode" only checks ONE mode pattern
- Missing E2E tests for:
  - Research mode detection
  - Low/medium confidence indicators
  - Destructive edit warning via ConfirmDialog

**Recommended Addition:**

```typescript
// e2e/chat/intent-detection.spec.ts
test('should show research mode for citation requests', async ({ workerCtx }) => {
  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();
  await chatPage.input.fill('Find papers on machine learning');
  await chatPage.expectMode('research');
});

test('should show destructive edit warning', async ({ workerCtx }) => {
  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();
  await chatPage.sendMessage('Delete all paragraphs');

  // ConfirmDialog should appear
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('confirm-title')).toContainText('destructive');
});
```

---

### Task 4.3: Chat Components (ModeIndicator, ChatMessage, ChatInput, ConfirmDialog)

| Aspect            | What's Created                                                              | E2E Tests Specified? | Gap?    |
| ----------------- | --------------------------------------------------------------------------- | -------------------- | ------- |
| UI Components     | ModeIndicator, ChatMessage, ChatInput, ConfirmDialog                        | Partial              | **YES** |
| User Interactions | Mode display, message rendering, input with Enter key, confirmation dialogs | Partial              | **YES** |
| API Endpoints     | None                                                                        | N/A                  | No      |
| Phase Integration | ModeIndicator uses intent-detection                                         | Partial              | **YES** |

**Gap Details:**

1. **ChatMessage streaming cursor E2E test missing** - Unit test checks `data-streaming="true"` but E2E doesn't verify cursor visual
2. **ConfirmDialog NOT E2E TESTED** - Only unit tests exist; no E2E verifies:
   - Backdrop click closes dialog
   - Escape key closes dialog
   - Confirm/cancel button interactions in real browser
3. **ChatInput Enter key vs Shift+Enter** - Unit tested, not E2E tested

**Recommended Addition:**

```typescript
// e2e/chat/chat-components.spec.ts
test('should close clear history dialog on escape', async ({ workerCtx }) => {
  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();

  // Trigger clear confirmation
  await page.getByTestId('chat-clear-history').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();

  // Press escape
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
});

test('should send message on Enter, not on Shift+Enter', async ({ workerCtx }) => {
  claudeMock.registerResponse('newline', mockResponses.simpleDiscussion);

  await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
  await chatPage.open();

  await chatPage.input.fill('Line 1');
  await page.keyboard.press('Shift+Enter');
  await chatPage.input.type('Line 2'); // Should add to same input

  await expect(chatPage.input).toHaveValue('Line 1\nLine 2');

  await page.keyboard.press('Enter'); // Now send
  await chatPage.waitForResponse();
});
```

---

### Task 4.4: Diff Utilities

| Aspect            | What's Created        | E2E Tests Specified? | Gap? |
| ----------------- | --------------------- | -------------------- | ---- |
| UI Components     | None (utilities only) | N/A                  | No   |
| User Interactions | None                  | N/A                  | No   |
| API Endpoints     | None                  | N/A                  | No   |
| Phase Integration | Used by DiffPanel     | Via Task 32          | No   |

**Gap Details:**

- Pure utility functions - appropriately unit tested only

---

### Task 4.5: API Helpers (chat.ts, ai-operations.ts, streaming.ts)

| Aspect            | What's Created     | E2E Tests Specified? | Gap? |
| ----------------- | ------------------ | -------------------- | ---- |
| UI Components     | None               | N/A                  | No   |
| User Interactions | None               | N/A                  | No   |
| API Endpoints     | Helpers only       | N/A                  | No   |
| Phase Integration | Used by API routes | Indirectly via E2E   | No   |

**Gap Details:**

- Helpers tested via unit tests - appropriate
- Integration tested via API route E2E tests

---

### Task 4.6: API Routes

| Aspect            | What's Created             | E2E Tests Specified? | Gap?    |
| ----------------- | -------------------------- | -------------------- | ------- |
| UI Components     | None                       | N/A                  | No      |
| User Interactions | Via chat/diff UIs          | Yes                  | Partial |
| API Endpoints     | 5 endpoints                | Mocked in E2E        | **YES** |
| Phase Integration | Uses Phase 3 audit logging | Not tested           | **YES** |

**Gap Details:**

1. **All E2E tests use mocked routes** - Real API routes never exercised in E2E
2. **Rate limiting not E2E tested** - 429 responses are defined but no E2E tests hit rate limits
3. **Audit logging not verified** - `createAuditLog('ai:chat', ...)` never verified in E2E

**Recommended Addition:**

```typescript
// e2e/api/rate-limiting.spec.ts
test.describe('Rate Limiting', () => {
  test('should return 429 after exceeding chat rate limit', async ({ page, workerCtx }) => {
    // Don't mock - hit real API
    await page.unroute('**/api/ai/chat');

    // Send 21 messages quickly (limit is 20)
    for (let i = 0; i < 21; i++) {
      const response = await page.request.post('/api/ai/chat', {
        data: { content: `Message ${i}`, documentId: workerCtx.documentId, projectId: workerCtx.projectId },
      });

      if (i === 20) {
        expect(response.status()).toBe(429);
        const body = await response.json();
        expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(body.retryAfter).toBeGreaterThan(0);
      }
    }
  });
});
```

---

### Task 4.7: Database Migration

| Aspect            | What's Created                         | E2E Tests Specified? | Gap?    |
| ----------------- | -------------------------------------- | -------------------- | ------- |
| UI Components     | None                                   | N/A                  | No      |
| User Interactions | None                                   | N/A                  | No      |
| API Endpoints     | None                                   | N/A                  | No      |
| Phase Integration | Indexes for chat_history/ai_operations | Not tested           | **YES** |

**Gap Details:**

- Indexes improve performance - should be tested via E2E query patterns
- `cleanup_old_records()` function never tested

**Recommended Addition:**

```typescript
// e2e/database/data-retention.spec.ts (optional - could be unit test)
test('should have indexes for efficient queries', async ({ page }) => {
  // This would require a database introspection test
  // Alternatively, measure query times with real data
});
```

---

### Task 4.8: ChatSidebar & useStreamingChat Hook

| Aspect            | What's Created                       | E2E Tests Specified? | Gap?         |
| ----------------- | ------------------------------------ | -------------------- | ------------ |
| UI Components     | ChatSidebar                          | Yes (Task 31)        | Partial      |
| User Interactions | Open/close, send, clear history      | Yes                  | **YES**      |
| API Endpoints     | Uses /api/ai/chat, /api/chat/history | Mocked               | **YES**      |
| Phase Integration | Uses Phase 1 editor page             | **NOT TESTED**       | **CRITICAL** |

**Gap Details:**

1. **CRITICAL: No page integration test** - Tests assume `workerCtx.documentId` exists, but:
   - `WorkerContext` interface doesn't define `documentId` or `projectId`
   - ChatPage.goto() uses these undefined values
   - Document editor page integration never verified

2. **Clear history with real API not tested** - Always mocked

3. **Chat history persistence not tested** - No test for:
   - Reload page and see previous messages
   - Messages saved to database

**Recommended Addition:**

First, fix the `WorkerContext` interface:

```typescript
// e2e/fixtures/test-fixtures.ts - MUST BE UPDATED
export interface WorkerContext {
  workerIndex: number;
  account: { email: string; name: string };
  prefix: (name: string) => string;
  projectId: string; // ADD THIS
  documentId: string; // ADD THIS
}
```

Then add integration test:

```typescript
// e2e/chat/chat-integration.spec.ts
test.describe('Chat Sidebar Integration', () => {
  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Create project and document via API (not mocked)
    const project = await createTestProject(page, workerCtx.prefix('project'));
    const document = await createTestDocument(page, project.id, workerCtx.prefix('doc'));

    workerCtx.projectId = project.id;
    workerCtx.documentId = document.id;
  });

  test('should integrate with document editor page', async ({ page, workerCtx }) => {
    // Navigate to actual document page (from Phase 1)
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Verify editor is visible (Phase 1 component)
    await expect(page.getByTestId('document-editor')).toBeVisible();

    // Verify chat toggle appears
    await expect(page.getByTestId('chat-sidebar-toggle')).toBeVisible();

    // Open chat and verify it overlays correctly
    await page.getByTestId('chat-sidebar-toggle').click();
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Editor should still be partially visible
    await expect(page.getByTestId('document-editor')).toBeVisible();
  });

  test('should persist messages after page reload', async ({ page, workerCtx }) => {
    // Don't mock - test real persistence
    await page.unroute('**/api/**');

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    await page.getByTestId('chat-input').fill('Test message for persistence');
    await page.getByTestId('chat-send-button').click();

    // Wait for save
    await page.waitForResponse((resp) => resp.url().includes('/api/ai/chat'));

    // Reload page
    await page.reload();
    await page.getByTestId('chat-sidebar-toggle').click();

    // Previous message should appear
    await expect(page.getByText('Test message for persistence')).toBeVisible();
  });
});
```

---

### Task 4.9: DiffPanel & AI Undo

| Aspect            | What's Created                | E2E Tests Specified? | Gap?         |
| ----------------- | ----------------------------- | -------------------- | ------------ |
| UI Components     | DiffPanel, AIUndoButton       | Yes (Tasks 32, 33)   | Partial      |
| User Interactions | Accept/reject, undo, history  | Yes                  | **YES**      |
| API Endpoints     | Uses /api/ai/operations       | Mocked               | **YES**      |
| Phase Integration | Updates Phase 1 TipTap editor | **NOT TESTED**       | **CRITICAL** |

**Gap Details:**

1. **CRITICAL: Editor content change not verified** - Tests check panel closes but don't verify:
   - TipTap editor content actually changes after accept
   - Original content restored after undo

2. **Keyboard navigation not tested** - A11y best practice requires keyboard-accessible diff review

3. **Partial accept scenario weak** - Test clicks one button but doesn't complete the flow

**Recommended Addition:**

```typescript
// e2e/diff/diff-editor-integration.spec.ts
test.describe('Diff Panel Editor Integration', () => {
  test('should update editor content when accepting changes', async ({ page, workerCtx }) => {
    claudeMock.registerResponse('simplify', { content: 'Simplified paragraph.' });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    // Get original editor content
    const editor = page.getByTestId('document-editor');
    const originalContent = await editor.textContent();

    await chatPage.open();
    await chatPage.sendMessage('Simplify all paragraphs');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    await diffPage.acceptAll();
    await diffPage.waitForPanelHidden();

    // VERIFY EDITOR CONTENT CHANGED
    const newContent = await editor.textContent();
    expect(newContent).not.toBe(originalContent);
    expect(newContent).toContain('Simplified');
  });

  test('should restore editor content when undoing', async ({ page, workerCtx }) => {
    claudeMock.registerResponse('change', { content: 'Changed content.' });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);

    const editor = page.getByTestId('document-editor');
    const originalContent = await editor.textContent();

    await chatPage.open();
    await chatPage.sendMessage('Change this document');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();
    await diffPage.acceptAll();

    // Now undo
    await diffPage.undo();

    // Content should be restored
    const restoredContent = await editor.textContent();
    expect(restoredContent).toBe(originalContent);
  });

  test('should navigate diff panel with keyboard', async ({ page, workerCtx }) => {
    claudeMock.registerResponse('a11y', { content: 'Test.' });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await chatPage.open();
    await chatPage.sendMessage('a11y keyboard test');
    await chatPage.waitForStreamingComplete();
    await diffPage.waitForPanelVisible();

    // Tab to first accept button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Skip Accept All, Reject All, Close

    // Focus should be on first change's accept button
    await expect(page.getByTestId('accept-change').first()).toBeFocused();

    // Enter to accept
    await page.keyboard.press('Enter');
    await diffPage.expectProgress('1 /');
  });
});
```

---

### Task 4.10: Integration (DocumentEditorContext, DiffPanelWrapper)

| Aspect            | What's Created                               | E2E Tests Specified? | Gap?         |
| ----------------- | -------------------------------------------- | -------------------- | ------------ |
| UI Components     | DiffPanelWrapper                             | Via Task 32          | Partial      |
| User Interactions | Editor disabled during diff review           | **NOT TESTED**       | **YES**      |
| API Endpoints     | None                                         | N/A                  | No           |
| Phase Integration | Coordinates Phase 1 editor with Phase 4 diff | **NOT TESTED**       | **CRITICAL** |

**Gap Details:**

1. **Editor disabled state not verified** - When diff panel is shown, editor should be read-only
2. **No concurrent edit prevention test** - What happens if user tries to type while diff panel is open?

**Recommended Addition:**

```typescript
// e2e/integration/editor-diff-coordination.spec.ts
test('should disable editor while diff panel is visible', async ({ page, workerCtx }) => {
  claudeMock.registerResponse('test', { content: 'Modified.' });

  await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  await chatPage.open();
  await chatPage.sendMessage('test modification');
  await chatPage.waitForStreamingComplete();
  await diffPage.waitForPanelVisible();

  // Editor should be disabled
  const editor = page.getByTestId('document-editor');
  await expect(editor).toHaveAttribute('contenteditable', 'false');

  // Trying to type should have no effect
  const contentBefore = await editor.textContent();
  await editor.click({ force: true }); // Force click on disabled element
  await page.keyboard.type('This should not appear');

  const contentAfter = await editor.textContent();
  expect(contentAfter).toBe(contentBefore);

  // After closing diff, editor should be enabled again
  await diffPage.rejectAll();
  await expect(editor).toHaveAttribute('contenteditable', 'true');
});
```

---

### Task 4.11: Tests

| Aspect              | What's Created                         | E2E Tests Specified? | Gap?    |
| ------------------- | -------------------------------------- | -------------------- | ------- |
| Test Infrastructure | Factories, mocks, page objects, specs  | Yes                  | **YES** |
| E2E Run Requirement | Defined but no step-level requirements | Partial              | **YES** |

**Gap Details:**

1. **E2E tests only at end of phase** - No incremental E2E test execution specified
2. **Design system visual verification missing** - Task 4.11 mentions visual tokens but no tests verify them
3. **Accessibility E2E tests missing** - Task 4.3 defines a11y requirements but no E2E tests

**Recommended Addition:**

```typescript
// e2e/chat/chat-a11y.spec.ts
import { injectAxe, checkA11y } from '../helpers/axe';

test.describe('Chat Sidebar Accessibility', () => {
  test('should have no a11y violations', async ({ page, workerCtx }) => {
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    await injectAxe(page);
    await checkA11y(page, {
      exclude: [['.monaco-editor']], // Exclude known library issues
    });
  });

  test('should support reduced motion', async ({ page, workerCtx }) => {
    // Enable reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // Streaming cursor should not animate
    claudeMock.registerResponse('motion', { content: 'Test', streamChunks: ['Test'], delayMs: 500 });
    await chatPage.sendMessage('motion test');

    const cursor = page.locator('[data-streaming="true"]');
    await expect(cursor).toHaveCSS('animation', 'none');
  });
});
```

---

## Critical Infrastructure Gap: WorkerContext Missing Fields

The E2E test plan assumes `workerCtx.projectId` and `workerCtx.documentId` exist, but the current `WorkerContext` interface does not include these fields:

**Current (`e2e/fixtures/test-fixtures.ts`):**

```typescript
export interface WorkerContext {
  workerIndex: number;
  account: { email: string; name: string };
  prefix: (name: string) => string;
}
```

**Required:**

```typescript
export interface WorkerContext {
  workerIndex: number;
  account: { email: string; name: string };
  prefix: (name: string) => string;
  projectId: string; // MUST ADD
  documentId: string; // MUST ADD
}
```

**Fix Location:** The worker fixture must create a test project and document during worker setup:

```typescript
// e2e/fixtures/test-fixtures.ts - UPDATED
workerCtx: [
  async ({}, use: (ctx: WorkerContext) => Promise<void>, workerInfo: WorkerInfo) => {
    const runId = Math.random().toString(36).substring(2, 6);
    const account = getWorkerAccount(workerInfo.parallelIndex);

    // Create test project and document for this worker
    const { project, document } = await createWorkerTestData(account, runId);

    const ctx: WorkerContext = {
      workerIndex: workerInfo.parallelIndex,
      account: { email: account.email, name: account.name },
      prefix: (name: string) => `W${workerInfo.parallelIndex}_${runId}_${name}`,
      projectId: project.id,
      documentId: document.id,
    };

    await use(ctx);

    // Cleanup
    await cleanupWorkerTestData(project.id);
  },
  { scope: 'worker' },
],
```

---

## Summary: E2E Tests to Add

### By Step (When to Run)

| After Step | E2E Test to Run                                                                    | Purpose                                  |
| ---------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| 4.1        | None                                                                               | State management only                    |
| 4.2        | None (wait for 4.3)                                                                | No UI yet                                |
| 4.3        | `npm run test:e2e e2e/chat/chat-components.spec.ts`                                | Verify ConfirmDialog, ChatInput keyboard |
| 4.4        | None                                                                               | Utilities only                           |
| 4.5        | None                                                                               | Helpers only                             |
| 4.6        | `npm run test:e2e e2e/api/rate-limiting.spec.ts`                                   | Verify rate limiting works               |
| 4.7        | None                                                                               | DB migration only                        |
| 4.8        | `npm run test:e2e e2e/chat/chat-sidebar.spec.ts e2e/chat/chat-integration.spec.ts` | Verify sidebar + page integration        |
| 4.9        | `npm run test:e2e e2e/diff/*.spec.ts e2e/ai-undo/*.spec.ts`                        | Verify diff + editor integration         |
| 4.10       | `npm run test:e2e e2e/integration/editor-diff-coordination.spec.ts`                | Verify coordination                      |
| 4.11       | `npm run test:e2e` (full suite)                                                    | Verify all E2E pass                      |

### New Test Files to Create

| File                                               | Tests                                  | Priority     |
| -------------------------------------------------- | -------------------------------------- | ------------ |
| `e2e/chat/intent-detection.spec.ts`                | Research mode, destructive warning     | Medium       |
| `e2e/chat/chat-components.spec.ts`                 | ConfirmDialog E2E, keyboard navigation | High         |
| `e2e/chat/chat-integration.spec.ts`                | Page integration, persistence          | **Critical** |
| `e2e/diff/diff-editor-integration.spec.ts`         | Editor content changes, undo restore   | **Critical** |
| `e2e/integration/editor-diff-coordination.spec.ts` | Editor disabled state                  | High         |
| `e2e/chat/chat-a11y.spec.ts`                       | Accessibility, reduced motion          | Medium       |
| `e2e/api/rate-limiting.spec.ts`                    | Rate limit enforcement                 | Medium       |

---

## Recommendations

### 1. Fix WorkerContext Infrastructure (BEFORE Starting Task 4.11)

Update `e2e/fixtures/test-fixtures.ts` to include `projectId` and `documentId` in `WorkerContext`. Without this, ALL E2E tests in Task 4.11 will fail.

### 2. Add E2E Checkpoints at Each Step

Update each task file to include:

````markdown
### E2E Verification (Run after completing this task)

```bash
npm run test:e2e e2e/[specific-test-file].spec.ts
```
````

```

### 3. Create Missing Page Object Methods

Update `ChatPage.ts` and `DiffPanelPage.ts` to add:
- `ChatPage.expectEmptyState()` - verify empty message list
- `DiffPanelPage.waitForEditorEnabled()` - verify editor re-enabled after close

### 4. Add Integration Test File to Task 4.10

Task 4.10 creates integration components but has NO E2E tests. Add:
- `e2e/integration/editor-diff-coordination.spec.ts`

### 5. Add Accessibility Tests

The design system specifies a11y requirements but no E2E tests verify:
- 44x44px touch targets
- `motion-reduce:animate-none` behavior
- Focus management in modals

---

## Conclusion

The Phase 4 E2E test plan covers the basic happy paths but has critical gaps in:

1. **Phase integration** - Components from Phase 1 (editor) are not tested with Phase 4 (chat/diff)
2. **Infrastructure** - `WorkerContext` missing required fields
3. **Persistence** - No tests verify data survives page reload
4. **Coordination** - Editor disabled state not verified
5. **Accessibility** - No E2E a11y tests despite design system requirements

Addressing these gaps before implementation will prevent the disconnected component issues seen in earlier phases.
```
