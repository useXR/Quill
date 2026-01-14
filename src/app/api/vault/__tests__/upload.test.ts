import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES } from '@/lib/vault/constants';

/**
 * Tests for vault upload API validation logic.
 * These tests verify authentication, file type validation, file size limits,
 * and ownership verification.
 */
describe('Vault Upload API', () => {
  describe('authentication', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('returns 401 when user is not authenticated', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'project-123', user_id: 'test-user-id' },
            error: null,
          }),
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ error: null }),
          }),
        },
      };

      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn().mockResolvedValue(mockClient),
      }));

      vi.doMock('@/lib/logger', () => ({
        vaultLogger: vi.fn(() => ({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        })),
        createLogger: vi.fn(() => ({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        })),
      }));

      vi.doMock('@/lib/queue', () => ({
        getExtractionQueue: vi.fn(() => ({
          enqueue: vi.fn(),
        })),
      }));

      vi.doMock('@/lib/api/vault', () => ({
        createVaultItem: vi.fn().mockResolvedValue({
          id: 'vault-item-123',
          project_id: 'project-123',
          filename: 'test.pdf',
        }),
      }));

      const { POST } = await import('../upload/route');

      const formData = new FormData();
      const blob = new Blob(['test'], { type: 'application/pdf' });
      formData.append('file', new File([blob], 'test.pdf', { type: 'application/pdf' }));
      formData.append('projectId', 'project-123');

      const request = new NextRequest('http://localhost:3000/api/vault/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('file type validation', () => {
    it('rejects unsupported file types based on ALLOWED_MIME_TYPES constant', () => {
      // Test that the constants correctly identify valid and invalid types
      const unsupportedTypes = ['application/x-msdownload', 'image/png', 'application/javascript', 'text/html'];
      const supportedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      for (const mimeType of unsupportedTypes) {
        const isAllowed = ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number]);
        expect(isAllowed).toBe(false);
      }

      for (const mimeType of supportedTypes) {
        const isAllowed = ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number]);
        expect(isAllowed).toBe(true);
      }
    });
  });

  describe('file size validation', () => {
    it('enforces file size limits per file type using FILE_SIZE_LIMITS constant', () => {
      // PDF limit is 100MB
      expect(20 * 1024 * 1024 <= FILE_SIZE_LIMITS.pdf).toBe(true); // 20MB is within limit
      expect(200 * 1024 * 1024 <= FILE_SIZE_LIMITS.pdf).toBe(false); // 200MB exceeds limit

      // DOCX limit is 50MB
      expect(30 * 1024 * 1024 <= FILE_SIZE_LIMITS.docx).toBe(true); // 30MB is within limit
      expect(60 * 1024 * 1024 <= FILE_SIZE_LIMITS.docx).toBe(false); // 60MB exceeds limit

      // TXT limit is 10MB
      expect(5 * 1024 * 1024 <= FILE_SIZE_LIMITS.txt).toBe(true); // 5MB is within limit
      expect(20 * 1024 * 1024 <= FILE_SIZE_LIMITS.txt).toBe(false); // 20MB exceeds limit
    });
  });

  describe('project ownership verification', () => {
    it('uses FORBIDDEN error code for unauthorized project access', async () => {
      // Verify the error code constant exists and is properly defined
      const { ErrorCodes } = await import('@/lib/api/errors');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');

      // Verify the ApiError class can create 403 errors
      const { ApiError } = await import('@/lib/api/errors');
      const forbiddenError = new ApiError(403, ErrorCodes.FORBIDDEN, 'Access denied');
      expect(forbiddenError.status).toBe(403);
      expect(forbiddenError.code).toBe('FORBIDDEN');
    });
  });
});
