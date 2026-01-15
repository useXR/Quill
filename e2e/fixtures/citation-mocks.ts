// e2e/fixtures/citation-mocks.ts
import { Page } from '@playwright/test';

/**
 * Setup mock handlers for citation-related APIs.
 * Use in beforeEach of citation tests.
 */
export async function setupCitationMocks(page: Page) {
  // Mock Semantic Scholar API
  await page.route('**/api.semanticscholar.org/**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query') || '';

    // Empty results
    if (query.includes('__empty__')) {
      await route.fulfill({ json: { total: 0, data: [] } });
      return;
    }

    // Error response
    if (query.includes('__error__')) {
      await route.fulfill({ status: 500, json: { error: 'Server error' } });
      return;
    }

    // Rate limit response
    if (query.includes('__rate_limited__')) {
      await route.fulfill({
        status: 429,
        json: { error: 'Rate limited' },
        headers: { 'Retry-After': '60' },
      });
      return;
    }

    // Default: return mock results
    await route.fulfill({
      json: {
        total: 2,
        data: [
          {
            paperId: 'mock-1',
            title: `Mock Paper: ${query}`,
            authors: [{ name: 'Test Author' }],
            year: 2024,
            externalIds: { DOI: '10.1000/mock1' },
            url: 'https://example.com',
            citationCount: 100,
            isOpenAccess: true,
          },
          {
            paperId: 'mock-2',
            title: `Second Paper: ${query}`,
            authors: [{ name: 'Another Author' }],
            year: 2023,
            externalIds: {},
            url: 'https://example.com/2',
            citationCount: 50,
          },
        ],
      },
    });
  });

  // Mock internal citations API search endpoint
  await page.route('**/api/citations/search**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') || '';

    if (query.includes('__empty__')) {
      await route.fulfill({ json: { papers: [], total: 0 } });
      return;
    }

    if (query.includes('__error__')) {
      await route.fulfill({ status: 500, json: { error: 'Search failed' } });
      return;
    }

    if (query.includes('__rate_limited__')) {
      await route.fulfill({
        status: 429,
        json: { error: 'Rate limited', retryAfter: 60 },
      });
      return;
    }

    await route.fulfill({
      json: {
        papers: [
          {
            paperId: 'internal-1',
            title: `Search Result: ${query}`,
            authors: [{ name: 'Mock Author' }],
            year: 2024,
            url: 'https://example.com',
            externalIds: { DOI: '10.1000/internal' },
          },
        ],
        total: 1,
      },
    });
  });
}

export async function setupCitationListMocks(page: Page, citations: unknown[] = []) {
  await page.route('**/api/citations?**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: citations });
    } else {
      await route.continue();
    }
  });
}

/**
 * Setup mock for rate limit scenarios with customizable behavior
 */
export async function setupRateLimitMock(page: Page, options: { retryAfter?: number } = {}) {
  const retryAfter = options.retryAfter ?? 60;

  await page.route('**/api/citations/search**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') || '';

    if (query.includes('__rate_limited__')) {
      await route.fulfill({
        status: 429,
        json: {
          error: 'Rate limited',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        headers: {
          'Retry-After': String(retryAfter),
        },
      });
      return;
    }

    // Default: return normal results
    await route.fulfill({
      json: {
        papers: [
          {
            paperId: 'test-1',
            title: 'Normal Result',
            authors: [{ name: 'Author' }],
            year: 2024,
            url: 'https://example.com',
          },
        ],
        total: 1,
      },
    });
  });
}
