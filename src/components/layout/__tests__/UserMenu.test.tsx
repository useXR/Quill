import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from '../UserMenu';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock auth context
const mockUser = { email: 'test@example.com' };
vi.mock('@/contexts/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

// Mock supabase client
const mockSignOut = vi.fn().mockResolvedValue({});
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the trigger button', () => {
      render(<UserMenu />);

      const trigger = screen.getByTestId('user-menu-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('should show user initial in avatar', () => {
      render(<UserMenu />);

      // First letter of email
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should not show dropdown initially', () => {
      render(<UserMenu />);

      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('Open/Close Behavior', () => {
    it('should open dropdown on click', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      const trigger = screen.getByTestId('user-menu-trigger');
      await user.click(trigger);

      expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should close dropdown on second click', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      const trigger = screen.getByTestId('user-menu-trigger');

      // Open
      await user.click(trigger);
      expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument();

      // Close
      await user.click(trigger);
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
    });

    it('should close dropdown on outside click', async () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <UserMenu />
        </div>
      );
      const user = userEvent.setup();

      // Open menu
      await user.click(screen.getByTestId('user-menu-trigger'));
      expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument();

      // Click outside
      await user.click(screen.getByTestId('outside'));
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
    });

    it('should close dropdown on Escape key', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      // Open menu
      await user.click(screen.getByTestId('user-menu-trigger'));
      expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
    });

    it('should return focus to trigger button after Escape', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      const trigger = screen.getByTestId('user-menu-trigger');

      // Open menu
      await user.click(trigger);

      // Press Escape
      await user.keyboard('{Escape}');

      // Focus should return to trigger
      expect(trigger).toHaveFocus();
    });
  });

  describe('Focus Management', () => {
    it('should focus first menu item when opened', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));

      await waitFor(() => {
        const settingsButton = screen.getByTestId('user-menu-settings');
        expect(settingsButton).toHaveFocus();
      });
    });

    it('should open dropdown on ArrowDown when closed', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      const trigger = screen.getByTestId('user-menu-trigger');
      trigger.focus();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument();
    });
  });

  describe('Menu Items', () => {
    it('should display user email', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should have Settings menu item', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));

      const settingsButton = screen.getByTestId('user-menu-settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toHaveAttribute('role', 'menuitem');
    });

    it('should have Sign out menu item', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));

      const signOutButton = screen.getByTestId('user-menu-signout');
      expect(signOutButton).toBeInTheDocument();
      expect(signOutButton).toHaveAttribute('role', 'menuitem');
    });
  });

  describe('Sign Out', () => {
    it('should call signOut when Sign out is clicked', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));
      await user.click(screen.getByTestId('user-menu-signout'));

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should close dropdown after signing out', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));
      await user.click(screen.getByTestId('user-menu-signout'));

      await waitFor(() => {
        expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on trigger', () => {
      render(<UserMenu />);

      const trigger = screen.getByTestId('user-menu-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'User menu');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('should have proper role on dropdown', async () => {
      render(<UserMenu />);
      const user = userEvent.setup();

      await user.click(screen.getByTestId('user-menu-trigger'));

      const dropdown = screen.getByTestId('user-menu-dropdown');
      expect(dropdown).toHaveAttribute('role', 'menu');
      expect(dropdown).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('should have minimum touch target size', () => {
      render(<UserMenu />);

      const trigger = screen.getByTestId('user-menu-trigger');
      expect(trigger).toHaveClass('min-h-[44px]');
      expect(trigger).toHaveClass('min-w-[44px]');
    });
  });

  describe('Custom className', () => {
    it('should accept custom className', () => {
      render(<UserMenu className="custom-class" />);

      const container = screen.getByTestId('user-menu');
      expect(container).toHaveClass('custom-class');
    });
  });
});
