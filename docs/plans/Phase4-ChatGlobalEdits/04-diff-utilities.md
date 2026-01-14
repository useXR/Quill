# Task 4.4: Diff Utilities

> **Phase 4** | [← Chat Components](./03-chat-components.md) | [Next: API Helpers →](./05-api-helpers.md)

---

## Context

**This task creates the diff generation and application utilities.** These functions compare original and modified content, generate structured diff output, and allow selective application of changes.

### Design System Integration

The diff utilities produce `DiffChange` objects that are styled by the DiffPanel component using design system tokens from `docs/design-system.md`:

| Change Type | Visual Styling                       | Purpose               |
| ----------- | ------------------------------------ | --------------------- |
| `add`       | `bg-success-light text-success-dark` | Added content (green) |
| `remove`    | `bg-error-light text-error-dark`     | Removed content (red) |
| `unchanged` | No styling (skipped in UI)           | Context lines         |

The `getDiffStats()` function provides counts displayed with `font-ui text-sm text-ink-secondary`.

### Prerequisites

- **Task 4.1** completed (ChatContext foundation)

### What This Task Creates

- `src/lib/ai/diff-generator.ts` - Diff generation and application functions
- `src/lib/ai/__tests__/diff-generator.test.ts` - Unit tests

### Tasks That Depend on This

- **Task 4.6** (API Routes) - Global edit route uses generateDiff
- **Task 4.9** (DiffPanel) - Uses all diff functions
- **Task 4.10** (Integration) - DiffPanelWrapper uses applyDiffChanges

### Parallel Tasks

This task can be done in parallel with:

- **Task 4.2** (Intent Detection)
- **Task 4.3** (Chat Components)

---

## Files to Create/Modify

- `src/lib/ai/diff-generator.ts` (create)
- `src/lib/ai/__tests__/diff-generator.test.ts` (create)

---

## Task 13: Diff Generator Library

### Step 1: Install diff library

```bash
npm install diff
npm install -D @types/diff
```

### Step 2: Write failing tests for diff generation

Create `src/lib/ai/__tests__/diff-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateDiff, getDiffStats } from '../diff-generator';

describe('generateDiff', () => {
  it('should detect added lines', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';

    const diff = generateDiff(original, modified);
    const additions = diff.filter((d) => d.type === 'add');

    expect(additions.length).toBeGreaterThan(0);
  });

  it('should detect removed lines', () => {
    const original = 'Line 1\nLine 2\nLine 3';
    const modified = 'Line 1\nLine 3';

    const diff = generateDiff(original, modified);
    const removals = diff.filter((d) => d.type === 'remove');

    expect(removals.length).toBeGreaterThan(0);
  });

  it('should detect unchanged lines', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nLine 2';

    const diff = generateDiff(original, modified);
    const unchanged = diff.filter((d) => d.type === 'unchanged');

    expect(unchanged.length).toBeGreaterThan(0);
  });
});

describe('getDiffStats', () => {
  it('should count additions, deletions, and unchanged', () => {
    const diff = [
      { type: 'unchanged' as const, value: 'Line 1\n', lineNumber: 1 },
      { type: 'remove' as const, value: 'Old line\n', lineNumber: 2 },
      { type: 'add' as const, value: 'New line\n', lineNumber: 2 },
    ];

    const stats = getDiffStats(diff);

    expect(stats.additions).toBe(1);
    expect(stats.deletions).toBe(1);
    expect(stats.unchanged).toBe(1);
  });
});
```

### Step 3: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/diff-generator.test.ts
```

**Expected:** FAIL - module not found

### Step 4: Write diff generator implementation

Create `src/lib/ai/diff-generator.ts`:

```typescript
import { diffLines } from 'diff';

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  value: string;
  lineNumber: number;
}

export function generateDiff(original: string, modified: string): DiffChange[] {
  const changes = diffLines(original, modified);
  const result: DiffChange[] = [];
  let lineNumber = 1;

  for (const change of changes) {
    const type: DiffChange['type'] = change.added ? 'add' : change.removed ? 'remove' : 'unchanged';

    result.push({
      type,
      value: change.value,
      lineNumber,
    });

    if (!change.removed) {
      lineNumber += (change.value.match(/\n/g) || []).length;
    }
  }

  return result;
}

export function getDiffStats(changes: DiffChange[]): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  return {
    additions: changes.filter((c) => c.type === 'add').length,
    deletions: changes.filter((c) => c.type === 'remove').length,
    unchanged: changes.filter((c) => c.type === 'unchanged').length,
  };
}
```

### Step 5: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/diff-generator.test.ts
```

**Expected:** PASS

### Step 6: Commit

```bash
git add package.json package-lock.json src/lib/ai/diff-generator.ts src/lib/ai/__tests__/diff-generator.test.ts
git commit -m "feat: add diff generator library"
```

---

## Task 14: Apply Diff Changes Function

### Step 1: Write failing test for applying changes

Add to `src/lib/ai/__tests__/diff-generator.test.ts`:

```typescript
import { generateDiff, getDiffStats, applyDiffChanges } from '../diff-generator';

describe('applyDiffChanges', () => {
  it('should apply all accepted changes', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';
    const diff = generateDiff(original, modified);

    // Accept all changes (indexes of non-unchanged items)
    const acceptedIndexes = diff.map((d, i) => (d.type !== 'unchanged' ? i : -1)).filter((i) => i !== -1);

    const result = applyDiffChanges(original, diff, acceptedIndexes);

    expect(result).toBe(modified);
  });

  it('should keep original when no changes accepted', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';
    const diff = generateDiff(original, modified);

    const result = applyDiffChanges(original, diff, []);

    expect(result).toBe(original);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/lib/ai/__tests__/diff-generator.test.ts
```

**Expected:** FAIL - applyDiffChanges not exported

### Step 3: Implement applyDiffChanges

Add to `src/lib/ai/diff-generator.ts`:

```typescript
export function applyDiffChanges(original: string, changes: DiffChange[], acceptedIndexes: number[]): string {
  const result: string[] = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const isAccepted = acceptedIndexes.includes(i);

    if (change.type === 'unchanged') {
      result.push(change.value);
    } else if (change.type === 'add' && isAccepted) {
      result.push(change.value);
    } else if (change.type === 'remove' && !isAccepted) {
      result.push(change.value);
    }
  }

  return result.join('');
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/lib/ai/__tests__/diff-generator.test.ts
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/lib/ai/diff-generator.ts src/lib/ai/__tests__/diff-generator.test.ts
git commit -m "feat: add applyDiffChanges function"
```

---

## Verification Checklist

- [ ] diff library installed
- [ ] generateDiff detects additions, removals, and unchanged
- [ ] getDiffStats returns correct counts
- [ ] applyDiffChanges applies accepted changes correctly
- [ ] applyDiffChanges keeps original when no changes accepted
- [ ] All tests pass: `npm test src/lib/ai/__tests__/diff-generator.test.ts`
- [ ] Changes committed (2 commits for Tasks 13-14)

---

## Next Steps

After this task, proceed to **[Task 4.5: API Helpers](./05-api-helpers.md)**.
