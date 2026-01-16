import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils/render';
import { CommandPalette } from '../CommandPalette';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any lingering event listeners
    vi.restoreAllMocks();
  });

  describe('Keyboard Shortcuts', () => {
    it('opens on Ctrl+K', async () => {
      render(<CommandPalette />);

      // Initially not visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Press Ctrl+K
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('opens on Cmd+K (Mac)', async () => {
      render(<CommandPalette />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Press Cmd+K (metaKey for Mac)
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('toggles closed on second Ctrl+K press', async () => {
      render(<CommandPalette />);

      // Open
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close with second press
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('closes on Escape', async () => {
      render(<CommandPalette />);

      // Open
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close with Escape - fire on the dialog element itself
      const dialog = screen.getByTestId('command-palette');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('cleans up event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<CommandPalette />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Dialog Structure', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('has correct aria-label on dialog', () => {
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Command palette');
    });

    it('renders search input with correct aria-label', () => {
      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-label', 'Search commands');
    });

    it('search input has autoFocus', async () => {
      await waitFor(() => {
        const input = screen.getByRole('combobox');
        expect(document.activeElement).toBe(input);
      });
    });

    it('renders data-testid attributes', () => {
      expect(screen.getByTestId('command-palette')).toBeInTheDocument();
      expect(screen.getByTestId('command-palette-backdrop')).toBeInTheDocument();
      expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
      expect(screen.getByTestId('command-palette-list')).toBeInTheDocument();
    });
  });

  describe('Navigation Group', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('renders Navigation group heading', () => {
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('renders Projects item with FolderOpen icon', () => {
      expect(screen.getByTestId('command-item-projects')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('renders Vault item with Search icon', () => {
      expect(screen.getByTestId('command-item-vault')).toBeInTheDocument();
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('renders Citations item with BookOpen icon', () => {
      expect(screen.getByTestId('command-item-citations')).toBeInTheDocument();
      expect(screen.getByText('Citations')).toBeInTheDocument();
    });
  });

  describe('Actions Group', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('renders Actions group heading', () => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('renders New Project item with FileText icon', () => {
      expect(screen.getByTestId('command-item-new-project')).toBeInTheDocument();
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });
  });

  describe('Command Execution', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('navigates to /projects when Projects is selected', async () => {
      const projectsItem = screen.getByTestId('command-item-projects');
      fireEvent.click(projectsItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects');
      });
    });

    it('navigates to /vault when Vault is selected', async () => {
      const vaultItem = screen.getByTestId('command-item-vault');
      fireEvent.click(vaultItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vault');
      });
    });

    it('navigates to /citations when Citations is selected', async () => {
      const citationsItem = screen.getByTestId('command-item-citations');
      fireEvent.click(citationsItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/citations');
      });
    });

    it('navigates to /projects/new when New Project is selected', async () => {
      const newProjectItem = screen.getByTestId('command-item-new-project');
      fireEvent.click(newProjectItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/new');
      });
    });

    it('closes dialog after command execution', async () => {
      const projectsItem = screen.getByTestId('command-item-projects');
      fireEvent.click(projectsItem);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Backdrop Interaction', () => {
    it('closes dialog when backdrop is clicked', async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const backdrop = screen.getByTestId('command-palette-backdrop');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('filters items based on search input', async () => {
      const input = screen.getByTestId('command-palette-input');

      // Type to filter
      fireEvent.change(input, { target: { value: 'proj' } });

      await waitFor(() => {
        // Projects should be visible
        expect(screen.getByText('Projects')).toBeInTheDocument();
        // New Project should be visible
        expect(screen.getByText('New Project')).toBeInTheDocument();
      });
    });

    it('shows empty state when no results match', async () => {
      const input = screen.getByTestId('command-palette-input');

      fireEvent.change(input, { target: { value: 'xyznonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No results found.')).toBeInTheDocument();
      });
    });
  });

  describe('Touch Target Requirements', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('items have min-h-[44px] for touch targets', () => {
      const projectsItem = screen.getByTestId('command-item-projects');
      expect(projectsItem).toHaveClass('min-h-[44px]');
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('has motion-reduce:animate-none class for reduced motion', () => {
      const dialog = screen.getByTestId('command-palette');
      expect(dialog).toHaveClass('motion-reduce:animate-none');
    });

    it('input has combobox role', () => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('list has listbox role', () => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    beforeEach(async () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('dialog has correct styling classes', () => {
      const dialog = screen.getByTestId('command-palette');
      expect(dialog).toHaveClass('max-w-lg');
      expect(dialog).toHaveClass('rounded-lg');
      expect(dialog).toHaveClass('shadow-2xl');
    });

    it('backdrop has correct overlay background', () => {
      const backdrop = screen.getByTestId('command-palette-backdrop');
      expect(backdrop).toHaveClass('bg-overlay');
    });

    it('input has correct styling', () => {
      const input = screen.getByTestId('command-palette-input');
      expect(input).toHaveClass('px-4');
      expect(input).toHaveClass('py-3');
      expect(input).toHaveClass('border-b');
      expect(input).toHaveClass('border-ink-faint');
    });

    it('list has correct styling', () => {
      const list = screen.getByTestId('command-palette-list');
      expect(list).toHaveClass('max-h-80');
      expect(list).toHaveClass('overflow-y-auto');
      expect(list).toHaveClass('p-2');
    });
  });
});
