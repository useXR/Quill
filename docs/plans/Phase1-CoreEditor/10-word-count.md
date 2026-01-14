# Task 9: Word/Character Count

> **Phase 1** | [← Autosave Hook](./09-autosave-hook.md) | [Next: E2E Tests →](./11-e2e-tests.md)

---

## Context

**This task adds word and character counting with limit warnings.** Essential for grant proposals with strict word limits.

> **Note:** This task uses constants from `@/lib/constants` for the default warning threshold.

### Prerequisites

- **Task 8** completed (DocumentEditor with autosave)

### What This Task Creates

- `src/hooks/__tests__/useWordCount.test.ts` - Word count hook tests
- `src/hooks/useWordCount.ts` - Word count hook
- `src/components/editor/__tests__/WordCount.test.tsx` - Component tests
- `src/components/editor/WordCount.tsx` - Word count display
- Updated `src/components/editor/Editor.tsx` - With word count integration

### Tasks That Depend on This

- **Task 10** (E2E Tests) - Validates word count feature

---

## Files to Create/Modify

- `src/hooks/__tests__/useWordCount.test.ts` (create)
- `src/hooks/useWordCount.ts` (create)
- `src/components/editor/__tests__/WordCount.test.tsx` (create)
- `src/components/editor/WordCount.tsx` (create)
- `src/components/editor/Editor.tsx` (modify)
- `src/components/editor/__tests__/Editor.test.tsx` (modify)

---

## Steps

### Step 9.1: Write failing test for useWordCount hook

Create `src/hooks/__tests__/useWordCount.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useWordCount } from '../useWordCount';

describe('useWordCount', () => {
  it('should initialize with zero counts', () => {
    const { result } = renderHook(() => useWordCount());

    expect(result.current.wordCount).toBe(0);
    expect(result.current.charCount).toBe(0);
    expect(result.current.charCountNoSpaces).toBe(0);
  });

  it('should count words correctly', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello world this is a test');
    });

    expect(result.current.wordCount).toBe(6);
  });

  it('should count characters with spaces', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello world');
    });

    expect(result.current.charCount).toBe(11);
  });

  it('should count characters without spaces', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello world');
    });

    expect(result.current.charCountNoSpaces).toBe(10);
  });

  it('should handle empty string', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('');
    });

    expect(result.current.wordCount).toBe(0);
    expect(result.current.charCount).toBe(0);
  });

  it('should strip HTML tags when counting', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('<p>Hello <strong>world</strong></p>');
    });

    expect(result.current.wordCount).toBe(2);
    expect(result.current.charCount).toBe(11);
  });

  it('should calculate percentage when limit provided', () => {
    const { result } = renderHook(() => useWordCount({ wordLimit: 100 }));

    act(() => {
      result.current.updateCount('word '.repeat(50).trim());
    });

    expect(result.current.wordCount).toBe(50);
    expect(result.current.percentage).toBe(50);
    expect(result.current.isOverLimit).toBe(false);
  });

  it('should flag when over word limit', () => {
    const { result } = renderHook(() => useWordCount({ wordLimit: 10 }));

    act(() => {
      result.current.updateCount('word '.repeat(15).trim());
    });

    expect(result.current.wordCount).toBe(15);
    expect(result.current.percentage).toBe(150);
    expect(result.current.isOverLimit).toBe(true);
  });

  it('should flag when near word limit', () => {
    const { result } = renderHook(() => useWordCount({ wordLimit: 100, warningThreshold: 90 }));

    act(() => {
      result.current.updateCount('word '.repeat(92).trim());
    });

    expect(result.current.isNearLimit).toBe(true);
    expect(result.current.isOverLimit).toBe(false);
  });
});
```

### Step 9.2: Run test to verify it fails

```bash
npm test src/hooks/__tests__/useWordCount.test.ts
```

**Expected:** FAIL with "Cannot find module '../useWordCount'"

### Step 9.3: Implement useWordCount hook

Create `src/hooks/useWordCount.ts`:

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';
import { EDITOR } from '@/lib/constants';

