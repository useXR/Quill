import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
  retryAfter?: number;
}

export function errorResponse(
  message: string,
  status: number,
  options?: { code?: string; details?: unknown; retryAfter?: number }
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: message,
      code: options?.code,
      details: options?.details,
      retryAfter: options?.retryAfter,
    },
    { status }
  );
}

export function validationError(error: ZodError): NextResponse<ApiError> {
  return errorResponse('Validation failed', 400, {
    code: 'VALIDATION_ERROR',
    details: error.flatten(),
  });
}

export function unauthorizedError(): NextResponse<ApiError> {
  return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
}

export function rateLimitError(retryAfter: number): NextResponse<ApiError> {
  return errorResponse('Too many requests', 429, {
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter,
  });
}

export function serverError(message = 'Internal server error'): NextResponse<ApiError> {
  return errorResponse(message, 500, { code: 'SERVER_ERROR' });
}
