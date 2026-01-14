# Development Best Practices

Lessons learned from building a production TypeScript/React/Next.js application. These patterns apply to projects using Supabase or similar backend services.

---

## Phase 0 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure                | What's Done                                               | Later Phases Should NOT...                           |
| ----------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| **Typed Supabase Clients**    | `createClient<Database>()` returns fully typed client     | Create untyped clients or duplicate the client setup |
| **Health Check Endpoint**     | `/api/health` with DB connectivity check                  | Create additional health endpoints                   |
| **ESLint + Prettier Config**  | Flat config with test file relaxation, formatting rules   | Modify linting rules or add new config files         |
| **Vitest Infrastructure**     | Browser API mocks, jsdom, coverage thresholds             | Re-mock ResizeObserver, matchMedia, etc.             |
| **Playwright Infrastructure** | Timeouts in `e2e/config/`, fixtures, axe-core setup       | Hardcode timeouts or recreate test account patterns  |
| **E2E Hydration Helpers**     | `waitForFormReady()`, `fillFormField()` in `e2e/helpers/` | Write custom hydration waits in tests                |
| **Test Render Utilities**     | `render()` with providers, `userEvent.setup()`            | Create alternate render functions                    |
| **CI Pipeline**               | GitHub Actions with lint→test→build→e2e                   | Create separate workflow files                       |
| **Type Generation Script**    | `pnpm db:types` regenerates from schema                   | Manually write database types                        |
| **Port Isolation**            | Dev: 3000, E2E: 3088                                      | Use different ports or conflict with these           |
| **Line Ending Normalization** | `.gitattributes` ensures LF for scripts                   | Worry about CRLF issues in bash/SQL                  |
| **Standalone Output**         | `next.config.ts` has `output: 'standalone'`               | Modify output config                                 |

### Patterns Established (Must Follow in Later Phases)

These set conventions that **new code must follow**:

| Pattern                 | Phase 0 Example                       | Later Phases Must...                                    |
| ----------------------- | ------------------------------------- | ------------------------------------------------------- |
| **Barrel Exports**      | `src/lib/supabase/index.ts`           | Create `index.ts` for each new `src/lib/<module>/`      |
| **RLS Policies**        | All 9 initial tables have RLS         | Add RLS to any new tables in migrations                 |
| **Database Indexes**    | Indexes on FKs and common queries     | Add indexes for new tables/query patterns               |
| **Audit Logging**       | `audit_logs` table exists             | Call audit logging from service functions (see Phase 2) |
| **Form Hydration**      | E2E helpers ready                     | Add `data-hydrated="true"` to forms via `useEffect`     |
| **Test Factories**      | `src/test-utils/factories.ts` pattern | Add factory functions for new entity types              |
| **Directory Structure** | `src/lib/`, `src/test-utils/`, `e2e/` | Place new code in appropriate directories               |

### Deferred to Later Phases

| Item              | Target Phase | Notes             |
| ----------------- | ------------ | ----------------- |
| Docker/Dockerfile | Deployment   | Multi-stage build |

---

## Phase 1 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure            | What's Done                                           | Later Phases Should NOT...                      |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| **Security Headers**      | HSTS, X-Frame-Options, CSP in `next.config.ts`        | Modify security headers without review          |
| **Constants System**      | `src/lib/constants/auth.ts`, `editor.ts`              | Hardcode magic values; add to constants instead |
| **Structured Logger**     | `src/lib/logger.ts` (pino)                            | Use `console.log` in production code            |
| **API Error Classes**     | `src/lib/api/errors.ts` with `ApiError`, `ErrorCodes` | Create new error classes; extend existing       |
| **API Error Handler**     | `src/lib/api/handle-error.ts`                         | Write custom error handling in routes           |
| **Zod Error Formatting**  | `src/lib/api/format-errors.ts`                        | Format Zod errors differently                   |
| **Auth Provider**         | `src/contexts/auth.tsx` in root layout                | Create duplicate auth state management          |
| **Auth Middleware**       | `src/middleware.ts` with protected routes             | Implement auth checks in individual pages       |
| **TipTap Editor**         | `src/components/editor/Editor.tsx` with extensions    | Create alternate rich text editors              |
| **E2E Timeout Constants** | `e2e/config/timeouts.ts`                              | Hardcode timeout values in tests                |
| **E2E Hydration Helpers** | `e2e/helpers/hydration.ts`                            | Write custom hydration waits                    |
| **E2E Page Objects**      | `e2e/pages/` directory pattern                        | Put selectors directly in test files            |

### Patterns Established (Must Follow in Later Phases)

| Pattern                        | Phase 1 Example                          | Later Phases Must...                              |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------- |
| **API Route Error Handling**   | `handleApiError(error, logger, context)` | Use `handleApiError` in all catch blocks          |
| **Zod Validation in Routes**   | `safeParse` + `formatZodError`           | Validate all API inputs with Zod schemas          |
| **Version Conflict Detection** | Documents use `expectedVersion` param    | Implement optimistic locking for concurrent edits |
| **Autosave Pattern**           | `useAutosave` hook with debounce + retry | Use hook for any auto-persisting content          |
| **Word Count Pattern**         | `useWordCount` hook with limits          | Use hook for any content with limits              |
| **Form Hydration**             | `data-hydrated="true"` via useEffect     | Add hydration attribute to interactive forms      |
| **Protected Route List**       | `PROTECTED_ROUTES` array in middleware   | Add new protected routes to the array             |
| **Sort Order for Lists**       | Documents have `sort_order` column       | Add `sort_order` for user-orderable items         |
| **E2E Test Structure**         | `e2e/{feature}/*.spec.ts`                | Organize tests by feature area                    |
| **E2E Accessibility**          | `checkA11y(page)` after page loads       | Include accessibility checks in E2E tests         |

### How to Add New API Routes

```typescript
// Follow this pattern for all new API routes
import { NextResponse } from 'next/server';
import { YourSchema } from '@/lib/api/schemas/your-schema';
import { formatZodError, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = YourSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error), code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    // Business logic here...
    logger.info({ resourceId: result.id }, 'Resource created');
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    return handleApiError(error, logger, 'Failed to create resource');
  }
}
```

### How to Add New E2E Tests

```typescript
// Follow this pattern for all new E2E tests
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { waitForFormReady, fillFormField } from '../helpers/hydration';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

test.describe('Feature Name', () => {
  test('should do something with accessibility', async ({ page }) => {
    await page.goto('/your-page');
    await waitForFormReady(page); // If page has forms

    // Test logic using TIMEOUTS constants, not hardcoded values
    await expect(page.locator('[data-testid="element"]')).toBeVisible(VISIBILITY_WAIT);

    // Always check accessibility
    await checkA11y(page);
  });
});
```

---

## Phase 2 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure                   | What's Done                                      | Later Phases Should NOT...                                |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| **Domain Logger Factory**        | `vaultLogger({ context })` creates child loggers | Create separate logger instances; use the factory pattern |
| **Audit Logging Helper**         | `src/lib/api/audit.ts` with `createAuditLog`     | Implement custom audit logging; use the helper            |
| **Soft Delete Cleanup Function** | `cleanup_soft_deleted_vault_items()` DB function | Create separate cleanup functions; follow the pattern     |
| **Text Chunker**                 | `src/lib/extraction/chunker.ts` with overlap     | Create alternate chunking logic; use existing chunker     |
| **Embeddings Service**           | `src/lib/extraction/embeddings.ts` with batching | Call OpenAI directly; use the service with rate limiting  |
| **Filename Sanitization**        | `src/lib/utils/filename.ts`                      | Write custom sanitization; use the utility                |

### Patterns Established (Must Follow in Later Phases)

