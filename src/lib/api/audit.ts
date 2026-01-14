import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import type { Json } from '@/lib/supabase/database.types';

const logger = createLogger({ module: 'audit' });

export type AuditAction =
  | 'vault:create'
  | 'vault:delete'
  | 'vault:restore'
  | 'vault:extraction_complete'
  | 'vault:extraction_failed';

export interface AuditLogInput {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  changes?: Json;
}

/**
 * Creates an audit log entry in the audit_logs table.
 * Used to track vault operations for compliance and debugging.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('audit_logs').insert({
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      user_id: input.userId ?? null,
      changes: input.changes ?? null,
    });

    if (error) {
      // Log the error but don't throw - audit logging should not break the main operation
      logger.error({ error, input }, 'Failed to create audit log');
      return;
    }

    logger.debug({ action: input.action, resourceId: input.resourceId }, 'Audit log created');
  } catch (err) {
    // Catch any unexpected errors to prevent audit logging from breaking the main flow
    logger.error({ error: err, input }, 'Unexpected error creating audit log');
  }
}
