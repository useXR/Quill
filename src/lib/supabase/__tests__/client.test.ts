import { describe, it, expect } from 'vitest';

describe('Supabase client', () => {
  it('should have required environment variables defined in test env', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });

  it('should export createClient function', async () => {
    const clientModule = await import('../client');
    expect(clientModule.createClient).toBeDefined();
    expect(typeof clientModule.createClient).toBe('function');
  });

  it('should return a client with expected methods', async () => {
    const { createClient } = await import('../client');
    const client = createClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth.getSession).toBe('function');
    expect(typeof client.auth.signInWithOtp).toBe('function');
  });
});
