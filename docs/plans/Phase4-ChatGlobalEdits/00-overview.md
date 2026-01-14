# Phase 4: Chat & Global Edits

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a document chat sidebar with intent detection, global edit capabilities with diff review, and AI operation history for undo functionality.

---

## Design System Integration

This phase implements UI components following the **Scholarly Craft** aesthetic documented in `docs/design-system.md`. All chat and diff components use the Quill design tokens.

### Key Design Tokens Used

| Component Type      | Design Tokens                                                              |
| ------------------- | -------------------------------------------------------------------------- |
| **Chat Sidebar**    | `bg-surface`, `border-ink-faint`, `shadow-lg`, `font-ui`                   |
| **Chat Messages**   | `text-ink-primary`, `text-ink-secondary`, `bg-bg-secondary`, `font-ui`     |
| **Mode Indicators** | `bg-quill-lighter`, `text-quill`, `border-quill-light`, `rounded-full`     |
| **Diff Panel**      | `bg-surface`, `shadow-xl`, `rounded-xl`, `border-ink-faint`                |
| **Buttons**         | `bg-quill`, `hover:bg-quill-dark`, `text-white`, `rounded-md`, `shadow-sm` |
| **Input Fields**    | `bg-surface`, `border-ink-faint`, `focus:ring-quill`, `font-ui`            |
| **Error States**    | `bg-error-light`, `text-error-dark`, `border-error`                        |
| **Success States**  | `bg-success-light`, `text-success-dark`, `border-success`                  |

### Typography Requirements

- **UI Elements:** `font-ui` (Source Sans 3) for all interactive elements
- **Message Content:** `font-ui` for chat messages, `text-base` size
- **Labels & Captions:** `font-ui`, `text-sm`, `text-ink-secondary`
- **Headings:** `font-display` (Libre Baskerville) for panel titles

### Motion Guidelines

All animations follow the "unhurried and purposeful" philosophy:

- Button hover/active: `duration-150`, `ease-default`
- Panel open/close: `duration-200`, fade transitions
- Streaming cursor: `animate-pulse` with `motion-reduce:animate-none`

---

## Phase 4 Task Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 4: CHAT & GLOBAL EDITS                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────┐                                                                     │
│  │ 4.1 ChatContext │                                                                     │
│  │   Reducer       │                                                                     │
│  └────────┬────────┘                                                                     │
│           │                                                                              │
│           ├───────────────────────┬───────────────────────┐                              │
│           ▼                       ▼                       ▼                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐                     │
│  │ 4.2 Intent      │     │ 4.3 Chat UI     │     │ 4.4 Diff        │                     │
│  │   Detection     │     │   Components    │     │   Utilities     │                     │
│  │  (parallel)     │     │  (parallel)     │     │  (parallel)     │                     │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘                     │
│           │                       │                       │                              │
│           └───────────────────────┴───────────────────────┤                              │
│                                                           │                              │
│                                                           ▼                              │
│                                                  ┌─────────────────┐                     │
│                                                  │ 4.5 API Helpers │                     │
│                                                  │   & Streaming   │                     │
│                                                  └────────┬────────┘                     │
│                                                           │                              │
│                                                           ▼                              │
│                                                  ┌─────────────────┐                     │
│                                                  │ 4.6 API Routes  │                     │
│                                                  └────────┬────────┘                     │
│                                                           │                              │
│                                                           ▼                              │
│                                                  ┌─────────────────┐                     │
│                                                  │ 4.7 Database    │                     │
│                                                  │   Migration     │                     │
│                                                  └────────┬────────┘                     │
│                                                           │                              │
│           ┌───────────────────────────────────────────────┤                              │
│           ▼                                               ▼                              │
│  ┌─────────────────┐                             ┌─────────────────┐                     │
│  │ 4.8 ChatSidebar │                             │ 4.9 DiffPanel   │                     │
│  │   & Hook        │                             │   & AI Undo     │                     │
│  └────────┬────────┘                             └────────┬────────┘                     │
│           │                                               │                              │
│           └───────────────────────┬───────────────────────┘                              │
│                                   │                                                      │
│                                   ▼                                                      │
│                          ┌─────────────────┐                                             │
│                          │ 4.10 Integration│                                             │
│                          └────────┬────────┘                                             │
│                                   │                                                      │
│                                   ▼                                                      │
│                          ┌─────────────────┐                                             │
│                          │ 4.11 Tests      │                                             │
│                          │ (Unit & E2E)    │                                             │
│                          └─────────────────┘                                             │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                                   | Tasks  | Description                                                     | Prerequisites        |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------- | -------------------- |
| [01-chat-context.md](./01-chat-context.md)             | 1-5    | ChatContext reducer with all actions                            | Pre-flight checklist |
| [02-intent-detection.md](./02-intent-detection.md)     | 6-9    | Intent detection for discussion/edit/research modes             | 4.1                  |
| [03-chat-components.md](./03-chat-components.md)       | 10-13  | ModeIndicator, ChatMessage, ChatInput, ConfirmDialog components | 4.1                  |
| [04-diff-utilities.md](./04-diff-utilities.md)         | 13-14  | Diff generator and apply functions                              | 4.1                  |
| [05-api-helpers.md](./05-api-helpers.md)               | 15-17  | Chat history, AI operations, streaming helpers                  | 4.2, 4.3, 4.4        |
| [06-api-routes.md](./06-api-routes.md)                 | 18-21b | Chat history, streaming chat, global edit, operations routes    | 4.5                  |
| [07-database-migration.md](./07-database-migration.md) | 22     | Database indexes for chat and AI operations                     | 4.6                  |
| [08-chat-sidebar.md](./08-chat-sidebar.md)             | 23-24  | ChatSidebar component and useStreamingChat hook                 | 4.7                  |
| [09-diff-panel-undo.md](./09-diff-panel-undo.md)       | 25-26  | DiffPanel component and AI undo functionality                   | 4.7                  |
| [10-integration.md](./10-integration.md)               | 27     | DocumentEditorContext and DiffPanelWrapper                      | 4.8, 4.9             |
| [11-tests.md](./11-tests.md)                           | 28-35  | AI factories, Page Objects, E2E tests with worker isolation     | 4.10                 |
| [99-verification.md](./99-verification.md)             | -      | Phase completion verification                                   | All tasks            |

