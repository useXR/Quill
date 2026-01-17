# Lessons Learned: Backend

Stack: Next.js API Routes, Supabase (PostgreSQL, Auth, Storage)

## Patterns That Work

<!-- Successful approaches discovered during implementation -->

## Anti-Patterns

<!-- Approaches that failed or caused issues -->

## Gotchas

### Next.js API Routes

<!-- Non-obvious behaviors, edge cases, surprises -->

### Supabase

<!-- Supabase-specific gotchas (auth, RLS, storage) -->

### AI Integration

<!-- Anthropic SDK, OpenAI SDK patterns -->

- Uses `@anthropic-ai/sdk` for Claude integration
- Uses `openai` package for OpenAI integration
- Uses `@modelcontextprotocol/sdk` for MCP

## Useful Tools/Libraries

- **Supabase**: Database, auth, and storage
- **Zod v4**: Schema validation
- **pino/pino-pretty**: Logging
- **mammoth**: DOCX import
- **pdf-parse**: PDF text extraction
- **puppeteer/puppeteer-core**: PDF export (with @sparticuz/chromium for serverless)
- **docx**: DOCX export
