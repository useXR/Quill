# Phase 3: AI Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Claude Code CLI as the AI backbone for Quill, enabling selection actions (refine/extend/shorten/simplify), cursor generation (Cmd+K), and streaming AI responses.

**Architecture:** Subprocess-based Claude CLI integration with process manager, error categorization, and automatic retry. The `AIProvider` interface enables future migration to direct Anthropic API. Zustand for AI operation state; SSE for streaming.

**Tech Stack:** Next.js 16+, TipTap editor, Zustand, Supabase, Vitest, Playwright, Claude Code CLI

---

## Design System Integration

All UI components in this phase **MUST** follow the [Quill Design System](../../design-system.md) ("Scholarly Craft" aesthetic).

### Key Design Tokens for AI Features

| Element                    | Design Token                                        | Notes                                          |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| **AI Toolbar Background**  | `bg-surface`                                        | Clean white surface with `shadow-md` elevation |
| **Toolbar Buttons**        | `bg-transparent hover:bg-surface-hover`             | Ghost button style with `text-ink-tertiary`    |
| **Active/Pressed Buttons** | `bg-quill-light text-quill`                         | Brand accent for active states                 |
| **Loading Spinner**        | `text-quill`                                        | Brand color for loading indicators             |
| **Error States**           | `bg-error-light text-error-dark`                    | Semantic error styling                         |
| **Success States**         | `bg-success-light text-success-dark`                | For accept confirmations                       |
| **Typography (UI)**        | `font-ui` (Source Sans 3)                           | All toolbar labels and buttons                 |
| **Border Radius**          | `rounded-lg`                                        | Standard card radius for floating toolbars     |
| **Focus Ring**             | `focus:ring-2 focus:ring-quill focus:ring-offset-2` | Consistent focus states                        |

### Typography Guidelines

- **Toolbar buttons**: `font-ui text-sm font-medium`
- **Status messages**: `font-ui text-xs text-ink-tertiary`
- **Preview text**: `font-prose text-base` (maintains document style)
- **Modal headings**: `font-display text-lg font-bold text-ink-primary`

### Motion & Animation

Per the design system's "unhurried and purposeful" motion philosophy:

- Button hover/active: `transition-all duration-150` (fast, responsive)
- Toolbar appearance: Fade in with `duration-200` (smooth, not flashy)
- Streaming text: No animation (text appears naturally)
- Loading spinner: `animate-spin` with Quill brand color

---