---

## Key Dependencies

- **React 19** - For hooks and context
- **TipTap Editor** - Document editing integration
- **Claude CLI** - For AI streaming responses
- **diff library** - For generating content diffs
- **Zod** - For API validation
- **Supabase** - For chat history and AI operations storage
- **Playwright** - For E2E testing
- **pino** - For structured logging (from Phase 1)

### Phase 3 Dependencies (Required)

Phase 4 requires these from Phase 3 to be in place:

- `@/lib/logger` - Structured logger with child logger support
- `@/lib/api/audit` - `createAuditLog()` function for audit logging
- `@/lib/constants/ai.ts` - AI constants (`AI.MAX_PROMPT_LENGTH`, `AI.MAX_CONTEXT_LENGTH`, `AI.STREAM_TIMEOUT_MS`)

## Best Practices Compliance

This phase follows all development best practices:

| Category              | Implementation                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Security**          | Rate limiting on all AI endpoints, Zod validation, CLI input sanitization                      |
| **Logging**           | Structured logging with pino, domain child loggers (ai, chat), audit logging for AI operations |
| **Code Organization** | Barrel exports for `@/lib/api` and `@/lib/ai`, standardized error response helpers             |
| **TypeScript**        | Typed database queries, discriminated unions for actions, Next.js 16 async params              |
| **React**             | useCallback memoization, cleanup on unmount, focus-visible states, non-blocking ConfirmDialog  |
| **Database**          | Composite indexes, retention policies, cleanup functions                                       |
| **Accessibility**     | 44x44px touch targets, reduced motion support, focus states, keyboard navigation               |

### Key Patterns Used

1. **Domain Loggers** - Each API route creates a domain logger: `logger.child({ domain: 'ai', operation: '...' })`
2. **Audit Logging** - AI operations are logged with `createAuditLog('ai:chat', {...})`, `ai:global-edit`, `ai:operation-status`
3. **Input Sanitization** - CLI inputs use `sanitizePrompt()` and `sanitizeContext()` from `@/lib/ai/sanitize.ts`
4. **Error Helpers** - Consistent errors via `unauthorizedError()`, `validationError()`, `rateLimitError()`, `serverError()`
5. **AI Constants** - Limits like `AI.MAX_PROMPT_LENGTH`, `AI.MAX_CONTEXT_LENGTH`, `AI.STREAM_TIMEOUT_MS` from `@/lib/constants/ai.ts`
6. **Non-blocking Dialogs** - Use `ConfirmDialog` component instead of `window.confirm()`

