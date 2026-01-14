'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

interface FormState {
  status: FormStatus;
  message: string;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>({ status: 'idle', message: '' });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate email
    if (!email.trim()) {
      setFormState({ status: 'error', message: 'Email is required' });
      return;
    }

    if (!validateEmail(email)) {
      setFormState({ status: 'error', message: 'Please enter a valid email address' });
      return;
    }

    setFormState({ status: 'loading', message: '' });

    try {
      // Check rate limit before sending magic link
      const rateLimitResponse = await fetch('/api/auth/check-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!rateLimitResponse.ok) {
        if (rateLimitResponse.status === 429) {
          const data = await rateLimitResponse.json();
          const minutes = data.retryAfter ? Math.ceil(data.retryAfter / 60) : 60;
          setFormState({
            status: 'error',
            message: `Too many attempts. Please try again in ${minutes} minutes.`,
          });
          return;
        }
        throw new Error('Rate limit check failed');
      }

      // Send magic link
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setFormState({ status: 'error', message: error.message });
        return;
      }

      setFormState({
        status: 'success',
        message: 'Check your email for the magic link!',
      });
    } catch {
      setFormState({
        status: 'error',
        message: 'Something went wrong. Please try again.',
      });
    }
  };

  const isLoading = formState.status === 'loading';

  return (
    <form onSubmit={handleSubmit} data-testid="login-form" data-hydrated="true" className="space-y-4 w-full max-w-sm">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          placeholder="you@example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          autoComplete="email"
        />
      </div>

      {formState.message && (
        <div
          className={`p-3 rounded-md text-sm ${
            formState.status === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : formState.status === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : ''
          }`}
          role={formState.status === 'error' ? 'alert' : 'status'}
        >
          {formState.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
