# Task 4.2: Intent Detection

> **Phase 4** | [← ChatContext](./01-chat-context.md) | [Next: Chat Components →](./03-chat-components.md)

---

## Context

**This task creates the intent detection system for classifying user messages.** It determines whether a message is a discussion, global edit request, or research query, enabling mode-specific UI feedback and behavior.

### Design System Integration

Intent detection results map directly to ModeIndicator visual states from `docs/design-system.md`:

| Detected Mode | UI Styling                                             | Icon          | Description                |
| ------------- | ------------------------------------------------------ | ------------- | -------------------------- |
| `discussion`  | `bg-info-light text-info-dark border-info/20`          | MessageCircle | General Q&A mode           |
| `global_edit` | `bg-warning-light text-warning-dark border-warning/20` | Edit3         | Document modification mode |
| `research`    | `bg-success-light text-success-dark border-success/20` | Search        | Citation/research mode     |

The `isDestructiveEdit()` function triggers a ConfirmDialog with `variant="danger"`:

- Dialog uses `bg-error-light text-error` icon styling
- Confirm button uses `bg-error hover:bg-error-dark`

### Prerequisites

- **Task 4.1** completed (ChatContext with mode types)

### E2E Test Dependencies

> **Note:** E2E tests in this task depend on `ClaudeCLIMock` created in **Task 4.3**. When implementing E2E tests, ensure Task 4.3 is completed first or stub the mock locally.

### What This Task Creates

- `src/lib/ai/intent-detection.ts` - Detection logic with patterns
- `src/lib/ai/__tests__/intent-detection.test.ts` - Unit tests

### Tasks That Depend on This

- **Task 4.3** (Chat Components) - ModeIndicator uses ChatMode type
- **Task 4.5** (API Helpers) - Uses mode detection
- **Task 4.8** (ChatSidebar) - Displays detected mode

### Parallel Tasks

This task can be done in parallel with:

- **Task 4.3** (Chat Components)
- **Task 4.4** (Diff Utilities)

---

## Files to Create/Modify

- `src/lib/ai/intent-detection.ts` (create)
- `src/lib/ai/__tests__/intent-detection.test.ts` (create)

---

## Task 6: Intent Detection - Discussion Mode

### Step 1: Write failing test for discussion mode detection

Create `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectChatMode } from '../intent-detection';

describe('detectChatMode', () => {
  it('should return discussion mode for general questions', () => {
    const result = detectChatMode('Can you explain this paragraph?');
    expect(result.mode).toBe('discussion');
  });

  it('should return discussion mode for simple requests', () => {
    const result = detectChatMode('What do you think about this?');
    expect(result.mode).toBe('discussion');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** FAIL - module not found

### Step 3: Write minimal implementation

Create `src/lib/ai/intent-detection.ts`:

```typescript
export type ChatMode = 'discussion' | 'global_edit' | 'research';

export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

