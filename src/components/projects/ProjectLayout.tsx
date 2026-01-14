import { ReactNode } from 'react';
import { ProjectSidebar } from './ProjectSidebar';

interface Document {
  id: string;
  title: string;
  sort_order: number;
}

interface ProjectLayoutProps {
  projectId: string;
  projectTitle: string;
  documents: Document[];
  vaultItemCount: number;
  children: ReactNode;
}

export function ProjectLayout({ projectId, projectTitle, documents, vaultItemCount, children }: ProjectLayoutProps) {
  return (
    <div data-testid="project-layout" className="flex min-h-screen bg-[var(--color-bg-primary)]">
      <ProjectSidebar
        projectId={projectId}
        projectTitle={projectTitle}
        documents={documents}
        vaultItemCount={vaultItemCount}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