interface UseWordCountOptions {
  wordLimit?: number;
  charLimit?: number;
  warningThreshold?: number; // percentage (default from constants)
}

interface UseWordCountReturn {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  percentage: number | null;
  charPercentage: number | null;
  isNearLimit: boolean;
  isOverLimit: boolean;
  isCharNearLimit: boolean;
  isCharOverLimit: boolean;
  updateCount: (text: string) => void;
}

function stripHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function countWords(text: string): number {
  const plainText = stripHtml(text).trim();
  if (!plainText) return 0;
  const words = plainText.split(/\s+/).filter(Boolean);
  return words.length;
}

function countChars(text: string, includeSpaces: boolean): number {
  const plainText = stripHtml(text);
  if (includeSpaces) {
    return plainText.length;
  }
  return plainText.replace(/\s/g, '').length;
}

export function useWordCount(options: UseWordCountOptions = {}): UseWordCountReturn {
  const { wordLimit, charLimit, warningThreshold = EDITOR.DEFAULT_WORD_WARNING_THRESHOLD } = options;

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [charCountNoSpaces, setCharCountNoSpaces] = useState(0);

  const updateCount = useCallback((text: string) => {
    setWordCount(countWords(text));
    setCharCount(countChars(text, true));
    setCharCountNoSpaces(countChars(text, false));
  }, []);

  const percentage = useMemo(() => {
    if (!wordLimit) return null;
    return Math.round((wordCount / wordLimit) * 100);
  }, [wordCount, wordLimit]);

  const charPercentage = useMemo(() => {
    if (!charLimit) return null;
    return Math.round((charCount / charLimit) * 100);
  }, [charCount, charLimit]);

  const isNearLimit = useMemo(() => {
    if (percentage === null) return false;
    return percentage >= warningThreshold && percentage < 100;
  }, [percentage, warningThreshold]);

  const isOverLimit = useMemo(() => {
    if (percentage === null) return false;
    return percentage > 100;
  }, [percentage]);

  const isCharNearLimit = useMemo(() => {
    if (charPercentage === null) return false;
    return charPercentage >= warningThreshold && charPercentage < 100;
  }, [charPercentage, warningThreshold]);

  const isCharOverLimit = useMemo(() => {
    if (charPercentage === null) return false;
    return charPercentage > 100;
  }, [charPercentage]);

  return {
    wordCount,
    charCount,
    charCountNoSpaces,
    percentage,
    charPercentage,
    isNearLimit,
    isOverLimit,
    isCharNearLimit,
    isCharOverLimit,
    updateCount,
  };
}
```

### Step 9.4: Run test to verify it passes

```bash
npm test src/hooks/__tests__/useWordCount.test.ts
```

**Expected:** PASS

### Step 9.5: Create WordCount component

Create `src/components/editor/WordCount.tsx` with progress bar and limit warnings.

See original plan for full implementation.

### Step 9.6: Integrate WordCount into Editor

Modify `src/components/editor/Editor.tsx` to include word count display.

See original plan for full implementation.

### Step 9.7: Run all word count tests

```bash
npm test -- --testPathPattern="(useWordCount|WordCount|Editor)"
```

**Expected:** PASS

### Step 9.8: Commit

```bash
git add src/hooks/useWordCount.ts src/hooks/__tests__/useWordCount.test.ts src/components/editor/WordCount.tsx src/components/editor/__tests__/WordCount.test.tsx src/components/editor/Editor.tsx src/components/editor/__tests__/Editor.test.tsx
git commit -m "feat: add word/character count with limit warnings"
```

---

## Verification Checklist

- [ ] useWordCount hook tests pass
- [ ] Uses constants from `@/lib/constants` for warning threshold
- [ ] Word counting works correctly
- [ ] Character counting (with/without spaces) works
- [ ] HTML stripping works
- [ ] Percentage calculation correct
- [ ] Near limit warning shows
- [ ] Over limit error shows
- [ ] WordCount component renders correctly
- [ ] Progress bar displays correctly
- [ ] Editor integrates word count
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 10: E2E Tests](./11-e2e-tests.md)**.