| Pattern                      | Phase 2 Example                                        | Later Phases Must...                                         |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| **Domain Child Loggers**     | `vaultLogger({ itemId, userId })`                      | Create child loggers with domain context, not bare `logger`  |
| **Soft Delete Pattern**      | `deleted_at` column + `.is('deleted_at', null)` filter | Add `deleted_at` to deletable entities; filter in queries    |
| **Audit Logging**            | `createAuditLog('vault:create', { ... })`              | Call audit helper for create/update/delete operations        |
| **File Upload Validation**   | Type whitelist + size limits + sanitization            | Validate uploads server-side before storage                  |
| **Optimistic Updates**       | Store previous state → update UI → rollback on error   | Use optimistic updates for user-facing mutations             |
| **Client Error Display**     | `setError(message)` state, not `console.error`         | Show user-friendly errors via state, not console             |
| **Request Cancellation**     | `AbortController` for in-flight requests               | Cancel pending requests when user triggers new ones          |
| **Vector Search Pattern**    | pgvector with HNSW index + RPC function                | Use RPC functions for vector operations; type responses      |
| **Background Queue Pattern** | In-memory queue with exponential backoff               | Use queue pattern for async processing; document limitations |

### How to Create a Domain Logger

```typescript
// In your module's service file
import { logger } from '@/lib/logger';

// Create a child logger with domain context
export function vaultLogger(context: { userId?: string; itemId?: string }) {
  return logger.child({ domain: 'vault', ...context });
}

// Usage in API routes
const log = vaultLogger({ userId: user.id, itemId });
log.info('Processing extraction');
log.error({ error }, 'Extraction failed');
```

### How to Implement Optimistic Updates

```typescript
const handleDelete = useCallback(
  async (id: string) => {
    // 1. Store previous state for rollback
    const previousItems = items;

    // 2. Optimistically update UI
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      // 3. Make the actual request
      const response = await fetch(`/api/resource/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
    } catch (error) {
      // 4. Rollback on error
      setItems(previousItems);
      setError('Failed to delete. Please try again.');
    }
  },
  [items]
);
```

### How to Add Soft Delete to a New Entity

```sql
-- 1. Add deleted_at column
ALTER TABLE your_table ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- 2. Update RLS policy to exclude deleted
CREATE POLICY "Users can view own non-deleted items"
  ON your_table FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 3. Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_your_table()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM your_table
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```typescript
// In your API helper
export async function deleteItem(id: string) {
  // Soft delete
  await supabase.from('your_table').update({ deleted_at: new Date().toISOString() }).eq('id', id);
}

export async function restoreItem(id: string) {
  await supabase.from('your_table').update({ deleted_at: null }).eq('id', id);
}

// Always filter in queries
export async function getItems() {
  return supabase.from('your_table').select('*').is('deleted_at', null); // IMPORTANT: Always add this filter
}
```

### Production Considerations

| Component            | Limitation                 | Production Solution                         |
| -------------------- | -------------------------- | ------------------------------------------- |
| **Extraction Queue** | In-memory; lost on restart | Use Redis, BullMQ, or database-backed queue |
| **Vector Search**    | Single Supabase instance   | Consider dedicated vector DB for scale      |
| **File Storage**     | Supabase Storage           | Consider S3 for large-scale storage         |

---

## Phase 3 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure                  | What's Done                                                    | Later Phases Should NOT...                                  |
| ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| **AI Constants File**           | `src/lib/constants/ai.ts` with timeouts, limits, retry config  | Hardcode AI-related magic values; add to constants          |
| **AI Domain Logger**            | `aiLogger({ userId, operationId })` factory in `claude-cli.ts` | Use `console.log` in AI code; use the domain logger         |
| **AI Provider Interface**       | `AIProvider` in `src/lib/ai/types.ts`                          | Create alternate provider patterns; implement the interface |
| **AI Zod Schema**               | `src/lib/api/schemas/ai-generate.ts`                           | Write inline validation; extend the schema                  |
| **SSE Streaming Endpoint**      | `/api/ai/generate` with proper headers                         | Create alternate streaming endpoints; follow the pattern    |
| **AI State Store**              | `useAIStore` Zustand store in `src/lib/stores/ai-store.ts`     | Create duplicate AI state management                        |
| **useAIStream Hook**            | `src/hooks/useAIStream.ts` for SSE consumption                 | Write custom SSE handling; use the hook                     |
| **Selection Tracker Extension** | `SelectionTracker` TipTap extension                            | Create alternate selection tracking                         |
| **Selection Toolbar**           | `SelectionToolbar.tsx` with full accessibility                 | Create non-accessible floating UI                           |

### Patterns Established (Must Follow in Later Phases)

| Pattern                       | Phase 3 Example                                    | Later Phases Must...                                 |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| **AI Domain Logger**          | `aiLogger({ userId, operationId })`                | Use `aiLogger` for all AI-related logging            |
| **AI Audit Events**           | `createAuditLog('ai:generate', { ... })`           | Audit log AI operations with `ai:` prefix            |
| **CLI Input Sanitization**    | `sanitizePrompt()`, `sanitizeContext()`            | Sanitize all user input before subprocess calls      |
| **Error Categorization**      | `categorizeError()` with `isRetryableError()`      | Categorize errors and identify retryable ones        |
| **SSE Response Format**       | `data: ${JSON.stringify(chunk)}\n\n` with `[DONE]` | Follow SSE format with done signal                   |
| **AI Operation Lifecycle**    | start → stream → preview → accept/reject           | Implement accept/reject flow for AI changes          |
| **Floating UI Accessibility** | `role="toolbar"`, `aria-label`, keyboard nav       | Add full ARIA support to floating toolbars           |
| **TipTap Extension Storage**  | `addStorage()` with listener pattern               | Use storage for extension state, not external stores |

### How to Create an AI Domain Logger

```typescript
// In your AI-related module
import { logger } from '@/lib/logger';

// Create domain-specific child logger
export function aiLogger(context: { userId?: string; operationId?: string }) {
  return logger.child({ domain: 'ai', ...context });
}

// Usage in API routes or services
const log = aiLogger({ userId: user.id, operationId: streamId });
log.info('Starting AI generation');
log.error({ error }, 'AI generation failed');
```

### How to Implement SSE Streaming Endpoints

```typescript
// Follow this pattern for all SSE streaming routes
import { NextRequest, NextResponse } from 'next/server';
import { aiLogger } from '@/lib/ai/claude-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const log = aiLogger({});

  // 1. Validate with Zod schema
  const result = yourSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: formatZodError(result.error), code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  // 2. Create audit log
  await createAuditLog('ai:your-operation', { userId, ... });

  // 3. Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Handle abort
      request.signal.addEventListener('abort', () => {
        controller.close();
      });

      // Send chunks
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

      // Send done signal
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  // 4. Return with correct headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Stream-Id': streamId,
    },
  });
}
```

### How to Consume SSE Streams (Client-Side)

```typescript
// Use useAIStream hook for SSE consumption
import { useAIStream } from '@/hooks/useAIStream';

function MyComponent() {
  const { content, isStreaming, error, startStream, cancel, reset } = useAIStream({
    onChunk: (chunk) => console.log('Received:', chunk),
    onComplete: (fullContent) => console.log('Done:', fullContent),
    onError: (error) => console.error('Error:', error),
  });

  const handleGenerate = async () => {
    await startStream(prompt, documentId, projectId);
  };

  return (
    <div>
      {isStreaming && <Spinner />}
      {content && <Preview>{content}</Preview>}
      {error && <ErrorMessage error={error} />}
    </div>
  );
}
```

### How to Implement Floating Toolbar Accessibility

