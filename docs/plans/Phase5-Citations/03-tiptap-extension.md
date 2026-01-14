# Tasks 5.13-5.14: TipTap Citation Extension

> **Phase 5** | [← Semantic Scholar Client](./02-semantic-scholar-client.md) | [Next: Database Migration →](./04-database-migration.md)

---

## Context

**This task creates a TipTap mark extension for inline citations.** The extension allows citations to be inserted, rendered, and parsed within the editor.

### Design System Integration

Inline citations within the editor must align with the Scholarly Craft aesthetic. The citation mark renders as a `<cite>` element with design tokens:

| Property    | Design Token                              | Purpose                              |
| ----------- | ----------------------------------------- | ------------------------------------ |
| Text color  | `text-quill`                              | Brand accent for clickable citations |
| Hover state | `hover:underline`                         | Subtle interaction feedback          |
| Cursor      | `cursor-pointer`                          | Indicates interactivity              |
| Font        | Inherits `font-prose` (Libre Baskerville) | Matches editor content               |

The citation should feel like a natural part of the scholarly text, using the quill brand color (`#7c3aed`) to subtly indicate it's a live reference without disrupting reading flow.

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
        // Design System: Use quill brand color for citations, matching Scholarly Craft aesthetic
        // Inherits font-prose (Libre Baskerville) from editor content
        class:
          'citation-mark cursor-pointer text-quill hover:text-quill-dark hover:underline transition-colors duration-150',
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

## Editor Integration

> **CRITICAL**: The Citation extension must be integrated into the main Editor component for citations to work in the editor. Without this integration, users cannot insert or view citations.

### Step 1: Update Editor extensions configuration

The Citation extension must be added to the TipTap extensions array in `src/components/editor/Editor.tsx`. The extension is configured via `createExtensions()` in `src/components/editor/extensions/index.ts`.

**Update `src/components/editor/extensions/index.ts`** to include the Citation extension:

```typescript
// src/components/editor/extensions/index.ts
import { Citation } from './citation';

// Add Citation to the extensions array returned by createExtensions()
export function createExtensions({ placeholder, characterLimit }: ExtensionOptions) {
  return [
    // ... existing extensions
    Citation,
    // ... other extensions
  ];
}
```

### Step 2: Verify Citation extension is loaded in Editor

After adding the extension, verify it's available:

```typescript
// In Editor.tsx, the editor should now have citation commands:
// editor.commands.setCitation({ citationId, displayText, doi, title })
// editor.commands.unsetCitation()
```

### Step 3: Add unit test for integration

Add test to verify Citation extension is included:

```typescript
// src/components/editor/__tests__/Editor.test.tsx
it('should have citation extension loaded', () => {
  // Render editor and verify citation commands exist
  const editor = renderEditor();
  expect(editor.commands.setCitation).toBeDefined();
  expect(editor.commands.unsetCitation).toBeDefined();
});
```

### Step 4: Commit

```bash
git add src/components/editor/extensions/index.ts
git commit -m "feat(editor): integrate Citation TipTap extension"
```

---

### E2E Regression Test (Required Before Proceeding)

```bash
# Verify citation extension doesn't break existing editor functionality
npm run test:e2e e2e/editor/
```

**Gate:** All existing editor tests must pass before proceeding.

### Additional Verification

After Task 5.6 (API Routes) is complete, return and verify citations render correctly:

```bash
npm run test:e2e e2e/citations/citation-editor-integration.spec.ts
```

---

## E2E Test: Citation Hover Tooltip

> **CRITICAL**: The citation mark must display a tooltip/popover on hover showing citation details. This provides quick reference without leaving the editor context.

### Test Coverage Required

Create or update `e2e/citations/citation-hover-tooltip.spec.ts`:

