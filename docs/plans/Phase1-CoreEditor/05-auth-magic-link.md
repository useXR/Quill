# Task 4: Supabase Auth with Magic Link

> **Phase 1** | [← Editor Toolbar](./04-editor-toolbar.md) | [Next: Auth Middleware →](./06-auth-middleware.md)

---

## Context

**This task implements passwordless authentication using magic links.** Includes rate limiting to prevent abuse.

### Prerequisites

- **Task 1** completed (Testing infrastructure)
- **Task 0** completed (auth_attempts table and rate limit function)

### What This Task Creates

- `src/lib/auth/rate-limit.ts` - Rate limiting helpers
- `src/lib/auth/__tests__/rate-limit.test.ts` - Rate limit tests
- `src/lib/auth/index.ts` - Auth barrel export
- `src/app/api/auth/check-rate-limit/route.ts` - Rate limit API
- `src/app/auth/callback/route.ts` - Auth callback handler
- `src/components/auth/__tests__/LoginForm.test.tsx` - Login form tests
- `src/components/auth/LoginForm.tsx` - Login form component
- `src/contexts/auth.tsx` - Auth context provider
- `src/app/login/page.tsx` - Login page
- `src/app/layout.tsx` - Updated with AuthProvider

### Tasks That Depend on This

- **Task 5** (Auth Middleware) - Uses auth state for route protection
- **Task 6** (Projects CRUD) - Requires authenticated user

### Parallel Tasks

This task can be done in parallel with:

- **Task 2** (TipTap Editor)
- **Task 3** (Editor Toolbar)

---

## Files to Create/Modify

- `src/lib/auth/rate-limit.ts` (create)
- `src/lib/auth/__tests__/rate-limit.test.ts` (create)
- `src/lib/auth/index.ts` (create)
- `src/app/api/auth/check-rate-limit/route.ts` (create)
- `src/app/auth/callback/route.ts` (create)
- `src/components/auth/__tests__/LoginForm.test.tsx` (create)
- `src/components/auth/LoginForm.tsx` (create)
- `src/contexts/auth.tsx` (create)
- `src/app/login/page.tsx` (create)
- `src/app/layout.tsx` (modify)

---

## Steps

### Step 4.1: Write the failing test for rate limiting

Create `src/lib/auth/__tests__/rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit, recordAuthAttempt } from '../rate-limit';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow when under limit', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await checkRateLimit('test@example.com', '127.0.0.1');

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block when over limit', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await checkRateLimit('spam@example.com', '127.0.0.1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(3600);
    });

    it('should fail open on database error', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await checkRateLimit('test@example.com', '127.0.0.1');

      expect(result.allowed).toBe(true);
    });
  });

  describe('recordAuthAttempt', () => {
    it('should record attempt to database', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({ insert: insertMock }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await recordAuthAttempt('test@example.com', '127.0.0.1', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('auth_attempts');
      expect(insertMock).toHaveBeenCalledWith({
        email: 'test@example.com',
        ip_address: '127.0.0.1',
        success: true,
      });
    });
  });
});
```

### Step 4.2: Run test to verify it fails

```bash
npm test src/lib/auth/__tests__/rate-limit.test.ts
```

**Expected:** FAIL - module '../rate-limit' not found

### Step 4.3: Implement rate limiting helper

Create `src/lib/auth/rate-limit.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { AUTH } from '@/lib/constants';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(email: string, ipAddress: string): Promise<RateLimitResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('check_auth_rate_limit', {
    p_email: email,
    p_ip: ipAddress,
  });

  if (error) {
    // Log error with context, but fail open to avoid blocking legitimate users
    logger.error({ error, email, ipAddress }, 'Rate limit check failed');
    return { allowed: true };
  }

  const retryAfterSeconds = AUTH.RATE_LIMIT_WINDOW_MINUTES * 60;

  return {
    allowed: data === true,
    retryAfter: data === true ? undefined : retryAfterSeconds,
  };
}

/**
 * SECURITY NOTE: Fail-Open Behavior
 *
 * On database errors, checkRateLimit returns { allowed: true } ("fail open").
 * This prioritizes availability over strict rate limiting.
 *
 * Tradeoff:
 * - PRO: Legitimate users aren't blocked by transient DB issues
 * - CON: Attackers could exploit DB outages to bypass rate limits
 *
 * For high-security environments, consider "fail closed" (return allowed: false)
 * or implementing a fallback in-memory rate limiter.
 */

export async function recordAuthAttempt(email: string, ipAddress: string, success: boolean): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('auth_attempts').insert({
    email,
    ip_address: ipAddress,
    success,
  });

  if (error) {
    logger.warn({ error, email }, 'Failed to record auth attempt');
  }
}
```

### Step 4.4: Run test to verify it passes

```bash
npm test src/lib/auth/__tests__/rate-limit.test.ts
```

**Expected:** PASS

### Step 4.5: Create rate limit API route

