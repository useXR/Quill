# Task 6.6: Command Palette

> **Phase 6** | [← Toast Notifications](./05-toast-notifications.md) | [Next: E2E Tests →](./07-e2e-tests.md)

---

## Context

**This task implements a command palette using the cmdk library.** Users can quickly navigate and execute actions using Cmd+K (Mac) or Ctrl+K (Windows/Linux).

### Prerequisites

- **Task 6.4** completed (Loading States & Error Handling)
- **Task 6.5** completed (Toast Notifications)

### What This Task Creates

- `src/components/ui/CommandPalette.tsx` - Command palette component
- `src/components/ui/__tests__/CommandPalette.test.tsx` - Component tests

### Tasks That Depend on This

- **Task 6.7** (E2E Tests) - Command palette testing

---

## Files to Create/Modify

- `src/components/ui/CommandPalette.tsx` (create)
- `src/components/ui/__tests__/CommandPalette.test.tsx` (create)

---

## Steps

### Step 1: Install cmdk

```bash
npm install cmdk
```

**Expected:** Package added to package.json

### Step 2: Write failing test for keyboard shortcut

Create `src/components/ui/__tests__/CommandPalette.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommandPalette } from '../CommandPalette';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe('keyboard shortcut', () => {
    it('opens on Cmd+K (Mac)', () => {
      render(<CommandPalette />);

      // Dialog should not be visible initially
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Press Cmd+K
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Dialog should now be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('opens on Ctrl+K (Windows/Linux)', () => {
      render(<CommandPalette />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('toggles closed on second Cmd+K press', () => {
      render(<CommandPalette />);

      // Open
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cleans up event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<CommandPalette />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
```

### Step 3: Run test to verify it fails

```bash
npm test -- --testPathPattern="CommandPalette" --watchAll=false
```

**Expected:** FAIL - Cannot find module '../CommandPalette'

### Step 4: Create basic CommandPalette structure

Create `src/components/ui/CommandPalette.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50"
    >
      {/* Backdrop with reduced motion support */}
      <div
        className="fixed inset-0 bg-black/50 motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 motion-reduce:animate-none">
        <Command.Input
          placeholder="Search or type a command..."
          aria-label="Search commands"
          className="w-full px-4 py-3 border-b outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-gray-500">
            No results found.
          </Command.Empty>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
```

### Step 5: Run test to verify keyboard shortcut passes

```bash
npm test -- --testPathPattern="CommandPalette" --watchAll=false
```

**Expected:** PASS - All keyboard shortcut tests pass

### Step 6: Add tests for navigation commands

Add to `src/components/ui/__tests__/CommandPalette.test.tsx` (inside the main describe block):

```typescript
  // Add these describe blocks inside the main 'CommandPalette' describe

  describe('navigation commands', () => {
    it('renders navigation items', async () => {
      render(<CommandPalette />);

      // Open palette
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Check navigation items exist
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('navigates to projects when Projects command selected', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      // Open palette
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Click Projects
      await user.click(screen.getByText('Projects'));

      expect(mockPush).toHaveBeenCalledWith('/projects');
    });

    it('navigates to vault when Vault command selected', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await user.click(screen.getByText('Vault'));

      expect(mockPush).toHaveBeenCalledWith('/vault');
    });

    it('closes dialog after command execution', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByText('Projects'));

      // Dialog should close after command
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('action commands', () => {
    it('renders New Project action', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    it('navigates to new project page when selected', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await user.click(screen.getByText('New Project'));

      expect(mockPush).toHaveBeenCalledWith('/projects/new');
    });
  });

  describe('search functionality', () => {
    it('renders search input with placeholder', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(
        screen.getByPlaceholderText('Search or type a command...')
      ).toBeInTheDocument();
    });

    it('filters items based on search input', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByPlaceholderText('Search or type a command...');
      await user.type(input, 'vault');

      // Vault should still be visible
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByPlaceholderText('Search or type a command...');
      await user.type(input, 'nonexistent command xyz');

      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });
  });

  describe('backdrop interaction', () => {
    it('closes when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click the backdrop (aria-hidden div)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        await user.click(backdrop);
      }

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible label on dialog', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-label',
        'Command palette'
      );
    });

    it('has accessible label on search input', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByLabelText('Search commands');
      expect(input).toBeInTheDocument();
    });

    it('focuses input when opened', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const input = screen.getByPlaceholderText('Search or type a command...');
      expect(document.activeElement).toBe(input);
    });

    it('command items meet minimum touch target size', () => {
      render(<CommandPalette />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Check that items have min-h-[44px] class for WCAG touch target compliance
      const projectsItem = screen.getByText('Projects').closest('[cmdk-item]');
      expect(projectsItem).toHaveClass('min-h-[44px]');
    });
  });
```