## Phase 3 Task Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3: AI INTEGRATION                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 3.1 Types    │  │ 3.2 Errors   │  │ 3.3 Sanitize │  │ 3.4 Mocks    │        │
│  │  (parallel)  │  │  (parallel)  │  │  (parallel)  │  │  (parallel)  │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘        │
│         │                 │                 │                                   │
│         └────────┬────────┴─────────────────┘                                   │
│                  │                                                              │
│                  ▼                                                              │
│           ┌──────────────┐                                                      │
│           │ 3.5 CLI      │                                                      │
│           │   Wrapper    │                                                      │
│           └──────┬───────┘                                                      │
│                  │                                                              │
│         ┌────────┴────────┐                                                     │
│         ▼                 ▼                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 3.6 CLI      │  │ 3.7 Streaming│  │ 3.8 AI Store │  │ 3.11 Context │        │
│  │  Validation  │  │   Module     │  │   (Zustand)  │  │   Builder    │        │
│  └──────────────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘        │
│                          │                 │                                    │
│                          └────────┬────────┘                                    │
│                                   │                                             │
│                                   ▼                                             │
│  ┌──────────────┐         ┌──────────────┐                                      │
│  │ 3.9 useAI    │◄────────│ 3.10 SSE API │                                      │
│  │   Stream     │         │     Route    │                                      │
│  └──────┬───────┘         └──────────────┘                                      │
│         │                                                                       │
│         │        ┌──────────────┐                                               │
│         │        │ 3.12 TipTap  │                                               │
│         │        │  Selection   │                                               │
│         │        └──────┬───────┘                                               │
│         │               │                                                       │
│         └───────┬───────┘                                                       │
│                 ▼                                                               │
│          ┌──────────────┐                                                       │
│          │ 3.13 Select  │                                                       │
│          │   Toolbar    │                                                       │
│          └──────┬───────┘                                                       │
│                 │                                                               │
│         ┌───────┴───────┐                                                       │
│         ▼               ▼                                                       │
│  ┌──────────────┐  ┌──────────────┐                                             │
│  │ 3.14 E2E     │  │ 3.15 Editor  │                                             │
│  │   Tests      │  │ Integration  │                                             │
│  └──────────────┘  └──────────────┘                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                                       | Task | Description                                  | Prerequisites        |
| ---------------------------------------------------------- | ---- | -------------------------------------------- | -------------------- |
| [01-ai-type-definitions.md](./01-ai-type-definitions.md)   | 3.1  | Core TypeScript types for AI integration     | Pre-flight checklist |
| [02-error-categorization.md](./02-error-categorization.md) | 3.2  | Error categorization with retry detection    | Pre-flight checklist |
| [03-input-sanitization.md](./03-input-sanitization.md)     | 3.3  | Input sanitization to prevent CLI injection  | Pre-flight checklist |
| [04-mock-factory.md](./04-mock-factory.md)                 | 3.4  | Mock factory for CLI process testing         | Pre-flight checklist |
| [05-claude-cli-wrapper.md](./05-claude-cli-wrapper.md)     | 3.5  | Claude CLI wrapper with process manager      | 3.1, 3.2, 3.3        |
| [06-cli-validation.md](./06-cli-validation.md)             | 3.6  | CLI validation and AIProvider implementation | 3.5                  |
| [07-streaming-module.md](./07-streaming-module.md)         | 3.7  | Streaming module with cancellation support   | 3.1, 3.3             |
| [08-ai-state-store.md](./08-ai-state-store.md)             | 3.8  | Zustand AI operation state management        | 3.1                  |
| [09-use-ai-stream-hook.md](./09-use-ai-stream-hook.md)     | 3.9  | useAIStream React hook for SSE consumption   | 3.1                  |
| [10-sse-api-route.md](./10-sse-api-route.md)               | 3.10 | SSE streaming API endpoint                   | 3.7, 3.8             |
| [11-context-builder.md](./11-context-builder.md)           | 3.11 | Context builder with token budget management | 3.1                  |
| [12-selection-tracker.md](./12-selection-tracker.md)       | 3.12 | TipTap selection tracker extension           | Pre-flight checklist |
| [13-selection-toolbar.md](./13-selection-toolbar.md)       | 3.13 | Accessible selection toolbar component       | 3.8, 3.9, 3.12       |
| [14-e2e-tests.md](./14-e2e-tests.md)                       | 3.14 | Playwright E2E tests for AI features         | 3.13                 |
| [15-editor-integration.md](./15-editor-integration.md)     | 3.15 | Final editor integration                     | 3.12, 3.13           |
| [99-verification.md](./99-verification.md)                 | -    | Phase completion verification                | All tasks            |

---

## Key Dependencies

- **Claude Code CLI** - AI backbone for text generation
- **Zustand** - State management for AI operations
- **TipTap** - Rich text editor (already in project)
- **Supabase** - Authentication for API routes

---

## Best Practices Compliance

This phase follows the development best practices established in Phase 0-2:

### Code Patterns

- **Constants**: All magic numbers in `src/lib/constants/ai.ts`
- **Structured Logging**: Use `aiLogger` from `claude-cli.ts`, not `console.log`
- **Zod Validation**: API routes use Zod schemas from `src/lib/api/schemas/`
- **Error Handling**: Use `handleApiError` from `@/lib/api` in routes
- **Audit Logging**: Call `createAuditLog('ai:generate', ...)` for AI operations

### Test Utilities (IMPORTANT: Reuse existing utilities)