```typescript
// All floating toolbars MUST follow this pattern
function FloatingToolbar({ actions, onAction }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex(i => (i + 1) % actions.length);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex(i => (i - 1 + actions.length) % actions.length);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    toolbarRef.current?.addEventListener('keydown', handleKeyDown);
    return () => toolbarRef.current?.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting actions"
      aria-orientation="horizontal"
    >
      {actions.map((action, index) => (
        <button
          key={action.id}
          tabIndex={index === focusedIndex ? 0 : -1}
          aria-describedby={`${action.id}-desc`}
        >
          {action.label}
          <span id={`${action.id}-desc`} className="sr-only">
            {action.description}
          </span>
        </button>
      ))}

      {/* Live region for state announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading && 'Generating AI response...'}
        {isPreview && 'Preview ready'}
        {error && `Error: ${error.message}`}
      </div>
    </div>
  );
}
```

### How to Create TipTap Extensions with Storage

```typescript
// Use storage pattern for extension state
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SelectionState {
  from: number;
  to: number;
  text: string;
}

export const SelectionTracker = Extension.create({
  name: 'selectionTracker',

  // Define typed storage
  addStorage() {
    return {
      selection: null as SelectionState | null,
      listeners: new Set<(sel: SelectionState | null) => void>(),
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('selectionTracker'),
        view() {
          return {
            update(view) {
              // Update storage and notify listeners
              extension.storage.selection = newSelection;
              extension.storage.listeners.forEach((fn) => fn(newSelection));
            },
          };
        },
      }),
    ];
  },
});

// React hook to consume extension storage
export function useEditorSelection(editor: Editor | null) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    if (!editor) return;

    const tracker = editor.storage.selectionTracker;
    setSelection(tracker.selection);

    const listener = (sel: SelectionState | null) => setSelection(sel);
    tracker.listeners.add(listener);

    return () => tracker.listeners.delete(listener);
  }, [editor]);

  return selection;
}
```

### AI Operation State Management

```typescript
// AI operations follow this lifecycle:
// 1. Start: User triggers action
// 2. Stream: Content streams progressively
// 3. Preview: User reviews generated content
// 4. Accept/Reject: User decides to apply or discard

// Use the Zustand store for this pattern
import { useAIStore } from '@/lib/stores/ai-store';

function AIFeature() {
  const store = useAIStore();

  const handleAction = () => {
    // 1. Capture document snapshot for undo
    const snapshot = editor.getHTML();

    // 2. Start operation
    store.startOperation('selection', userPrompt, snapshot);

    // 3. Stream content (updates store automatically via onChunk)
    await startStream(prompt);
  };

  const handleAccept = () => {
    // 4a. Apply changes to editor
    editor.chain().insertContent(store.currentOperation.output).run();
    store.acceptOperation(); // Adds to history for undo
  };

  const handleReject = () => {
    // 4b. Discard changes
    store.rejectOperation(); // No history entry
  };

  const handleUndo = (operationId: string) => {
    // Restore from snapshot
    const snapshot = store.undoOperation(operationId);
    if (snapshot) editor.commands.setContent(snapshot);
  };
}
```

### CLI Input Sanitization (Security)

```typescript
// ALWAYS sanitize user input before passing to CLI subprocess
import { AI } from '@/lib/constants/ai';

export function sanitizePrompt(prompt: string): string {
  // Remove control characters
  let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Escape shell metacharacters
  sanitized = sanitized.replace(/[`$(){}[\]\\]/g, '\\$&');

  // Prevent CLI flag injection
  if (/^-{1,2}\w/.test(sanitized.trim())) {
    throw new SanitizationError('Prompt cannot start with CLI flags');
  }

  // Enforce length limits
  if (sanitized.length > AI.MAX_PROMPT_LENGTH) {
    throw new SanitizationError(`Prompt exceeds ${AI.MAX_PROMPT_LENGTH} chars`);
  }

  return sanitized;
}
```

### Production Considerations

| Component            | Limitation                                  | Production Solution                                    |
| -------------------- | ------------------------------------------- | ------------------------------------------------------ |
| **Claude CLI**       | Local subprocess; not horizontally scalable | Migrate to Anthropic API for multi-instance deployment |
| **Streaming State**  | In-memory Zustand; lost on refresh          | Consider persisting preview state to localStorage      |
| **AI Rate Limiting** | Per-user limits in application code         | Use Redis for distributed rate limiting                |

---

## Phase 4 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure              | What's Done                                                                                                          | Later Phases Should NOT...                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Error Response Helpers**  | `src/lib/api/error-response.ts` with `validationError()`, `unauthorizedError()`, `rateLimitError()`, `serverError()` | Write inline `NextResponse.json({ error: ... })`; use the helpers |
| **Rate Limit Utility**      | `src/lib/rate-limit.ts` with configurable limits/windows                                                             | Create custom rate limiting; use the utility                      |
| **CLI Sanitization**        | `src/lib/ai/sanitize.ts` with `sanitizePrompt()`, `sanitizeContext()`                                                | Pass unsanitized input to CLI; always sanitize                    |
| **ConfirmDialog Component** | `src/components/ui/ConfirmDialog.tsx` with full accessibility                                                        | Use `window.confirm()`; use the component                         |
| **Chat Context**            | `src/contexts/ChatContext.tsx` with discriminated union actions                                                      | Create duplicate chat state; extend the context                   |
| **Diff Generator**          | `src/lib/ai/diff-generator.ts` for content diffs                                                                     | Create alternate diff logic; use the generator                    |
| **Streaming Chat Hook**     | `src/hooks/useStreamingChat.ts` for SSE consumption                                                                  | Write custom streaming hooks; use the existing hook               |

### Patterns Established (Must Follow in Later Phases)

| Pattern                      | Phase 4 Example                                    | Later Phases Must...                                          |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| **Error Response Helpers**   | `return unauthorizedError()`                       | Use helpers from `@/lib/api/error-response` in all API routes |
| **Non-blocking Dialogs**     | `<ConfirmDialog open={show} />`                    | Never use `window.confirm()`; use `ConfirmDialog` component   |
| **Next.js 15 Async Params**  | `params: Promise<{ id: string }>` + `await params` | Await dynamic route params in App Router routes               |
| **Diff Review Flow**         | Accept/reject individual changes                   | Implement granular accept/reject for AI-generated changes     |
| **AI Operation Snapshots**   | Store `snapshotBefore` for undo                    | Capture document state before AI modifications                |
| **Chat Message Persistence** | `saveChatMessage()` with project/document context  | Persist chat history with proper foreign keys                 |

### How to Use Error Response Helpers

```typescript
// In API routes, use the standardized helpers
import { unauthorizedError, validationError, rateLimitError, serverError } from '@/lib/api/error-response';

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return unauthorizedError(); // Returns 401 with { error, code }
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error); // Returns 400 with flattened errors
  }

  const rateLimitResult = await rateLimit(user.id);
  if (!rateLimitResult.success) {
    return rateLimitError(rateLimitResult.retryAfter!); // Returns 429
  }

  try {
    // ... business logic
  } catch (error) {
    log.error({ error }, 'Operation failed');
    return serverError('Failed to process request'); // Returns 500
  }
}
```

### How to Use Non-blocking Confirmation Dialogs

```typescript
// WRONG - blocks main thread, breaks accessibility, no styling
const confirmed = window.confirm('Delete this item?');
if (confirmed) deleteItem();

// CORRECT - non-blocking, accessible, styleable
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (itemToDelete) {
      await deleteItem(itemToDelete);
    }
    setShowConfirm(false);
    setItemToDelete(null);
  };

  return (
    <>
      <button onClick={() => handleDeleteClick('123')}>Delete</button>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Delete Item?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
```

### How to Handle Next.js 15 Dynamic Route Params

```typescript
// WRONG - Next.js 14 pattern (fails in Next.js 15+)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id; // TypeError: Cannot read properties of Promise
}

