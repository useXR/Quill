'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

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
    <form onSubmit={handleSubmit} data-testid="login-form" data-hydrated="true" className="space-y-5 w-full">
      <Input
        id="email"
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      {formState.message && formState.status === 'success' && <Alert variant="success">{formState.message}</Alert>}

      {formState.message && formState.status === 'error' && <Alert variant="error">{formState.message}</Alert>}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {isLoading ? 'Sending...' : 'Send Magic Link'}
      </Button>
    </form>
  );
}
