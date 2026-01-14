import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockUser } from '@/test-utils/supabase-mock';

// Mock @supabase/ssr before importing middleware
const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock the env module
vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'test-anon-key',
  },
}));

// Helper to create a mock NextRequest
function createMockRequest(pathname: string, origin = 'http://localhost:3000'): NextRequest {
  const url = new URL(pathname, origin);
  return new NextRequest(url, {
    headers: new Headers(),
  });
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('protected routes', () => {
    it('should redirect unauthenticated user from /projects to /login', async () => {
      // Arrange: User is not authenticated
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/projects');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(307); // Temporary redirect
      const redirectUrl = new URL(response.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/projects');
    });

    it('should redirect unauthenticated user from /editor to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/editor/some-document');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = new URL(response.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/editor/some-document');
    });

    it('should redirect unauthenticated user from /vault to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/vault');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = new URL(response.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/vault');
    });

    it('should allow authenticated user to access /projects', async () => {
      // Arrange: User is authenticated
      const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/projects');

      // Act
      const response = await middleware(request);

      // Assert: Should not redirect (status 200 or no redirect header)
      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });

    it('should allow authenticated user to access /editor', async () => {
      const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/editor/doc-id');

      const response = await middleware(request);

      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });

    it('should allow authenticated user to access /vault', async () => {
      const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/vault');

      const response = await middleware(request);

      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });
  });

  describe('public routes', () => {
    it('should allow access to /login without auth', async () => {
      // Arrange: User is not authenticated
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/login');

      // Act
      const response = await middleware(request);

      // Assert: Should not redirect
      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });

    it('should allow access to the home page without auth', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/');

      const response = await middleware(request);

      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });
  });

  describe('login page redirect for authenticated users', () => {
    it('should redirect authenticated user from /login to /projects', async () => {
      // Arrange: User is authenticated
      const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/login');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(307);
      const redirectUrl = new URL(response.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/projects');
    });
  });

  describe('nested protected routes', () => {
    it('should protect nested routes under /projects', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/projects/123/settings');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = new URL(response.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/projects/123/settings');
    });

    it('should protect nested routes under /editor', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { middleware } = await import('@/middleware');
      const request = createMockRequest('/editor/doc-123/version/1');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const redirectUrl = new URL(response.headers.get('location')!);
      expect(redirectUrl.pathname).toBe('/login');
    });
  });
});
