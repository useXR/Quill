# Tasks 5.13-5.14: TipTap Citation Extension

> **Phase 5** | [← Semantic Scholar Client](./02-semantic-scholar-client.md) | [Next: Database Migration →](./04-database-migration.md)

---

## Context

**This task creates a TipTap mark extension for inline citations.** The extension allows citations to be inserted, rendered, and parsed within the editor.

### Prerequisites

- **Task 5.1** completed (Paper types defined)

### What This Task Creates

- `src/components/editor/extensions/citation.ts` - TipTap mark extension
- `src/components/editor/extensions/__tests__/citation.test.ts` - extension tests

### Tasks That Depend on This

- **Tasks 5.24-5.32** (UI Components) - CitationPicker uses this extension
- Editor integration for citation insertion

### Parallel Tasks

This task can be done in parallel with:

- **Tasks 5.2-5.12** (Semantic Scholar Client)
- **Tasks 5.15-5.16** (Database Migration)

---

## Files to Create

- `src/components/editor/extensions/__tests__/citation.test.ts` (create)
- `src/components/editor/extensions/citation.ts` (create)

---

## Task 5.13: Citation Extension Tests (RED)

### Step 1: Write failing tests for Citation extension

Create `src/components/editor/extensions/__tests__/citation.test.ts`:

```typescript
// src/components/editor/extensions/__tests__/citation.test.ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Citation } from '../citation';

function createTestEditor(content = '<p>Test content</p>') {
  return new Editor({
    extensions: [StarterKit, Citation],
    content,
  });
}

describe('Citation Extension', () => {
  it('should register citation mark', () => {
    const editor = createTestEditor();
    expect(editor.extensionManager.extensions.find((e) => e.name === 'citation')).toBeDefined();
    editor.destroy();
  });

  it('should add citation mark with attributes', () => {
    const editor = createTestEditor('<p>Test content</p>');

    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setCitation({
      citationId: 'cite-123',
      displayText: '[1]',
      doi: '10.1000/test',
      title: 'Test Paper',
    });

    const html = editor.getHTML();
    expect(html).toContain('data-citation-id="cite-123"');
    expect(html).toContain('data-display-text="[1]"');
    editor.destroy();
  });

  it('should parse citation from HTML', () => {
    const html = '<p><cite data-citation-id="abc" data-display-text="[1]">[1]</cite></p>';
    const editor = createTestEditor(html);

    const json = editor.getJSON();
    const citeMark = json.content?.[0]?.content?.[0]?.marks?.[0];

    expect(citeMark?.type).toBe('citation');
    expect(citeMark?.attrs?.citationId).toBe('abc');
    editor.destroy();
  });

  it('should render citation as cite element with classes', () => {
    const editor = createTestEditor('<p>Test</p>');

    editor.commands.selectAll();
    editor.commands.setCitation({
      citationId: 'test',
      displayText: '[1]',
    });

    const html = editor.getHTML();
    expect(html).toContain('<cite');
    expect(html).toContain('class=');
    editor.destroy();
  });

  it('should provide unsetCitation command', () => {
    const editor = createTestEditor('<p><cite data-citation-id="test">[1]</cite></p>');

    editor.commands.selectAll();
    editor.commands.unsetCitation();

    const html = editor.getHTML();
    expect(html).not.toContain('cite');
    editor.destroy();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test src/components/editor/extensions/__tests__/citation.test.ts
```

**Expected:** FAIL with "Cannot find module '../citation'"

### Step 3: Commit failing tests

```bash
git add src/components/editor/extensions/__tests__/citation.test.ts
git commit -m "test(editor): add failing Citation extension tests (RED)"
```

---

## Task 5.14: Citation Extension Implementation (GREEN)

### Step 1: Implement Citation extension

Create `src/components/editor/extensions/citation.ts`:

```typescript
// src/components/editor/extensions/citation.ts
import { Mark, mergeAttributes } from '@tiptap/core';

export interface CitationAttributes {
  citationId: string;
  displayText: string;
  doi?: string;
  title?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      setCitation: (attributes: CitationAttributes) => ReturnType;
      unsetCitation: () => ReturnType;
    };
  }
}

export const Citation = Mark.create({
  name: 'citation',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-citation-id'),
        renderHTML: (attributes) => ({
          'data-citation-id': attributes.citationId,
        }),
      },
      displayText: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-display-text'),
        renderHTML: (attributes) => ({
          'data-display-text': attributes.displayText,
        }),
      },
      doi: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-doi'),
        renderHTML: (attributes) => {
          if (!attributes.doi) return {};
          return { 'data-doi': attributes.doi };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { 'data-title': attributes.title };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'cite[data-citation-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'cite',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'citation-mark cursor-pointer text-blue-600 hover:underline',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCitation:
        (attributes: CitationAttributes) =>
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

export default Citation;
```

### Step 2: Run tests to verify they pass

```bash
npm test src/components/editor/extensions/__tests__/citation.test.ts
```

**Expected:** All 5 tests PASS

### Step 3: Commit

```bash
git add src/components/editor/extensions/citation.ts
git commit -m "feat(editor): implement Citation TipTap extension (GREEN)"
```

---

## Verification Checklist

- [ ] `src/components/editor/extensions/citation.ts` exists
- [ ] `src/components/editor/extensions/__tests__/citation.test.ts` exists
- [ ] All 5 tests pass
- [ ] `setCitation` command works
- [ ] `unsetCitation` command works
- [ ] Citation parses from HTML correctly
- [ ] Citation renders with correct attributes
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Tasks 5.15-5.16: Database Migration](./04-database-migration.md)**.

If running in parallel with Tasks 5.2-5.12, wait for all parallel tracks to complete before starting Task 5.17.
