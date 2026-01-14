import { NextResponse } from 'next/server';
import { ApiError } from './errors';
import type { Logger } from 'pino';

export function handleApiError(error: unknown, logger: Logger, context: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  logger.error({ error }, context);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
