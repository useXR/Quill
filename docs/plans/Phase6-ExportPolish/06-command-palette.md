# Task 6.6: Command Palette

> **Phase 6** | [← Toast Notifications](./05-toast-notifications.md) | [Next: E2E Tests →](./07-e2e-tests.md)

---

## Design System Context

The command palette follows the **Scholarly Craft** aesthetic as a refined power-user tool with clean typography and subtle visual hierarchy.

### Key Design Tokens for This Task

| Element           | Design Token        | Purpose                           |
| ----------------- | ------------------- | --------------------------------- |
| Dialog background | `bg-surface`        | Clean white (#ffffff)             |
| Backdrop          | `bg-overlay`        | rgba(0,0,0,0.5) modal scrim       |
| Input border      | `border-ink-faint`  | Subtle separator                  |
| Group headings    | `text-ink-tertiary` | Muted section labels              |
| Item text         | `text-ink-primary`  | High-contrast menu items          |
| Hover state       | `bg-surface-hover`  | Subtle selection highlight        |
| Selected state    | `bg-surface-hover`  | Visual feedback via aria-selected |
| Focus ring        | `ring-quill`        | Brand-consistent focus indicator  |

### Typography

- **Search Input:** `font-ui text-base` (Source Sans 3, 16px)
- **Group Headings:** `font-ui text-xs text-ink-tertiary` (12px, muted)
- **Menu Items:** `font-ui text-sm text-ink-primary` (14px)
- **Empty State:** `font-ui text-sm text-ink-tertiary`

### Layout

- **Dialog:** `max-w-lg`, `rounded-lg`, `shadow-2xl`, centered at 25% from top
- **Input:** `px-4 py-3`, full width, no visible outline (focus-within styled)
- **List:** `max-h-80 overflow-y-auto p-2`
- **Items:** `min-h-[44px]` touch targets, `rounded-md`, `px-3`

### Icons

- **Size:** `w-4 h-4` (16px)
- **Color:** Inherit from text color (`currentColor`)
- **Alignment:** `flex-shrink-0` to prevent compression

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

/**
 * Command palette with Scholarly Craft styling.
 * Design tokens: bg-surface, bg-overlay, border-ink-faint, text-ink-*, ring-quill
 */
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
      {/* Backdrop with reduced motion support - uses design system overlay */}
      <div
        className="fixed inset-0 bg-overlay motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-surface rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 motion-reduce:animate-none">
        <Command.Input
          placeholder="Search or type a command..."
          aria-label="Search commands"
          className="w-full px-4 py-3 border-b border-ink-faint outline-none font-ui text-base text-ink-primary placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-quill"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center font-ui text-sm text-ink-tertiary">
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

/**
 * Command palette with Scholarly Craft styling.
 * Design tokens: bg-surface, bg-overlay, border-ink-faint, text-ink-*, ring-quill, bg-surface-hover
 */
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
      {/* Backdrop with reduced motion support - uses design system overlay */}
      <div
        className="fixed inset-0 bg-overlay motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      {/* Dialog container with animation and reduced motion support */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-surface rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 motion-reduce:animate-none">
        <Command.Input
          placeholder="Search or type a command..."
          aria-label="Search commands"
          className="w-full px-4 py-3 border-b border-ink-faint outline-none font-ui text-base text-ink-primary placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-quill"
          autoFocus
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center font-ui text-sm text-ink-tertiary">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Navigation"
            className="font-ui text-xs text-ink-tertiary px-2 py-1"
          >
            {/* Touch target: min-h-[44px] ensures 44px minimum height */}
            <Command.Item
              onSelect={() => runCommand(() => router.push('/projects'))}
              className="flex items-center gap-2 px-3 min-h-[44px] rounded-md cursor-pointer font-ui text-sm text-ink-primary transition-colors motion-reduce:transition-none hover:bg-surface-hover aria-selected:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quill"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              Projects
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => router.push('/vault'))}
              className="flex items-center gap-2 px-3 min-h-[44px] rounded-md cursor-pointer font-ui text-sm text-ink-primary transition-colors motion-reduce:transition-none hover:bg-surface-hover aria-selected:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quill"
            >
              <Search className="w-4 h-4 shrink-0" />
              Vault
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Actions"
            className="font-ui text-xs text-ink-tertiary px-2 py-1"
          >
            <Command.Item
              onSelect={() => runCommand(() => router.push('/projects/new'))}
              className="flex items-center gap-2 px-3 min-h-[44px] rounded-md cursor-pointer font-ui text-sm text-ink-primary transition-colors motion-reduce:transition-none hover:bg-surface-hover aria-selected:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quill"
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

## E2E Page Object