### Testing Best Practices Compliance

This phase follows all testing best practices from `testing-best-practices.md`:

| Pattern                  | Implementation                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| **AI Test Factories**    | Extend `src/test-utils/factories.ts` with `createMockChatMessage()`, `createMockDiffChange()` |
| **Page Object Model**    | `e2e/pages/ChatPage.ts`, `e2e/pages/DiffPanelPage.ts`                                         |
| **Worker Isolation**     | Import from `../fixtures/test-fixtures` with `workerCtx` and `loginAsWorker`                  |
| **Centralized Timeouts** | Import `TIMEOUTS` from `e2e/config/timeouts.ts`, never hardcode                               |
| **SSE Mocking**          | Use ReadableStream pattern for streaming endpoint mocks                                       |
| **Streaming Completion** | `waitForStreamingComplete()` with `expect().toPass()` pattern                                 |
| **Abort Testing**        | Verify user cancellation doesn't trigger error state                                          |
| **Authentication**       | Use `loginAsWorker()` fixture before all E2E tests                                            |

---

## Pre-Flight Checklist

Before starting **any** task, verify prerequisites:

```bash
node --version        # Must be 24+
npm --version
npm test -- --version # Vitest available
npx playwright --version  # Playwright available
npx supabase --version    # Supabase CLI available
docker ps             # Docker running for Supabase
```

---

## Execution Strategy

### Sequential vs Parallel Tasks

- **Task 4.1** must complete first (ChatContext foundation)
- **Tasks 4.2, 4.3, 4.4** can be done in parallel after 4.1
- **Tasks 4.5 → 4.6 → 4.7** are sequential (API layer)
- **Tasks 4.8 and 4.9** can be done in parallel after 4.7
- **Task 4.10** requires 4.8 and 4.9
- **Task 4.11** is final (testing)

### Recommended Order

For a single developer, follow file order: 01 → 02 → ... → 11

For parallel execution with multiple agents:

1. Complete 01 first
2. Then parallel: 02 | 03 | 04
3. Then 05 → 06 → 07
4. Then parallel: 08 | 09
5. Then 10 → 11

---

## Architecture Overview

**Tech Stack:** Next.js 16, React 19, TipTap editor, Supabase (auth/DB), Claude CLI (streaming), Zod (validation), diff library, Playwright (E2E)

### State Management

- **ChatContext** - React context with reducer for chat state
- **DocumentEditorContext** - Coordinates editor and diff panel

### API Layer

- SSE streaming for real-time AI responses
- Zod validation on all endpoints
- Supabase for persistence

### Components (Scholarly Craft Design)

- **ChatSidebar** - Slide-out chat interface (`bg-surface`, `shadow-lg`, `border-l border-ink-faint`)
- **DiffPanel** - Modal for reviewing changes (`bg-surface`, `shadow-xl`, `rounded-xl`)
- **AIUndoButton** - Undo AI operations with history (`bg-surface`, `border-ink-faint`, `hover:bg-surface-hover`)
- **ConfirmDialog** - Non-blocking confirmation dialog (`bg-surface`, `shadow-xl`, `rounded-lg`)

---

## Data Attributes Reference

### Chat Components

- `chat-sidebar`, `chat-sidebar-toggle`
- `chat-message-list`, `chat-message`
- `chat-input`, `chat-send-button`
- `chat-mode-indicator`
- `chat-loading`, `chat-error`, `chat-retry`
- `chat-cancel-stream`, `chat-clear-history`

### Diff Components

- `diff-panel`, `diff-change`
- `diff-accept-all`, `diff-reject-all`, `diff-close`
- `accept-change`, `reject-change`
- `diff-progress`

### AI History Components

- `ai-undo-button`, `undo-count`
- `ai-history-toggle`, `ai-history-panel`
- `ai-snapshot-list`, `ai-snapshot`, `restore-snapshot`

### UI Components

- `confirm-dialog`, `confirm-backdrop`
- `confirm-title`, `confirm-message`
- `confirm-confirm`, `confirm-cancel`
