import { NextResponse } from 'next/server';
import { getCitations, createCitation, createCitationFromPaper, isDuplicateCitation } from '@/lib/api/citations';
import { createCitationRequestSchema } from '@/lib/citations/schemas';
import { citationLogger } from '@/lib/citations/logger';

const log = citationLogger({});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  try {
    const citations = await getCitations(projectId);
    return NextResponse.json(citations);
  } catch (error) {
    log.error({ error }, 'Failed to fetch citations');
    return NextResponse.json({ error: 'Failed to fetch citations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = createCitationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    const { projectId, paper, ...manualCitation } = validationResult.data;
    if (paper) {
      const { isDuplicate, existingId } = await isDuplicateCitation(projectId, paper);
      if (isDuplicate) {
        return NextResponse.json({ error: 'Citation already exists', code: 'DUPLICATE', existingId }, { status: 409 });
      }
      const citation = await createCitationFromPaper(projectId, paper);
      return NextResponse.json(citation, { status: 201 });
    }
    const citation = await createCitation({
      project_id: projectId,
      title: manualCitation.title!,
      authors: manualCitation.authors,
      year: manualCitation.year,
      journal: manualCitation.journal,
      doi: manualCitation.doi,
      url: manualCitation.url,
      abstract: manualCitation.abstract,
      source: 'user_added',
      verified: !!manualCitation.doi,
    });
    return NextResponse.json(citation, { status: 201 });
  } catch (error) {
    log.error({ error }, 'Failed to create citation');
    return NextResponse.json({ error: 'Failed to create citation' }, { status: 500 });
  }
}
