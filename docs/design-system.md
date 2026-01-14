# Quill Design System

**Aesthetic Direction: Scholarly Craft**

A refined editorial aesthetic that balances academic gravitas with modern usability. The design evokes the space where a well-designed academic journal meets a premium writing application.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Shadows & Elevation](#shadows--elevation)
6. [Border & Radius](#border--radius)
7. [Components](#components)
8. [Motion & Animation](#motion--animation)
9. [Iconography](#iconography)
10. [Accessibility](#accessibility)
11. [Dark Mode](#dark-mode)
12. [Implementation Guide](#implementation-guide)

---

## Design Philosophy

### Core Principles

| Principle                        | Description                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **Authority without stuffiness** | Serif typography for prose conveys credibility; clean UI chrome keeps it modern   |
| **Warm focus**                   | Cream/paper tones reduce eye strain during long writing sessions                  |
| **Subtle craft details**         | Refined borders, typographic finesse, ink-inspired accents honor the "Quill" name |
| **Calm confidence**              | Generous spacing, unhurried layouts, no visual noise reduces anxiety              |
| **Functional elegance**          | Every decorative choice serves usability; beauty through restraint                |

### Target Emotional Response

Users should feel:

- **Focused** — The interface recedes, the writing advances
- **Credible** — "This is where serious academic work happens"
- **Calm** — Reduced anxiety despite high-stakes documents
- **Supported** — Tools are discoverable but never intrusive

### What We Avoid

- Bright, saturated colors (feels frivolous)
- Flashy animations (distracting)
- Generic SaaS blue palettes (forgettable)
- Harsh white backgrounds (eye strain)
- Trendy effects like glassmorphism (will date quickly)
- Dense, cluttered interfaces (overwhelming)

---

## Color System

### Philosophy

Warm, papery backgrounds with deep ink-inspired accents. The palette evokes quality stationery, academic tradition, and focused craftsmanship.

### CSS Custom Properties

```css
:root {
  /* ===== BACKGROUND ===== */
  /* Primary canvas - warm cream like quality paper */
  --color-bg-primary: #faf8f5;
  /* Secondary/subtle backgrounds */
  --color-bg-secondary: #f5f3f0;
  /* Tertiary for depth */
  --color-bg-tertiary: #efecea;

  /* ===== SURFACE ===== */
  /* Cards, modals, elevated elements */
  --color-surface: #ffffff;
  /* Subtle surface variant */
  --color-surface-muted: #fdfcfb;
  /* Interactive surface hover */
  --color-surface-hover: #f9f8f7;
  /* Interactive surface active/pressed */
  --color-surface-active: #f5f4f2;

  /* ===== INK (Text & Icons) ===== */
  /* Primary text - warm near-black */
  --color-ink-primary: #1c1917;
  /* Secondary text */
  --color-ink-secondary: #44403c;
  /* Tertiary/muted text */
  --color-ink-tertiary: #78716c;
  /* Subtle text (placeholders, disabled) */
  --color-ink-subtle: #a8a29e;
  /* Faint (borders, dividers) */
  --color-ink-faint: #d6d3d1;

  /* ===== QUILL (Brand Accent) ===== */
  /* Primary brand color - deep violet */
  --color-quill: #7c3aed;
  /* Darker variant for hover states */
  --color-quill-dark: #6d28d9;
  /* Darkest for active/pressed */
  --color-quill-darker: #5b21b6;
  /* Light background tint */
  --color-quill-light: #ede9fe;
  /* Lighter background tint */
  --color-quill-lighter: #f5f3ff;

  /* ===== SEMANTIC: SUCCESS ===== */
  --color-success: #166534;
  --color-success-light: #dcfce7;
  --color-success-dark: #14532d;

  /* ===== SEMANTIC: WARNING ===== */
  --color-warning: #a16207;
  --color-warning-light: #fef3c7;
  --color-warning-dark: #854d0e;

  /* ===== SEMANTIC: ERROR ===== */
  --color-error: #991b1b;
  --color-error-light: #fee2e2;
  --color-error-dark: #7f1d1d;

  /* ===== SEMANTIC: INFO ===== */
  --color-info: #1e40af;
  --color-info-light: #dbeafe;
  --color-info-dark: #1e3a8a;

  /* ===== STATUS COLORS ===== */
  /* Project/document status badges */
  --color-status-draft: #78716c;
  --color-status-draft-bg: #f5f5f4;
  --color-status-submitted: #1e40af;
  --color-status-submitted-bg: #eff6ff;
  --color-status-funded: #166534;
  --color-status-funded-bg: #f0fdf4;
  --color-status-rejected: #991b1b;
  --color-status-rejected-bg: #fef2f2;

  /* ===== EDITOR ===== */
  /* Editor-specific colors */
  --color-editor-bg: #fffffe;
  --color-editor-selection: #ede9fe;
  --color-editor-highlight: #fef3c7;
  --color-editor-link: #7c3aed;
  --color-editor-cursor: #1c1917;

  /* ===== OVERLAY ===== */
  --color-overlay: rgba(28, 25, 23, 0.5);
  --color-overlay-light: rgba(28, 25, 23, 0.2);
}
```

### Color Usage Guidelines

| Use Case              | Token                   |
| --------------------- | ----------------------- |
| Page background       | `--color-bg-primary`    |
| Card/modal background | `--color-surface`       |
| Primary text          | `--color-ink-primary`   |
| Secondary/helper text | `--color-ink-secondary` |
| Placeholder text      | `--color-ink-subtle`    |
| Borders               | `--color-ink-faint`     |
| Primary buttons       | `--color-quill`         |
| Links                 | `--color-quill`         |
| Focus rings           | `--color-quill`         |
| Success states        | `--color-success`       |
| Warning states        | `--color-warning`       |
| Error states          | `--color-error`         |

### Tailwind v4 Theme Configuration

Tailwind CSS v4 uses a CSS-first configuration approach with the `@theme` directive. Define custom design tokens directly in your CSS file (typically `globals.css`).

```css
/* src/app/globals.css */
@import 'tailwindcss';

@theme {
  /* Background colors */
  --color-bg-primary: #faf8f5;
  --color-bg-secondary: #f5f3f0;
  --color-bg-tertiary: #efecea;

  /* Surface colors */
  --color-surface: #ffffff;
  --color-surface-muted: #fdfcfb;
  --color-surface-hover: #f9f8f7;
  --color-surface-active: #f5f4f2;

  /* Ink (text) colors */
  --color-ink-primary: #1c1917;
  --color-ink-secondary: #44403c;
  --color-ink-tertiary: #78716c;
  --color-ink-subtle: #a8a29e;
  --color-ink-faint: #d6d3d1;

  /* Quill (brand) colors */
  --color-quill: #7c3aed;
  --color-quill-dark: #6d28d9;
  --color-quill-darker: #5b21b6;
  --color-quill-light: #ede9fe;
  --color-quill-lighter: #f5f3ff;

  /* Semantic colors */
  --color-success: #166534;
  --color-success-light: #dcfce7;
  --color-success-dark: #14532d;

  --color-warning: #a16207;
  --color-warning-light: #fef3c7;
  --color-warning-dark: #854d0e;

  --color-error: #991b1b;
  --color-error-light: #fee2e2;
  --color-error-dark: #7f1d1d;

  --color-info: #1e40af;
  --color-info-light: #dbeafe;
  --color-info-dark: #1e3a8a;

  /* Font families */
  --font-display: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;
  --font-prose: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;
  --font-ui: 'Source Sans 3', 'Segoe UI', 'Roboto', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

These theme variables automatically generate utility classes. For example:

- `--color-quill` → `bg-quill`, `text-quill`, `border-quill`
- `--color-ink-primary` → `bg-ink-primary`, `text-ink-primary`
- `--font-display` → `font-display`

> **Note:** Tailwind v4 no longer requires a `tailwind.config.ts` file for theme customization. All theme tokens are defined in CSS using the `@theme` directive.

---

## Typography

### Philosophy

Typography establishes scholarly credibility. Serif fonts for content-heavy areas evoke academic publishing. Clean sans-serif for UI elements ensures usability.

### Font Stack

```css
:root {
  /* Display/Headings - refined serif with academic character */
  --font-display: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;

  /* Body/Prose - same serif for document content */
  --font-prose: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;

  /* UI/Interface - humanist sans-serif with warmth */
  --font-ui: 'Source Sans 3', 'Segoe UI', 'Roboto', sans-serif;

  /* Monospace - for code, data, technical content */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

### Font Installation

Add to `src/app/layout.tsx`:

```tsx
import { Libre_Baskerville, Source_Sans_3, JetBrains_Mono } from 'next/font/google';

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

// In body className:
// `${libreBaskerville.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`
```

### Type Scale

Based on a 1.25 ratio (Major Third) with 16px base.

```css
:root {
  /* Font sizes */
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.125rem; /* 18px */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 1.875rem; /* 30px */
  --text-4xl: 2.25rem; /* 36px */
  --text-5xl: 3rem; /* 48px */

  /* Line heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 1.75;
  --leading-prose: 1.8; /* Optimal for long-form reading */

  /* Letter spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;

  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### Typography Patterns

#### Page Titles

```css
.page-title {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--color-ink-primary);
}
```

#### Section Headings

```css
.section-heading {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-snug);
  color: var(--color-ink-primary);
}
```

#### Card Titles

```css
.card-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  line-height: var(--leading-snug);
  color: var(--color-ink-primary);
}
```

#### Body Text (UI)

```css
.body-text {
  font-family: var(--font-ui);
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--color-ink-secondary);
}
```

#### Prose (Editor Content)

```css
.prose-content {
  font-family: var(--font-prose);
  font-size: var(--text-lg);
  font-weight: var(--font-normal);
  line-height: var(--leading-prose);
  color: var(--color-ink-primary);
  max-width: 70ch; /* Optimal reading width */
}
```

#### Labels & Captions

```css
.label {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: var(--leading-normal);
  color: var(--color-ink-secondary);
}

.caption {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--color-ink-tertiary);
}
```

#### Buttons

```css
.button-text {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: var(--leading-none);
  letter-spacing: var(--tracking-wide);
}
```

---

## Spacing & Layout

### Spacing Scale

Based on 4px base unit. Use multiples for consistency.

```css
:root {
  --space-0: 0;
  --space-px: 1px;
  --space-0.5: 0.125rem; /* 2px */
  --space-1: 0.25rem; /* 4px */
  --space-1.5: 0.375rem; /* 6px */
  --space-2: 0.5rem; /* 8px */
  --space-2.5: 0.625rem; /* 10px */
  --space-3: 0.75rem; /* 12px */
  --space-3.5: 0.875rem; /* 14px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-7: 1.75rem; /* 28px */
  --space-8: 2rem; /* 32px */
  --space-9: 2.25rem; /* 36px */
  --space-10: 2.5rem; /* 40px */
  --space-11: 2.75rem; /* 44px */
  --space-12: 3rem; /* 48px */
  --space-14: 3.5rem; /* 56px */
  --space-16: 4rem; /* 64px */
  --space-20: 5rem; /* 80px */
  --space-24: 6rem; /* 96px */
  --space-28: 7rem; /* 112px */
  --space-32: 8rem; /* 128px */
}
```

### Layout Containers

```css
:root {
  /* Max widths */
  --max-w-prose: 70ch; /* Optimal reading width */
  --max-w-content: 48rem; /* 768px - forms, narrow content */
  --max-w-container: 64rem; /* 1024px - standard container */
  --max-w-wide: 80rem; /* 1280px - wide layouts */
  --max-w-full: 100%;

  /* Container padding (responsive) */
  --container-padding-sm: var(--space-4); /* Mobile */
  --container-padding-md: var(--space-6); /* Tablet */
  --container-padding-lg: var(--space-8); /* Desktop */
}
```

### Standard Layouts

#### Page Container

```tsx
<div className="min-h-screen bg-bg-primary">
  <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">{/* Page content */}</div>
</div>
```

#### Content Container (Forms, Narrow Content)

```tsx
<div className="max-w-content mx-auto">{/* Narrow content */}</div>
```

#### Prose Container (Editor, Long-form)

```tsx
<div className="max-w-prose mx-auto">{/* Long-form content */}</div>
```

### Grid Systems

#### Project Card Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{/* Cards */}</div>
```

#### Two-Column Layout

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
  <main>{/* Primary content */}</main>
  <aside>{/* Sidebar */}</aside>
</div>
```

---

## Shadows & Elevation

### Philosophy

Shadows use warm tones (sepia-tinted) to match the paper aesthetic. Subtle elevation creates depth without harsh contrasts.

```css
:root {
  /* Shadows - warm-tinted for paper feel */
  --shadow-color: 30 20% 10%;

  --shadow-xs: 0 1px 2px hsl(var(--shadow-color) / 0.04);

  --shadow-sm: 0 1px 3px hsl(var(--shadow-color) / 0.06), 0 1px 2px hsl(var(--shadow-color) / 0.04);

  --shadow-md: 0 4px 6px hsl(var(--shadow-color) / 0.05), 0 2px 4px hsl(var(--shadow-color) / 0.04);

  --shadow-lg: 0 10px 15px hsl(var(--shadow-color) / 0.06), 0 4px 6px hsl(var(--shadow-color) / 0.04);

  --shadow-xl: 0 20px 25px hsl(var(--shadow-color) / 0.08), 0 8px 10px hsl(var(--shadow-color) / 0.04);

  --shadow-2xl: 0 25px 50px hsl(var(--shadow-color) / 0.15);

  /* Inner shadow for inset elements */
  --shadow-inner: inset 0 2px 4px hsl(var(--shadow-color) / 0.04);

  /* Focus ring shadow */
  --shadow-focus: 0 0 0 3px var(--color-quill-light);
}
```

### Elevation Levels

| Level | Use Case                    | Shadow Token  |
| ----- | --------------------------- | ------------- |
| 0     | Flat elements, backgrounds  | None          |
| 1     | Cards at rest, inputs       | `--shadow-sm` |
| 2     | Cards on hover, dropdowns   | `--shadow-md` |
| 3     | Modals, popovers            | `--shadow-lg` |
| 4     | Tooltips, floating toolbars | `--shadow-xl` |

---

## Border & Radius

### Border Widths

```css
:root {
  --border-width-0: 0;
  --border-width-1: 1px;
  --border-width-2: 2px;
  --border-width-4: 4px;
}
```

### Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 0.25rem; /* 4px - subtle rounding */
  --radius-md: 0.375rem; /* 6px - default for inputs, buttons */
  --radius-lg: 0.5rem; /* 8px - cards, larger elements */
  --radius-xl: 0.75rem; /* 12px - modals, prominent cards */
  --radius-2xl: 1rem; /* 16px - large containers */
  --radius-full: 9999px; /* Pills, avatars */
}
```

### Border Patterns

```css
/* Default border */
.border-default {
  border: 1px solid var(--color-ink-faint);
}

/* Subtle border */
.border-subtle {
  border: 1px solid var(--color-bg-tertiary);
}

/* Accent border (left accent pattern) */
.border-accent-left {
  border-left: 3px solid var(--color-quill);
}
```

---

## Components

### Buttons

#### Primary Button

```tsx
<button
  className="
  inline-flex items-center justify-center
  px-4 py-2.5
  bg-quill hover:bg-quill-dark active:bg-quill-darker
  text-white font-ui font-semibold text-sm
  rounded-md
  shadow-sm hover:shadow-md
  transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-quill
"
>
  Button Text
</button>
```

#### Secondary Button

```tsx
<button
  className="
  inline-flex items-center justify-center
  px-4 py-2.5
  bg-surface hover:bg-surface-hover active:bg-surface-active
  text-ink-primary font-ui font-semibold text-sm
  border border-ink-faint
  rounded-md
  shadow-sm
  transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
"
>
  Button Text
</button>
```

#### Ghost Button

```tsx
<button
  className="
  inline-flex items-center justify-center
  px-4 py-2.5
  bg-transparent hover:bg-surface-hover active:bg-surface-active
  text-ink-secondary hover:text-ink-primary font-ui font-medium text-sm
  rounded-md
  transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
"
>
  Button Text
</button>
```

#### Icon Button

```tsx
<button
  className="
  inline-flex items-center justify-center
  w-9 h-9
  bg-transparent hover:bg-surface-hover active:bg-surface-active
  text-ink-tertiary hover:text-ink-primary
  rounded-md
  transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
"
  aria-label="Action description"
>
  <IconComponent className="w-5 h-5" />
</button>
```

### Form Inputs

#### Text Input

```tsx
<div className="space-y-1.5">
  <label htmlFor="input-id" className="block text-sm font-medium font-ui text-ink-secondary">
    Label <span className="text-error">*</span>
  </label>
  <input
    id="input-id"
    type="text"
    placeholder="Placeholder text"
    className="
      w-full px-3 py-2.5
      bg-surface
      text-ink-primary font-ui text-base
      placeholder:text-ink-subtle
      border border-ink-faint rounded-md
      shadow-sm
      transition-all duration-150
      hover:border-ink-subtle
      focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-secondary
    "
  />
  <p className="text-xs font-ui text-ink-tertiary">Helper text or character count</p>
</div>
```

#### Textarea

```tsx
<textarea
  rows={4}
  className="
    w-full px-3 py-2.5
    bg-surface
    text-ink-primary font-ui text-base
    placeholder:text-ink-subtle
    border border-ink-faint rounded-md
    shadow-sm
    resize-none
    transition-all duration-150
    hover:border-ink-subtle
    focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill
    disabled:opacity-50 disabled:cursor-not-allowed
  "
/>
```

### Cards

#### Standard Card

```tsx
<div
  className="
  bg-surface
  border border-ink-faint rounded-lg
  shadow-sm
  p-6
"
>
  {/* Card content */}
</div>
```

#### Interactive Card (Link)

```tsx
<a
  href="/path"
  className="
    block
    bg-surface
    border border-ink-faint rounded-lg
    shadow-sm
    p-6
    transition-all duration-200
    hover:shadow-md hover:border-ink-subtle
    focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
  "
>
  {/* Card content */}
</a>
```

#### Accent Card (Left Border)

```tsx
<div
  className="
  bg-surface
  border border-ink-faint border-l-4 border-l-quill
  rounded-lg rounded-l-none
  shadow-sm
  p-6
"
>
  {/* Card content */}
</div>
```

### Status Badges

Status badges use understated styling appropriate for academic contexts.

```tsx
type Status = 'draft' | 'submitted' | 'funded' | 'rejected';

const statusStyles: Record<Status, string> = {
  draft: 'bg-bg-secondary text-ink-secondary',
  submitted: 'bg-info-light text-info-dark',
  funded: 'bg-success-light text-success-dark',
  rejected: 'bg-error-light text-error-dark',
};

<span
  className={`
  inline-flex items-center
  px-2.5 py-1
  text-xs font-ui font-medium
  rounded-md
  ${statusStyles[status]}
`}
>
  {statusLabel}
</span>;
```

### Alerts / Messages

#### Success Alert

```tsx
<div
  role="status"
  className="
    flex items-start gap-3
    p-4
    bg-success-light
    border border-success/20 rounded-lg
  "
>
  <CheckIcon className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
  <p className="text-sm font-ui text-success-dark">Success message here.</p>
</div>
```

#### Error Alert

```tsx
<div
  role="alert"
  className="
    flex items-start gap-3
    p-4
    bg-error-light
    border border-error/20 rounded-lg
  "
>
  <AlertIcon className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
  <p className="text-sm font-ui text-error-dark">Error message here.</p>
</div>
```

#### Warning Alert

```tsx
<div
  role="alert"
  className="
    flex items-start gap-3
    p-4
    bg-warning-light
    border border-warning/20 rounded-lg
  "
>
  <WarningIcon className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
  <p className="text-sm font-ui text-warning-dark">Warning message here.</p>
</div>
```

### Editor Components

#### Editor Container

```tsx
<div
  className="
  bg-surface
  border border-ink-faint rounded-xl
  shadow-md
  overflow-hidden
"
>
  {/* Toolbar */}
  {/* Editor content */}
  {/* Footer (word count) */}
</div>
```

#### Editor Toolbar

```tsx
<div
  className="
  flex items-center gap-1
  px-3 py-2
  bg-bg-secondary
  border-b border-ink-faint
"
>
  {/* Toolbar buttons grouped with dividers */}
</div>
```

#### Toolbar Button

```tsx
<button
  type="button"
  aria-label="Bold"
  aria-pressed={isActive}
  className={`
    p-2 rounded-md
    transition-all duration-150
    ${isActive ? 'bg-quill-light text-quill' : 'text-ink-tertiary hover:bg-surface-hover hover:text-ink-primary'}
    focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-1
  `}
>
  <BoldIcon className="w-4 h-4" />
</button>
```

#### Toolbar Divider

```tsx
<div role="separator" aria-hidden="true" className="w-px h-5 bg-ink-faint mx-1" />
```

#### Editor Content Area

```tsx
<div
  className="
  p-8 lg:p-12
  bg-editor-bg
  min-h-[400px]
"
>
  <div
    className="
    max-w-prose mx-auto
    font-prose text-lg leading-loose
    text-ink-primary
  "
  >
    {/* TipTap EditorContent */}
  </div>
</div>
```

#### Word Count Footer

```tsx
<div
  className="
  flex items-center justify-between
  px-4 py-2
  bg-bg-secondary
  border-t border-ink-faint
  text-xs font-ui text-ink-tertiary
"
>
  <span>1,234 words</span>
  <span>Saved at 2:34 PM</span>
</div>
```

### Empty States

```tsx
<div
  className="
  flex flex-col items-center justify-center
  py-16 px-4
  text-center
"
>
  {/* Subtle illustration */}
  <svg
    className="w-16 h-16 text-ink-subtle mb-4"
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    {/* Custom quill/document illustration */}
  </svg>

  <h3 className="font-display text-lg font-bold text-ink-primary mb-2">No projects yet</h3>
  <p className="font-ui text-sm text-ink-tertiary max-w-sm mb-6">Create your first grant proposal to get started.</p>
  <button className="/* Primary button styles */">Create Project</button>
</div>
```

---

## Motion & Animation

### Philosophy

Motion should be **unhurried and purposeful**. Academic writers are doing focused work; flashy animations feel frivolous. Motion serves to:

- Provide feedback that actions succeeded
- Create smooth spatial relationships
- Reduce cognitive load during transitions

### Timing Functions

```css
:root {
  /* Easing curves */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1); /* Smooth general purpose */
  --ease-in: cubic-bezier(0.4, 0, 1, 1); /* Accelerate */
  --ease-out: cubic-bezier(0, 0, 0.2, 1); /* Decelerate */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* Smooth both ends */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Subtle overshoot */

  /* Durations */
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
  --duration-slower: 300ms;
  --duration-page: 400ms;
}
```

### Standard Transitions

#### Interactive Elements (Buttons, Inputs)

```css
.interactive {
  transition:
    background-color var(--duration-fast) var(--ease-default),
    border-color var(--duration-fast) var(--ease-default),
    box-shadow var(--duration-fast) var(--ease-default),
    color var(--duration-fast) var(--ease-default);
}
```

#### Cards (Hover Effects)

```css
.card-interactive {
  transition:
    box-shadow var(--duration-slow) var(--ease-out),
    border-color var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}

.card-interactive:hover {
  transform: translateY(-2px);
}
```

#### Page Transitions (with Framer Motion)

```tsx
import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

<motion.div
  initial="initial"
  animate="animate"
  exit="exit"
  variants={pageVariants}
  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
>
  {children}
</motion.div>;
```

#### Staggered List Reveals

```tsx
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

<motion.div variants={containerVariants} initial="initial" animate="animate">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {/* Item content */}
    </motion.div>
  ))}
</motion.div>;
```

### Loading States

#### Skeleton Loader

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-bg-tertiary rounded w-3/4 mb-2" />
  <div className="h-4 bg-bg-tertiary rounded w-1/2" />
</div>
```

#### Spinner

```tsx
<svg className="animate-spin h-5 w-5 text-quill" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>
```

### Animation Guidelines

| Context             | Approach                               |
| ------------------- | -------------------------------------- |
| Button hover/active | Instant (100ms) color transitions      |
| Card hover          | Slow (200ms) shadow + subtle lift      |
| Page transitions    | Fade only (200ms), no slides           |
| List reveals        | Stagger (50ms delay), fade-up (10px)   |
| Modal appearance    | Fade (200ms) + subtle scale (0.98 → 1) |
| Success feedback    | Checkmark fade-in (200ms)              |
| Error shake         | Subtle (not cartoon-like)              |

### What to Avoid

- Bouncy/elastic animations (feels playful, not scholarly)
- Long durations > 400ms (feels slow)
- Dramatic slides or zooms (distracting)
- Continuous animations (distracting)
- Animation for animation's sake

---

## Iconography

### Icon Library

Use [Lucide Icons](https://lucide.dev/) for consistency. Lucide provides clean, minimal icons that match the Scholarly Craft aesthetic.

### Icon Sizing

```css
:root {
  --icon-xs: 0.875rem; /* 14px - inline with small text */
  --icon-sm: 1rem; /* 16px - inline with body text */
  --icon-md: 1.25rem; /* 20px - buttons, inputs */
  --icon-lg: 1.5rem; /* 24px - navigation, emphasis */
  --icon-xl: 2rem; /* 32px - empty states */
  --icon-2xl: 3rem; /* 48px - hero illustrations */
}
```

### Icon Usage Patterns

```tsx
// Inline with text
<span className="inline-flex items-center gap-1.5">
  <CalendarIcon className="w-4 h-4 text-ink-tertiary" />
  <span>January 15, 2025</span>
</span>

// In buttons
<button className="inline-flex items-center gap-2">
  <PlusIcon className="w-5 h-5" />
  <span>New Project</span>
</button>

// Status indicators
<CheckCircleIcon className="w-5 h-5 text-success" aria-hidden="true" />
```

### Common Icons

| Purpose       | Icon                     | Usage               |
| ------------- | ------------------------ | ------------------- |
| Add/Create    | `Plus`                   | Primary actions     |
| Edit          | `Pencil`                 | Edit buttons        |
| Delete        | `Trash2`                 | Destructive actions |
| Save          | `Save`                   | Save actions        |
| Success       | `Check` or `CheckCircle` | Success states      |
| Error         | `AlertTriangle`          | Error states        |
| Warning       | `AlertCircle`            | Warning states      |
| Info          | `Info`                   | Informational       |
| Loading       | `Loader2`                | With `animate-spin` |
| Close         | `X`                      | Dismiss/close       |
| Menu          | `Menu`                   | Mobile navigation   |
| Search        | `Search`                 | Search inputs       |
| Calendar      | `Calendar`               | Date displays       |
| Clock         | `Clock`                  | Time displays       |
| User          | `User`                   | User-related        |
| Settings      | `Settings`               | Configuration       |
| External link | `ExternalLink`           | External links      |

---

## Accessibility

### Color Contrast

All color combinations meet WCAG 2.1 AA standards:

| Combination                                     | Contrast Ratio | Standard |
| ----------------------------------------------- | -------------- | -------- |
| `--color-ink-primary` on `--color-bg-primary`   | 14.5:1         | AAA      |
| `--color-ink-secondary` on `--color-bg-primary` | 8.2:1          | AAA      |
| `--color-ink-tertiary` on `--color-bg-primary`  | 4.8:1          | AA       |
| `--color-quill` on white                        | 4.6:1          | AA       |
| White on `--color-quill`                        | 4.6:1          | AA       |

### Focus States

All interactive elements must have visible focus indicators:

```css
.focus-ring {
  outline: none;
  ring: 2px;
  ring-color: var(--color-quill);
  ring-offset: 2px;
  ring-offset-color: var(--color-surface);
}
```

### Keyboard Navigation

- All interactive elements are focusable
- Focus order follows visual order
- Skip links provided for main content
- Toolbar buttons support arrow key navigation

### Screen Reader Support

```tsx
// Status updates
<div role="status" aria-live="polite">
  {/* Dynamic content */}
</div>

// Error messages
<div role="alert">
  {/* Error content */}
</div>

// Icon buttons
<button aria-label="Save document">
  <SaveIcon aria-hidden="true" />
</button>

// Progress indicators
<div
  role="progressbar"
  aria-valuenow={75}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Word count progress"
>
  {/* Visual progress bar */}
</div>
```

### Reduced Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Dark Mode

### Philosophy

Dark mode uses warm, desaturated tones to maintain the paper/ink aesthetic. Not pure black—slightly warm dark grays preserve the scholarly feel.

### Dark Mode Colors

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* ===== BACKGROUND ===== */
    --color-bg-primary: #1c1917; /* Warm near-black */
    --color-bg-secondary: #292524; /* Elevated dark */
    --color-bg-tertiary: #44403c; /* Tertiary dark */

    /* ===== SURFACE ===== */
    --color-surface: #292524;
    --color-surface-muted: #1c1917;
    --color-surface-hover: #44403c;
    --color-surface-active: #57534e;

    /* ===== INK ===== */
    --color-ink-primary: #fafaf9;
    --color-ink-secondary: #d6d3d1;
    --color-ink-tertiary: #a8a29e;
    --color-ink-subtle: #78716c;
    --color-ink-faint: #44403c;

    /* ===== QUILL ===== */
    --color-quill: #a78bfa; /* Lighter violet for dark mode */
    --color-quill-dark: #8b5cf6;
    --color-quill-darker: #7c3aed;
    --color-quill-light: #2e1065; /* Dark violet for backgrounds */
    --color-quill-lighter: #1e1033;

    /* ===== SEMANTIC ===== */
    --color-success: #4ade80;
    --color-success-light: #14532d;
    --color-success-dark: #86efac;

    --color-warning: #fbbf24;
    --color-warning-light: #78350f;
    --color-warning-dark: #fcd34d;

    --color-error: #f87171;
    --color-error-light: #7f1d1d;
    --color-error-dark: #fca5a5;

    /* ===== EDITOR ===== */
    --color-editor-bg: #1c1917;
    --color-editor-selection: #2e1065;

    /* ===== SHADOWS ===== */
    --shadow-color: 0 0% 0%;
  }
}
```

### Dark Mode Implementation

```tsx
// In layout.tsx or globals.css
<html className="[color-scheme:light] dark:[color-scheme:dark]">
```

Tailwind classes automatically adapt when using CSS custom properties.

---

## Implementation Guide

### Step 1: Update Global Styles

Replace `src/app/globals.css` with Tailwind v4's CSS-first approach:

```css
/* Tailwind v4 uses @import instead of @tailwind directives */
@import 'tailwindcss';

/* Define design tokens using @theme directive */
@theme {
  /* Background colors */
  --color-bg-primary: #faf8f5;
  --color-bg-secondary: #f5f3f0;
  --color-bg-tertiary: #efecea;

  /* Surface colors */
  --color-surface: #ffffff;
  --color-surface-muted: #fdfcfb;
  --color-surface-hover: #f9f8f7;
  --color-surface-active: #f5f4f2;

  /* Ink (text) colors */
  --color-ink-primary: #1c1917;
  --color-ink-secondary: #44403c;
  --color-ink-tertiary: #78716c;
  --color-ink-subtle: #a8a29e;
  --color-ink-faint: #d6d3d1;

  /* Quill (brand) colors */
  --color-quill: #7c3aed;
  --color-quill-dark: #6d28d9;
  --color-quill-darker: #5b21b6;
  --color-quill-light: #ede9fe;
  --color-quill-lighter: #f5f3ff;

  /* Semantic colors - see Color System section for full list */

  /* Font families */
  --font-display: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;
  --font-prose: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;
  --font-ui: 'Source Sans 3', 'Segoe UI', 'Roboto', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

/* Base layer for global styles */
@layer base {
  /* Dark mode overrides using CSS custom properties */
  @media (prefers-color-scheme: dark) {
    :root {
      /* Override theme colors for dark mode - see Dark Mode section */
    }
  }

  /* Base typography */
  body {
    font-family: var(--font-ui);
    color: var(--color-ink-primary);
    background-color: var(--color-bg-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

### Step 2: Remove tailwind.config.ts (Optional)

Tailwind v4 no longer requires a JavaScript configuration file. All theme customization is done via the `@theme` directive in CSS. You can delete `tailwind.config.ts` if it only contains theme extensions—these are now defined in `globals.css`.

> **Migration note:** If you have plugins or complex configurations in `tailwind.config.ts`, you can keep the file. Tailwind v4 still supports JavaScript config for advanced use cases like plugins.

### Step 3: Update Layout with Fonts

Update `src/app/layout.tsx` to include Google Fonts (see Typography section).

### Step 4: Create Utility Components

Create reusable component files:

```
src/components/ui/
├── Button.tsx
├── Input.tsx
├── Card.tsx
├── Badge.tsx
├── Alert.tsx
└── index.ts
```

### Step 5: Migrate Existing Components

Update each component to use new design tokens:

1. Replace color classes (`bg-blue-600` → `bg-quill`)
2. Replace font classes (add `font-display` or `font-ui`)
3. Update spacing to match system
4. Add proper shadow and radius tokens

### Component Migration Checklist

- [ ] LoginForm
- [ ] LoginPage
- [ ] ProjectList
- [ ] ProjectCard
- [ ] NewProjectForm
- [ ] ProjectsPage
- [ ] ProjectDetailPage
- [ ] Editor
- [ ] Toolbar
- [ ] WordCount
- [ ] SaveStatus
- [ ] DocumentEditor

---

## Design Token Reference

### Quick Reference Card

```
COLORS
  Background:    bg-bg-primary, bg-bg-secondary
  Surface:       bg-surface, bg-surface-hover
  Text:          text-ink-primary, text-ink-secondary, text-ink-tertiary
  Brand:         bg-quill, text-quill, hover:bg-quill-dark
  Borders:       border-ink-faint

TYPOGRAPHY
  Display:       font-display (Libre Baskerville)
  UI:            font-ui (Source Sans 3)
  Prose:         font-prose (Libre Baskerville)
  Sizes:         text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl

SPACING
  Component:     p-4, p-6, p-8
  Gaps:          gap-2, gap-4, gap-6, gap-8
  Sections:      py-8, py-12, py-16

EFFECTS
  Radius:        rounded-md (inputs), rounded-lg (cards), rounded-xl (modals)
  Shadows:       shadow-sm (rest), shadow-md (hover), shadow-lg (modals)
  Focus:         focus:ring-2 focus:ring-quill focus:ring-offset-2
```

---

_Last updated: January 2026_
_Version: 1.1 — Updated for Tailwind CSS v4_
