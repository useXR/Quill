# Dependency Upgrade Reference Guide

> **Purpose:** Reference document for updating existing plan documents after the January 2026 dependency upgrade.

## Summary of Version Changes

| Package            | Old Version | New Version | Breaking Changes |
| ------------------ | ----------- | ----------- | ---------------- |
| next               | 14.2.35     | 16.1.1      | Yes              |
| react              | 18.3.1      | 19.2.3      | Yes              |
| react-dom          | 18.3.1      | 19.2.3      | Yes              |
| tailwindcss        | 3.4.19      | 4.1.18      | Yes              |
| eslint             | 8.57.1      | 9.39.2      | Yes              |
| eslint-config-next | 14.2.35     | 16.1.1      | Yes              |
| supabase (CLI)     | 1.200.3     | 2.72.6      | Minor            |
| @types/node        | 20.x        | 24.x        | No               |
| @types/react       | 18.x        | 19.x        | Yes              |
| @types/react-dom   | 18.x        | 19.x        | Yes              |

---

## Next.js 14 → 16 Changes

### Configuration Changes

#### serverExternalPackages (moved out of experimental)

**Old (Next.js 14):**

```javascript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },
};
```

**New (Next.js 16):**

```javascript
const nextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty'],
};
```

**Search patterns in plans:**

- `experimental.serverComponentsExternalPackages`
- `serverComponentsExternalPackages`

#### Turbopack is now default

- No configuration needed - Turbopack is the default bundler
- Remove any `--turbo` flags from dev scripts
- Remove `experimental.turbo` configuration

**Search patterns in plans:**

- `--turbo`
- `experimental.turbo`
- `experimental: { turbo:`

#### Middleware deprecation warning

Next.js 16 shows a deprecation warning for `middleware.ts`. The new pattern is `proxy.ts`, but `middleware.ts` still works.

**Note:** We kept `middleware.ts` for now. Future plans should consider migrating to `proxy.ts`.

### Version references to update

**Search and replace in plans:**

- `Next.js 14` → `Next.js 16`
- `next@14` → `next@16`
- `"next": "14.` → `"next": "16.`
- `eslint-config-next@14` → `eslint-config-next@16`

---

## React 18 → 19 Changes

### Context.Provider syntax change

**Old (React 18):**

```tsx
return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
```

**New (React 19):**

```tsx
return <MyContext value={value}>{children}</MyContext>;
```

**Search patterns in plans:**

- `Context.Provider`
- `.Provider value=`

### forwardRef is deprecated

**Old (React 18):**

```tsx
const MyInput = forwardRef<HTMLInputElement, Props>((props, ref) => {
  return <input ref={ref} {...props} />;
});
```

**New (React 19):**

```tsx
function MyInput({ ref, ...props }: Props & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

**Search patterns in plans:**

- `forwardRef`
- `forwardRef<`
- `React.forwardRef`

### useFormState renamed to useActionState

**Old (React 18):**

```tsx
import { useFormState } from 'react-dom';
const [state, formAction] = useFormState(action, initialState);
```

**New (React 19):**

```tsx
import { useActionState } from 'react';
const [state, formAction] = useActionState(action, initialState);
```

**Search patterns in plans:**

- `useFormState`
- `import { useFormState }`

### Ref callbacks can return cleanup functions

**Old (React 18):**

```tsx
<div
  ref={(node) => {
    instance = node;
  }}
/>
```

**New (React 19) - explicit syntax required:**

```tsx
<div
  ref={(node) => {
    instance = node;
  }}
/> // Note: explicit block, no implicit return
```

### Components cannot be defined inside render

**Old (allowed in React 18):**

```tsx
function Parent() {
  const Child = () => <div>child</div>; // Bad: defined inside render
  return <Child />;
}
```

**New (required in React 19):**

```tsx
function Child() {
  return <div>child</div>;
}

function Parent() {
  return <Child />;
}
```

**Search patterns in plans:**

- `const Component = () =>` inside function bodies
- Nested component definitions

### Refs cannot be updated during render

**Old (allowed in React 18):**

```tsx
function Component() {
  const ref = useRef(null);
  ref.current = someValue; // Bad: updating during render
  return <div />;
}
```

**New (required in React 19):**

```tsx
function Component() {
  const ref = useRef(null);
  useEffect(() => {
    ref.current = someValue; // Good: updating in effect
  }, [someValue]);
  return <div />;
}
```

### Version references to update

**Search and replace in plans:**

- `React 18` → `React 19`
- `react@18` → `react@19`
- `"react": "^18` → `"react": "^19`
- `@types/react@18` → `@types/react@19`

---

## Tailwind CSS 3 → 4 Changes

### Import syntax change

**Old (Tailwind 3):**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**New (Tailwind 4):**

```css
@import 'tailwindcss';
```

**Search patterns in plans:**

- `@tailwind base`
- `@tailwind components`
- `@tailwind utilities`

### Configuration file removed

- `tailwind.config.ts` is **deleted** in v4
- Configuration is now CSS-based using `@theme` directive

**Old (Tailwind 3) - tailwind.config.ts:**

```typescript
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
      },
    },
  },
};
```

**New (Tailwind 4) - globals.css:**

```css
@import 'tailwindcss';

@theme {
  --color-primary: #3b82f6;
}
```

**Search patterns in plans:**

- `tailwind.config.ts`
- `tailwind.config.js`
- `tailwind.config`
- References to configuring Tailwind via JS/TS

### PostCSS configuration change

**Old (Tailwind 3):**

```javascript
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**New (Tailwind 4):**

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**Search patterns in plans:**

- `plugins: { tailwindcss:`
- `autoprefixer` (no longer needed)

### Utility class renames