// CORRECT - Next.js 15 pattern (params is now a Promise)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Must await the params

  // Now use id safely
  const item = await getItem(id);
}

// Also applies to GET, POST, DELETE, etc.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
}
```

### How to Implement Rate Limiting

```typescript
import { rateLimit } from '@/lib/rate-limit';

// Create a rate limiter for your endpoint
const rateLimitChat = rateLimit({ limit: 20, window: 60 }); // 20 req/min

export async function POST(request: NextRequest) {
  const user = await getUser();

  // Check rate limit using user ID as identifier
  const result = await rateLimitChat(user.id);

  if (!result.success) {
    return rateLimitError(result.retryAfter!);
  }

  // Proceed with request...
}
```

### Production Considerations

| Component           | Limitation                                                  | Production Solution                            |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| **Rate Limiting**   | In-memory Map; lost on restart, not shared across instances | Use Redis with `@upstash/ratelimit` or similar |
| **Chat History**    | Grows indefinitely                                          | Implement retention policy with cleanup job    |
| **AI Operations**   | Snapshots stored in JSON column                             | Consider blob storage for large documents      |
| **Diff Generation** | Synchronous, can be slow for large docs                     | Consider web worker or server-side generation  |

---

## Phase 5 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure              | What's Done                                                                 | Later Phases Should NOT...                                     |
| --------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Semantic Scholar Client** | `src/lib/citations/semantic-scholar.ts` with caching, rate limiting, retry  | Create alternate paper search clients; extend the existing one |
| **Citation Domain Logger**  | `citationLogger({ context })` factory in `src/lib/citations/logger.ts`      | Use bare `logger` in citation code; use the domain logger      |
| **Citation Constants**      | `src/lib/constants/citations.ts` with API limits, cache TTL, grace periods  | Hardcode citation-related magic values; add to constants       |
| **TipTap Citation Mark**    | `Citation` mark extension in `src/components/editor/extensions/citation.ts` | Create duplicate inline citation formatting; extend the mark   |
| **Citation Schemas**        | `src/lib/citations/schemas.ts` with Zod schemas for API validation          | Write inline validation; extend the schemas                    |
| **Citations API Helpers**   | `src/lib/api/citations.ts` with full CRUD operations                        | Write raw Supabase queries for citations; use the helpers      |

### Patterns Established (Must Follow in Later Phases)

| Pattern                         | Phase 5 Example                                       | Later Phases Must...                                   |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| **External API Client Pattern** | `searchPapersWithCache()` with TTL cache + rate limit | Follow caching/rate-limiting pattern for external APIs |
| **Client-Side Rate Limiting**   | Exponential backoff in `semantic-scholar.ts`          | Implement backoff for external service calls           |
| **Custom API Error Types**      | `SemanticScholarError` with `code`, `retryAfter`      | Create typed errors for external API integrations      |
| **TipTap Mark Extension**       | `Citation.create()` with `parseHTML`/`renderHTML`     | Follow mark pattern for inline formatted content       |
| **Junction Table Pattern**      | `document_citations` with metadata columns            | Use junction tables for many-to-many with context      |
| **Partial Index Pattern**       | `WHERE deleted_at IS NULL` in unique indexes          | Create partial indexes excluding soft-deleted records  |
| **Citation Formatter**          | `formatCitation(paper, style)` utility                | Add formatters for new citation/output styles          |

### How to Build an External API Client

```typescript
// Follow this pattern for all external API integrations
import { CITATIONS } from '@/lib/constants/citations';
import { citationLogger } from '@/lib/citations/logger';

// 1. Define custom error type
export class ExternalApiError extends Error {
  constructor(
    message: string,
    public code: 'RATE_LIMITED' | 'NOT_FOUND' | 'NETWORK_ERROR' | 'INVALID_RESPONSE',
    public statusCode?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

// 2. Implement in-memory cache with TTL
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// 3. Implement rate limiting state
let rateLimitState = { remaining: 100, resetAt: 0 };

// 4. Core fetch with retry and rate limiting
async function fetchWithRetry<T>(url: string, options: RequestInit = {}, maxRetries = 3): Promise<T> {
  const log = citationLogger({});

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check rate limit before request
    if (rateLimitState.remaining <= 0 && Date.now() < rateLimitState.resetAt) {
      const waitTime = rateLimitState.resetAt - Date.now();
      throw new ExternalApiError('Rate limited', 'RATE_LIMITED', 429, Math.ceil(waitTime / 1000));
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Update rate limit state from headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      if (remaining) rateLimitState.remaining = parseInt(remaining, 10);
      if (reset) rateLimitState.resetAt = parseInt(reset, 10) * 1000;

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        throw new ExternalApiError('Rate limited', 'RATE_LIMITED', 429, retryAfter);
      }

      if (!response.ok) {
        throw new ExternalApiError(
          `API error: ${response.statusText}`,
          response.status === 404 ? 'NOT_FOUND' : 'NETWORK_ERROR',
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ExternalApiError && error.code === 'RATE_LIMITED') {
        throw error; // Don't retry rate limits
      }

      if (attempt === maxRetries) {
        log.error({ error, url, attempt }, 'External API request failed');
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new ExternalApiError('Max retries exceeded', 'NETWORK_ERROR');
}

// 5. Public API with caching
export async function searchWithCache(query: string): Promise<SearchResult[]> {
  const cacheKey = `search:${query}`;
  const cached = getCached<SearchResult[]>(cacheKey);
  if (cached) return cached;

  const results = await fetchWithRetry<SearchResult[]>(`https://api.example.com/search?q=${encodeURIComponent(query)}`);

  setCache(cacheKey, results, CITATIONS.CACHE_TTL_MS);
  return results;
}

// 6. Cache management helpers
export function clearCache(): void {
  cache.clear();
}

export function resetRateLimitState(): void {
  rateLimitState = { remaining: 100, resetAt: 0 };
}
```

### How to Create a TipTap Mark Extension

```typescript
// Use this pattern for inline formatted content (citations, highlights, etc.)
import { Mark, mergeAttributes } from '@tiptap/core';

export interface CitationOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      setCitation: (attributes: { paperId: string; citationNumber: number }) => ReturnType;
      unsetCitation: () => ReturnType;
    };
  }
}

export const Citation = Mark.create<CitationOptions>({
  name: 'citation',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      paperId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-paper-id'),
        renderHTML: (attributes) => ({
          'data-paper-id': attributes.paperId,
        }),
      },
      citationNumber: {
        default: null,
        parseHTML: (element) => {
          const num = element.getAttribute('data-citation-number');
          return num ? parseInt(num, 10) : null;
        },
        renderHTML: (attributes) => ({
          'data-citation-number': attributes.citationNumber,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'cite[data-paper-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'cite',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'citation',
      }),
      0, // Content placeholder
    ];
  },

