import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock
const { mockGetUser, mockUpdateAIOperationStatus, mockCreateAuditLog } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateAIOperationStatus: vi.fn(),
  mockCreateAuditLog: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/api/ai-operations', () => ({
  updateAIOperationStatus: mockUpdateAIOperationStatus,
}));

vi.mock('@/lib/api/audit', () => ({
  createAuditLog: mockCreateAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import route after mocks are set up
import { PATCH } from '../route';

describe('AI Operations Update Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpdateAIOperationStatus.mockResolvedValue({
      id: 'op-1',
      status: 'accepted',
      operation_type: 'global',
    });
    mockCreateAuditLog.mockResolvedValue(undefined);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'op-1' }) });
    expect(response.status).toBe(401);
  });

  it('should update operation status to accepted', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'op-1' }) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('accepted');
    expect(mockUpdateAIOperationStatus).toHaveBeenCalledWith('op-1', 'accepted', undefined);
  });

  it('should update operation status with outputContent', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted', outputContent: 'Updated content' }),
    });
    await PATCH(request, { params: Promise.resolve({ id: 'op-1' }) });

    expect(mockUpdateAIOperationStatus).toHaveBeenCalledWith('op-1', 'accepted', 'Updated content');
  });

  it('should update operation status to rejected', async () => {
    mockUpdateAIOperationStatus.mockResolvedValueOnce({
      id: 'op-1',
      status: 'rejected',
      operation_type: 'global',
    });

    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'op-1' }) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('rejected');
  });

  it('should create audit log for status update', async () => {
    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    await PATCH(request, { params: Promise.resolve({ id: 'op-1' }) });

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      'ai:operation-status',
      expect.objectContaining({
        userId: 'user-1',
        operationId: 'op-1',
        status: 'accepted',
      })
    );
  });

  it('should return 500 on error', async () => {
    mockUpdateAIOperationStatus.mockRejectedValueOnce(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/ai/operations/op-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'op-1' }) });
    expect(response.status).toBe(500);
  });
});
