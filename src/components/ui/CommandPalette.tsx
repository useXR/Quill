'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { FolderOpen, Search, BookOpen, FileText } from 'lucide-react';

/**
 * CommandPalette Component - Scholarly Craft Design System
 *
 * A keyboard-accessible command palette for quick navigation and actions.
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 *
 * Design tokens from docs/design-system.md:
 * - Dialog: bg-surface, shadow-2xl, rounded-lg (Elevation 3)
 * - Backdrop: bg-overlay (rgba with 50% opacity)
 * - Input border: border-ink-faint
 * - Group headings: text-ink-tertiary
 * - Item text: text-ink-primary
 * - Hover/Selected: bg-surface-hover
 * - Focus ring: ring-quill
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle command selection
  const handleSelect = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
    },
    [router]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[25vh] bg-overlay"
      onClick={handleBackdropClick}
      data-testid="command-palette-backdrop"
    >
      <Command
        role="dialog"
        aria-label="Command palette"
        className="
          w-full max-w-lg
          bg-surface
          rounded-lg shadow-2xl
          overflow-hidden
          motion-reduce:animate-none
        "
        data-testid="command-palette"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <Command.Input
          aria-label="Search commands"
          placeholder="Type a command or search..."
          autoFocus
          className="
            w-full px-4 py-3
            border-b border-ink-faint
            font-ui text-base text-ink-primary
            bg-surface
            placeholder:text-ink-tertiary
            focus:outline-none
          "
          data-testid="command-palette-input"
        />

        <Command.List className="max-h-80 overflow-y-auto p-2" data-testid="command-palette-list">
          <Command.Empty className="px-4 py-6 text-center font-ui text-sm text-ink-secondary">
            No results found.
          </Command.Empty>

          {/* Navigation Group */}
          <Command.Group
            heading="Navigation"
            className="[&_[cmdk-group-heading]]:font-ui [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-tertiary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
          >
            <Command.Item
              value="projects"
              onSelect={() => handleSelect('/projects')}
              className="
                flex items-center gap-2 px-3 min-h-[44px] rounded-md
                font-ui text-sm text-ink-primary
                cursor-pointer
                hover:bg-surface-hover
                aria-selected:bg-surface-hover
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                motion-reduce:transition-none
              "
              data-testid="command-item-projects"
            >
              <FolderOpen className="h-4 w-4 text-ink-secondary" aria-hidden="true" />
              <span>Projects</span>
            </Command.Item>

            <Command.Item
              value="vault"
              onSelect={() => handleSelect('/vault')}
              className="
                flex items-center gap-2 px-3 min-h-[44px] rounded-md
                font-ui text-sm text-ink-primary
                cursor-pointer
                hover:bg-surface-hover
                aria-selected:bg-surface-hover
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                motion-reduce:transition-none
              "
              data-testid="command-item-vault"
            >
              <Search className="h-4 w-4 text-ink-secondary" aria-hidden="true" />
              <span>Vault</span>
            </Command.Item>

            <Command.Item
              value="citations"
              onSelect={() => handleSelect('/citations')}
              className="
                flex items-center gap-2 px-3 min-h-[44px] rounded-md
                font-ui text-sm text-ink-primary
                cursor-pointer
                hover:bg-surface-hover
                aria-selected:bg-surface-hover
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                motion-reduce:transition-none
              "
              data-testid="command-item-citations"
            >
              <BookOpen className="h-4 w-4 text-ink-secondary" aria-hidden="true" />
              <span>Citations</span>
            </Command.Item>
          </Command.Group>

          {/* Actions Group */}
          <Command.Group
            heading="Actions"
            className="[&_[cmdk-group-heading]]:font-ui [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-tertiary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
          >
            <Command.Item
              value="new-project"
              onSelect={() => handleSelect('/projects/new')}
              className="
                flex items-center gap-2 px-3 min-h-[44px] rounded-md
                font-ui text-sm text-ink-primary
                cursor-pointer
                hover:bg-surface-hover
                aria-selected:bg-surface-hover
                focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                motion-reduce:transition-none
              "
              data-testid="command-item-new-project"
            >
              <FileText className="h-4 w-4 text-ink-secondary" aria-hidden="true" />
              <span>New Project</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
