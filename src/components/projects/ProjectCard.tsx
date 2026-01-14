'use client';

import type { Project, ProjectStatus } from '@/lib/supabase/types';
import { CardLink, CardTitle, CardDescription } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';

interface ProjectCardProps {
  project: Project;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ProjectCard({ project }: ProjectCardProps) {
  const status = (project.status || 'draft') as ProjectStatus;

  return (
    <CardLink href={`/projects/${project.id}`} data-testid="project-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <CardTitle className="line-clamp-2">{project.title}</CardTitle>
        <StatusBadge status={status} />
      </div>

      {project.description && <CardDescription className="line-clamp-2 mb-4">{project.description}</CardDescription>}

      <div className="text-xs text-[var(--color-ink-tertiary)]" style={{ fontFamily: 'var(--font-ui)' }}>
        Updated {formatDate(project.updated_at)}
      </div>
    </CardLink>
  );
}
