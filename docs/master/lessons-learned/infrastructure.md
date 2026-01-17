# Lessons Learned: Infrastructure

Stack: pnpm, Node.js 20+, Supabase (local dev), Husky (git hooks)

## Patterns That Work

<!-- Successful approaches discovered during implementation -->

## Anti-Patterns

<!-- Approaches that failed or caused issues -->

## Gotchas

### pnpm

<!-- Non-obvious behaviors, edge cases, surprises -->

### Supabase Local Development

<!-- Supabase CLI patterns -->

### Git Hooks (Husky)

<!-- Pre-commit, lint-staged patterns -->

## Development Commands

```bash
# Development
pnpm dev               # Start Next.js dev server
pnpm build             # Production build
pnpm start             # Start production server
pnpm lint              # ESLint
pnpm format            # Prettier write
pnpm format:check      # Prettier check

# Database (Supabase)
pnpm db:start          # Start local Supabase
pnpm db:stop           # Stop local Supabase
pnpm db:reset          # Reset database
pnpm db:status         # Check status
pnpm db:push           # Push migrations
pnpm db:types          # Generate TypeScript types
```

## Useful Tools/Libraries

- **pnpm**: Fast, disk-efficient package manager
- **Supabase CLI**: Local development environment
- **Husky**: Git hooks
- **lint-staged**: Run linters on staged files
- **ESLint 9**: Linting (flat config)
- **Prettier**: Code formatting
