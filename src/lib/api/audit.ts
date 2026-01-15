import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import type { Json } from '@/lib/supabase/database.types';

const logger = createLogger({ module: 'audit' });

export type AuditAction =
  | 'vault:create'
  | 'vault:delete'
  | 'vault:restore'
  | 'vault:extraction_complete'
  | 'vault:extraction_failed'
  | 'ai:chat'
  | 'ai:global-edit'
  | 'ai:operation-status';

export interface AuditLogInput {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  changes?: Json;
}

/**
 * Simplified audit log creation with action and details.
 * Extracts resourceType from action prefix (e.g., 'ai:chat' -> 'ai').
 */
export async function createAuditLog(action: AuditAction, details: Record<string, unknown>): Promise<void>;
/**
 * Full audit log creation with explicit input object.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void>;
export async function createAuditLog(
  actionOrInput: AuditAction | AuditLogInput,
  details?: Record<string, unknown>
): Promise<void> {
  // Handle overloaded signatures
  const input: AuditLogInput =
    typeof actionOrInput === 'string'
      ? {
          action: actionOrInput,
          resourceType: actionOrInput.split(':')[0],
          userId: (details?.userId as string) ?? undefined,
          resourceId: (details?.documentId as string) ?? (details?.operationId as string) ?? undefined,
          changes: details as Json,
        }
      : actionOrInput;

  return createAuditLogInternal(input);
}

/**
 * Internal implementation for creating an audit log entry in the audit_logs table.
 * Uses admin client (service role) to bypass RLS - audit logs should not
 * be insertable by regular users to prevent tampering with the audit trail.
 */
async function createAuditLogInternal(input: AuditLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();

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
