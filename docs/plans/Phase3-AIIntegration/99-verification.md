# Phase 3 Verification Checklist

> **Phase 3** | [← Editor Integration](./15-editor-integration.md) | **Final Step**

---

## Purpose

**This checklist verifies that all Phase 3 AI Integration tasks are complete and working.**

---

## Design System Compliance Verification

All Phase 3 UI components **MUST** comply with the [Quill Design System](../../design-system.md). Verify:

### Design System Checklist

- [ ] **Typography**: All UI text uses `font-ui` (Source Sans 3), all prose uses `font-prose` (Libre Baskerville)
- [ ] **Colors**: Components use semantic tokens (`text-ink-primary`, `bg-surface`, `text-quill`) not raw hex values
- [ ] **Buttons**: Primary buttons use `bg-quill hover:bg-quill-dark`, secondary use `bg-surface hover:bg-surface-hover`
- [ ] **Focus states**: All interactive elements use `focus:ring-2 focus:ring-quill focus:ring-offset-2`
- [ ] **Border radius**: Toolbars use `rounded-lg`, buttons use `rounded-md`
- [ ] **Shadows**: Floating UI uses warm-tinted `shadow-lg` or `shadow-xl`
- [ ] **Icons**: Lucide icons at `w-4 h-4` (16px) or `w-5 h-5` (20px)
- [ ] **Loading states**: Spinners use `text-quill animate-spin`
- [ ] **Error states**: Use `bg-error-light text-error-dark` semantic tokens
- [ ] **Transitions**: All interactions use `transition-all duration-150`

### Quick Visual Inspection

| Component           | Expected Appearance                                        |
| ------------------- | ---------------------------------------------------------- |
| Selection Toolbar   | White card (`bg-surface`) with warm shadow, ghost buttons  |
| Toolbar Buttons     | Gray text (`text-ink-tertiary`), purple on hover/focus     |
| Accept Button       | Purple background (`bg-quill`), white text, rounded        |
| Reject Button       | White/cream background (`bg-surface`), dark text, bordered |
| Loading Spinner     | Purple color (`text-quill`), spinning                      |
| Error Alert         | Soft red background (`bg-error-light`), dark red text      |
| Cursor Prompt Modal | White card with blurred backdrop, purple accent icon       |

---

## E2E Test Execution Requirements

**Before marking Phase 3 complete, the following E2E test suites MUST pass:**

### Required E2E Test Execution

```bash
# 1. Phase 1 Editor Regression Tests (REQUIRED)
npm run test:e2e e2e/editor/

# 2. Phase 3 AI E2E Tests (REQUIRED)
npm run test:e2e e2e/ai/

# 3. Cross-Phase Integration Tests (REQUIRED)
npm run test:e2e e2e/ai/ai-cross-phase-integration.spec.ts

# 4. User Journey Tests (REQUIRED)
npm run test:e2e e2e/ai/ai-user-journey.spec.ts

# 5. Full E2E Suite (REQUIRED - final gate)
npm run test:e2e
```

**Gate:** ALL tests must pass. Any failures must be resolved before Phase 3 is considered complete.

### Cross-Phase Regression Verification

Phase 3 introduces AI integration that touches multiple previous phases. Verify no regressions:

| Phase   | Test Command                     | What It Verifies                                    |
| ------- | -------------------------------- | --------------------------------------------------- |
| Phase 1 | `npm run test:e2e e2e/editor/`   | Editor functionality not broken by SelectionTracker |
| Phase 1 | `npm run test:e2e e2e/auth/`     | Authentication still works with AI endpoints        |
| Phase 1 | `npm run test:e2e e2e/projects/` | Project/document context preserved for AI           |
| Phase 2 | `npm run test:e2e e2e/vault/`    | Vault integration available for AI context          |

---

## Automated Verification

Run this script to verify all tests pass:

