# Phase 4 Verification Checklist

> **Phase 4** | [← Tests](./11-tests.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 4 tasks are complete and working.** Run through each section to confirm the chat and global edit features are fully functional.

---

## Automated Verification

Run this script to check key functionality:

```bash
#!/bin/bash
echo "=== Phase 4 Verification ==="

echo -e "\n1. Running unit tests..."
npm test

echo -e "\n2. Running type check..."
npm run typecheck

echo -e "\n3. Running E2E tests..."
npm run test:e2e

echo -e "\n4. Checking file existence..."
files=(
  "src/contexts/ChatContext.tsx"
  "src/lib/ai/intent-detection.ts"
  "src/components/chat/ModeIndicator.tsx"
  "src/components/chat/ChatMessage.tsx"
  "src/components/chat/ChatInput.tsx"
  "src/components/ui/ConfirmDialog.tsx"
  "src/components/chat/ChatSidebar.tsx"
  "src/lib/ai/diff-generator.ts"
  "src/lib/ai/sanitize.ts"
  "src/lib/api/chat.ts"
  "src/lib/api/ai-operations.ts"
  "src/lib/api/error-response.ts"
  "src/lib/ai/streaming.ts"
  "src/lib/rate-limit.ts"
  "src/app/api/chat/history/route.ts"
  "src/app/api/ai/chat/route.ts"
  "src/app/api/ai/global-edit/route.ts"
  "src/app/api/ai/operations/route.ts"
  "src/app/api/ai/operations/[id]/route.ts"
  "src/components/editor/DiffPanel.tsx"
  "src/hooks/useAIUndo.ts"
  "src/components/editor/AIUndoButton.tsx"
  "src/contexts/DocumentEditorContext.tsx"
  "src/components/editor/DiffPanelWrapper.tsx"
  "src/hooks/useStreamingChat.ts"
  "e2e/pages/ChatPage.ts"
  "e2e/pages/DiffPanelPage.ts"
  "e2e/fixtures/claude-cli-mock.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (MISSING)"
  fi
done

echo -e "\n=== Verification Complete ==="
```

---

## Manual Verification Steps

### 1. Chat Sidebar

```bash
npm run dev
```

Open browser to document page, then:

- [ ] Chat toggle button visible in bottom-right
- [ ] Click toggle opens sidebar
- [ ] Sidebar shows empty state message
- [ ] Input field accepts text
- [ ] Mode indicator updates as you type
- [ ] Send button works
- [ ] Messages display correctly
- [ ] Streaming shows animated cursor
- [ ] Close button works

### 2. Intent Detection

In the chat input, test these phrases:

- [ ] "Can you explain this?" → Discussion mode
- [ ] "Change all headings to title case" → Global Edit mode
- [ ] "Find papers on machine learning" → Research mode
- [ ] "Delete all paragraphs" → Shows destructive warning

### 3. Global Edit Flow

- [ ] Type a global edit request
- [ ] Confirm diff panel appears
- [ ] Verify changes are displayed
- [ ] Test Accept All button
- [ ] Test Reject All button
- [ ] Test individual accept/reject buttons
- [ ] Verify progress counter updates
- [ ] Apply changes and verify editor updates

### 4. AI Undo

- [ ] After accepting changes, undo button shows count
- [ ] Click undo restores previous content
- [ ] History dropdown shows operation list
- [ ] Restore from history works
- [ ] Count decrements after undo

### 5. Error Handling and Cancellation

- [ ] Network error shows error message
- [ ] Retry button appears on error
- [ ] Cancel button visible during streaming
- [ ] Cancel aborts the request
- [ ] **CRITICAL:** Cancel does NOT show error message (user-initiated abort shouldn't trigger error)

---

## File Checklist

### Task 4.1 - ChatContext Reducer

- [ ] `src/contexts/ChatContext.tsx` exists
- [ ] `src/contexts/__tests__/ChatContext.test.tsx` exists

### Task 4.2 - Intent Detection

- [ ] `src/lib/ai/intent-detection.ts` exists
- [ ] `src/lib/ai/__tests__/intent-detection.test.ts` exists

### Task 4.3 - Chat Components

- [ ] `src/components/chat/ModeIndicator.tsx` exists
- [ ] `src/components/chat/ChatMessage.tsx` exists
- [ ] `src/components/chat/ChatInput.tsx` exists
- [ ] `src/components/ui/ConfirmDialog.tsx` exists (Best Practice: non-blocking dialogs)
- [ ] Tests for all components exist

### Task 4.4 - Diff Utilities

- [ ] `src/lib/ai/diff-generator.ts` exists
- [ ] `src/lib/ai/__tests__/diff-generator.test.ts` exists

### Task 4.5 - API Helpers

- [ ] `src/lib/api/chat.ts` exists
- [ ] `src/lib/api/ai-operations.ts` exists
- [ ] `src/lib/ai/streaming.ts` exists (uses domain logger, AI constants)
- [ ] Tests for all helpers exist

### Pre-Task - API Infrastructure

- [ ] `src/lib/api/error-response.ts` exists (Best Practice: consistent error formatting)
- [ ] `src/lib/rate-limit.ts` exists
- [ ] `src/lib/ai/sanitize.ts` exists (Best Practice: CLI input sanitization)

### Task 4.6 - API Routes

- [ ] `src/app/api/chat/history/route.ts` exists (uses domain logger, error helpers)
- [ ] `src/app/api/ai/chat/route.ts` exists (uses sanitization, audit logging)
- [ ] `src/app/api/ai/global-edit/route.ts` exists (uses sanitization, audit logging, AI constants)
- [ ] `src/app/api/ai/operations/route.ts` exists (uses error helpers, domain logger)
- [ ] `src/app/api/ai/operations/[id]/route.ts` exists (uses Next.js 15 async params, audit logging)
- [ ] Tests for all routes exist

### Task 4.7 - Database Migration

- [ ] `supabase/migrations/20260113000000_chat_indexes.sql` exists

### Task 4.8 - ChatSidebar

- [ ] `src/components/chat/ChatSidebar.tsx` exists
- [ ] `src/hooks/useStreamingChat.ts` exists
- [ ] Tests exist

### Task 4.9 - DiffPanel & AI Undo

- [ ] `src/components/editor/DiffPanel.tsx` exists
- [ ] `src/hooks/useAIUndo.ts` exists
- [ ] `src/components/editor/AIUndoButton.tsx` exists
- [ ] Tests exist

### Task 4.10 - Integration

- [ ] `src/contexts/DocumentEditorContext.tsx` exists
- [ ] `src/components/editor/DiffPanelWrapper.tsx` exists

### Task 4.11 - Tests (Testing Best Practices Compliance)

- [ ] `src/test-utils/factories.ts` extended with `createMockChatMessage()`, `createMockDiffChange()`
- [ ] `e2e/fixtures/claude-cli-mock.ts` exists (uses SSE ReadableStream pattern)
- [ ] `e2e/pages/ChatPage.ts` exists (Page Object with `waitForStreamingComplete()`)
- [ ] `e2e/pages/DiffPanelPage.ts` exists (Page Object)
- [ ] `e2e/chat/chat-sidebar.spec.ts` exists (uses worker isolation, `loginAsWorker`)
- [ ] `e2e/diff/diff-panel.spec.ts` exists (uses Page Objects)
- [ ] `e2e/ai-undo/ai-undo.spec.ts` exists
- [ ] `e2e/chat/chat-errors.spec.ts` exists (tests abort doesn't trigger error)

---

## Summary

| Task                    | Status |
| ----------------------- | ------ |
| 4.1 ChatContext Reducer | [ ]    |
| 4.2 Intent Detection    | [ ]    |
| 4.3 Chat Components     | [ ]    |
| 4.4 Diff Utilities      | [ ]    |
| 4.5 API Helpers         | [ ]    |
| 4.6 API Routes          | [ ]    |
| 4.7 Database Migration  | [ ]    |
| 4.8 ChatSidebar & Hook  | [ ]    |
| 4.9 DiffPanel & AI Undo | [ ]    |
| 4.10 Integration        | [ ]    |
| 4.11 Tests              | [ ]    |

---

## Phase 4 Complete

**All checks passing? Phase 4 is complete!**

### What Was Built

- Document chat sidebar with real-time streaming
- Intent detection for discussion/edit/research modes
- Global edit with diff-based change review
- Granular accept/reject for individual changes
- AI operation history with undo functionality
- Comprehensive unit and E2E test coverage

### Data Attributes Reference

**Chat Components:**
`chat-sidebar`, `chat-sidebar-toggle`, `chat-message-list`, `chat-message`, `chat-input`, `chat-send-button`, `chat-mode-indicator`, `chat-loading`, `chat-error`, `chat-retry`, `chat-cancel-stream`, `chat-clear-history`

**Diff Components:**
`diff-panel`, `diff-change`, `diff-accept-all`, `diff-reject-all`, `diff-close`, `accept-change`, `reject-change`, `diff-progress`

**AI History Components:**
`ai-undo-button`, `undo-count`, `ai-history-toggle`, `ai-history-panel`, `ai-snapshot-list`, `ai-snapshot`, `restore-snapshot`

**UI Components:**
`confirm-dialog`, `confirm-backdrop`, `confirm-confirm`, `confirm-cancel`

---

Proceed to **Phase 5: Citations** when ready.