**IMPORTANT:** Page objects must be created in the same task as the feature they test, not deferred to Task 6.7. This ensures consistent test patterns and reduces integration issues.

### Create `e2e/pages/CommandPalettePage.ts`

Create the CommandPalettePage page object following the existing pattern from Phase 0:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

/**
 * Page object for command palette interactions.
 * Follows Phase 0 page object pattern from LoginPage.ts.
 */
export class CommandPalettePage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly searchInput: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /command palette/i });
    this.searchInput = page.getByPlaceholder(/search or type/i);
    this.emptyState = page.getByText(/no results found/i);
  }

  /**
   * Opens the command palette using Cmd+K (Mac) keyboard shortcut.
   * For cross-platform testing, use openWithCtrlK() for Windows/Linux.
   */
  async open() {
    await this.page.keyboard.press('Meta+k');
    await expect(this.dialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  /**
   * Opens the command palette using Ctrl+K (Windows/Linux) keyboard shortcut.
   */
  async openWithCtrlK() {
    await this.page.keyboard.press('Control+k');
    await expect(this.dialog).toBeVisible({ timeout: TIMEOUTS.DIALOG });
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).not.toBeVisible();
  }

  async search(query: string) {
    await expect(this.searchInput).toBeVisible();
    await this.searchInput.fill(query);
    // Wait for debounced search
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE_SEARCH || 300);
  }

  async selectOption(name: string | RegExp) {
    const option = this.page.getByRole('option', { name });
    await option.click();
  }

  async navigateWithKeyboard(direction: 'up' | 'down', count = 1) {
    for (let i = 0; i < count; i++) {
      await this.page.keyboard.press(direction === 'down' ? 'ArrowDown' : 'ArrowUp');
    }
  }

  async selectWithEnter() {
    await this.page.keyboard.press('Enter');
  }

  async expectOptionVisible(name: string | RegExp) {
    await expect(this.page.getByRole('option', { name })).toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  async expectClosed() {
    await expect(this.dialog).not.toBeVisible();
  }

  async expectOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async expectSearchInputFocused() {
    await expect(this.searchInput).toBeFocused();
  }
}
```

---

## E2E Tests

**IMPORTANT:** E2E tests must be created as part of this task, not deferred to Task 6.7. This follows the incremental testing pattern established in earlier phases.

### Create `e2e/navigation/command-palette.spec.ts`

Create E2E tests covering command palette functionality. **Note:** This task uses the `CommandPalettePage` page object created above.

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { CommandPalettePage } from '../pages/CommandPalettePage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('Command Palette', () => {
  let commandPalette: CommandPalettePage;

  test.beforeEach(async ({ page, loginAsWorker }) => {
    await loginAsWorker();
    commandPalette = new CommandPalettePage(page);
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Keyboard Shortcuts', () => {
    test('opens with Cmd+K (Mac)', async () => {
      await commandPalette.open();
      await commandPalette.expectOpen();
    });

    test('opens with Ctrl+K (Windows/Linux)', async () => {
      // This is the cross-platform keyboard shortcut test
      await commandPalette.openWithCtrlK();
      await commandPalette.expectOpen();
    });

    test('search input receives focus when opened', async () => {
      await commandPalette.open();
      await commandPalette.expectSearchInputFocused();
    });

    test('closes with Escape key', async () => {
      await commandPalette.open();
      await commandPalette.close();
      await commandPalette.expectClosed();
    });

    test('toggles closed on second Cmd+K press', async ({ page }) => {
      // Open
      await commandPalette.open();
      await commandPalette.expectOpen();

      // Close with same shortcut
      await page.keyboard.press('Meta+k');
      await commandPalette.expectClosed();
    });

    test('toggles closed on second Ctrl+K press (Windows/Linux)', async ({ page }) => {
      // Open with Ctrl+K
      await commandPalette.openWithCtrlK();
      await commandPalette.expectOpen();

      // Close with same shortcut
      await page.keyboard.press('Control+k');
      await commandPalette.expectClosed();
    });
  });

  test.describe('Search Functionality', () => {
    test('filters commands as user types', async () => {
      await commandPalette.open();
      await commandPalette.search('vault');

      // Vault option should be visible
      await commandPalette.expectOptionVisible(/vault/i);
    });

    test('shows empty state when no matches', async () => {
      await commandPalette.open();
      await commandPalette.search('nonexistent command xyz');

      await commandPalette.expectEmptyState();
    });
  });

  test.describe('Command Execution', () => {
    test('navigates to projects when selected', async ({ page }) => {
      await commandPalette.open();
      await commandPalette.selectOption(/projects/i);

      await expect(page).toHaveURL(/\/projects/);
      await commandPalette.expectClosed();
    });

    test('navigates to vault when selected', async ({ page }) => {
      await commandPalette.open();
      await commandPalette.selectOption(/vault/i);

      await expect(page).toHaveURL(/\/vault/);
    });

    test('closes palette after command execution', async () => {
      await commandPalette.open();
      await commandPalette.selectOption(/projects/i);

      await commandPalette.expectClosed();
    });
  });

  test.describe('Accessibility', () => {
    test('dialog has accessible label', async () => {
      await commandPalette.open();

      await expect(commandPalette.dialog).toHaveAttribute('aria-label', /command palette/i);
    });

    test('search input has accessible label', async () => {
      await commandPalette.open();

      await expect(commandPalette.searchInput).toHaveAttribute('aria-label', /search commands/i);
    });

    test('command items meet minimum touch target size', async ({ page }) => {
      await commandPalette.open();

      // Check that items have min-h-[44px] class for WCAG touch target compliance
      const item = page.locator('[cmdk-item]').first();
      await expect(item).toHaveClass(/min-h-\[44px\]/);
    });
  });
});
```

