import { logger } from '@/lib/logger';

export function citationLogger(context: {
  userId?: string;
  citationId?: string;
  projectId?: string;
  paperId?: string;
}) {
  return logger.child({ domain: 'citations', ...context });
}
