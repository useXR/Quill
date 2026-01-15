import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateAIOperationStatus } from '@/lib/api/ai-operations';
import { createAuditLog } from '@/lib/api/audit';
import { unauthorizedError, serverError } from '@/lib/api/error-response';
import { createLogger } from '@/lib/logger';

// Domain logger for AI operations (Best Practice: Domain child loggers)
const logger = createLogger({ domain: 'ai', route: 'operations-update' });

// Next.js 15+ dynamic route params pattern (Best Practice: Await params in App Router)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedError();
  }

  const { status, outputContent } = await request.json();

  try {
    const operation = await updateAIOperationStatus(id, status, outputContent);

    // Audit log status changes (Best Practice: AI Audit Events)
    await createAuditLog('ai:operation-status', {
      userId: user.id,
      operationId: id,
      status,
      hasOutputContent: !!outputContent,
    });

    logger.info({ userId: user.id, operationId: id, status }, 'AI operation status updated');
    return NextResponse.json(operation);
  } catch (error) {
    logger.error({ error, userId: user.id, operationId: id }, 'Failed to update operation');
    return serverError('Failed to update operation');
  }
}
