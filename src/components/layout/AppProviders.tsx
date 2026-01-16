'use client';

import { type ReactNode } from 'react';
import { AppShell } from './AppShell';
import { ToastContainer } from '@/components/ui/Toast';
import { CommandPalette } from '@/components/ui/CommandPalette';

export interface AppProvidersProps {
  /** Page content */
  children: ReactNode;
}

/**
 * Root layout wrapper that combines AppShell with global UI components.
 * Includes ToastContainer and CommandPalette for global notifications and commands.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <AppShell>{children}</AppShell>

      {/* Global UI Components */}
      <ToastContainer />
      <CommandPalette />
    </>
  );
}
