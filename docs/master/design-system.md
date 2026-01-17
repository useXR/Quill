# Design System

Quill uses a warm, paper-inspired design system with full dark mode support. All design tokens are defined in `src/app/globals.css` using Tailwind CSS v4's `@theme` directive.

## Colors

### Background

- `bg-primary`: #faf8f5 — Main app background (warm off-white)
- `bg-secondary`: #f5f3f0 — Secondary areas
- `bg-tertiary`: #efecea — Tertiary/nested areas

### Surface

- `surface`: #ffffff — Cards, panels, elevated elements
- `surface-muted`: #fdfcfb — Subtle surface variant
- `surface-hover`: #f9f8f7 — Hover states
- `surface-active`: #f5f4f2 — Active/pressed states

### Ink (Text & Icons)

- `ink-primary`: #1c1917 — Primary text
- `ink-secondary`: #44403c — Secondary text
- `ink-tertiary`: #78716c — Tertiary/muted text
- `ink-subtle`: #a8a29e — Placeholders, hints
- `ink-faint`: #d6d3d1 — Borders, dividers

### Brand (Quill Purple)

- `quill`: #7c3aed — Primary brand color
- `quill-dark`: #6d28d9 — Hover states
- `quill-darker`: #5b21b6 — Active states
- `quill-light`: #ede9fe — Light backgrounds
- `quill-lighter`: #f5f3ff — Lightest backgrounds

### Semantic Colors

- **Success**: #166534 (dark green)
- **Warning**: #a16207 (amber)
- **Error**: #991b1b (dark red)
- **Info**: #1e40af (blue)

### Status Colors

- Draft: `#78716c` on `#f5f5f4`
- Submitted: `#1e40af` on `#eff6ff`
- Funded: `#166534` on `#f0fdf4`
- Rejected: `#991b1b` on `#fef2f2`

## Typography

### Font Families

- **Display**: `'Libre Baskerville', Georgia, serif` — Headers, titles
- **UI**: `'Source Sans 3', system-ui, sans-serif` — Interface elements
- **Prose**: `'Libre Baskerville', Georgia, serif` — Editor content
- **Mono**: `'JetBrains Mono', monospace` — Code blocks

### Usage Pattern

```tsx
// Headers/titles use display font
<h1 className="font-display">Document Title</h1>

// UI elements use UI font (default body font)
<button>Save Document</button>

// Editor content inherits prose font via TipTap styles
```

## Spacing

Uses Tailwind's default spacing scale. No custom overrides.

## Shadows

Warm-tinted shadows for a paper-like feel:

- `shadow-warm-xs`: Subtle elevation
- `shadow-warm-sm`: Cards, dropdowns
- `shadow-warm-md`: Modals, floating panels
- `shadow-warm-lg`: Page containers in editor
- `shadow-warm-xl`: Maximum elevation
- `shadow-focus`: Focus ring (purple tint)

## Border Radius

- `radius-sm`: 0.25rem (4px)
- `radius-md`: 0.375rem (6px)
- `radius-lg`: 0.5rem (8px)
- `radius-xl`: 0.75rem (12px)
- `radius-2xl`: 1rem (16px)

## Components

### Buttons (`src/components/ui/Button.tsx`)

Variants: primary, secondary, ghost, danger
Sizes: sm, md, lg

### Cards (`src/components/ui/Card.tsx`)

Surface-colored containers with warm shadows

### Form Elements

- Input (`src/components/ui/Input.tsx`)
- Select (`src/components/ui/Select.tsx`)

### Editor-Specific

- Page container (`.tiptap-page`) — White surface with lg shadow
- Page content (`.tiptap-page-content`) — 96px padding (1" margins)

## Responsive Breakpoints

Uses Tailwind defaults:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## Dark Mode

Toggle via `data-theme="dark"` on `<html>`. All color tokens have dark mode variants defined in globals.css.

## Anti-Patterns

<!-- Populated from lessons learned -->
