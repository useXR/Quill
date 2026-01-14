'use client';

import { ProjectCard } from './ProjectCard';
import type { Project } from '@/lib/supabase/types';

interface ProjectListProps {
  projects: Project[];
  emptyMessage?: string;
}

export function ProjectList({
  projects,
  emptyMessage = 'No projects yet. Create your first project to get started.',
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg
          className="w-16 h-16 text-[var(--color-ink-subtle)] mb-4"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Document/quill icon */}
          <rect x="12" y="8" width="40" height="48" rx="3" />
          <line x1="20" y1="20" x2="44" y2="20" />
          <line x1="20" y1="28" x2="44" y2="28" />
          <line x1="20" y1="36" x2="36" y2="36" />
          <path d="M42 44 L52 34 L56 38 L46 48 L42 48 Z" fill="currentColor" opacity="0.3" />
        </svg>
        <h3
          className="text-lg font-bold text-[var(--color-ink-primary)] mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          No projects yet
        </h3>
        <p className="text-sm text-[var(--color-ink-tertiary)] max-w-sm" style={{ fontFamily: 'var(--font-ui)' }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
