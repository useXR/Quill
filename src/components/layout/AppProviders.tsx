'use client';

import { type ReactNode } from 'react';
import { AppShell } from './AppShell';
import { ToastContainer } from '@/components/ui/Toast';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { LayoutProvider } from '@/contexts/LayoutContext';

export interface AppProvidersProps {
  /** Page content */
  children: ReactNode;
}

/**
 * Root layout wrapper that combines AppShell with global UI components.
 * Includes ToastContainer and CommandPalette for global notifications and commands.
 * LayoutProvider wraps AppShell so Sidebar can access project context.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <LayoutProvider>
      <AppShell>{children}</AppShell>

      {/* Global UI Components */}
      <ToastContainer />
      <CommandPalette />
    </LayoutProvider>
  );
}
