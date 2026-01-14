# Phase 3 Verification Checklist

> **Phase 3** | [← Editor Integration](./15-editor-integration.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 3 AI Integration tasks are complete and working.**

---

## Automated Verification

Run this script to verify all tests pass:

```bash
#!/bin/bash
set -e

echo "=== Phase 3 Verification ==="
echo ""

# Check Claude CLI
echo "Checking Claude CLI..."
claude --version || { echo "FAIL: Claude CLI not installed"; exit 1; }

# Check for best practices compliance
echo ""
echo "Checking for console.log/warn/error (should not exist in AI modules)..."
if grep -r "console\.\(log\|warn\|error\)" src/lib/ai/ --include="*.ts" | grep -v "__tests__"; then
  echo "WARN: Found console statements - should use aiLogger instead"
fi

# Check constants file exists
echo ""
echo "Checking constants file..."
[ -f src/lib/constants/ai.ts ] || { echo "FAIL: AI constants file missing"; exit 1; }

# Check Zod schema exists
echo ""
echo "Checking Zod schema..."
[ -f src/lib/api/schemas/ai-generate.ts ] || { echo "FAIL: AI generate schema missing"; exit 1; }

# Check AI factories added to test-utils (per Phase 0-2 patterns)
echo ""
echo "Checking AI factories in test-utils..."
grep -q "createMockAIOperation" src/test-utils/factories.ts || { echo "FAIL: AI factories not added to test-utils"; exit 1; }

# Check AI Page Object exists (per Phase 2 Page Object pattern)
echo ""
echo "Checking AI Page Object..."
[ -f e2e/pages/AIToolbarPage.ts ] || { echo "FAIL: AIToolbarPage Page Object missing"; exit 1; }

# Check barrel export for stores module (per Phase 2 patterns)
echo ""
echo "Checking stores barrel export..."
[ -f src/lib/stores/index.ts ] || { echo "FAIL: stores/index.ts barrel export missing"; exit 1; }

# Check rate limiting constants exist (per Phase 1 patterns)
echo ""
echo "Checking rate limiting constants..."
grep -q "RATE_LIMIT" src/lib/constants/ai.ts || { echo "FAIL: Rate limiting constants missing from AI constants"; exit 1; }

# Check rate limiting is used in API route (per Phase 1 patterns)
echo ""
echo "Checking rate limiting in API route..."
grep -q "checkRateLimit" src/app/api/ai/generate/route.ts || { echo "FAIL: Rate limiting not implemented in AI API route"; exit 1; }

# Run all AI-related tests
echo ""
echo "Running AI unit tests..."
npm test src/lib/ai/ || { echo "FAIL: AI unit tests"; exit 1; }

echo ""
echo "Running store tests..."
npm test src/lib/stores/ || { echo "FAIL: Store tests"; exit 1; }

echo ""
echo "Running hook tests..."
npm test src/hooks/ || { echo "FAIL: Hook tests"; exit 1; }

echo ""
echo "Running component tests..."
npm test src/components/editor/ || { echo "FAIL: Component tests"; exit 1; }

echo ""
echo "Running API route tests..."
npm test src/app/api/ai/ || { echo "FAIL: API route tests"; exit 1; }

echo ""
echo "Running E2E tests..."
npm run test:e2e || { echo "FAIL: E2E tests"; exit 1; }

echo ""
echo "Running lint..."
npm run lint || { echo "FAIL: Lint errors"; exit 1; }

echo ""
echo "Running build..."
npm run build || { echo "FAIL: Build failed"; exit 1; }

echo ""
echo "=== All Phase 3 Checks Passed ==="
```

---

## Manual Verification Steps

### 1. Claude CLI

```bash
claude --version
```

- [ ] Command succeeds and shows version

### 2. Streaming Responses

1. Open a document in the editor
2. Select some text
3. Click "Refine"

- [ ] Response appears progressively (streaming)
- [ ] Content updates smoothly during generation

### 3. Selection Toolbar

1. Open a document
2. Select text

- [ ] Toolbar appears near selection
- [ ] Refine, Extend, Shorten, Simplify buttons visible
- [ ] Arrow keys navigate between buttons
- [ ] Escape closes toolbar

### 4. AI Actions

1. Select text
2. Click each action

- [ ] Refine improves clarity
- [ ] Extend adds content
- [ ] Shorten makes concise
- [ ] Simplify uses simpler language

### 5. Accept/Reject Flow

1. Trigger an AI action
2. Wait for completion

- [ ] Accept button appears after generation
- [ ] Accept replaces selected text
- [ ] Reject discards changes

### 6. Cursor Generation (Cmd+K)

1. Place cursor in document
2. Press Cmd+K (or Ctrl+K)

- [ ] Modal opens
- [ ] Input field is focused
- [ ] Enter submits prompt
- [ ] Preview shows streaming response
- [ ] Accept inserts at cursor position
- [ ] Escape closes modal

### 7. Keyboard Navigation

1. Select text (toolbar appears)
2. Use only keyboard

- [ ] Arrow keys move focus between buttons
- [ ] Enter activates focused button
- [ ] Tab moves between toolbar and content
- [ ] Escape closes toolbar

### 8. Error Handling

1. Disconnect network
2. Trigger AI action

- [ ] Error message displayed
- [ ] Retry option available (for retryable errors)
- [ ] Non-retryable errors show helpful message

---

## Best Practices Compliance Checklist

### Constants & Logging

- [ ] All constants defined in `src/lib/constants/ai.ts` (no magic numbers)
- [ ] Structured logging used via `aiLogger` (no console.log/warn/error)
- [ ] Domain logger mocking pattern used in tests

### API Routes

- [ ] API route uses Zod validation with `generateRequestSchema`
- [ ] API route uses `handleApiError` for error handling
- [ ] Audit logging calls `createAuditLog('ai:generate', ...)` for operations
- [ ] All API errors return proper error codes (AUTH_REQUIRED, VALIDATION_ERROR, RATE_LIMITED, etc.)

### Infrastructure (per Phase 1-2)

- [ ] Rate limiting uses `checkRateLimit` from `@/lib/auth/rate-limit`
- [ ] Rate limit constants defined in `AI.RATE_LIMIT` (not hardcoded)
- [ ] 429 status returned when rate limited with `retryAfter`
- [ ] Barrel export exists: `src/lib/stores/index.ts`
- [ ] All types re-exported from barrel for external use

### Test Utilities (per Phase 0-2 patterns)

- [ ] Uses `createMockSupabaseClient` from `@/test-utils/supabase-mock.ts`
- [ ] Uses `createMockEditor` from `@/test-utils/tiptap-mock.ts`
- [ ] Uses AI factories from `@/test-utils/factories.ts`:
  - [ ] `createMockAIOperation`
  - [ ] `createMockStreamChunk`
  - [ ] `createMockClaudeError`
- [ ] E2E tests use `AIToolbarPage` Page Object
- [ ] E2E tests use `waitForFormReady`, `checkA11y`, `VISIBILITY_WAIT`
- [ ] E2E async tests use `expect().toPass()` polling pattern

---

## File Checklist

### Task 3.1 - AI Type Definitions

- [ ] `src/lib/ai/types.ts` exists
- [ ] `src/lib/ai/__tests__/types.test.ts` exists
- [ ] `src/lib/constants/ai.ts` exists with all constants including:
  - [ ] Timeout constants (DEFAULT_TIMEOUT_MS, etc.)
  - [ ] Limit constants (MAX_PROMPT_LENGTH, etc.)
  - [ ] Rate limiting constants (`AI.RATE_LIMIT` per Phase 1 patterns)

### Task 3.2 - Error Categorization

- [ ] `src/lib/ai/errors.ts` exists
- [ ] `src/lib/ai/__tests__/errors.test.ts` exists

### Task 3.3 - Input Sanitization

- [ ] `src/lib/ai/sanitize.ts` exists
- [ ] `src/lib/ai/__tests__/sanitize.test.ts` exists

### Task 3.4 - Mock Factory

- [ ] `src/lib/ai/__tests__/mocks/mock-claude-cli.ts` exists
- [ ] `src/test-utils/factories.ts` updated with AI factories:
  - [ ] `createMockAIOperation` exported
  - [ ] `createMockStreamChunk` exported
  - [ ] `createMockClaudeError` exported
  - [ ] `mockStreamChunks` collection exported
  - [ ] `mockAIOperations` collection exported

### Task 3.5 - Claude CLI Wrapper

- [ ] `src/lib/ai/claude-cli.ts` exists
- [ ] `src/lib/ai/__tests__/claude-cli.test.ts` exists

### Task 3.6 - CLI Validation

- [ ] `validateClaudeCLI` function exported
- [ ] `ClaudeCLIProvider` class exported

### Task 3.7 - Streaming Module

- [ ] `src/lib/ai/streaming.ts` exists
- [ ] `src/lib/ai/__tests__/streaming.test.ts` exists

### Task 3.8 - AI State Store

- [ ] `src/lib/stores/ai-store.ts` exists
- [ ] `src/lib/stores/__tests__/ai-store.test.ts` exists
- [ ] `src/lib/stores/index.ts` exists with barrel exports (per Phase 2 patterns):
  - [ ] `useAIStore` exported
  - [ ] `AIOperation`, `AIOperationType`, `AIOperationStatus` types exported

### Task 3.9 - useAIStream Hook

- [ ] `src/hooks/useAIStream.ts` exists
- [ ] `src/hooks/__tests__/useAIStream.test.tsx` exists

### Task 3.10 - SSE API Route

- [ ] `src/lib/ai/index.ts` exists
- [ ] `src/lib/api/schemas/ai-generate.ts` exists (Zod schema)
- [ ] `src/app/api/ai/generate/route.ts` exists
- [ ] `src/app/api/ai/generate/__tests__/route.test.ts` exists
- [ ] Rate limiting implemented (per Phase 1 patterns):
  - [ ] Uses `checkRateLimit` from `@/lib/auth/rate-limit`
  - [ ] Uses `AI.RATE_LIMIT` constants
  - [ ] Returns 429 with `retryAfter` when limited

### Task 3.11 - Context Builder

- [ ] `src/lib/ai/context-builder.ts` exists
- [ ] `src/lib/ai/__tests__/context-builder.test.ts` exists

### Task 3.12 - Selection Tracker

- [ ] `src/components/editor/extensions/selection-tracker.ts` exists
- [ ] `src/components/editor/extensions/__tests__/selection-tracker.test.ts` exists

### Task 3.13 - Selection Toolbar

- [ ] `src/components/editor/SelectionToolbar.tsx` exists
- [ ] `src/components/editor/__tests__/SelectionToolbar.test.tsx` exists

### Task 3.14 - E2E Tests

- [ ] `e2e/pages/AIToolbarPage.ts` exists (per Phase 2 Page Object pattern)
- [ ] `e2e/selection-toolbar.spec.ts` exists
- [ ] `e2e/cursor-generation.spec.ts` exists
- [ ] Tests use `AIToolbarPage` Page Object
- [ ] `waitForStreamingComplete()` uses `expect().toPass()` polling pattern

### Task 3.15 - Editor Integration

- [ ] `src/components/editor/CursorPrompt.tsx` exists
- [ ] DocumentEditor imports all AI components

---

## Accessibility Verification

- [ ] All interactive elements have accessible names
- [ ] Toolbar has `role="toolbar"` with `aria-label`
- [ ] Modal has `role="dialog"` with `aria-modal="true"`
- [ ] Focus is trapped within modal when open
- [ ] Focus returns to editor when modal closes
- [ ] Live regions announce state changes (loading, preview, error)
- [ ] Screen reader can navigate all actions
- [ ] Keyboard-only operation works end-to-end

---

## Edge Cases Verified

- [ ] Cancel during stream works (no orphan processes)
- [ ] Empty response handled gracefully
- [ ] Network failure shows retry option
- [ ] Rate limit shows appropriate wait message
- [ ] Context too long shows truncation notice
- [ ] Multiple rapid requests queue properly
- [ ] Heartbeat keeps connection alive during slow generation

---

## Summary

| Task                     | Status |
| ------------------------ | ------ |
| 3.1 AI Type Definitions  | [ ]    |
| 3.2 Error Categorization | [ ]    |
| 3.3 Input Sanitization   | [ ]    |
| 3.4 Mock Factory         | [ ]    |
| 3.5 Claude CLI Wrapper   | [ ]    |
| 3.6 CLI Validation       | [ ]    |
| 3.7 Streaming Module     | [ ]    |
| 3.8 AI State Store       | [ ]    |
| 3.9 useAIStream Hook     | [ ]    |
| 3.10 SSE API Route       | [ ]    |
| 3.11 Context Builder     | [ ]    |
| 3.12 Selection Tracker   | [ ]    |
| 3.13 Selection Toolbar   | [ ]    |
| 3.14 E2E Tests           | [ ]    |
| 3.15 Editor Integration  | [ ]    |

---

## Phase 3 Complete

**All checks passing? Phase 3 is complete!**

Proceed to **Phase 4: Chat & Global Edits**.

---

## Migration Notes for Direct Anthropic API

When ready to add direct API support:

1. Create `src/lib/ai/anthropic-provider.ts` implementing `AIProvider`
2. Add `ANTHROPIC_API_KEY` to environment
3. **Update CSP in `next.config.ts`** (per Phase 1 security patterns):
   ```typescript
   // Add to connect-src when adding Anthropic API support:
   "connect-src 'self' https://*.supabase.co https://api.anthropic.com",
   ```
4. Update provider factory in `src/lib/ai/index.ts`:

```typescript
import { ClaudeCLIProvider } from './claude-cli';
import { AnthropicAPIProvider } from './anthropic-provider';
import type { AIProvider } from './types';

export function createAIProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicAPIProvider();
  }
  return new ClaudeCLIProvider();
}
```

5. **Consider adding AI health to `/api/health`** for operational monitoring
