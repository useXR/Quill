import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test-utils';
import { LoginForm } from '../LoginForm';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ allowed: true }),
    });
  });

  it('should render email input and submit button', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();
  });

  it('should have data-testid attribute on form', () => {
    render(<LoginForm />);

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  it('should have data-hydrated attribute after hydration', () => {
    render(<LoginForm />);

    expect(screen.getByTestId('login-form')).toHaveAttribute('data-hydrated', 'true');
  });

  it('should show loading state during submission', async () => {
    // Create a promise that we can control
    let resolveRateLimit: (value: Response) => void;
    const rateLimitPromise = new Promise<Response>((resolve) => {
      resolveRateLimit = resolve;
    });

    mockFetch.mockReturnValueOnce(rateLimitPromise);

    const { user } = render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send magic link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    // Button should be disabled while loading
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/sending/i);

    // Resolve the promise
    resolveRateLimit!({
      ok: true,
      json: () => Promise.resolve({ allowed: true }),
    } as Response);
  });

  it('should show success message after magic link sent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ allowed: true }),
    });

    const { user } = render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send magic link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('should show rate limit error when rate limited', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ allowed: false, retryAfter: 3600 }),
    });

    const { user } = render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send magic link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    // Do NOT mock fetch for this test - we want to verify validation happens before any API call
    mockFetch.mockClear();

    const { user } = render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const form = screen.getByTestId('login-form');

    // Type an invalid email (missing @ and domain)
    await user.type(emailInput, 'invalidemail');

    // Use fireEvent.submit to bypass HTML5 validation and test our JS validation
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });

    // Verify fetch was never called (validation should prevent API call)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should require email to submit', async () => {
    render(<LoginForm />);

    const form = screen.getByTestId('login-form');

    // Use fireEvent.submit to bypass HTML5 validation and test our JS validation
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });
});
