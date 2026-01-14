# Task 0.3: Set Up Vitest for Unit/Integration Testing

> **Phase 0** | [← ESLint/Prettier](./02-eslint-prettier.md) | [Next: Playwright Setup →](./04-playwright-setup.md)

---

## Context

**This task establishes the unit and integration testing infrastructure.** Vitest is fast, Vite-native, and works seamlessly with React and TypeScript.

### Prerequisites

- **Task 0.2** completed (ESLint/Prettier configured)

### What This Task Creates

- Vitest configuration with coverage thresholds
- Browser API mocks (ResizeObserver, IntersectionObserver, matchMedia)
- Opt-in Next.js mock utilities
- Custom render function with providers
- Test utilities barrel export

### Tasks That Depend on This

- **Task 0.8** (Test Utilities) - extends the test utilities created here
- **Task 0.9** (CI) - runs unit tests

### Parallel Tasks

This task can be done in parallel with:

- **Task 0.4** (Playwright)
- **Task 0.5** (Supabase)

---

## Files to Create/Modify

- `package.json` (modify)
- `vitest.config.ts` (create)
- `vitest.setup.ts` (create)
- `src/test-utils/next-mocks.ts` (create)
- `src/test-utils/render.tsx` (create)
- `src/test-utils/index.ts` (create)
- `src/lib/__tests__/example.test.ts` (create)

---

## Steps

### Step 1: Install Vitest and all testing utilities

```bash
pnpm add -D vitest @vitejs/plugin-react @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
```

**Note:** Includes `@vitest/ui` for test:ui script and `@vitest/coverage-v8` for coverage.

### Step 2: Create comprehensive Vitest config

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom is the default choice; happy-dom is faster but has fewer browser APIs
    // If you encounter compatibility issues, try switching to 'happy-dom'
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'e2e'],

    // Test isolation and performance
    isolate: true,
    pool: 'threads',
    testTimeout: 10000,
    hookTimeout: 10000,

    // Mock cleanup between tests - ensures test isolation
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Environment variables for tests
    // NOTE: For CI, these are overridden by workflow env vars with real Supabase keys
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },

    // Reporters for CI integration
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: {
      junit: './test-results/vitest-junit.xml',
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'src/middleware.ts',
        '.next/**',
        'e2e/**',
        'src/test-utils/**',
      ],
      // Coverage thresholds - fail if not met
      // NOTE: Starting with lower thresholds for Phase 0 since there's minimal code.
      // Increase progressively as the codebase grows:
      // - Phase 1: 60% lines, 60% functions
      // - Phase 2+: 70-80% as features stabilize
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

### Step 3: Create Vitest setup file

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test - ensures DOM is reset
afterEach(() => {
  cleanup();
});

// ============================================
// BROWSER API MOCKS
// These are required for UI libraries (Radix, shadcn, Framer Motion)
// ============================================

// Mock window.matchMedia (required for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (required for Radix UI, many component libraries)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver (for lazy loading, infinite scroll)
global.IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as unknown as typeof IntersectionObserver;

// NOTE: We intentionally do NOT add global mocks for next/navigation or
// next/headers here. Tests should explicitly opt-in to mocks using the
// utilities in src/test-utils/next-mocks.ts. This follows the TDD principle
// of avoiding mocks unless unavoidable, and makes test dependencies explicit.
```

### Step 4: Create opt-in Next.js mock utilities

Create `src/test-utils/next-mocks.ts`:

```typescript
import { vi } from 'vitest';

/**
 * Mock next/navigation hooks for component tests.
 * Call this at the top of test files that need router mocking.
 *
 * @example
 * import { mockNextNavigation } from '@/test-utils/next-mocks';
 * mockNextNavigation();
 *
 * describe('MyComponent', () => { ... });
 */
export function mockNextNavigation() {
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  }));
}

/**
 * Mock next/headers for server component tests.
 * Call this at the top of test files that need headers/cookies mocking.
 */
export function mockNextHeaders() {
  vi.mock('next/headers', () => ({
    cookies: () => ({
      get: vi.fn(),
      getAll: vi.fn(() => []),
      set: vi.fn(),
      delete: vi.fn(),
    }),
    headers: () => new Headers(),
  }));
}
```

### Step 5: Create React Testing Library render utilities

Create `src/test-utils/render.tsx`:

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Wrapper component with all providers.
 * Add providers here as you add them to the app (e.g., QueryClientProvider).
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with providers
 * and sets up userEvent.
 *
 * @example
 * const { user } = render(<MyButton />);
 * await user.click(screen.getByRole('button'));
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };
```

### Step 6: Create test-utils barrel export

Create `src/test-utils/index.ts`:

```typescript
export * from './render';
export * from './next-mocks';
```

### Step 7: Write first test (should pass)

Create `src/lib/__tests__/example.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Example test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with arrays', () => {
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('should work with objects', () => {
    expect({ name: 'test' }).toHaveProperty('name', 'test');
  });
});
```

### Step 8: Add test scripts to package.json

Add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:ui": "vitest --ui"
```

### Step 9: Run tests

```bash
pnpm test
```

**Expected:** 3 tests passing

### Step 10: Commit

```bash
git add .
git commit -m "chore: configure Vitest with test utilities and coverage"
```

---

## Verification Checklist

- [ ] `vitest.config.ts` created with coverage thresholds
- [ ] `vitest.setup.ts` created with browser API mocks
- [ ] `src/test-utils/next-mocks.ts` created
- [ ] `src/test-utils/render.tsx` created
- [ ] `src/test-utils/index.ts` created
- [ ] `src/lib/__tests__/example.test.ts` passes
- [ ] `pnpm test` runs 3 passing tests
- [ ] Changes committed

---

## Next Steps

Continue with the next task in sequence, or if running in parallel:

- **[Task 0.4: Set Up Playwright](./04-playwright-setup.md)** (can run in parallel)
- **[Task 0.5: Set Up Supabase](./05-supabase-local.md)** (can run in parallel)

After both 0.3 and 0.7 are complete, proceed to **[Task 0.8: Test Utilities](./08-test-utilities.md)**.
