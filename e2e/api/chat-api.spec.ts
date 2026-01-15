import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Chat API E2E Tests', () => {
  test.describe('Authentication', () => {
    test('should return 401 for unauthenticated requests to /api/chat/history', async ({ request }) => {
      // Make request without authentication
      const response = await request.get('/api/chat/history?projectId=550e8400-e29b-41d4-a716-446655440000');

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 for unauthenticated requests to /api/ai/chat', async ({ request }) => {
      const response = await request.post('/api/ai/chat', {
        data: {
          content: 'Test message',
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          projectId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should return 401 for unauthenticated requests to /api/ai/global-edit', async ({ request }) => {
      const response = await request.post('/api/ai/global-edit', {
        data: {
          instruction: 'Make this formal',
          currentContent: 'Test content',
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          projectId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Validation', () => {
    test('should return 400 for invalid projectId in chat history', async ({ request }) => {
      const response = await request.get('/api/chat/history?projectId=invalid-uuid');

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('should return 400 for missing projectId in chat history', async ({ request }) => {
      const response = await request.get('/api/chat/history');

      expect(response.status()).toBe(400);
    });

    test('should return 400 for missing documentId in operations list', async ({ request }) => {
      const response = await request.get('/api/ai/operations');

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Rate Limiting', () => {
    test('should return 429 with retryAfter when rate limit exceeded', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Navigate to set up cookies
      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      // Make rapid requests to trigger rate limit
      // Note: The rate limit is 20 requests per minute, so we need more than 20
      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 25; i++) {
        requests.push(
          page.request.post('/api/ai/chat', {
            data: {
              content: `Test message ${i}`,
              documentId: workerCtx.documentId,
              projectId: workerCtx.projectId,
            },
          })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = responses.filter((r) => r.status() === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Check retryAfter in body
      const rateLimitedResponse = rateLimited[0];
      const body = await rateLimitedResponse.json();
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.retryAfter).toBeGreaterThan(0);
    });
  });

  test.describe('Successful Operations', () => {
    test('should create chat message and return SSE stream', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      // Navigate to set up cookies
      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      // Make authenticated request
      const response = await page.request.post('/api/ai/chat', {
        data: {
          content: 'Hello, this is a test message',
          documentId: workerCtx.documentId,
          projectId: workerCtx.projectId,
          mode: 'discussion',
        },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/event-stream');
    });

    test('should fetch chat history for valid project', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      const response = await page.request.get(`/api/chat/history?projectId=${workerCtx.projectId}`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('hasMore');
    });

    test('should delete chat history for valid project', async ({ page, workerCtx, loginAsWorker }) => {
      await loginAsWorker();

      await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
        timeout: TIMEOUTS.PAGE_LOAD,
      });

      const response = await page.request.delete('/api/chat/history', {
        data: { projectId: workerCtx.projectId },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});

test.describe('Global Edit API', () => {
  test('global-edit endpoint returns diff with changes', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    const response = await page.request.post('/api/ai/global-edit', {
      data: {
        instruction: 'Make this more formal',
        currentContent: 'This is some casual text.',
        documentId: workerCtx.documentId,
        projectId: workerCtx.projectId,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');

    // Parse SSE response and verify diff structure
    const body = await response.text();
    expect(body).toContain('"type":"done"');
    expect(body).toContain('"diff"');
    expect(body).toContain('"operationId"');
  });

  test('global-edit endpoint validates instruction length', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    // Send instruction exceeding max length (50000 chars)
    const longInstruction = 'x'.repeat(50001);
    const response = await page.request.post('/api/ai/global-edit', {
      data: {
        instruction: longInstruction,
        currentContent: 'Test content',
        documentId: workerCtx.documentId,
        projectId: workerCtx.projectId,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('Authorization', () => {
  test('user cannot access another user chat history', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();

    // Navigate to establish session
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    // Attempt to access chat history with a different user's project ID
    // This should be blocked by RLS policies
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';
    const response = await page.request.get(`/api/chat/history?projectId=${fakeProjectId}`);

    // Should return empty array or 403 forbidden based on RLS
    expect([200, 403]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.data).toEqual([]);
    }
  });

  test('user cannot update another user AI operation', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    // Attempt to update a non-existent or other user's operation
    const fakeOperationId = '00000000-0000-0000-0000-000000000000';
    const response = await page.request.patch(`/api/ai/operations/${fakeOperationId}`, {
      data: { status: 'accepted' },
    });

    // Should fail because operation doesn't exist or belongs to another user
    expect([403, 404, 500]).toContain(response.status());
  });
});

test.describe('Input Sanitization', () => {
  test('API rejects prompt starting with CLI flags', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    const response = await page.request.post('/api/ai/chat', {
      data: {
        content: '--help inject attack',
        documentId: workerCtx.documentId,
        projectId: workerCtx.projectId,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('SANITIZATION_ERROR');
  });

  test('API rejects prompt starting with double dash flags', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    const response = await page.request.post('/api/ai/global-edit', {
      data: {
        instruction: '-p malicious',
        currentContent: 'Test content',
        documentId: workerCtx.documentId,
        projectId: workerCtx.projectId,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('SANITIZATION_ERROR');
  });
});

test.describe('AI Operations API', () => {
  test('should fetch operations for valid document', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    const response = await page.request.get(`/api/ai/operations?documentId=${workerCtx.documentId}`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('should support limit parameter in operations list', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`, {
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    const response = await page.request.get(`/api/ai/operations?documentId=${workerCtx.documentId}&limit=5`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    // Results should be limited (may be empty if no operations exist)
    expect(body.length).toBeLessThanOrEqual(5);
  });
});
