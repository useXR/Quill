import type { ZodError } from 'zod';

export function formatZodError(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
}

export function getFieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.');
    if (field && !result[field]) {
      result[field] = issue.message;
    }
  }
  return result;
}
