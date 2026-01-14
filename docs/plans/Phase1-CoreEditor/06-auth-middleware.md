# Task 5: Auth Middleware

> **Phase 1** | [← Auth Magic Link](./05-auth-magic-link.md) | [Next: Projects CRUD →](./07-projects-crud.md)

---

## Context

**This task creates middleware to protect routes requiring authentication.** Unauthenticated users are redirected to login.

> **Note:** Cookie `sameSite` is set to `'lax'` by Supabase SSR, which is required for OAuth redirect chains to work correctly. See Best Practices §6.2.

### Prerequisites

- **Task 4** completed (Auth with magic link)

### What This Task Creates

- `src/middleware.ts` - Route protection middleware
- `src/__tests__/middleware.test.ts` - Middleware tests

### Tasks That Depend on This

- **Task 6** (Projects CRUD) - Requires auth middleware for route protection
- **Task 7** (Documents CRUD) - Same

---

## Files to Create/Modify

- `src/middleware.ts` (create)
- `src/__tests__/middleware.test.ts` (create)

---

## Steps

### Step 5.1: Write the failing test for middleware

Create `src/__tests__/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated user from /projects to /login', async () => {
      // Mock unauthenticated user
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/projects');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/projects');

      const response = await middleware(request as any);

      expect(response.status).toBe(307); // Redirect
    });

    it('should allow authenticated user to access /projects', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
          }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/projects');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/projects');

      const response = await middleware(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('Public Routes', () => {
    it('should allow access to /login without auth', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/login');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/login');

      const response = await middleware(request as any);

      expect(response.status).toBe(200);
    });

    it('should redirect authenticated user from /login to /projects', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
          }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/login');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/login');

      const response = await middleware(request as any);

      expect(response.status).toBe(307);
    });
  });
});
```

### Step 5.2: Run test to verify it fails

```bash
npm test src/__tests__/middleware.test.ts
```

**Expected:** FAIL - module '../middleware' not found

### Step 5.3: Implement middleware

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

const PROTECTED_ROUTES = ['/projects', '/editor', '/vault'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Step 5.4: Run test to verify it passes

```bash
npm test src/__tests__/middleware.test.ts
```

**Expected:** PASS

### Step 5.5: Commit

```bash
git add src/middleware.ts src/__tests__/middleware.test.ts
git commit -m "feat: add auth middleware for route protection"
```

---

## Verification Checklist

- [ ] Middleware tests pass
- [ ] Unauthenticated users redirected from protected routes
- [ ] Authenticated users can access protected routes
- [ ] Login page accessible without auth
- [ ] Authenticated users redirected from login to projects
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 6: Projects CRUD](./07-projects-crud.md)**.
