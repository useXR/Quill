import { vi } from 'vitest';
import type { User, AuthError } from '@supabase/supabase-js';

// ============================================
// AUTH MOCK TYPES
// ============================================

export interface MockAuthUser extends Partial<User> {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface MockSession {
  user: MockAuthUser;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  expires_in?: number;
}

export interface MockAuthState {
  user: MockAuthUser | null;
  session: MockSession | null;
  error: AuthError | null;
}

// ============================================
// QUERY BUILDER MOCK
// ============================================

export interface MockQueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code: string } | null;
  count?: number;
  status?: number;
  statusText?: string;
}

export interface MockQueryBuilder<T = unknown> {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  containedBy: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
  _result: MockQueryResult<T>;
}

/**
 * Create a chainable mock query builder for Supabase queries
 */
export function createMockQueryBuilder<T = unknown>(
  result: MockQueryResult<T> = { data: null, error: null }
): MockQueryBuilder<T> {
  const builder: MockQueryBuilder<T> = {
    _result: result,
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    like: vi.fn(),
    ilike: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    contains: vi.fn(),
    containedBy: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
  };

  // Make all methods chainable and return the builder
  const chainableMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'containedBy',
    'order',
    'limit',
    'range',
  ] as const;

  for (const method of chainableMethods) {
    builder[method].mockReturnValue(builder);
  }

  // Terminal methods resolve to the result
  builder.single.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  builder.then.mockImplementation((resolve) => resolve(result));

  return builder;
}

/**
 * Set the result for a mock query builder
 */
export function setMockQueryResult<T>(builder: MockQueryBuilder<T>, result: MockQueryResult<T>): void {
  builder._result = result;
  builder.single.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  builder.then.mockImplementation((resolve) => resolve(result));
}

// ============================================
// AUTH MOCK
// ============================================

export interface MockAuth {
  getUser: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  signInWithOtp: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  resetPasswordForEmail: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
  _state: MockAuthState;
}

/**
 * Create a mock auth object with common methods
 */
export function createMockAuth(initialState: Partial<MockAuthState> = {}): MockAuth {
  const state: MockAuthState = {
    user: initialState.user ?? null,
    session: initialState.session ?? null,
    error: initialState.error ?? null,
  };

  const mockAuth: MockAuth = {
    _state: state,
    getUser: vi.fn().mockResolvedValue({ data: { user: state.user }, error: state.error }),
    getSession: vi.fn().mockResolvedValue({ data: { session: state.session }, error: state.error }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: state.user, session: state.session },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: state.user, session: state.session },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: state.user }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({
      data: { user: state.user, session: state.session },
      error: null,
    }),
  };

  return mockAuth;
}

/**
 * Set the user for a mock auth instance
 */
export function setMockAuthUser(auth: MockAuth, user: MockAuthUser | null): void {
  auth._state.user = user;
  auth._state.session = user ? { user, access_token: 'mock-token' } : null;
  auth.getUser.mockResolvedValue({ data: { user }, error: null });
  auth.getSession.mockResolvedValue({
    data: { session: auth._state.session },
    error: null,
  });
}

/**
 * Set an error for a mock auth instance
 */
export function setMockAuthError(auth: MockAuth, error: AuthError | null): void {
  auth._state.error = error;
  auth.getUser.mockResolvedValue({ data: { user: null }, error });
  auth.getSession.mockResolvedValue({ data: { session: null }, error });
}

// ============================================
// SUPABASE CLIENT MOCK
// ============================================

export interface MockSupabaseClient {
  auth: MockAuth;
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  _queryBuilders: Map<string, MockQueryBuilder>;
}

/**
 * Create a fully mocked Supabase client
 */
export function createMockSupabaseClient(authState: Partial<MockAuthState> = {}): MockSupabaseClient {
  const queryBuilders = new Map<string, MockQueryBuilder>();

  const mockClient: MockSupabaseClient = {
    auth: createMockAuth(authState),
    from: vi.fn((table: string) => {
      if (!queryBuilders.has(table)) {
        queryBuilders.set(table, createMockQueryBuilder());
      }
      return queryBuilders.get(table)!;
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://mock-url.com' } }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://mock-signed-url.com' },
          error: null,
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
    _queryBuilders: queryBuilders,
  };

  return mockClient;
}

/**
 * Get or create a query builder for a specific table
 */
export function getMockQueryBuilder<T = unknown>(client: MockSupabaseClient, table: string): MockQueryBuilder<T> {
  if (!client._queryBuilders.has(table)) {
    client._queryBuilders.set(table, createMockQueryBuilder<T>());
  }
  return client._queryBuilders.get(table) as MockQueryBuilder<T>;
}

/**
 * Set the result for a specific table's query builder
 */
export function setMockTableResult<T>(client: MockSupabaseClient, table: string, result: MockQueryResult<T>): void {
  const builder = getMockQueryBuilder<T>(client, table);
  setMockQueryResult(builder, result);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a mock user with sensible defaults
 */
export function createMockUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  return {
    id: overrides.id ?? 'test-user-id',
    email: overrides.email ?? 'test@example.com',
    app_metadata: overrides.app_metadata ?? {},
    user_metadata: overrides.user_metadata ?? {},
    ...overrides,
  };
}

/**
 * Create a mock session with sensible defaults
 */
export function createMockSession(
  user: MockAuthUser = createMockUser(),
  overrides: Partial<MockSession> = {}
): MockSession {
  return {
    user,
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

/**
 * Create a mock error result
 */
export function createMockError(message: string, code: string = 'MOCK_ERROR'): { message: string; code: string } {
  return { message, code };
}