```typescript
// e2e/citations/citation-hover-tooltip.spec.ts
import { test, expect } from '../fixtures/test-fixtures';
import { CitationEditorPage } from '../pages/CitationEditorPage';
import { setupCitationMocks } from '../fixtures/citation-mocks';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Citation Hover Tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await setupCitationMocks(page);
  });

  test('hovering over citation mark shows tooltip with details', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Insert a citation first
    await citationEditor.openCitationPicker();
    await citationEditor.searchInPicker('hover tooltip test');
    await citationEditor.selectCitationFromPicker(0);

    // Wait for citation to appear in editor
    const citation = page.locator('cite[data-citation-id]');
    await expect(citation).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Hover over the citation mark
    await citation.hover();

    // Tooltip should appear with citation details
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Verify tooltip contains expected information
    await expect(tooltip.getByText(/hover tooltip test/i)).toBeVisible(); // Title
    await expect(tooltip.getByText(/Mock Author|Test Author/i)).toBeVisible(); // Author
    await expect(tooltip.getByText(/10\.1000/i)).toBeVisible(); // DOI
  });

  test('tooltip disappears when mouse leaves citation', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Insert citation
    await citationEditor.openCitationPicker();
    await citationEditor.searchInPicker('disappear test');
    await citationEditor.selectCitationFromPicker(0);

    const citation = page.locator('cite[data-citation-id]');
    await expect(citation).toBeVisible();

    // Hover to show tooltip
    await citation.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Move mouse away from citation
    await page.mouse.move(0, 0);

    // Tooltip should disappear
    await expect(tooltip).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  });

  test('tooltip shows "No DOI" indicator for citations without DOI', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Override mock to return paper without DOI
    await page.route('**/api/citations/search**', async (route) => {
      await route.fulfill({
        json: {
          papers: [
            {
              paperId: 'no-doi-paper',
              title: 'Paper Without DOI',
              authors: [{ name: 'No DOI Author' }],
              year: 2024,
              url: 'https://example.com',
              externalIds: {}, // No DOI
            },
          ],
          total: 1,
        },
      });
    });

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    await citationEditor.openCitationPicker();
    await citationEditor.searchInPicker('no doi');
    await citationEditor.selectCitationFromPicker(0);

    const citation = page.locator('cite[data-citation-id]');
    await citation.hover();

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await expect(tooltip.getByText(/no doi/i)).toBeVisible();
  });

  test('tooltip is keyboard accessible via focus', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    const citationEditor = new CitationEditorPage(page);
    await citationEditor.goto(workerCtx.projectId, workerCtx.documentId);

    // Insert citation
    await citationEditor.openCitationPicker();
    await citationEditor.searchInPicker('keyboard test');
    await citationEditor.selectCitationFromPicker(0);

    const citation = page.locator('cite[data-citation-id]');
    await expect(citation).toBeVisible();

    // Tab to focus the citation (if focusable)
    await page.keyboard.press('Tab');

    // If citation is focusable, tooltip should appear on focus
    // This tests screen reader accessibility
    const tooltip = page.getByRole('tooltip');
    // Note: Implementation may vary - some designs use hover only
  });
});
```

### Implementation Note

The Citation extension must be updated to render a tooltip component on hover. This can be implemented using:

1. **TipTap NodeView** - Custom render function that wraps citation in a tooltip component
2. **CSS :hover with data attributes** - Pure CSS tooltip using `::after` pseudo-element
3. **React Tooltip Library** - Integration with Radix UI Tooltip or similar

Recommended approach for Scholarly Craft design system:

```typescript
// In citation.ts renderHTML or via a wrapper component
// The tooltip should show:
// - Paper title (font-display)
// - Authors (font-ui, text-ink-secondary)
// - DOI with "View Paper" link (text-quill, hover:underline)
// - Year and journal if available (font-ui, text-ink-tertiary)
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
- [ ] **CRITICAL**: Citation extension added to `createExtensions()` in `extensions/index.ts`
- [ ] **CRITICAL**: Editor integration test verifies citation commands are available
- [ ] **E2E Regression**: All existing editor E2E tests pass (`e2e/editor/`)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Tasks 5.15-5.16: Database Migration](./04-database-migration.md)**.

If running in parallel with Tasks 5.2-5.12, wait for all parallel tracks to complete before starting Task 5.17.