- **Supabase Mocks**: Use `createMockSupabaseClient`, `createUnauthenticatedMock` from `@/test-utils/supabase-mock.ts`
- **TipTap Mocks**: Use `createMockEditor` from `@/test-utils/tiptap-mock.ts`
- **AI Factories**: Add `createMockAIOperation`, `createMockStreamChunk`, `createMockClaudeError` to `src/test-utils/factories.ts`
- **Domain Logger Mocking**: Follow Phase 2 pattern for mocking `aiLogger`

### E2E Test Patterns

- **Page Objects**: Create `AIToolbarPage.ts` following `VaultPage.ts` pattern
- **Helpers**: Use `waitForFormReady`, `checkA11y`, `VISIBILITY_WAIT` from `e2e/helpers/`
- **Async Processing**: Use `expect().toPass()` polling pattern for streaming operations
- **Timeout Constants**: Import from `e2e/config/timeouts.ts`, never hardcode

---

## Infrastructure Best Practices Compliance

This phase follows infrastructure patterns established in Phase 0-2:

### From Phase 1 (MUST use)

- **Rate Limiting**: AI endpoint uses `checkRateLimit` from `@/lib/auth/rate-limit`
- **Security Headers**: If adding external API connections, update CSP in `next.config.ts`
- **Structured Logging**: Use `aiLogger` child logger from `@/lib/logger`

### From Phase 2 (MUST use)

- **Module-specific Logger**: `aiLogger` created following `vaultLogger` pattern
- **Audit Logging**: Use `createAuditLog('ai:generate', ...)` for AI operations
- **Barrel Exports**: Every `src/lib/<module>/` has `index.ts` (including `src/lib/stores/`)
- **Request Cancellation**: AbortController pattern for cancellable AI streams

### Rate Limiting Implementation

```typescript
// In API route - per Phase 1 patterns
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { AI } from '@/lib/constants/ai';

const rateLimit = await checkRateLimit(`ai:${user.id}`, clientIp, {
  maxAttempts: AI.RATE_LIMIT.MAX_REQUESTS_PER_MINUTE,
  windowMs: AI.RATE_LIMIT.WINDOW_MS,
});

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', code: 'RATE_LIMITED', retryAfter: rateLimit.retryAfter },
    { status: 429 }
  );
}
```

### Future Considerations

**CSP for Direct Anthropic API:**
When migrating from CLI to direct API, update `next.config.ts`:

```typescript
// Add to connect-src when adding Anthropic API support:
"connect-src 'self' https://*.supabase.co https://api.anthropic.com",
```

**AI Health Check:**
Consider adding CLI status to `/api/health` endpoint for operational monitoring.

**Persistent Operation History:**
If AI operations need to persist beyond session (for undo across sessions, analytics), consider soft delete pattern from Phase 2.

---

## Pre-Flight Checklist

Before starting **any** task, verify prerequisites:

```bash
claude --version      # Verify Claude CLI installed
npm install zustand   # State management (if not already installed)
npm test              # Verify existing tests pass
```

---

## Execution Strategy

### Sequential vs Parallel Tasks

- **Tasks 3.1, 3.2, 3.3, 3.4** can be done in parallel (no dependencies)
- **Task 3.5** requires 3.1, 3.2, 3.3
- **Task 3.6** requires 3.5
- **Tasks 3.7, 3.8, 3.9, 3.11** can be done in parallel after 3.5
- **Task 3.10** requires 3.7 and 3.8
- **Task 3.12** is independent (TipTap work)
- **Task 3.13** requires 3.8, 3.9, 3.12
- **Tasks 3.14, 3.15** require 3.13

### Recommended Order

For a single developer, follow numerical order: 3.1 → 3.2 → ... → 3.15

For parallel execution with multiple agents:

1. Parallel: 3.1 | 3.2 | 3.3 | 3.4 | 3.12
2. Then 3.5
3. Parallel: 3.6 | 3.7 | 3.8 | 3.9 | 3.11
4. Then 3.10 → 3.13
5. Parallel: 3.14 | 3.15
