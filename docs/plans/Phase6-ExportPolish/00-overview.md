# Phase 6: Export & Polish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the MVP with document export (DOCX/PDF), responsive app shell, error handling, toast notifications, command palette, and comprehensive E2E testing.

---

## Design System Reference

This phase implements UI components following the **Scholarly Craft** aesthetic defined in `docs/design-system.md`. Key design tokens used throughout:

### Typography (Tailwind v4 `@theme` tokens)

- **Display/Headings:** `font-display` (Libre Baskerville)
- **UI Elements:** `font-ui` (Source Sans 3)
- **Prose Content:** `font-prose` (Libre Baskerville)
- **Monospace:** `font-mono` (JetBrains Mono)

### Color Palette

- **Backgrounds:** `bg-bg-primary` (#faf8f5 warm cream), `bg-bg-secondary`, `bg-surface`
- **Text:** `text-ink-primary`, `text-ink-secondary`, `text-ink-tertiary`
- **Brand Accent:** `bg-quill` (#7c3aed), `hover:bg-quill-dark`, `text-quill`
- **Semantic:** `text-success`, `text-error`, `text-warning`, `bg-success-light`, `bg-error-light`

### Interactive Elements

- **Buttons:** `rounded-md`, `shadow-sm`, `hover:shadow-md`, `focus:ring-2 focus:ring-quill`
- **Cards:** `bg-surface`, `border border-ink-faint`, `rounded-lg`, `shadow-sm`
- **Touch Targets:** Minimum 44x44px (`min-h-[44px] min-w-[44px]`)

### Motion

- **Transitions:** `transition-all duration-150` for interactive elements
- **Reduced Motion:** Always include `motion-reduce:transition-none`

---

## Phase 6 Task Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 6: EXPORT & POLISH                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐      ┌──────────────┐                                     │
│  │ 6.1 DOCX     │      │ 6.2 PDF      │                                     │
│  │   Export     │      │   Export     │                                     │
│  └──────┬───────┘      └──────┬───────┘                                     │
│         │                     │                                             │
│         └──────────┬──────────┘                                             │
│                    │                                                        │
│                    ▼                                                        │
│         ┌──────────────────┐                                                │
│         │ 6.3 App Shell &  │                                                │
│         │   Navigation     │                                                │
│         └────────┬─────────┘                                                │
│                  │                                                          │
│         ┌────────┴────────┐                                                 │
│         ▼                 ▼                                                 │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │ 6.4 Loading  │  │ 6.5 Toast    │                                         │
│  │ States/Errors│  │ Notifications│                                         │
│  └──────┬───────┘  └──────┬───────┘                                         │
│         │                 │                                                 │
│         └────────┬────────┘                                                 │
│                  ▼                                                          │
│         ┌──────────────────┐                                                │
│         │ 6.6 Command      │                                                │
│         │    Palette       │                                                │
│         └────────┬─────────┘                                                │
│                  │                                                          │
│                  ▼                                                          │
│         ┌──────────────────┐                                                │
│         │ 6.7 E2E Tests    │                                                │
│         │ & Accessibility  │                                                │
│         └──────────────────┘                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Files

| File                                                           | Task | Description                         | Prerequisites        |
| -------------------------------------------------------------- | ---- | ----------------------------------- | -------------------- |
| [01-docx-export.md](./01-docx-export.md)                       | 6.1  | DOCX export with HTML parsing       | Pre-flight checklist |
| [02-pdf-export.md](./02-pdf-export.md)                         | 6.2  | PDF export with Puppeteer           | Pre-flight checklist |
| [03-app-shell-navigation.md](./03-app-shell-navigation.md)     | 6.3  | Responsive app shell and navigation | 6.1, 6.2             |
| [04-loading-error-handling.md](./04-loading-error-handling.md) | 6.4  | Loading states and error handling   | 6.3                  |
| [05-toast-notifications.md](./05-toast-notifications.md)       | 6.5  | Toast notification system           | 6.3                  |
| [06-command-palette.md](./06-command-palette.md)               | 6.6  | Command palette with cmdk           | 6.4, 6.5             |
| [07-e2e-tests.md](./07-e2e-tests.md)                           | 6.7  | E2E tests and accessibility         | 6.6                  |
| [99-verification.md](./99-verification.md)                     | -    | Phase completion verification       | All tasks            |

---

## Key Dependencies

- **docx** - Server-side Word document generation
- **node-html-parser** - HTML parsing for DOCX conversion
- **puppeteer** - Headless Chrome for PDF generation
- **cmdk** - Command palette UI component
- **zustand** - State management for toasts
- **@axe-core/playwright** - Accessibility testing

---

## Pre-Flight Checklist

Before starting **any** task, verify prerequisites:

```bash
# Verify Node.js and npm
node --version        # Must be 24+
npm --version

# Verify existing project structure
ls src/lib/           # Should exist
ls src/components/    # Should exist
ls src/app/           # Should exist

# Verify test setup
npm test -- --run     # Should pass existing tests
```

---

## Execution Strategy

### Sequential vs Parallel Tasks

- **Tasks 6.1, 6.2** can be done in parallel (independent export formats)
- **Task 6.3** depends on export completion (AppProviders imports Toast/CommandPalette)
- **Tasks 6.4, 6.5** can be done in parallel after 6.3
- **Task 6.6** depends on 6.4 and 6.5
- **Task 6.7** is the final task (tests all previous functionality)

### Recommended Order

**For a single developer, follow numerical order:** 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7

**For parallel execution with multiple agents:**

1. Parallel: 6.1 | 6.2
2. Then 6.3
3. Parallel: 6.4 | 6.5
4. Then 6.6 → 6.7

---

## Architecture Overview

**Server-side Export:**

- `docx` library for Word documents with HTML-to-DOCX conversion
- Puppeteer for PDF generation from styled HTML

**Client-side App Shell:**

- Responsive sidebar with mobile drawer navigation
- Skip links for accessibility
- Zustand-powered toast notifications

**Command Palette:**

- `cmdk` library with Cmd+K / Ctrl+K activation
- Navigation commands and action commands

**E2E Testing:**

- Playwright with page object pattern
- `@axe-core/playwright` for accessibility audits
- Auth fixture with persistent sessions

---

## Tech Stack

- Next.js 16
- TypeScript
- docx, puppeteer, cmdk
- Zustand
- Playwright, @axe-core/playwright
- Tailwind CSS v4 (CSS-first configuration with `@theme` directive)

## UI Standards

All components in this phase adhere to:

1. **Scholarly Craft Aesthetic** - Warm cream backgrounds, serif typography for academic gravitas, clean sans-serif for UI elements
2. **WCAG 2.1 AA Accessibility** - Focus rings (`focus:ring-2 focus:ring-quill focus:ring-offset-2`), 44px touch targets, reduced motion support
3. **Design Token Consistency** - Use only tokens from `docs/design-system.md` (no arbitrary colors like `bg-blue-600`)
4. **Tailwind v4 Syntax** - Tokens defined via `@theme` in CSS, generating utilities like `bg-quill`, `text-ink-primary`, `font-display`
