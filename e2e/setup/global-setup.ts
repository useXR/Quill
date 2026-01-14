import * as fs from 'fs';

async function globalSetup() {
  console.log('\n[Playwright] Global setup starting...');

  // Check for CRLF line endings in env file (breaks bash sourcing)
  const envTestPath = '.env.test';
  if (fs.existsSync(envTestPath)) {
    const envContent = fs.readFileSync(envTestPath, 'utf-8');
    if (envContent.includes('\r\n')) {
      console.warn('[Setup] Warning: .env.test has CRLF line endings, converting...');
      fs.writeFileSync(envTestPath, envContent.replace(/\r\n/g, '\n'));
    }
  }

  // Verify environment
  if (!process.env.CI) {
    console.log('[Setup] Running in local development mode');
  }

  // Check if Supabase is healthy (if URL is configured)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const isHealthy = await checkSupabaseHealth(supabaseUrl);
    if (!isHealthy) {
      console.warn('[Setup] Warning: Supabase health check failed. Some tests may fail.');
      console.warn('[Setup] Run: pnpm exec supabase start');
    } else {
      console.log('[Setup] Supabase is healthy');
    }
  }

  console.log('[Playwright] Global setup complete\n');
}

async function checkSupabaseHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    });
    return response.ok || response.status === 400; // 400 means API is responding
  } catch {
    return false;
  }
}

export default globalSetup;