### Step 7: Add full implementation with navigation and actions

Update `src/components/ui/CommandPalette.tsx` with complete implementation:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { FolderOpen, FileText, Search } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50"
    >
      {/* Backdrop with reduced motion support */}
      <div
        className="fixed inset-0 bg-black/50 motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      {/* Dialog container with animation and reduced motion support */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 motion-reduce:animate-none">
        <Command.Input
          placeholder="Search or type a command..."
          aria-label="Search commands"
          className="w-full px-4 py-3 border-b outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          autoFocus
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-gray-500">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Navigation"
            className="text-xs text-gray-500 px-2 py-1"
          >
            {/* Touch target: min-h-[44px] ensures 44px minimum height */}
            <Command.Item
              onSelect={() => runCommand(() => router.push('/projects'))}
              className="flex items-center gap-2 px-3 min-h-[44px] rounded cursor-pointer transition-colors motion-reduce:transition-none hover:bg-gray-100 aria-selected:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              Projects
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => router.push('/vault'))}
              className="flex items-center gap-2 px-3 min-h-[44px] rounded cursor-pointer transition-colors motion-reduce:transition-none hover:bg-gray-100 aria-selected:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Search className="w-4 h-4 shrink-0" />
              Vault
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Actions"
            className="text-xs text-gray-500 px-2 py-1"
          >
            <Command.Item
              onSelect={() => runCommand(() => router.push('/projects/new'))}
              className="flex items-center gap-2 px-3 min-h-[44px] rounded cursor-pointer transition-colors motion-reduce:transition-none hover:bg-gray-100 aria-selected:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <FileText className="w-4 h-4 shrink-0" />
              New Project
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
```

### Step 8: Run all CommandPalette tests

```bash
npm test -- --testPathPattern="CommandPalette" --watchAll=false
```

**Expected:** PASS - All tests pass

### Step 9: Commit

```bash
git add src/components/ui/CommandPalette.tsx src/components/ui/__tests__/CommandPalette.test.tsx
git commit -m "feat: add command palette with Cmd+K and comprehensive tests"
```

**Expected:** Commit created successfully

---

## Verification Checklist

- [ ] cmdk package installed
- [ ] Cmd+K opens command palette on Mac
- [ ] Ctrl+K opens command palette on Windows/Linux
- [ ] Second Cmd+K/Ctrl+K closes palette
- [ ] Navigation items visible (Projects, Vault)
- [ ] Clicking item navigates and closes palette
- [ ] New Project action navigates to /projects/new
- [ ] Search input filters command list
- [ ] Empty state shown when no matches
- [ ] Backdrop click closes palette
- [ ] Input auto-focuses when opened
- [ ] Accessible label on dialog (`aria-label="Command palette"`)
- [ ] Accessible label on search input (`aria-label="Search commands"`)
- [ ] Touch targets meet 44px minimum (`min-h-[44px]`)
- [ ] Reduced motion supported (`motion-reduce:animate-none`)
- [ ] Focus-visible styles on interactive elements
- [ ] All tests pass
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 6.7: E2E Tests](./07-e2e-tests.md)**.
