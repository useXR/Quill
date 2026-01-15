import { NextRequest, NextResponse } from 'next/server';
import { getCitation, updateCitation, deleteCitation } from '@/lib/api/citations';
import { updateCitationRequestSchema } from '@/lib/citations/schemas';
import { citationLogger } from '@/lib/citations/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = citationLogger({ citationId: id });
  try {
    const citation = await getCitation(id);
    if (!citation) {
      return NextResponse.json({ error: 'Citation not found' }, { status: 404 });
    }
    return NextResponse.json(citation);
  } catch (error) {
    log.error({ error }, 'Failed to fetch citation');
    return NextResponse.json({ error: 'Failed to fetch citation' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = citationLogger({ citationId: id });
  try {
    const body = await request.json();
    const validationResult = updateCitationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }
    const citation = await updateCitation(id, validationResult.data);
    return NextResponse.json(citation);
  } catch (error) {
    log.error({ error }, 'Failed to update citation');
    return NextResponse.json({ error: 'Failed to update citation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = citationLogger({ citationId: id });
  try {
    await deleteCitation(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to delete citation');
    return NextResponse.json({ error: 'Failed to delete citation' }, { status: 500 });
  }
}
