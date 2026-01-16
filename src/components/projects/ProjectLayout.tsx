'use client';

import { useEffect, type ReactNode } from 'react';
import { useLayoutContext } from '@/contexts/LayoutContext';

interface Document {
  id: string;
  title: string;
  sort_order: number | null;
}

interface ProjectLayoutProps {
  projectId: string;
  projectTitle: string;
  documents: Document[];
  vaultItemCount: number;
  children: ReactNode;
}

/**
 * Thin client wrapper that syncs project data to LayoutContext.
 * Server pages pass project data as props, this component syncs to context.
 * Sidebar reads from context to render project-level navigation.
 */
export function ProjectLayout({ projectId, projectTitle, documents, vaultItemCount, children }: ProjectLayoutProps) {
  const { setProjectData } = useLayoutContext();

  useEffect(() => {
    setProjectData({ id: projectId, title: projectTitle, documents, vaultItemCount });

    return () => {
      // Only clear if we're still the active project (handles race conditions)
      setProjectData((current) => (current?.id === projectId ? null : current));
    };
  }, [projectId, projectTitle, documents, vaultItemCount, setProjectData]);

  // No longer renders sidebar - AppShell's Sidebar handles it via context
  return <>{children}</>;
}
