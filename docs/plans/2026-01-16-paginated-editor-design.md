# Paginated Editor Design

## Goal

Help grant writers track page count so they can stay within page limits. Users need to know approximately how many pages their content will occupy when exported to PDF.

## Approach: Two Phases

After evaluating libraries (`tiptap-pagination-plus`, `prosemirror-pagination`, official TipTap Pages), we found significant risks: critical bugs, incomplete features, or paid tiers. We'll take a phased approach to deliver value quickly while de-risking the complex parts.

### Phase 1: Typography Fix + Page Estimate (This Implementation)

Low-risk changes that solve the core need:

1. **Fix typography mismatch** - PDF export currently uses Times New Roman while editor uses Libre Baskerville. Change PDF export to use Libre Baskerville so page counts are accurate.
2. **Add page count estimate** - Calculate approximate page count based on rendered content height and display "~X pages" indicator.

### Phase 2: Full Page Rendering (Future)

If Phase 1 isn't sufficient:

1. Fork `tiptap-pagination-plus` and fix critical bugs, OR
2. Evaluate `prosemirror-pagination` for TipTap compatibility
3. Implement visual page boundaries with discrete page containers

---

## Phase 1 Specification

### Typography Alignment

**Current State:**
| Component | Font | Size | Line Height |
|-----------|------|------|-------------|
| Editor | Libre Baskerville | prose-lg | 1.75 |
| PDF Export | Times New Roman | 12pt | 1.6 |

**Target State:**
| Component | Font | Size | Line Height |
|-----------|------|------|-------------|
| Editor | Libre Baskerville | prose-lg | 1.6 |
| PDF Export | Libre Baskerville | 12pt | 1.6 |

**Files to Modify:**

- `src/lib/export/pdf-styles.ts` - Change font-family to Libre Baskerville
- `src/app/globals.css` - Adjust prose line-height if needed for consistency

### Page Count Estimator

**Calculation:**

```
contentHeight = editor.view.dom.scrollHeight (rendered content in pixels)
pageContentHeight = 864px (9 inches at 96dpi, Letter minus 1" margins)
estimatedPages = Math.ceil(contentHeight / pageContentHeight)
```

**Display:**

- Location: Bottom-right corner of editor canvas, above chat FAB
- Format: "~X pages" in a subtle pill/badge
- Style: `bg-surface`, `text-ink-secondary`, small shadow
- Updates: Debounced (200ms) on content change

**Component:** `src/components/editor/PageEstimate.tsx` (new)

### Page Configuration Constants

Create shared constants used by both estimator and PDF export:

```typescript
// src/lib/constants/page.ts
export const PAGE_CONFIG = {
  // US Letter at 96 DPI
  WIDTH_PX: 816, // 8.5 inches
  HEIGHT_PX: 1056, // 11 inches
  MARGIN_PX: 96, // 1 inch

  // Content area (page minus margins)
  CONTENT_WIDTH_PX: 624, // 6.5 inches
  CONTENT_HEIGHT_PX: 864, // 9 inches

  // Typography
  FONT_FAMILY: "'Libre Baskerville', Georgia, serif",
  FONT_SIZE: '12pt',
  LINE_HEIGHT: 1.6,
};
```

---

## Files to Modify (Phase 1)

| File                                     | Change                                     |
| ---------------------------------------- | ------------------------------------------ |
| `src/lib/constants/page.ts`              | New - shared page configuration            |
| `src/lib/export/pdf-styles.ts`           | Use Libre Baskerville, reference constants |
| `src/components/editor/PageEstimate.tsx` | New - page count indicator component       |
| `src/components/editor/EditorCanvas.tsx` | Add PageEstimate component                 |
| `src/components/editor/Editor.tsx`       | Expose content height for estimation       |

---

## Out of Scope (Phase 1)

- Visual page boundaries/breaks
- Discrete page containers
- Manual page break insertion
- Headers/footers
- Table splitting across pages
- Mobile-specific handling

---

## Testing (Phase 1)

1. Create test document, export to PDF, count pages manually
2. Verify page estimate matches PDF page count (within ±0.5 pages)
3. Test with various content: short (1 page), medium (3-5 pages), long (10+ pages)
4. Verify estimate updates correctly as user types
5. Test dark/light mode styling of indicator

---

## Phase 2 Notes (For Future Reference)

If full page rendering is needed later:

**Library Options:**

- `tiptap-pagination-plus` - Fork and fix issues #25 (infinite loop), #21 (dimension change loop), #24 (commands broken)
- `prosemirror-pagination` - 94 stars, needs TipTap compatibility testing
- Official TipTap Pages - Paid, Alpha, incomplete

**Critical Bugs to Fix (if forking tiptap-pagination-plus):**

- Issue #25: Infinite loop on nodes bigger than 1 page
- Issue #21: Infinite loop when changing page dimensions
- Issue #24: Commands not working
- Issue #15: Pagination fails with tables

**Additional Requirements:**

- Replace table extensions with library's TablePlus variants
- Add pagination-aware debouncing to autosave
- Update SelectionToolbar positioning for paginated layout

---

## References

- [tiptap-pagination-plus](https://github.com/RomikMakavana/tiptap-pagination-plus)
- [prosemirror-pagination](https://github.com/todorstoev/prosemirror-pagination)
- [TipTap Pages (Official)](https://tiptap.dev/docs/pages/getting-started/overview)
- [ProseMirror pagination discussion](https://discuss.prosemirror.net/t/pagination/6078)
- Existing PDF export: `src/lib/export/pdf.ts`, `src/lib/export/pdf-styles.ts`
