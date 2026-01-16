'use client';

import { AppProviders } from '@/components/layout';

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
