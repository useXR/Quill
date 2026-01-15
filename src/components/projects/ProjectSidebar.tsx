'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, FileText, FolderArchive } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  sort_order: number | null;
}

interface ProjectSidebarProps {
  projectId: string;
  projectTitle: string;
  documents: Document[];
  vaultItemCount: number;
}

export function ProjectSidebar({ projectId, projectTitle, documents, vaultItemCount }: ProjectSidebarProps) {
  const pathname = usePathname();

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [documents]
  );

  const isDocumentsActive =
    pathname === `/projects/${projectId}` || pathname.startsWith(`/projects/${projectId}/documents`);
  const isVaultActive = pathname.startsWith(`/projects/${projectId}/vault`);

  return (
    <nav
      aria-label="Project navigation"
      className="
        w-60 flex-shrink-0
        bg-[var(--color-bg-secondary)]
        border-r border-[var(--color-ink-faint)]
        h-full overflow-y-auto
      "
    >
      <div className="p-4">
        {/* Back link */}
        <Link
          href="/projects"
          className="
            flex items-center gap-2
            text-sm font-medium
            text-[var(--color-ink-secondary)]
            hover:text-[var(--color-ink-primary)]
            transition-colors duration-150
            mb-6
          "
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          All Projects
        </Link>

        {/* Project title */}
        <h2
          className="
            text-xs font-semibold uppercase tracking-wider
            text-[var(--color-ink-secondary)]
            mb-4 px-2
          "
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {projectTitle}
        </h2>

        {/* Documents section */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            aria-current={isDocumentsActive ? 'page' : undefined}
            className={`
              flex items-center gap-2
              px-3 py-2 rounded-[var(--radius-md)]
              text-sm font-medium
              transition-colors duration-150
              ${
                isDocumentsActive
                  ? 'bg-[var(--color-quill-lighter)] text-[var(--color-quill-dark)]'
                  : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink-primary)]'
              }
            `}
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            Documents
          </Link>

          {/* Document list */}
          {sortedDocuments.length > 0 ? (
            <ul role="list" aria-label="Documents" className="mt-2 ml-4 space-y-1">
              {sortedDocuments.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/projects/${projectId}/documents/${doc.id}`}
                    className="
                      block px-3 py-2.5 rounded-[var(--radius-sm)]
                      text-sm
                      text-[var(--color-ink-secondary)]
                      hover:text-[var(--color-ink-primary)]
                      hover:bg-[var(--color-surface-hover)]
                      transition-colors duration-150
                      truncate
                      min-h-[44px] flex items-center
                    "
                    style={{ fontFamily: 'var(--font-ui)' }}
                    title={doc.title}
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="
                mt-2 ml-4 px-3
                text-xs text-[var(--color-ink-secondary)] italic
              "
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              No documents yet
            </p>
          )}
        </div>

        {/* Vault section */}
        <Link
          href={`/projects/${projectId}/vault`}
          aria-current={isVaultActive ? 'page' : undefined}
          className={`
            flex items-center justify-between
            px-3 py-2 rounded-[var(--radius-md)]
            text-sm font-medium
            transition-colors duration-150
            ${
              isVaultActive
                ? 'bg-[var(--color-quill-lighter)] text-[var(--color-quill-dark)]'
                : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink-primary)]'
            }
          `}
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          <span className="flex items-center gap-2">
            <FolderArchive className="w-4 h-4" aria-hidden="true" />
            Vault
          </span>
          {vaultItemCount > 0 && (
            <span
              className="
                px-2 py-0.5 rounded-full
                text-xs font-medium
                bg-[var(--color-ink-faint)]
                text-[var(--color-ink-secondary)]
              "
              aria-label={`${vaultItemCount} items`}
            >
              {vaultItemCount}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