---

## Keyboard Testing

**IMPORTANT:** Command palette must be fully operable with keyboard only (WCAG 2.1.1).

### Add keyboard navigation tests to `e2e/navigation/command-palette.spec.ts`

```typescript
test.describe('Keyboard Navigation', () => {
  test('can navigate options with arrow keys', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    // Navigate down
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Verify option is highlighted (aria-selected or visual indicator)
    const selectedOption = page.locator('[cmdk-item][aria-selected="true"]');
    await expect(selectedOption).toBeVisible();
  });

  test('can select option with Enter key', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    // Navigate to first option and select
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Dialog should close after selection
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('full keyboard-only navigation flow', async ({ page }) => {
    // Open with keyboard
    await page.keyboard.press('Meta+k');
    await expect(page.getByRole('dialog')).toBeVisible();

    // Type to filter
    await page.keyboard.type('vault');
    await expect(page.getByRole('option', { name: /vault/i })).toBeVisible();

    // Navigate and select
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Should navigate to vault
    await expect(page).toHaveURL(/\/vault/);
  });

  test('Tab key does not leave dialog unexpectedly', async ({ page }) => {
    await page.keyboard.press('Meta+k');

    // Tab should keep focus within dialog (focus trap)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should still be within the dialog
    const dialog = page.getByRole('dialog');
    const focusedElement = page.locator(':focus');

    // Verify focused element is inside dialog
    await expect(focusedElement).toBeVisible();
    const focusBox = await focusedElement.boundingBox();
    const dialogBox = await dialog.boundingBox();

    if (focusBox && dialogBox) {
      expect(focusBox.x).toBeGreaterThanOrEqual(dialogBox.x);
      expect(focusBox.y).toBeGreaterThanOrEqual(dialogBox.y);
    }
  });
});
```

### Run E2E Tests

```bash
npm run test:e2e -- --grep "Command Palette"
```

**Expected:** All command palette E2E tests pass

---

## E2E Verification

Before proceeding to the next task, verify:

- [ ] All unit tests pass (`npm test -- src/components/ui/__tests__/CommandPalette.test.tsx`)
- [ ] E2E tests pass (`npm run test:e2e -- --grep "Command Palette"`)
- [ ] Cmd+K / Ctrl+K opens palette
- [ ] Search filters commands correctly
- [ ] Escape closes palette
- [ ] Command execution works and closes palette
- [ ] Full keyboard navigation works (arrow keys, Enter, Tab)
- [ ] Focus trap keeps keyboard focus within dialog

**Do not proceed to Task 6.7 until all E2E tests pass.**

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

## Additional E2E Tests

Add to `e2e/navigation/command-palette.spec.ts`:

```typescript
test('reduced motion preference disables animations', async ({ page, loginAsWorker }) => {
  await loginAsWorker();
  // Set reduced motion preference
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Open command palette
  await page.keyboard.press('Meta+k');
  // Verify no transition animations (check computed style or class)
  const palette = page.getByRole('dialog');
  await expect(palette).toHaveCSS('animation-duration', '0s');
});

test('citations navigation command works', async ({ page, workerCtx, loginAsWorker }) => {
  await loginAsWorker();
  await page.goto(`/projects/${workerCtx.projectId}`);
  // Open palette
  await page.keyboard.press('Meta+k');
  // Search for citations
  await page.getByRole('textbox').fill('citations');
  // Select option
  await page.keyboard.press('Enter');
  // Verify navigation
  await expect(page).toHaveURL(/\/citations/);
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/navigation/command-palette.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 6.7.

---

## Next Steps

After this task, proceed to **[Task 6.7: E2E Tests](./07-e2e-tests.md)**.