| Old Class (v3)       | New Class (v4)      |
| -------------------- | ------------------- |
| `shadow-sm`          | `shadow-xs`         |
| `shadow`             | `shadow-sm`         |
| `rounded-sm`         | `rounded-xs`        |
| `rounded`            | `rounded-sm`        |
| `blur-sm`            | `blur-xs`           |
| `blur`               | `blur-sm`           |
| `outline-none`       | `outline-hidden`    |
| `ring` (3px default) | `ring-3` (explicit) |

**Search patterns in plans:**

- Any of the old class names in code examples

### Important modifier position changed

**Old (Tailwind 3):**

```html
<div class="!flex !bg-red-500"></div>
```

**New (Tailwind 4):**

```html
<div class="flex! bg-red-500!"></div>
```

**Search patterns in plans:**

- `!` prefix on utility classes

### Border and ring now require explicit colors

**Old (Tailwind 3):**

```html
<div class="border">
  <!-- Had default gray color -->
  <div class="ring"><!-- Had default blue color --></div>
</div>
```

**New (Tailwind 4):**

```html
<div class="border border-gray-200">
  <!-- Explicit color required -->
  <div class="ring-3 ring-blue-500"><!-- Explicit color required --></div>
</div>
```

**Note:** We added compatibility styles in globals.css to preserve old behavior.

### Custom utilities syntax

**Old (Tailwind 3):**

```css
@layer utilities {
  .custom-utility {
    /* styles */
  }
}
```

**New (Tailwind 4):**

```css
@utility custom-utility {
  /* styles */
}
```

**Search patterns in plans:**

- `@layer utilities`
- `@layer components`

### CSS variables in arbitrary values

**Old (Tailwind 3):**

```html
<div class="bg-[--brand-color]"></div>
```

**New (Tailwind 4):**

```html
<div class="bg-(--brand-color)"></div>
```

**Search patterns in plans:**

- `[--` (CSS variable in square brackets)

### Version references to update

**Search and replace in plans:**

- `Tailwind CSS 3` → `Tailwind CSS 4`
- `Tailwind 3` → `Tailwind 4`
- `tailwindcss@3` → `tailwindcss@4`

---

## ESLint 8 → 9 Changes

### Configuration format

ESLint 9 uses flat config format (`eslint.config.mjs`) by default. We were already using flat config, so this is mostly compatible.

**Current config structure:**

```javascript
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierConfig,
  // Custom rules...
];

export default eslintConfig;
```

### jsx-a11y now included in next config

- No need to separately configure `eslint-plugin-jsx-a11y`
- It's included in `eslint-config-next/core-web-vitals`

**Search patterns in plans:**

- `eslint-plugin-jsx-a11y` (can be removed from manual setup)
- Manual jsx-a11y configuration

### New React hooks rules

ESLint 9 with React 19 includes stricter rules:

- `react-hooks/static-components` - Components can't be defined during render
- `react-hooks/immutability` - Variables can't be accessed before declaration in callbacks
- `react-hooks/refs` - Refs can't be updated during render

### Version references to update

**Search and replace in plans:**

- `ESLint 8` → `ESLint 9`
- `eslint@8` → `eslint@9`
- `.eslintrc` → `eslint.config.mjs` (if referencing old format)

---

## Node.js Version

We're using Node.js v24.12.0. Plans should reference:

- `Node.js 24+` or `Node.js >=24`
- `@types/node@24`

**Search and replace in plans:**

- `Node.js 20+` → `Node.js 24+`
- `@types/node@20` → `@types/node@24`
- `"node": ">=20` → `"node": ">=24`

---

## Checklist for Updating Plan Documents

### Quick Search Patterns

Run these searches across all plan documents to find items needing updates:

```bash
# Next.js version references
grep -r "Next.js 14" docs/plans/
grep -r "next@14" docs/plans/
grep -r "serverComponentsExternalPackages" docs/plans/

# React version references
grep -r "React 18" docs/plans/
grep -r "forwardRef" docs/plans/
grep -r "Context.Provider" docs/plans/
grep -r "useFormState" docs/plans/

# Tailwind references
grep -r "@tailwind" docs/plans/
grep -r "tailwind.config" docs/plans/
grep -r "shadow-sm" docs/plans/  # May need context check

# ESLint references
grep -r "ESLint 8" docs/plans/
grep -r ".eslintrc" docs/plans/

# Node.js references
grep -r "Node.js 20" docs/plans/
grep -r "@types/node@20" docs/plans/
```

### Priority Updates

1. **High Priority** - Code examples that won't work:
   - `Context.Provider` syntax
   - `forwardRef` usage
   - `@tailwind` directives
   - `tailwind.config.ts` references
   - `experimental.serverComponentsExternalPackages`

2. **Medium Priority** - Version references:
   - "Next.js 14" → "Next.js 16"
   - "React 18" → "React 19"
   - "Tailwind CSS 3" → "Tailwind CSS 4"

3. **Low Priority** - Minor updates:
   - Utility class renames (shadow-sm → shadow-xs, etc.)
   - Node.js version references

---

## Files Already Updated in Codebase

The following files were updated as part of the upgrade:

- `next.config.mjs` - serverExternalPackages moved out of experimental
- `eslint.config.mjs` - Simplified, removed duplicate jsx-a11y
- `postcss.config.mjs` - Updated to @tailwindcss/postcss
- `src/app/globals.css` - Tailwind 4 syntax
- `src/contexts/auth.tsx` - Context.Provider → Context
- `src/components/editor/Toolbar.tsx` - Divider moved outside render
- `src/hooks/useAutosave.ts` - Ref pattern fix for React 19
- `src/test-utils/render.tsx` - Removed explicit any
- `tailwind.config.ts` - **Deleted** (config now in CSS)

Use these as reference implementations when updating plan documents.
