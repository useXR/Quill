'use client';

import Link from 'next/link';
import type { Project, ProjectStatus } from '@/lib/supabase/types';

interface ProjectCardProps {
  project: Project;
}

const statusColors: Record<ProjectStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  funded: 'bg-green-100 text-green-800',
};

const statusLabels: Record<ProjectStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  funded: 'Funded',
};

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
    <Link
      href={`/projects/${project.id}`}
      className="block bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{project.title}</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>

      {project.description && <p className="text-sm text-gray-600 line-clamp-2 mb-4">{project.description}</p>}

      <div className="text-xs text-gray-500">Updated {formatDate(project.updated_at)}</div>
    </Link>
  );
}
