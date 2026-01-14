# Quill Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker (for Supabase local development)

## Quick Start

```bash
# First time setup
./scripts/dev-setup.sh

# Copy environment template
cp .env.local.example .env.local
# Edit .env.local with values from `pnpm exec supabase status`

# Start development
pnpm dev
```

## Accessing Supabase Studio

After running `pnpm db:start`, Supabase Studio is available at:
http://localhost:54323

## Available Scripts

### Development

- `pnpm dev` - Start Next.js dev server
- `pnpm build` - Build for production
- `pnpm start` - Start production server

### Testing

- `pnpm test` - Run unit/integration tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage
- `pnpm test:ui` - Open Vitest UI
- `pnpm test:e2e` - Run all Playwright E2E tests
- `pnpm test:e2e:chromium` - Run E2E tests (Chromium only)
- `pnpm test:e2e:ui` - Run E2E tests with UI
- `pnpm test:e2e:debug` - Debug E2E tests

### Database

- `pnpm db:start` - Start local Supabase
- `pnpm db:stop` - Stop local Supabase
- `pnpm db:status` - Show Supabase status
- `pnpm db:reset` - Reset database (runs migrations)
- `pnpm exec supabase migration new <name>` - Create new migration
- `pnpm db:types` - Regenerate TypeScript types

### All Tests

- `pnpm test:all` - Run lint, format check, unit tests, and E2E tests

### Code Quality

- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check formatting

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── (auth)/         # Route groups for auth layouts
│   ├── api/            # API routes including /api/health
│   └── actions/        # Server actions (thin wrappers)
├── components/          # React components
│   ├── ui/             # Base UI components (shadcn)
│   ├── forms/          # Form components
│   ├── editor/         # TipTap editor components
│   └── [feature]/      # Feature-specific components
├── contexts/            # React context providers
├── hooks/               # Custom React hooks
├── lib/                 # Shared utilities
│   ├── supabase/       # Supabase clients and types
│   │   ├── index.ts    # Barrel export
│   │   ├── client.ts   # Browser client
│   │   ├── server.ts   # Server client
│   │   ├── types.ts    # Type helpers
│   │   └── test-utils.ts
│   ├── constants/      # Magic values (Phase 1+)
│   │   ├── auth.ts     # SESSION_DURATION, MAX_ATTEMPTS
│   │   └── retention.ts # AUDIT_LOG_DAYS, etc.
│   ├── validation/     # Zod schemas (Phase 1+)
│   ├── errors/         # Custom error classes (Phase 1+)
│   └── utils/          # General utilities
├── types/               # Global type definitions
├── styles/              # Global styles
└── test-utils/          # Unit test utilities
    ├── index.ts        # Barrel export
    ├── render.tsx      # Custom render with providers
    ├── next-mocks.ts   # Opt-in Next.js mocks
    └── factories.ts    # Test data factories

e2e/                    # Playwright E2E tests
├── config/             # Centralized timeout constants
├── fixtures/           # Test accounts, worker fixtures
├── helpers/            # Hydration, auth, accessibility helpers
├── setup/              # Global setup/teardown
└── [feature]/          # Test specs organized by feature

supabase/
├── migrations/         # Database migrations
└── config.toml        # Supabase config
```

### Code Organization Patterns (Phase 1+)

When adding features, follow these patterns from `docs/best-practices/development-best-practices.md`:

**Barrel Exports:** Every `src/lib/<module>/` directory should have an `index.ts` that exports its public API.

**Server Actions:** Should be thin wrappers that delegate to service functions in `lib/`.

**Constants Files:** Use constants files for magic values instead of hardcoded numbers:

```typescript
// lib/constants/auth.ts
export const AUTH = {
  SESSION_DURATION_DAYS: 7,
  MAX_LOGIN_ATTEMPTS: 5,
} as const;
```

**Custom Error Classes:** Define in `lib/errors/` for consistent error handling:

```typescript
// lib/errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500
  ) {
    super(message);
  }
}
```

**Zod Validation:** Define schemas in `lib/validation/` for forms and API inputs:

```typescript
// lib/validation/user.ts
import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[0-9]/, 'Must contain number');
```

## Development Workflow

This project follows Test-Driven Development (TDD) principles:

1. **RED** - Write a failing test that defines the desired behavior
2. **GREEN** - Write the minimum code to make the test pass
3. **REFACTOR** - Clean up while keeping tests green

**Important:** All PRs should include tests for new functionality. Write tests
before or alongside implementation, not as an afterthought.

## Testing Strategy

### Unit Tests (Vitest)

- Test pure functions and utilities
- Test React components in isolation
- Located in `__tests__` folders near source
- Use factories from `@/test-utils` for test data

### Integration Tests (Vitest)

- Test component interactions
- Test API route handlers
- Test Supabase queries (with test database)

### E2E Tests (Playwright)

- Test complete user flows
- Test AI interactions (mocked)
- Test accessibility (WCAG 2.1 AA via axe-core)
- Located in `e2e/` folder organized by feature
- Use `data-testid` attributes for stable selectors
- Use centralized timeouts from `e2e/config/timeouts.ts`
- Use port 3099 (isolated from dev server on 3000)

### Test Utilities

- `src/test-utils/render.tsx` - Custom render with providers
- `src/test-utils/next-mocks.ts` - Opt-in Next.js mocks
- `src/test-utils/factories.ts` - Test data factories
- `src/lib/supabase/test-utils.ts` - Database test utilities
- `e2e/fixtures/test-fixtures.ts` - Worker isolation fixtures
- `e2e/helpers/hydration.ts` - React hydration helpers
- `e2e/helpers/axe.ts` - Accessibility testing

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# For testing
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For AI features (Phase 2+)
OPENAI_API_KEY=your-openai-key
```

## Troubleshooting

### Supabase won't start

1. Ensure Docker is running: `docker ps`
2. Check for port conflicts: `lsof -i :54321`
3. Reset Supabase: `pnpm exec supabase stop && pnpm exec supabase start`

### Tests failing with env errors

1. Ensure `.env.local` exists with valid values
2. Run `pnpm exec supabase status` to verify Supabase is running
3. Regenerate types: `pnpm db:types`

### TypeScript type errors after schema change

1. Run migrations: `pnpm exec supabase db reset`
2. Regenerate types: `pnpm db:types`

## Production Infrastructure (Future Phases)

The following infrastructure items are prepared but deferred to deployment phases:

| Item                   | Status   | Notes                                                      |
| ---------------------- | -------- | ---------------------------------------------------------- |
| `output: 'standalone'` | Ready    | Configured in `next.config.ts`                             |
| `/api/health` endpoint | Ready    | For Docker/CI health checks                                |
| `audit_logs` table     | Ready    | For security tracking                                      |
| RLS policies           | Ready    | Database-level access control                              |
| Security headers       | Deferred | Phase 1 - CSP, HSTS, etc.                                  |
| Rate limiting          | Deferred | Phase 1 - Login, API endpoints                             |
| Docker Compose files   | Deferred | See `docs/best-practices/infrastructure-best-practices.md` |
| Dockerfile             | Deferred | Multi-stage build pattern documented                       |
| Backup/restore scripts | Deferred | Patterns documented in best practices                      |

When ready to containerize, follow the patterns in `docs/best-practices/infrastructure-best-practices.md`.

For code organization, validation, and security patterns, see `docs/best-practices/development-best-practices.md`.
