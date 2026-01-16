# Paginated Editor Design

## Goal

Add Google Docs-style page rendering to the document editor so users can see exactly how many pages their content will occupy when printed/exported. This helps grant writers stay within page limits.

## Approach

Use the [tiptap-pagination-plus](https://github.com/RomikMakavana/tiptap-pagination-plus) library to add automatic pagination to the existing TipTap editor. The library handles page breaks, content reflow, and page counting.

## Page Configuration

Matches existing PDF export settings:

| Setting          | Value                  | Rationale                         |
| ---------------- | ---------------------- | --------------------------------- |
| Page size        | US Letter (8.5" × 11") | Standard for US grant submissions |
| Margins          | 1 inch all sides       | Matches `src/lib/export/pdf.ts`   |
| Content area     | 6.5" × 9"              | Letter minus margins              |
| Pixel dimensions | 816 × 1056 px          | At 96 DPI                         |
| Margin in pixels | 96 px                  | 1 inch at 96 DPI                  |
| Page gap         | 32 px                  | Space between pages on canvas     |

## Visual Design

**Page Appearance:**

- White background with `shadow-warm-lg` shadow (light mode)
- Respects dark mode theming (dark pages, light text)
- Subtle border using `border-ink-faint`
- 32px gap between pages showing canvas background

**Page Counter:**

- Fixed position in bottom-right corner of editor canvas
- Above the chat FAB button
- Shows "Page X of Y" in pill/badge style
- Uses `bg-surface`, `text-ink-secondary`
- Updates in real-time as content changes

## Files to Modify

| File                                        | Change                                  |
| ------------------------------------------- | --------------------------------------- |
| `package.json`                              | Add `tiptap-pagination-plus` dependency |
| `src/components/editor/extensions/index.ts` | Add Pagination extension with config    |
| `src/components/editor/Editor.tsx`          | Remove flex height stretching           |
| `src/components/editor/EditorCanvas.tsx`    | Simplify layout for paginated content   |
| `src/app/globals.css`                       | Add pagination CSS styles               |
| `src/components/editor/PageCounter.tsx`     | New component for page indicator        |

## Extension Configuration

```typescript
import { Pagination } from 'tiptap-pagination-plus';

Pagination.configure({
  pageSize: 'LETTER',
  pageMargin: {
    top: 96,
    bottom: 96,
    left: 96,
    right: 96,
  },
  pageGap: 32,
  showPageNumber: true,
});
```

## Out of Scope (YAGNI)

- Configurable page sizes (Letter only)
- Configurable margins (1" only)
- Manual page break insertion
- Headers/footers in editor view
- A4 support

## Testing

- Verify page count matches PDF export for sample documents
- Test with long documents (10+ pages)
- Confirm dark/light mode styling
- Test content reflow when editing mid-document

## References

- [tiptap-pagination-plus GitHub](https://github.com/RomikMakavana/tiptap-pagination-plus)
- [Live demo](https://romikmakavana.me/tiptap-pagination/)
- Existing PDF export: `src/lib/export/pdf.ts`, `src/lib/export/pdf-styles.ts`
