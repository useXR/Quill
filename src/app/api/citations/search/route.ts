import { NextRequest, NextResponse } from 'next/server';
import { searchPapersWithCache, SemanticScholarError } from '@/lib/citations';
import { searchQuerySchema } from '@/lib/citations/schemas';
import { citationLogger } from '@/lib/citations/logger';

const log = citationLogger({});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validationResult = searchQuerySchema.safeParse({
    q: searchParams.get('q'),
    limit: searchParams.get('limit'),
  });
  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 });
  }
  const { q: query, limit } = validationResult.data;
  try {
    const papers = await searchPapersWithCache(query, limit);
    return NextResponse.json({ papers, total: papers.length });
  } catch (error) {
    if (error instanceof SemanticScholarError && error.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429 });
    }
    log.error({ error }, 'Search failed');
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
