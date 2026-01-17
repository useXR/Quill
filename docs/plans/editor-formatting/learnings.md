# Learnings Log: Editor Formatting Overhaul

## Plan Review Phase

### Round 1 - 2026-01-16

**Key insight:** @tiptap/markdown extension exists and handles all markdown-to-TipTap conversion natively. Building a custom parser would have been 2-4 days of unnecessary work.

**Pattern discovered:** The existing Toolbar.tsx already has good structure (ARIA attributes, button groups, renderButton helper). Incremental enhancement is better than rewrite.

**Scope creep caught:** LinkPopover was not in original requirements. Removed from plan.

**Testing gap:** Dark mode testing was missing from original plan. Added explicit dark mode E2E tests.

## Domain Review Phase

<!-- Domain critics append here -->

## Implementation Phase

<!-- Implementation agents append here -->

## Code Review Phase

<!-- Code reviewers append here -->
