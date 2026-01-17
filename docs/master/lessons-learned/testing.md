# Lessons Learned: Testing

Stack: Vitest (unit), Playwright (E2E), Testing Library

## Patterns That Work

<!-- Successful approaches discovered during implementation -->

## Anti-Patterns

<!-- Approaches that failed or caused issues -->

## Gotchas

### Vitest

<!-- Non-obvious behaviors, edge cases, surprises -->

### Playwright

<!-- Playwright-specific gotchas -->

### Testing Library

<!-- React Testing Library patterns -->

## Test Commands

```bash
# Unit tests
pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
pnpm test:ui           # Vitest UI

# E2E tests
pnpm test:e2e          # All browsers
pnpm test:e2e:ui       # Playwright UI
pnpm test:e2e:debug    # Debug mode
pnpm test:e2e:chromium # Chromium only
pnpm test:e2e:serial   # Serial execution

# Full suite
pnpm test:all          # Lint + format + unit + e2e:chromium
```

## Useful Tools/Libraries

- **Vitest**: Fast unit testing with Vite
- **@testing-library/react**: Component testing
- **@testing-library/user-event**: User interaction simulation
- **@playwright/test**: E2E testing
- **@axe-core/playwright**: Accessibility testing
- **jsdom**: DOM environment for Vitest
