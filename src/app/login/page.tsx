import { LoginForm } from '@/components/auth';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1
            className="text-3xl font-bold text-[var(--color-ink-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sign in to Quill
          </h1>
          <p className="mt-3 text-[var(--color-ink-secondary)]" style={{ fontFamily: 'var(--font-ui)' }}>
            Enter your email to receive a magic link
          </p>
        </div>
        <Card padding="lg" className="mt-8">
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