```bash
#!/bin/bash
set -e

echo "=== Phase 3 Verification ==="
echo ""

# Check design system tokens are used (no raw colors in components)
echo "Checking design system compliance..."
if grep -rE "(bg-white|bg-gray|bg-blue|bg-green|text-gray|text-blue|border-gray)" \
  src/components/editor/SelectionToolbar.tsx \
  src/components/editor/CursorPrompt.tsx 2>/dev/null; then
  echo "WARN: Found non-design-system colors. Should use semantic tokens instead."
fi

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

# Check AI timeout constants exist in E2E config
echo ""
echo "Checking AI E2E timeout constants..."
grep -q "AI_STREAMING" e2e/config/timeouts.ts || { echo "FAIL: AI_STREAMING timeout constant missing"; exit 1; }
grep -q "AI_HEARTBEAT" e2e/config/timeouts.ts || { echo "FAIL: AI_HEARTBEAT timeout constant missing"; exit 1; }

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
echo "=== Running Full E2E Test Suite ==="
echo ""

# Run Phase 1 editor regression tests
echo "Running Phase 1 editor regression tests..."
npx playwright test e2e/editor/*.spec.ts || { echo "FAIL: Phase 1 editor E2E tests (regression)"; exit 1; }

# Run Phase 3 AI E2E tests
echo ""
echo "Running Phase 3 AI E2E tests..."
npx playwright test e2e/ai/ || { echo "FAIL: Phase 3 AI E2E tests"; exit 1; }

# Run complete E2E suite
echo ""
echo "Running complete E2E suite..."
npm run test:e2e || { echo "FAIL: Full E2E test suite"; exit 1; }

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

## E2E Test Suite Requirements

**The following E2E test files MUST exist and pass:**

### API Tests (`e2e/ai/ai-api.spec.ts`)

| Test                                       | Description                      |
| ------------------------------------------ | -------------------------------- |
| Authenticated user can call endpoint (200) | Verify successful API call       |
| Unauthenticated user gets 401              | Verify auth error response       |
| Rate limited user gets 429 with retryAfter | Verify rate limit response       |
| Invalid request gets 400 validation error  | Verify validation error response |
| Prompt exceeding max length gets 400       | Verify length validation         |

### Toolbar Basic Tests (`e2e/ai/ai-toolbar-basic.spec.ts`)

| Test                              | Description                    |
| --------------------------------- | ------------------------------ |
| Toolbar appears on text selection | Basic visibility               |
| All action buttons are visible    | Refine/Extend/Shorten/Simplify |
| Escape closes toolbar             | Keyboard dismissal             |

### Selection Toolbar Tests (`e2e/ai/ai-selection-toolbar.spec.ts`)

| Test                                          | Description        |
| --------------------------------------------- | ------------------ |
| Should appear when text is selected           | Toolbar visibility |
| Should support keyboard navigation            | Arrow keys, focus  |
| Should show loading spinner during generation | Loading UI         |
| Should accept and replace selected text       | Accept flow        |
| Should have proper ARIA live regions          | Accessibility      |
| Should use polling pattern for slow streaming | Async handling     |

### Cursor Generation Tests (`e2e/ai/ai-cursor-generation.spec.ts`)

| Test                                      | Description        |
| ----------------------------------------- | ------------------ |
| Should open modal on Cmd+K                | Keyboard shortcut  |
| Should have correct ARIA attributes       | Accessibility      |
| Should close on Escape                    | Keyboard dismissal |
| Should trap focus within modal            | Focus management   |
| Should show streaming preview             | Preview UI         |
| Should insert content at cursor on Accept | Accept flow        |
| Should support keyboard-only operation    | Full a11y          |

### Error States Tests (`e2e/ai/ai-error-states.spec.ts`)

| Test                                           | Description      |
| ---------------------------------------------- | ---------------- |
| Should display error alert on API failure      | Error UI         |
| Should show retry button for retryable errors  | Retry UI         |
| Should display rate limit countdown            | Rate limit UI    |
| Should display validation error inline         | Validation UI    |
| Should handle network disconnection gracefully | Network error    |
| Should allow retry after network failure       | Recovery flow    |
| Should handle stream timeout                   | Timeout handling |

### Reject/Undo Tests (`e2e/ai/ai-reject-undo.spec.ts`)

| Test                                                | Description          |
| --------------------------------------------------- | -------------------- |
| Should restore original text on reject              | Reject flow          |
| Should close toolbar on reject                      | Reject UI            |
| Should cancel streaming on reject during generation | Cancel during stream |
| Should undo accepted changes with Ctrl+Z            | Undo flow            |
| Should support multiple undo operations             | Multi-undo           |
| Should support redo after undo with Ctrl+Shift+Z    | Redo flow            |
| Should close modal on cancel                        | Cursor prompt cancel |
| Should undo cursor insertion with Ctrl+Z            | Cursor undo          |

### Cross-Phase Integration Tests (`e2e/ai/ai-cross-phase-integration.spec.ts`)

| Test                                                       | Description                       |
| ---------------------------------------------------------- | --------------------------------- |
| AI changes persist through autosave (Phase 1)              | Verify AI changes save correctly  |
| AI works within project document context (Phase 1)         | Verify project/document isolation |
| Vault context available for AI generation (Phase 2)        | Verify vault integration          |
| Auth session expiry during AI streaming handled gracefully | Verify graceful error handling    |

### User Journey Tests (`e2e/ai/ai-user-journey.spec.ts`)

| Test                                      | Description                           |
| ----------------------------------------- | ------------------------------------- |
| Complete selection toolbar workflow       | Select -> refine -> accept -> verify  |
| Complete cursor prompt workflow           | Cmd+K -> prompt -> generate -> accept |
| Reject flow preserves original content    | Verify reject doesn't lose data       |
| Undo restores previous state after accept | Verify undo works after AI accept     |

### Phase 1 Regression Tests

All existing `e2e/editor/*.spec.ts` tests must continue to pass.

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
- [ ] `e2e/config/timeouts.ts` updated with AI constants:
  - [ ] `AI_STREAMING: 30000` defined
  - [ ] `AI_HEARTBEAT: 6000` defined
  - [ ] `AI_ERROR_DISPLAY: 3000` defined
- [ ] `e2e/ai/ai-api.spec.ts` exists (API error response tests)
- [ ] `e2e/ai/ai-toolbar-basic.spec.ts` exists (basic toolbar tests)
- [ ] `e2e/ai/ai-selection-toolbar.spec.ts` exists (full toolbar tests)
- [ ] `e2e/ai/ai-cursor-generation.spec.ts` exists (Cmd+K tests)
- [ ] `e2e/ai/ai-error-states.spec.ts` exists (error UI tests)
- [ ] `e2e/ai/ai-reject-undo.spec.ts` exists (reject/undo flow tests)
- [ ] `e2e/ai/ai-cross-phase-integration.spec.ts` exists (cross-phase tests)
- [ ] `e2e/ai/ai-user-journey.spec.ts` exists (complete workflow tests)
- [ ] Tests use `AIToolbarPage` Page Object
- [ ] `waitForStreamingComplete()` uses `expect().toPass()` polling pattern
- [ ] CursorPrompt modal has axe-core accessibility tests
- [ ] All AI E2E tests pass: `npx playwright test e2e/ai/`

### Task 3.15 - Editor Integration

- [ ] `src/components/editor/CursorPrompt.tsx` exists
- [ ] DocumentEditor imports all AI components
- [ ] **E2E Regression Verification:**
  - [ ] All `e2e/editor/*.spec.ts` tests pass (Phase 1 regression)
  - [ ] All `e2e/ai/*.spec.ts` tests pass (Phase 3 AI tests)
  - [ ] Full E2E suite passes: `npm run test:e2e`

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

## Design System Visual Verification

Per the [Quill Design System](../../design-system.md) "Scholarly Craft" aesthetic:

### Selection Toolbar Appearance

- [ ] Background is clean white (`bg-surface`) not gray
- [ ] Shadow has warm undertones (not blue-gray)
- [ ] Buttons use ghost style (transparent background)
- [ ] Button text is `text-ink-tertiary` (warm gray)
- [ ] Hover state shows `bg-surface-hover` (warm cream)
- [ ] Focus ring is purple (`ring-quill`)
- [ ] Icons are 16px Lucide icons
- [ ] Typography uses Source Sans 3 (`font-ui`)

### Cursor Prompt Modal Appearance

- [ ] Backdrop is subtle blur with `bg-ink-primary/40`
- [ ] Card has large radius (`rounded-xl`)
- [ ] Header icon has purple tint (`bg-quill-light`)
- [ ] Title uses Libre Baskerville (`font-display`)
- [ ] Input has proper focus ring in purple
- [ ] Preview panel uses prose font for reading
- [ ] Streaming cursor pulses in purple

### Color Token Usage (no hardcoded colors)

- [ ] No `bg-white` (use `bg-surface`)
- [ ] No `bg-gray-*` (use `bg-surface-hover`, `bg-surface-muted`)
- [ ] No `text-gray-*` (use `text-ink-primary/secondary/tertiary`)
- [ ] No `bg-blue-*` or `bg-purple-*` (use `bg-quill`, `bg-quill-light`)
- [ ] No `bg-green-*` (use `bg-success`, `bg-success-light`)
- [ ] No `bg-red-*` (use `bg-error`, `bg-error-light`)

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