Create `src/app/api/auth/check-rate-limit/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkRateLimit, recordAuthAttempt } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ allowed: false, error: 'Email is required' }, { status: 400 });
    }

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    const result = await checkRateLimit(email, ipAddress);

    if (!result.allowed) {
      await recordAuthAttempt(email, ipAddress, false);
      logger.info({ email, ipAddress }, 'Auth rate limited');
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, 'Rate limit check error');
    return NextResponse.json({ allowed: true });
  }
}
```

### Step 4.6: Create auth callback route

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const ALLOWED_REDIRECTS = ['/', '/projects', '/editor'];

function isValidRedirect(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) {
    return ALLOWED_REDIRECTS.some((allowed) => url === allowed || url.startsWith(allowed + '/'));
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  const redirectTo = isValidRedirect(next) ? next : '/projects';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      logger.info({ redirectTo }, 'Auth callback success');
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    logger.error({ error: error.message, code: error.code }, 'Auth callback failed');
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### Step 4.7: Write the failing test for LoginForm

Create `src/components/auth/__tests__/LoginForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

global.fetch = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ allowed: true }),
    });
  });

  describe('Rendering', () => {
    it('should render email input and submit button', () => {
      render(<LoginForm />);

      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Magic Link' })).toBeInTheDocument();
    });
  });

  describe('Submission', () => {
    it('should show loading state when submitting', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });

    it('should show success message after magic link sent', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('should show rate limit error when exceeded', async () => {
      (fetch as any).mockResolvedValue({
        json: () => Promise.resolve({ allowed: false, retryAfter: 3600 }),
      });

      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/Too many attempts/)).toBeInTheDocument();
      });
    });
  });
});
```

### Step 4.8: Run test to verify it fails

```bash
npm test src/components/auth/__tests__/LoginForm.test.tsx
```

**Expected:** FAIL - module '../LoginForm' not found

### Step 4.9: Implement LoginForm component

Create `src/components/auth/LoginForm.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type LoginState = 'idle' | 'loading' | 'success' | 'error' | 'rate_limited';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Mark form as hydrated for E2E tests
  // React SSR hydration can clear form inputs - this signals when it's safe to interact
  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');

    try {
      const rateLimitResponse = await fetch('/api/auth/check-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const rateLimitData = await rateLimitResponse.json();

      if (!rateLimitData.allowed) {
        setState('rate_limited');
        setErrorMessage(
          `Too many attempts. Please try again in ${Math.ceil(
            rateLimitData.retryAfter / 60
          )} minutes.`
        );
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setState('error');
        setErrorMessage('Failed to send magic link. Please try again.');
        return;
      }

      setState('success');
    } catch {
      setState('error');
      setErrorMessage('An unexpected error occurred.');
    }
  };

  if (state === 'success') {
    return (
      <div className="text-center p-6">
        <h2 className="text-xl font-semibold text-green-600 mb-2">
          Check your email
        </h2>
        <p className="text-gray-600">
          We sent a magic link to <strong>{email}</strong>
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="login-form"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={state === 'loading'}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {(state === 'error' || state === 'rate_limited') && (
        <p className="text-sm text-red-600" role="alert">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={state === 'loading' || state === 'rate_limited'}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
```

**Key E2E testing features:**

- `data-hydrated="true"` attribute signals when form is ready for interaction
- `data-testid="login-form"` for reliable element selection
- `name="email"` attribute for form field targeting
- `role="alert"` on error messages for accessibility

### Step 4.10: Run test to verify it passes

```bash
npm test src/components/auth/__tests__/LoginForm.test.tsx
```

**Expected:** PASS

### Step 4.11: Create login page

Create `src/app/login/page.tsx`:

```typescript
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">
          Sign in to Quill
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
```

### Step 4.12: Create auth barrel export

Create `src/lib/auth/index.ts`:

```typescript
export { checkRateLimit, recordAuthAttempt } from './rate-limit';
export type { RateLimitResult } from './rate-limit';
```

### Step 4.13: Create auth context provider

Create `src/contexts/auth.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext value={{ user, loading }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Step 4.14: Add AuthProvider to root layout

Modify `src/app/layout.tsx` to wrap the app with AuthProvider:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Quill - Grant Writing Made Easy',
  description: 'AI-powered grant proposal writing assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Step 4.15: Commit

```bash
git add src/lib/auth src/app/api/auth src/app/auth src/components/auth src/contexts src/app/login src/app/layout.tsx
git commit -m "feat: add auth with magic link, rate limiting, AuthProvider, and login form"
```

---

## Verification Checklist

- [ ] Rate limit tests pass
- [ ] Rate limit helper works (uses structured logger)
- [ ] Rate limit "fails open" on database errors (allows request, logs error) - documented security/availability tradeoff
- [ ] Rate limit API route created (uses structured logger)
- [ ] Auth callback route created (uses structured logger)
- [ ] Auth barrel export created (`src/lib/auth/index.ts`)
- [ ] LoginForm tests pass
- [ ] LoginForm component renders
- [ ] Success message shows after submission
- [ ] Rate limit error shows when exceeded
- [ ] AuthProvider created (`src/contexts/auth.tsx`)
- [ ] Root layout updated with AuthProvider
- [ ] Login page created
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 5: Auth Middleware](./06-auth-middleware.md)**.