export function detectChatMode(message: string): ModeDetectionResult {
  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add intent detection with discussion mode default"
```

---

## Task 7: Intent Detection - Global Edit Mode

### Step 1: Write failing tests for global edit patterns

Add to `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
describe('global_edit mode', () => {
  it('should detect edit for "change all" patterns', () => {
    const result = detectChatMode('Change all instances of "the" to "a"');
    expect(result.mode).toBe('global_edit');
  });

  it('should detect edit for "throughout" patterns', () => {
    const result = detectChatMode('Make the tone more formal throughout');
    expect(result.mode).toBe('global_edit');
  });

  it('should detect edit for "everywhere" patterns', () => {
    const result = detectChatMode('Fix grammar everywhere');
    expect(result.mode).toBe('global_edit');
  });

  it('should detect edit for "rewrite entire" patterns', () => {
    const result = detectChatMode('Rewrite the entire introduction');
    expect(result.mode).toBe('global_edit');
  });

  it('should have high confidence for multiple edit pattern matches', () => {
    const result = detectChatMode('Change all headings throughout the entire document');
    expect(result.mode).toBe('global_edit');
    expect(result.confidence).toBe('high');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** FAIL - mode is still 'discussion'

### Step 3: Implement edit pattern detection

Update `src/lib/ai/intent-detection.ts`:

```typescript
export type ChatMode = 'discussion' | 'global_edit' | 'research';

export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

interface Pattern {
  pattern: RegExp;
  weight: number;
  description: string;
}

const EDIT_PATTERNS: Pattern[] = [
  { pattern: /\b(change|modify|update|edit)\s+(?:all|every|each)/i, weight: 3, description: 'bulk change' },
  { pattern: /\bthroughout\s+(the\s+)?(document|text|entire)/i, weight: 3, description: 'throughout document' },
  { pattern: /\beverywhere\b/i, weight: 2, description: 'everywhere' },
  { pattern: /\ball\s+(sections?|paragraphs?|headings?|sentences?)\b/i, weight: 2, description: 'all sections' },
  { pattern: /\breplace\s+(?:all|every)/i, weight: 3, description: 'replace all' },
  { pattern: /\bremove\s+(?:all|every)/i, weight: 3, description: 'remove all' },
  { pattern: /\bdelete\s+(?:all|every)/i, weight: 3, description: 'delete all' },
  { pattern: /\brewrite\s+(the\s+)?(entire|whole|document)/i, weight: 3, description: 'rewrite document' },
  { pattern: /\bfix\s+(all|every)\s+/i, weight: 2, description: 'fix all' },
];

export function detectChatMode(message: string): ModeDetectionResult {
  let editScore = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, weight, description } of EDIT_PATTERNS) {
    if (pattern.test(message)) {
      editScore += weight;
      matchedPatterns.push(`edit:${description}`);
    }
  }

  const confidence: 'high' | 'medium' | 'low' = editScore >= 5 ? 'high' : editScore >= 3 ? 'medium' : 'low';

  if (editScore >= 2) {
    return { mode: 'global_edit', confidence, matchedPatterns };
  }

  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add global edit pattern detection"
```

---

## Task 8: Intent Detection - Research Mode

### Step 1: Write failing tests for research patterns

Add to `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
describe('research mode', () => {
  it('should detect research for "find papers" patterns', () => {
    const result = detectChatMode('Find papers on machine learning');
    expect(result.mode).toBe('research');
  });

  it('should detect research for citation requests', () => {
    const result = detectChatMode('Can you cite sources for this claim?');
    expect(result.mode).toBe('research');
  });

  it('should detect research for recent research queries', () => {
    const result = detectChatMode('What are recent studies on climate change?');
    expect(result.mode).toBe('research');
  });

  it('should detect research for literature review requests', () => {
    const result = detectChatMode('Help me with the literature review on this topic');
    expect(result.mode).toBe('research');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** FAIL - returns 'discussion' instead of 'research'

### Step 3: Add research pattern detection

Update `src/lib/ai/intent-detection.ts` to add research patterns:

```typescript
const RESEARCH_PATTERNS: Pattern[] = [
  {
    pattern: /\b(find|search\s+for|look\s+up)\s+.*(paper|study|article|research)/i,
    weight: 3,
    description: 'find papers',
  },
  { pattern: /\bcite|citation|reference\b/i, weight: 2, description: 'citation request' },
  {
    pattern: /\brecent\s+(papers?|studies?|research|findings?|publications?)\b/i,
    weight: 3,
    description: 'recent research',
  },
  { pattern: /\bsources?\s+(for|about|on)\b/i, weight: 2, description: 'sources for' },
  { pattern: /\bliterature\s+(review|search|on)\b/i, weight: 3, description: 'literature review' },
  { pattern: /\bpeer[- ]reviewed\b/i, weight: 2, description: 'peer reviewed' },
  { pattern: /\b(doi|pmid|pubmed|arxiv)\b/i, weight: 3, description: 'database reference' },
];

export function detectChatMode(message: string): ModeDetectionResult {
  let editScore = 0;
  let researchScore = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, weight, description } of EDIT_PATTERNS) {
    if (pattern.test(message)) {
      editScore += weight;
      matchedPatterns.push(`edit:${description}`);
    }
  }

  for (const { pattern, weight, description } of RESEARCH_PATTERNS) {
    if (pattern.test(message)) {
      researchScore += weight;
      matchedPatterns.push(`research:${description}`);
    }
  }

  const maxScore = Math.max(editScore, researchScore);
  const confidence: 'high' | 'medium' | 'low' = maxScore >= 5 ? 'high' : maxScore >= 3 ? 'medium' : 'low';

  if (editScore > researchScore && editScore >= 2) {
    return { mode: 'global_edit', confidence, matchedPatterns };
  }
  if (researchScore > editScore && researchScore >= 2) {
    return { mode: 'research', confidence, matchedPatterns };
  }

  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add research mode pattern detection"
```

---

## Task 9: Intent Detection - Destructive Edit Warning

### Step 1: Write failing tests for destructive edit detection

Add to `src/lib/ai/__tests__/intent-detection.test.ts`:

```typescript
import { detectChatMode, isDestructiveEdit } from '../intent-detection';

describe('isDestructiveEdit', () => {
  it('should return true for delete all', () => {
    expect(isDestructiveEdit('Delete all paragraphs about methodology')).toBe(true);
  });

  it('should return true for remove everything', () => {
    expect(isDestructiveEdit('Remove everything after the introduction')).toBe(true);
  });

  it('should return true for rewrite entire document', () => {
    expect(isDestructiveEdit('Rewrite the entire document')).toBe(true);
  });

  it('should return false for non-destructive edits', () => {
    expect(isDestructiveEdit('Change the word "good" to "excellent"')).toBe(false);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** FAIL - isDestructiveEdit not exported

### Step 3: Add isDestructiveEdit function

Add to `src/lib/ai/intent-detection.ts`:

```typescript
export function isDestructiveEdit(message: string): boolean {
  const destructivePatterns = [
    /\bdelete\s+(all|every|the\s+entire)/i,
    /\bremove\s+(all|every|everything|the\s+entire)/i,
    /\brewrite\s+(the\s+)?(entire|whole)/i,
    /\breplace\s+(all|everything)/i,
    /\bclear\s+(all|the\s+)/i,
  ];

  return destructivePatterns.some((p) => p.test(message));
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/intent-detection.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/intent-detection.ts src/lib/ai/__tests__/intent-detection.test.ts
git commit -m "feat: add destructive edit detection for warnings"
```

---

## Verification Checklist

- [ ] Discussion mode default test passes
- [ ] Global edit pattern tests pass
- [ ] Research mode pattern tests pass
- [ ] Destructive edit detection tests pass
- [ ] All tests run without errors: `npm test src/lib/ai/__tests__/intent-detection.test.ts`
- [ ] Changes committed (4 commits for Tasks 6-9)

---

## E2E Tests for Intent Detection

### Required E2E Test File: `e2e/chat/intent-detection.spec.ts`

Create E2E tests that verify visual feedback for intent detection in real browser scenarios:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { ChatPage } from '../pages/ChatPage';
import { ClaudeCLIMock } from '../fixtures/claude-cli-mock';

test.describe('Intent Detection Visual Feedback', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    chatPage = new ChatPage(page);
    await chatPage.goto(workerCtx.projectId, workerCtx.documentId);
    await chatPage.open();
  });

  test('typing "explain this" shows Discussion mode indicator', async ({ page }) => {
    await chatPage.typeMessage('explain this paragraph');
    await expect(chatPage.modeIndicator).toContainText('Discussion');
    await expect(chatPage.modeIndicator).toHaveAttribute('data-mode', 'discussion');
  });

  test('typing "change all headings" shows Global Edit mode indicator', async ({ page }) => {
    await chatPage.typeMessage('change all headings to title case');
    await expect(chatPage.modeIndicator).toContainText('Global Edit');
    await expect(chatPage.modeIndicator).toHaveAttribute('data-mode', 'global_edit');
  });

  test('typing "find papers" shows Research mode indicator', async ({ page }) => {
    await chatPage.typeMessage('find papers on machine learning');
    await expect(chatPage.modeIndicator).toContainText('Research');
    await expect(chatPage.modeIndicator).toHaveAttribute('data-mode', 'research');
  });

  test('typing "delete all paragraphs" triggers ConfirmDialog warning', async ({ page }) => {
    await chatPage.typeMessage('delete all empty paragraphs');
    await chatPage.sendButton.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText('destructive')).toBeVisible();
  });

  test('ConfirmDialog Cancel button aborts destructive edit without changes', async ({ page }) => {
    // Type destructive edit request
    await chatPage.typeMessage('delete all paragraphs');
    await chatPage.sendButton.click();

    // Wait for ConfirmDialog
    await expect(page.getByRole('alertdialog')).toBeVisible();

    // Click Cancel
    await page.getByTestId('confirm-cancel').click();

    // Dialog should close
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // No request should be sent (input still has value)
    await expect(chatPage.input).toHaveValue('delete all paragraphs');
  });

  test('ConfirmDialog Confirm button proceeds with destructive edit', async ({ page }) => {
    // Register mock for the destructive edit
    const claudeMock = new ClaudeCLIMock();
    await claudeMock.setupRoutes(page);
    claudeMock.registerResponse('delete all', { content: 'Content deleted.' });

    // Type destructive edit request
    await chatPage.typeMessage('delete all paragraphs');
    await chatPage.sendButton.click();

    // Wait for ConfirmDialog
    await expect(page.getByRole('alertdialog')).toBeVisible();

    // Click Confirm
    await page.getByTestId('confirm-confirm').click();

    // Dialog should close and request should proceed
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Input should be cleared (message sent)
    await expect(chatPage.input).toHaveValue('');

    // Response should arrive
    await chatPage.waitForStreamingComplete();
    const messages = await page.getByTestId('chat-message');
    await expect(messages.last()).toContainText('Content deleted');
  });

  test('mode indicator updates dynamically as user types', async ({ page }) => {
    // Start with discussion text
    await chatPage.typeMessage('what do you think');
    await expect(chatPage.modeIndicator).toHaveAttribute('data-mode', 'discussion');

    // Clear and type edit text
    await chatPage.input.clear();
    await chatPage.typeMessage('change all instances');
    await expect(chatPage.modeIndicator).toHaveAttribute('data-mode', 'global_edit');
  });
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/chat/intent-detection.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 4.3.

---

## Next Steps

After this task, proceed to **[Task 4.3: Chat Components](./03-chat-components.md)**.
