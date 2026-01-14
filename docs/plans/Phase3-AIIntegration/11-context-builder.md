# Task 3.11: Context Builder

> **Phase 3** | [← SSE API Route](./10-sse-api-route.md) | [Next: Selection Tracker →](./12-selection-tracker.md)

---

## Context

**This task creates the context builder module for assembling AI prompts with relevant document context.** This enables the AI to have awareness of the current document, vault references, and operation history while respecting token budgets.

### Prerequisites

- **Task 3.1** completed (AI Type Definitions) - provides operation types

### What This Task Creates

- `src/lib/ai/context-builder.ts` - Context formatting functions
- `src/lib/ai/__tests__/context-builder.test.ts` - Context builder tests

### Tasks That Depend on This

- **Task 3.13** (Selection Toolbar) - may use context building

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.7** (Streaming Module)
- **Task 3.8** (AI State Store)
- **Task 3.9** (useAIStream Hook)

---

## Files to Create/Modify

- `src/lib/ai/context-builder.ts` (create)
- `src/lib/ai/__tests__/context-builder.test.ts` (create)

---

## Steps

### Step 1: Write the failing test

```typescript
// src/lib/ai/__tests__/context-builder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatContextForPrompt, buildPromptWithContext } from '../context-builder';

describe('formatContextForPrompt', () => {
  it('should format context with document content', () => {
    const context = {
      documentContent: 'My document',
      vaultContext: [],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toContain('## Current Document');
    expect(formatted).toContain('My document');
  });

  it('should include vault context', () => {
    const context = {
      documentContent: 'Doc',
      vaultContext: ['[From paper.pdf]: Research content'],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toContain('## Reference Materials');
    expect(formatted).toContain('paper.pdf');
  });

  it('should truncate long documents', () => {
    const context = {
      documentContent: 'x'.repeat(50000),
      vaultContext: [],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toContain('[Document truncated]');
    expect(formatted.length).toBeLessThan(40000);
  });

  it('should return empty string for empty context', () => {
    const context = {
      documentContent: '',
      vaultContext: [],
      recentChat: [],
    };

    const formatted = formatContextForPrompt(context);

    expect(formatted).toBe('');
  });
});

describe('buildPromptWithContext', () => {
  it('should include operation-specific instructions', () => {
    const context = {
      documentContent: 'Doc',
      vaultContext: [],
      recentChat: [],
    };

    const selectionPrompt = buildPromptWithContext('improve this', context, 'selection');
    expect(selectionPrompt).toContain('selected portion');

    const cursorPrompt = buildPromptWithContext('write more', context, 'cursor');
    expect(cursorPrompt).toContain('cursor position');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/context-builder.test.ts
```

**Expected:** FAIL with "Cannot find module '../context-builder'"

### Step 3: Write minimal implementation

```typescript
// src/lib/ai/context-builder.ts
import { AI } from '@/lib/constants/ai';

export interface AIContext {
  documentContent: string;
  vaultContext: string[];
  recentChat: string[];
  recentOperations?: Array<{
    type: string;
    input: string;
    output: string;
    status: string;
  }>;
  citations?: Array<{
    shortRef: string;
    title: string;
  }>;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatContextForPrompt(context: AIContext): string {
  const parts: string[] = [];
  let tokenCount = 0;

  if (context.documentContent) {
    const docSection = `## Current Document\n${context.documentContent}`;
    const docTokens = estimateTokens(docSection);

    if (tokenCount + docTokens < AI.MAX_CONTEXT_TOKENS * 0.6) {
      parts.push(docSection);
      tokenCount += docTokens;
    } else {
      const maxChars = (AI.MAX_CONTEXT_TOKENS * 0.6 - tokenCount) * 4;
      parts.push(`## Current Document\n${context.documentContent.slice(0, maxChars)}...\n[Document truncated]`);
      tokenCount = AI.MAX_CONTEXT_TOKENS * 0.6;
    }
  }

  if (context.recentOperations && context.recentOperations.length > 0) {
    const opsSection = `## Recent AI Operations (for context)\n${context.recentOperations
      .map((op) => `- ${op.type}: "${op.input.slice(0, 50)}..." → ${op.status}`)
      .join('\n')}`;
    const opsTokens = estimateTokens(opsSection);

    if (tokenCount + opsTokens < AI.MAX_CONTEXT_TOKENS * 0.7) {
      parts.push(opsSection);
      tokenCount += opsTokens;
    }
  }

  if (context.vaultContext.length > 0) {
    const remainingBudget = AI.MAX_CONTEXT_TOKENS - tokenCount - 500;
    let vaultSection = '## Reference Materials\n';
    let vaultTokens = estimateTokens(vaultSection);

    for (const chunk of context.vaultContext) {
      const chunkTokens = estimateTokens(chunk);
      if (vaultTokens + chunkTokens < remainingBudget) {
        vaultSection += chunk + '\n\n';
        vaultTokens += chunkTokens;
      } else {
        break;
      }
    }

    if (vaultSection !== '## Reference Materials\n') {
      parts.push(vaultSection.trim());
      tokenCount += vaultTokens;
    }
  }

  if (context.citations && context.citations.length > 0) {
    const citSection = `## Available Citations\n${context.citations
      .map((c) => `- ${c.shortRef}: "${c.title}"`)
      .join('\n')}`;
    const citTokens = estimateTokens(citSection);

    if (tokenCount + citTokens < AI.MAX_CONTEXT_TOKENS) {
      parts.push(citSection);
    }
  }

  return parts.join('\n\n');
}

export function buildPromptWithContext(
  userPrompt: string,
  context: AIContext,
  operationType: 'selection' | 'cursor' | 'global' | 'chat'
): string {
  const formattedContext = formatContextForPrompt(context);

  const systemInstructions: Record<string, string> = {
    selection:
      'You are helping edit a selected portion of an academic document. Keep the same style and tone as the surrounding content.',
    cursor:
      'You are generating new content to be inserted at the cursor position in an academic document. Match the existing style.',
    global:
      'You are making changes across an entire academic document. Preserve the structure and improve consistency.',
    chat: 'You are a writing assistant helping with an academic grant proposal. Provide helpful, specific advice.',
  };

  return `${systemInstructions[operationType]}

${formattedContext}

User request: ${userPrompt}`;
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/context-builder.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/context-builder.ts src/lib/ai/__tests__/context-builder.test.ts
git commit -m "feat(ai): add context builder with token budget management"
```

---

## Verification Checklist

- [ ] `src/lib/ai/context-builder.ts` exists
- [ ] `src/lib/ai/__tests__/context-builder.test.ts` exists
- [ ] Tests pass: `npm test src/lib/ai/__tests__/context-builder.test.ts`
- [ ] `formatContextForPrompt` is exported
- [ ] `buildPromptWithContext` is exported
- [ ] Long documents are truncated with indicator
- [ ] Token budget is respected
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.12: Selection Tracker](./12-selection-tracker.md)**.
