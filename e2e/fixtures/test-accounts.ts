/**
 * Single source of truth for test accounts.
 * Never duplicate account definitions elsewhere.
 */
export const TEST_PASSWORD = 'password123';

// Shared accounts (for serial tests requiring specific roles)
export const SHARED_ACCOUNTS = {
  owner: { email: 'owner@test.local', password: TEST_PASSWORD, role: 'owner' as const },
  admin: { email: 'admin@test.local', password: TEST_PASSWORD, role: 'admin' as const },
  member: { email: 'member@test.local', password: TEST_PASSWORD, role: 'member' as const },
  viewer: { email: 'viewer@test.local', password: TEST_PASSWORD, role: 'viewer' as const },
} as const;

// Worker accounts (for parallel tests - each worker gets isolated data)
export const MAX_WORKERS = 8;

export function getWorkerAccount(index: number) {
  return {
    email: `worker${index}@test.local`,
    password: TEST_PASSWORD,
    name: `Worker ${index}`,
  };
}

export type SharedAccountKey = keyof typeof SHARED_ACCOUNTS;
