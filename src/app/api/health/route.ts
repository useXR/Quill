import { NextResponse } from 'next/server';

interface HealthCheck {
  status: 'ok' | 'error' | 'degraded';
  latency?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
  };
}

/**
 * Health check endpoint for:
 * - Docker container health checks
 * - CI/CD pipeline verification
 * - Load balancer health probes
 * - Monitoring and alerting
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const checks = {
    database: await checkDatabase(),
  };

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  const anyDegraded = Object.values(checks).some((c) => c.status === 'degraded');

  const status = allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy';

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'development',
    checks,
  };

  return NextResponse.json(response, {
    status: status === 'unhealthy' ? 503 : 200,
  });
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    return {
      status: 'error',
      error: 'NEXT_PUBLIC_SUPABASE_URL not configured',
    };
  }

  if (!supabaseKey) {
    return {
      status: 'error',
      error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY not configured',
    };
  }

  try {
    // Query profiles table to verify database connectivity
    // This is more reliable than HEAD request to REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      // Health check timeout should be short for load balancers
      signal: AbortSignal.timeout(2000),
    });

    const latency = Date.now() - start;

    // 200 = success, 406 = table exists but no rows match (acceptable)
    if (response.ok || response.status === 406) {
      return { status: 'ok', latency };
    }

    // 401 = invalid key, 404 = table doesn't exist (both degraded, not error)
    if (response.status === 401 || response.status === 404) {
      return {
        status: 'degraded',
        latency,
        error: `Database responded with ${response.status}`,
      };
    }

    return {
      status: 'degraded',
      latency,
      error: `Unexpected status: ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