  addCommands() {
    return {
      setCitation:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetCitation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
```

### How to Create Junction Tables with Metadata

```sql
-- Junction table pattern for many-to-many with context
CREATE TABLE IF NOT EXISTS public.document_citations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Foreign keys to both related tables
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  citation_id uuid REFERENCES public.citations(id) ON DELETE CASCADE NOT NULL,

  -- Metadata specific to this relationship
  citation_number integer,           -- Order within document
  position jsonb,                    -- Location data

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Prevent duplicate relationships
  UNIQUE(document_id, citation_id)
);

-- Enable RLS
ALTER TABLE public.document_citations ENABLE ROW LEVEL SECURITY;

-- RLS policy through parent table
CREATE POLICY "Users can manage document_citations in own projects"
  ON public.document_citations FOR ALL
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.projects p ON d.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Helper function for auto-numbering
CREATE OR REPLACE FUNCTION public.get_next_citation_number(p_document_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(MAX(citation_number), 0) + 1
  FROM public.document_citations
  WHERE document_id = p_document_id;
$$ LANGUAGE sql STABLE;
```

### How to Create Partial Indexes

```sql
-- Partial indexes optimize queries that filter on specific conditions

-- 1. Unique index excluding soft-deleted records
CREATE UNIQUE INDEX citations_paper_id_project_id_idx
  ON public.citations(paper_id, project_id)
  WHERE paper_id IS NOT NULL AND deleted_at IS NULL;

-- 2. Index for soft-delete cleanup queries
CREATE INDEX citations_deleted_at_idx
  ON public.citations(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 3. Index for common listing queries (excludes deleted)
CREATE INDEX citations_project_created_idx
  ON public.citations(project_id, created_at DESC)
  WHERE deleted_at IS NULL;
```

### Production Considerations

| Component                | Limitation                                              | Production Solution                             |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------- |
| **API Client Cache**     | In-memory; lost on restart, not shared across instances | Use Redis or Upstash for distributed caching    |
| **Rate Limit State**     | In-memory; per-instance tracking                        | Use Redis for coordinated rate limiting         |
| **Semantic Scholar API** | 100 req/5min limit                                      | Implement request queuing or user-based quotas  |
| **Citation Formatter**   | Limited styles (APA, Chicago, MLA)                      | Add more styles as needed; consider CSL library |

---

## Phase 6 Implementation Status

### Infrastructure Permanently Complete (Do Not Recreate)

These are **one-time setups** that later phases automatically benefit from:

| Infrastructure            | What's Done                                                                      | Later Phases Should NOT...                              |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Export Module**         | `src/lib/export/` with barrel exports, types, DOCX/PDF functions                 | Create separate export utilities; extend the module     |
| **App Shell**             | `src/components/layout/AppShell.tsx` with responsive sidebar/mobile nav          | Create alternate layout wrappers; use AppShell          |
| **Accessibility CSS**     | `src/styles/accessibility.css` with focus-visible, touch targets, reduced motion | Redefine these patterns; import and use the classes     |
| **Custom Error Classes**  | `src/lib/errors.ts` with `AppError`, `NetworkError`, `NotFoundError`, etc.       | Create new error hierarchies; extend existing classes   |
| **Toast System**          | `useToast` hook + `ToastContainer` component                                     | Create alternate notification systems; use the toast    |
| **Toast Constants**       | `src/lib/constants/toast.ts` with timeouts and limits                            | Hardcode toast-related values; add to constants         |
| **Command Palette**       | `src/components/ui/CommandPalette.tsx` with Cmd+K activation                     | Create alternate command interfaces; extend the palette |
| **useMediaQuery Hook**    | `src/hooks/useMediaQuery.ts` for responsive breakpoints                          | Write custom media query logic; use the hook            |
| **E2E Timeout Constants** | `e2e/config/timeouts.ts` with `E2E_TIMEOUTS`                                     | Hardcode timeout values; add to constants               |
| **E2E Page Objects**      | `e2e/page-objects/` with BasePage, EditorPage, ProjectsPage                      | Put selectors directly in tests; create page objects    |
| **E2E Auth Fixtures**     | `e2e/fixtures/auth.ts` with persistent auth state                                | Re-authenticate in every test; use fixtures             |

### Patterns Established (Must Follow in Later Phases)

| Pattern                      | Phase 6 Example                                          | Later Phases Must...                                   |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| **Export API Route Pattern** | `/api/export/docx/route.ts` with validation, auth, audit | Follow pattern for new export formats (Markdown, etc.) |
| **Touch Target Minimum**     | `min-h-[44px] min-w-[44px]` on all interactive elements  | Ensure all buttons/links meet 44x44px minimum          |
| **Reduced Motion Support**   | `motion-reduce:animate-none` on animations               | Add `motion-reduce:` variants to all animations        |
| **Focus Management**         | `useEffect` + `ref.current?.focus()` in modals           | Manage focus when opening/closing modals and dialogs   |
| **ARIA Live Regions**        | `aria-live="polite"` on toast container                  | Use live regions for dynamic content announcements     |
| **Error Boundary Wrapping**  | `<ErrorBoundary>` around feature components              | Wrap risky components in error boundaries              |
| **Toast for User Feedback**  | `useToast().addToast('Success', 'success')`              | Use toasts for action feedback, not `alert()`          |
| **Command Registration**     | Add commands to `CommandPalette.tsx`                     | Register new navigation/action commands in palette     |
| **Page Object Pattern**      | `class EditorPage extends BasePage`                      | Create page objects for new E2E test areas             |
| **Accessibility Testing**    | `new AxeBuilder({ page }).analyze()`                     | Include axe-core checks in E2E tests                   |

### How to Add New Export Formats

```typescript
// 1. Create the export function in src/lib/export/
// src/lib/export/markdown.ts
export async function exportToMarkdown(htmlContent: string, options: MarkdownExportOptions): Promise<string> {
  // Convert HTML to Markdown
  // ...
}

// 2. Add types to src/lib/export/types.ts
export interface MarkdownExportOptions {
  title: string;
  includeMetadata?: boolean;
}

// 3. Update barrel export in src/lib/export/index.ts
export { exportToMarkdown } from './markdown';
export type { MarkdownExportOptions } from './types';

// 4. Create API route following the pattern
// src/app/api/export/markdown/route.ts
import { handleApiError } from '@/lib/api/handle-error';
import { unauthorizedError, validationError, notFoundError, forbiddenError } from '@/lib/api/error-response';
import { createAuditLog } from '@/lib/api/audit';

export async function GET(request: NextRequest) {
  // 1. Validate with Zod
  // 2. Authenticate user
  // 3. Fetch document with typed query
  // 4. Check authorization
  // 5. Call export function
  // 6. Audit log the export
  // 7. Return with proper Content-Type
}
```

### How to Show Toast Notifications

```typescript
'use client';

import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { addToast } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      addToast('Changes saved successfully', 'success');
    } catch (error) {
      addToast('Failed to save changes', 'error');
    }
  };

  // For different toast types:
  // addToast('Document created', 'success');  // Green, 5s timeout
  // addToast('Save failed', 'error');         // Red, 10s timeout (WCAG)
  // addToast('New version available', 'info'); // Blue, 5s timeout
  // addToast('Approaching limit', 'warning');  // Yellow, 5s timeout
}
```

### How to Create Accessible Modals/Dialogs

```typescript
'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ open, onClose, children }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 1. Focus management - focus first element when opened
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  // 2. Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* 3. Backdrop with reduced motion support */}
      <div
        className="fixed inset-0 bg-black/50 motion-reduce:transition-none"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* 4. Dialog with ARIA attributes */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Modal title"
        className="fixed ... motion-reduce:animate-none"
      >
        {/* 5. Close button with touch target */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] ..."
          aria-label="Close modal"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {children}
      </div>
    </>
  );
}
```

### How to Add Commands to Command Palette

```typescript
// In src/components/ui/CommandPalette.tsx

// 1. Add to Navigation group for page navigation
<Command.Group heading="Navigation">
  <Command.Item
    onSelect={() => runCommand(() => router.push('/your-page'))}
    className="flex items-center gap-2 px-3 min-h-[44px] rounded ..."
  >
    <YourIcon className="w-4 h-4 shrink-0" />
    Your Page Name
  </Command.Item>
</Command.Group>

// 2. Add to Actions group for operations
<Command.Group heading="Actions">
  <Command.Item
    onSelect={() => runCommand(() => performAction())}
    className="flex items-center gap-2 px-3 min-h-[44px] rounded ..."
  >
    <ActionIcon className="w-4 h-4 shrink-0" />
    Action Name
  </Command.Item>
