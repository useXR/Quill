-- Auth attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now() NOT NULL,
  success boolean DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email ON public.auth_attempts(email, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON public.auth_attempts(ip_address, created_at);

-- Rate limit check function
CREATE OR REPLACE FUNCTION check_auth_rate_limit(
  p_email text,
  p_ip inet,
  max_attempts int DEFAULT 5,
  window_minutes int DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  attempt_count int;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_attempts
  WHERE (email = p_email OR ip_address = p_ip)
    AND created_at > now() - (window_minutes || ' minutes')::interval;
  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