</Command.Group>
```

### How to Write E2E Tests with Page Objects

```typescript
// 1. Create page object extending BasePage
// e2e/page-objects/YourPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class YourPage extends BasePage {
  readonly url = '/your-page';
  readonly mainElement: Locator;
  readonly actionButton: Locator;

  constructor(page: Page) {
    super(page);
    this.mainElement = page.locator('[data-testid="main-element"]');
    this.actionButton = page.getByRole('button', { name: /action/i });
  }

  async waitForLoad() {
    await super.waitForLoad();
    await expect(this.mainElement).toBeVisible();
  }

  async performAction() {
    await this.actionButton.click();
    // Return something useful for assertions
  }
}

// 2. Use in tests
// e2e/your-feature.spec.ts
import { test, expect } from './fixtures/auth';
import { YourPage } from './page-objects/YourPage';
import AxeBuilder from '@axe-core/playwright';

test.describe('Your Feature', () => {
  let yourPage: YourPage;

  test.beforeEach(async ({ page }) => {
    yourPage = new YourPage(page);
    await yourPage.goto();
  });

  test('performs action correctly', async () => {
    await yourPage.performAction();
    // Assert expected outcome
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

### Accessibility Checklist for New Components

Every new interactive component must:

- [ ] Meet 44x44px touch target minimum (`min-h-[44px] min-w-[44px]`)
- [ ] Have visible focus indicator (`:focus-visible` styles)
- [ ] Support reduced motion (`motion-reduce:animate-none`)
- [ ] Include appropriate ARIA attributes (`role`, `aria-label`, `aria-expanded`, etc.)
- [ ] Be keyboard accessible (Tab, Enter, Escape, Arrow keys as appropriate)
- [ ] Manage focus correctly when opening/closing
- [ ] Pass axe-core accessibility audit in E2E tests

### Production Considerations

| Component           | Limitation                              | Production Solution                                             |
| ------------------- | --------------------------------------- | --------------------------------------------------------------- |
| **PDF Export**      | Puppeteer uses memory; cold starts slow | Consider serverless function with warm instances or pre-warming |
| **Toast Queue**     | In-memory Zustand; lost on refresh      | Consider persisting critical notifications to localStorage      |
| **Command Palette** | Static commands only                    | Add dynamic commands based on context (current page, user role) |
| **E2E Auth State**  | File-based storage                      | Consider using database-backed test accounts in CI              |

---

## Table of Contents

1. [Phase 0 Implementation Status](#phase-0-implementation-status)
2. [Phase 1 Implementation Status](#phase-1-implementation-status)
3. [Phase 2 Implementation Status](#phase-2-implementation-status)
4. [Phase 3 Implementation Status](#phase-3-implementation-status)
5. [Phase 4 Implementation Status](#phase-4-implementation-status)
6. [Phase 5 Implementation Status](#phase-5-implementation-status)
7. [Phase 6 Implementation Status](#phase-6-implementation-status)
8. [Security](#security)
9. [Code Organization](#code-organization)
10. [TypeScript Patterns](#typescript-patterns)
11. [React Patterns](#react-patterns)
12. [Database & Performance](#database--performance)
13. [Authentication & Sessions](#authentication--sessions)
14. [Validation](#validation)
15. [Logging & Observability](#logging--observability)
16. [Design System Principles](#design-system-principles)
17. [Deployment & Operations](#deployment--operations)

---

## Security

### 1. Never Use String Interpolation for Database Queries

Always use parameterized queries to prevent SQL injection:

```typescript
// WRONG - SQL injection vulnerability
const query = `SELECT * FROM users WHERE email = '${email}'`;

// CORRECT - Parameterized query
const { data } = await supabase.from('users').select('*').eq('email', email);

// For raw SQL (when needed)
const { data } = await supabase.rpc('custom_function', { email_param: email });
```

### 2. Use Constant-Time Comparison for Secrets

API keys, tokens, and other secrets must use timing-safe comparison to prevent timing attacks:

```typescript
import crypto from 'crypto';

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to avoid timing leak on length
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// WRONG - leaks timing information
if (providedToken === storedToken) { ... }

// CORRECT - constant time
if (secureCompare(providedToken, storedToken)) { ... }
```

### 3. Hash Sensitive Tokens Before Storage

Verification tokens, password reset tokens, and similar values should be hashed before storing:

```typescript
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate token
const plainToken = crypto.randomBytes(32).toString('hex');
const hashedToken = hashToken(plainToken);

// Store hash in database, send plaintext to user
await db.insert({ token_hash: hashedToken, expires_at: ... });
sendEmail(user.email, `Your reset link: /reset?token=${plainToken}`);

// Verify by hashing the provided token
const providedHash = hashToken(providedToken);
const record = await db.findOne({ token_hash: providedHash });
```

### 4. Implement Access Control at the Database Level

Use Row Level Security (RLS) in Supabase to restrict access based on relationships:

```sql
-- Users can only see their own organization's data
CREATE POLICY "Users can view own organization data"
ON items FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Audit logs only visible to organization admins
CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id = audit_logs.organization_id
    AND role = 'admin'
  )
);
```

### 5. Always Validate Server-Side

Never trust client-side validation alone. Server actions and API routes must validate all input:

```typescript
// schemas/user.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

// app/api/users/route.ts
export async function POST(request: Request) {
  const body = await request.json();

  // Validate even though client already validated
  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
  }

  // Use validated data
  const { email, name, password } = result.data;
  // ...
}
```

### 6. Security Headers Checklist

Configure these headers in `next.config.ts`:

| Header                      | Value                                          | Purpose                |
| --------------------------- | ---------------------------------------------- | ---------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS           |
| `X-Frame-Options`           | `SAMEORIGIN`                                   | Prevents clickjacking  |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME sniffing |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Controls referrer      |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Restricts features     |
| `Content-Security-Policy`   | See below                                      | XSS protection         |

### 7. Rate Limiting Guidelines

| Endpoint       | Limit        | Window                   |
| -------------- | ------------ | ------------------------ |
| Login          | 5 attempts   | Per minute per IP        |
| Registration   | 3 attempts   | Per minute per IP        |
| Password reset | 3 requests   | Per 15 minutes per email |
| OAuth          | 10 attempts  | Per minute per IP        |
| API calls      | 100 requests | Per minute per user      |

---

## Code Organization

### 1. Create Barrel Exports From the Start

Every `src/lib/<module>/` directory should have an `index.ts` that exports its public API:

```typescript
// src/lib/auth/index.ts
export { login, logout, validateSession } from './auth-service';
export { hashPassword, verifyPassword } from './password';
export type { Session, User } from './types';

// Usage - clean imports
import { login, validateSession, type User } from '@/lib/auth';

// Instead of
import { login } from '@/lib/auth/auth-service';
import { validateSession } from '@/lib/auth/session';
import type { User } from '@/lib/auth/types';
```

### 2. Server Actions Should Delegate to Services

Server actions (`'use server'`) should be thin wrappers that call service functions:

```typescript
// lib/items/item-service.ts
export async function createItem(userId: string, data: CreateItemData) {
  // All business logic here
  const validated = createItemSchema.parse(data);
  const item = await db.items.create({ ...validated, userId });
  await auditLog('item:create', { userId, itemId: item.id });
  return item;
}

// app/actions/items.ts
('use server');

import { createItem } from '@/lib/items';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function createItemAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const data = Object.fromEntries(formData);
  const item = await createItem(session.userId, data);

  redirect(`/items/${item.id}`);
}
```

### 3. Extract Duplicated Logic Immediately

When you see the same pattern twice, extract it:

```typescript
// BEFORE - duplicated in multiple files
const errors = result.error.flatten();
return {
  error: Object.values(errors.fieldErrors).flat().join(', '),
};

// AFTER - shared utility
// lib/validation/format-errors.ts
export function formatZodErrors(error: ZodError): string {
  const flattened = error.flatten();
  return Object.values(flattened.fieldErrors).flat().join(', ');
}
```

Common candidates for extraction:

- Zod error formatting
- Password validation rules
- Find-or-create patterns
- Date formatting
- API response handling

### 4. Use Constants Files for Magic Values

```typescript
// lib/constants/auth.ts
export const AUTH = {
  SESSION_DURATION_DAYS: 7,
  SESSION_MAX_AGE_DAYS: 30,
  PASSWORD_MIN_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

// lib/constants/retention.ts
export const RETENTION = {
  AUDIT_LOGS_DAYS: 90,
  SOFT_DELETE_GRACE_PERIOD_DAYS: 7,
  UNDO_WINDOW_SECONDS: 10,
} as const;
```

### 5. Recommended Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Route groups for layouts
│   ├── api/               # API routes
│   └── actions/           # Server actions
├── components/
│   ├── ui/                # Design system components
│   ├── forms/             # Form components
│   └── [feature]/         # Feature-specific components
├── contexts/              # React context providers
├── hooks/                 # Custom React hooks
├── lib/
│   ├── [module]/          # Business logic modules
│   │   ├── index.ts       # Barrel export
│   │   ├── service.ts     # Service functions
│   │   ├── types.ts       # Module types
│   │   └── schemas.ts     # Zod schemas
│   ├── constants/         # App constants
│   ├── utils/             # Utility functions
│   └── db/                # Database client/helpers
├── types/                 # Global type definitions
└── styles/                # Global styles
```

### 6. Avoid Reserved Variable Names

Don't use `module`, `exports`, `require`, or other Node.js globals as variable names:

```typescript
// WRONG - 'module' is a reserved global
const module = await import('./config');

// CORRECT
const configModule = await import('./config');
const importedConfig = await import('./config');
```

---

## TypeScript Patterns

### 1. Type Database Query Results

Always provide type parameters to database queries:

```typescript
// With Supabase
interface User {
  id: string;
  email: string;
  name: string;
}

// WRONG - data is `any`
const { data } = await supabase.from('users').select('*').single();

// CORRECT - data is typed
const { data } = await supabase.from('users').select('*').single<User>();

// Even better - generate types from database schema
import { Database } from '@/types/supabase';
type User = Database['public']['Tables']['users']['Row'];
```

### 2. Type External Library Outputs at the Call Site

Many libraries return `any`. Cast immediately:

```typescript
// External calendar library
import ICAL from 'ical.js';

interface ParsedEvent {
  summary: string;
  start: Date;
  end: Date;
}

const parsed = ICAL.parse(icsData) as ICAL.Component;
const events = parsed.getAllSubcomponents('vevent') as ICAL.Component[];
```

### 3. Define Interfaces for Third-Party API Responses

```typescript
// lib/google/types.ts
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Usage
const response = await fetch('https://oauth2.googleapis.com/token', { ... });
const tokens = (await response.json()) as GoogleTokenResponse;
```

### 4. Prefer `unknown` Over `any` for Truly Unknown Data

```typescript
// WRONG
function processInput(data: any) {
  return data.value; // No type safety
}

// CORRECT
function processInput(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid input');
}

// Even better - use Zod for runtime validation
const inputSchema = z.object({ value: z.string() });

function processInput(data: unknown) {
  const parsed = inputSchema.parse(data);
  return parsed.value; // Fully typed
}
```

### 5. Use Discriminated Unions for Action Types

```typescript
type UndoableAction =
  | { type: 'item:delete'; itemId: string; previousData: Item }
  | { type: 'item:update'; itemId: string; previousData: Partial<Item> }
  | { type: 'organization:archive'; orgId: string };

function handleUndo(action: UndoableAction) {
  switch (action.type) {
    case 'item:delete':
      // TypeScript knows action has itemId and previousData
      return restoreItem(action.itemId, action.previousData);
    case 'item:update':
      return revertUpdate(action.itemId, action.previousData);
    case 'organization:archive':
      return unarchiveOrg(action.orgId);
  }
}
```

### 6. Type `response.json()` with Assertions

Fetch responses return `Promise<any>`:

```typescript
interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface User {
  id: string;
  name: string;
}

const response = await fetch('/api/users/123');
const result = (await response.json()) as ApiResponse<User>;

if (result.error) {
  throw new Error(result.error);
}

// result.data is typed as User
console.log(result.data.name);
```

---

## React Patterns

### 1. Add Providers to Layout Early

If a context will be needed globally, add its provider to the root layout during initial implementation:

```typescript
// app/layout.tsx
import { AuthProvider } from '@/contexts/auth';
import { ThemeProvider } from '@/contexts/theme';
import { ToastProvider } from '@/contexts/toast';
import { UndoProvider } from '@/contexts/undo';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <UndoProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </UndoProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2. Manage Resources with useRef + Cleanup

Stores, timers, and subscriptions should use useRef with cleanup:

```typescript
function usePolling(callback: () => void, interval: number) {
  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Update callback ref without causing effect to re-run
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);

    // Cleanup prevents memory leaks
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval]);
}
```

### 3. Implement Loading States for Async Buttons

Prevent duplicate clicks with loading state:

```typescript
function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onDelete();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? <Spinner /> : 'Delete'}
    </button>
  );
}
```

### 4. Intentional `exhaustive-deps` Exceptions

Sometimes effects should only trigger on specific property changes:

```typescript
function useOrganizationData(organization: Organization | null) {
  useEffect(() => {
    if (organization?.id) {
      fetchData(organization.id);
    }
    // Intentionally only depend on ID, not full object
    // This prevents re-fetching when other org properties change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);
}
```

### 5. Never Call Impure Functions During Render

```typescript
// WRONG - violates React's pure component rules
function Timer() {
  const now = Date.now(); // Called on every render!
  return <span>{now}</span>;
}

// CORRECT - use state and effect
function Timer() {
  const [now, setNow] = useState<number>();

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{now}</span>;
}
```

### 6. Handle React Hydration for Forms

React hydration resets controlled inputs. Add a hydration indicator:

```typescript
function LoginForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    formRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  return (
    <form ref={formRef} data-hydrated={isHydrated}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Database & Performance

### 1. Design Indexes with Query Patterns

Add indexes during initial schema design for known patterns:

```sql
-- Common queries to optimize
CREATE INDEX idx_items_organization ON items(organization_id);
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_org_status ON items(organization_id, status);

-- Composite index for common filter + sort
CREATE INDEX idx_events_org_date ON events(organization_id, start_date);
```

### 2. Use Batch Operations for Cleanup

Single batch queries are dramatically faster than individual deletions:

```typescript
// WRONG - N+1 queries
for (const id of idsToDelete) {
  await supabase.from('items').delete().eq('id', id);
}

// CORRECT - single batch operation
await supabase.from('items').delete().in('id', idsToDelete);

// For complex conditions
await supabase.from('audit_logs').delete().lt('created_at', ninetyDaysAgo);
```

### 3. Plan Retention Periods Upfront

Define during design, not as an afterthought:

| Data Type                 | Retention    | Cleanup Frequency |
| ------------------------- | ------------ | ----------------- |
| Audit logs                | 90 days      | Daily             |
| Job run history           | 30 days      | Daily             |
| Soft-deleted records      | 7 days grace | Daily             |
| Session tokens            | 30 days max  | Hourly            |
| Email verification tokens | 24 hours     | Hourly            |

### 4. Use Deep Equality for Change Detection

```typescript
// WRONG - only compares references
if (prevData !== newData) {
  saveChanges(newData);
}

// CORRECT - compares values
import isEqual from 'lodash/isEqual';

if (!isEqual(prevData, newData)) {
  saveChanges(newData);
}

// Or with JSON (works for simple objects)
if (JSON.stringify(prevData) !== JSON.stringify(newData)) {
  saveChanges(newData);
}
```

### 5. Soft Delete Pattern

Implement soft delete with grace periods:

```typescript
// Schema
interface SoftDeletable {
  deleted_at: string | null;
}

// Delete (soft)
await supabase.from('organizations').update({ deleted_at: new Date().toISOString() }).eq('id', orgId);

// Query (exclude deleted)
await supabase.from('organizations').select('*').is('deleted_at', null);

// Restore (undo)
await supabase.from('organizations').update({ deleted_at: null }).eq('id', orgId);

// Cleanup job (permanent delete after grace period)
const gracePeriodAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
await supabase.from('organizations').delete().lt('deleted_at', gracePeriodAgo.toISOString());
```

---

## Authentication & Sessions

### 1. Session Management Best Practices

```typescript
const SESSION_CONFIG = {
  DURATION_DAYS: 7, // Idle timeout
  MAX_AGE_DAYS: 30, // Absolute timeout
  COOKIE_NAME: 'session_token',
  COOKIE_OPTIONS: {
    httpOnly: true, // No JavaScript access
    secure: true, // HTTPS only
    sameSite: 'lax' as const, // Required for OAuth
    path: '/',
  },
};
```

### 2. OAuth Requires `sameSite: 'lax'`

OAuth redirect chains won't work with `sameSite: 'strict'` because cookies aren't sent after the OAuth provider redirects back:

```typescript
// WRONG - OAuth will fail
cookies().set('session', token, { sameSite: 'strict' });

// CORRECT - works with OAuth
cookies().set('session', token, { sameSite: 'lax' });
```

### 3. Server Actions Authenticate via Cookies

Don't rely on client-side auth state:

```typescript
// WRONG - client auth state may be stale
'use server';

export async function updateProfile(data: ProfileData) {
  const user = useAuth(); // This doesn't work in server actions!
  // ...
}

// CORRECT - validate session from cookie
('use server');

export async function updateProfile(data: ProfileData) {
  const session = await getSession(); // Reads from cookie
  if (!session) {
    throw new Error('Unauthorized');
  }

  // Use session.userId for database operations
  await db.users.update(session.userId, data);
}
```

### 4. Handle Missing Session Fields

Database queries may not return all fields depending on RLS policies:

```typescript
interface Session {
  id: string;
  user_id: string;
  created_at?: string; // May be hidden by RLS
  expires_at: string;
}

function isSessionExpired(session: Session): boolean {
  // Handle potentially missing created_at
  if (!session.expires_at) {
    return true; // Fail safe
  }
  return new Date(session.expires_at) < new Date();
}
```

---

## Validation

### 1. Zod Schema Patterns

```typescript
// Reusable field schemas
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

// Composed schemas
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

### 2. Format Zod Errors Consistently

```typescript
// lib/validation/format-errors.ts
import { ZodError } from 'zod';

export function formatZodError(error: ZodError): string {
  return error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
}

export function getFieldErrors(error: ZodError): Record<string, string> {
  const flattened = error.flatten();
  const result: Record<string, string> = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length > 0) {
      result[field] = messages[0];
    }
  }

  return result;
}
```

### 3. Validate at System Boundaries

Validate data at entry points, trust it internally:

```typescript
// API route - validate incoming request
export async function POST(request: Request) {
  const body = await request.json();
  const data = createItemSchema.parse(body); // Throws on invalid

  // data is now trusted within the application
  return await itemService.create(data);
}

// Internal service - no need to re-validate
async function create(data: CreateItemInput) {
  // data is already validated, just use it
  return await db.items.create(data);
}
```

---

## Logging & Observability

### 1. Use a Structured Logger

Never use `console.log` in production code:

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Usage
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ error, requestId }, 'Failed to process request');
logger.warn({ threshold, current }, 'Rate limit approaching');
```

### 2. Audit Logging Pattern

Log all significant operations:

```typescript
interface AuditLog {
  id: string;
  user_id: string;
  organization_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

async function auditLog(
  userId: string,
  action: string,
  resource: { type: string; id: string },
  changes?: Record<string, unknown>
) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resource.type,
    resource_id: resource.id,
    changes,
  });
}

// Usage
await auditLog(
  session.userId,
  'item:update',
  { type: 'item', id: item.id },
  {
    name: { old: oldName, new: newName },
  }
);
```

### 3. Document During Implementation

Add JSDoc comments as you write code:

```typescript
/**
 * Creates a new session for the authenticated user.
 *
 * @param userId - The ID of the user to create a session for
 * @param options - Session configuration options
 * @returns The created session with token
 *
 * @example
 * const session = await createSession(user.id, { rememberMe: true });
 * setCookie('session', session.token);
 */
export async function createSession(userId: string, options: SessionOptions = {}): Promise<Session> {
  // ...
}
```

---

## Design System Principles

### 1. Touch Target Minimums

- **Standard interactive elements**: 44x44px minimum
- **Mobile/tablet**: 48x48px recommended
- **Dense lists**: 44x44px with 8px spacing

### 2. Focus States

Clear, visible focus indicators for accessibility:

```css
.focus-ring:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

### 3. Reduced Motion Support

Always respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 4. Color Contrast

- **Body text**: Minimum 4.5:1 ratio (WCAG AA)
- **Large text (18px+)**: Minimum 3:1 ratio
- **Interactive boundaries**: Minimum 3:1 against adjacent colors

### 5. Semantic Color Variables

```css
:root {
  /* Semantic colors - not named by hue */
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Use semantic names in components */
  --color-button-primary: var(--color-accent);
  --color-button-danger: var(--color-error);
}
```

---

## Deployment & Operations

### 1. Environment Variable Management

```bash
# .env.example (commit this)
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
SESSION_SECRET=generate-with-openssl

# .env (never commit)
DATABASE_URL=postgresql://actual-connection-string
GOOGLE_CLIENT_SECRET=actual-secret
```

### 2. API Key Rotation Schedule

| Key                     | Rotation Frequency        |
| ----------------------- | ------------------------- |
| OAuth client secrets    | Annually or on compromise |
| API keys (third-party)  | Quarterly                 |
| Session encryption keys | Annually                  |
| Database passwords      | Quarterly                 |

### 3. Health Check Endpoints

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    external: await checkExternalServices(),
  };

  const healthy = Object.values(checks).every((c) => c.status === 'ok');

  return Response.json({ status: healthy ? 'healthy' : 'degraded', checks }, { status: healthy ? 200 : 503 });
}
```

### 4. Docker Security

- **Non-root user**: Run app as non-root in container
- **Resource limits**: Set CPU and memory limits
- **Network isolation**: Use isolated Docker networks
- **Image pinning**: Use specific versions, not `latest`

```dockerfile
# Run as non-root user
RUN addgroup --system app && adduser --system --group app
USER app

# In docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### 5. Security Checklist (Pre-Production)

- [ ] All secrets in `.env`, not in code
- [ ] `.env` in `.gitignore`
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] CSRF protection enabled
- [ ] Rate limiting enabled
- [ ] Admin routes protected
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] 2FA enabled on cloud accounts
- [ ] Database backups configured
- [ ] Monitoring and alerting set up

---

## Quick Reference

### Common Patterns

```typescript
// Safe JSON parsing
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Retry with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 1000): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(baseDelay * Math.pow(2, attempt - 1));
    }
  }
  throw new Error('Unreachable');
}

// Type-safe environment variables
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

### Error Handling Pattern

```typescript
// Custom error classes
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

// Usage
if (!item) {
  throw new NotFoundError('Item', itemId);
}
```
