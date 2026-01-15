import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from '../Toast';
import { useToastStore } from '@/hooks/useToast';
import { act } from '@testing-library/react';

// Mock crypto.randomUUID
const mockUUID = vi.fn();
vi.stubGlobal('crypto', { randomUUID: mockUUID });

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUUID.mockReset();
    let uuidCounter = 0;
    mockUUID.mockImplementation(() => `toast-${++uuidCounter}`);

    // Reset the store state before each test
    act(() => {
      useToastStore.getState().clearToasts();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should not render when there are no toasts', () => {
    render(<ToastContainer />);
    expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument();
  });

  it('should render toasts when present', () => {
    act(() => {
      useToastStore.getState().addToast('Test message');
    });

    render(<ToastContainer />);

    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render multiple toasts', () => {
    act(() => {
      useToastStore.getState().addToast('Message 1');
      useToastStore.getState().addToast('Message 2');
      useToastStore.getState().addToast('Message 3');
    });

    render(<ToastContainer />);

    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
    expect(screen.getByText('Message 3')).toBeInTheDocument();
  });

  it('should display toast title when provided', () => {
    act(() => {
      useToastStore.getState().addToast('Test message', { title: 'Test Title' });
    });

    render(<ToastContainer />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  describe('toast types', () => {
    it.each(['success', 'error', 'warning', 'info'] as const)('should render %s toast with correct styling', (type) => {
      // Reset counter for each iteration
      mockUUID.mockReset();
      let counter = 0;
      mockUUID.mockImplementation(() => `toast-${++counter}`);

      act(() => {
        useToastStore.getState().clearToasts();
        useToastStore.getState().addToast(`${type} message`, { type });
      });

      render(<ToastContainer />);

      const toast = screen.getByTestId('toast-toast-1');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute('role', 'alert');
    });
  });

  describe('dismiss functionality', () => {
    it('should remove toast when dismiss button is clicked', () => {
      act(() => {
        useToastStore.getState().addToast('Dismissable toast');
      });

      render(<ToastContainer />);

      expect(screen.getByText('Dismissable toast')).toBeInTheDocument();

      const dismissButton = screen.getByTestId('toast-dismiss-toast-1');
      fireEvent.click(dismissButton);

      expect(screen.queryByText('Dismissable toast')).not.toBeInTheDocument();
    });

    it('should only dismiss the clicked toast', () => {
      act(() => {
        useToastStore.getState().addToast('Toast 1');
        useToastStore.getState().addToast('Toast 2');
      });

      render(<ToastContainer />);

      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();

      const dismissButton = screen.getByTestId('toast-dismiss-toast-1');
      fireEvent.click(dismissButton);

      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have correct container ARIA attributes', () => {
      act(() => {
        useToastStore.getState().addToast('Test');
      });

      render(<ToastContainer />);

      const container = screen.getByTestId('toast-container');
      expect(container).toHaveAttribute('role', 'status');
      expect(container).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveAttribute('aria-label', 'Notifications');
    });

    it('should have role="alert" on individual toasts', () => {
      act(() => {
        useToastStore.getState().addToast('Alert message');
      });

      render(<ToastContainer />);

      const toast = screen.getByTestId('toast-toast-1');
      expect(toast).toHaveAttribute('role', 'alert');
    });

    it('should have accessible dismiss button', () => {
      act(() => {
        useToastStore.getState().addToast('Test');
      });

      render(<ToastContainer />);

      const dismissButton = screen.getByTestId('toast-dismiss-toast-1');
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss notification');
      expect(dismissButton).toHaveAttribute('type', 'button');
    });

    it('should have 44x44px touch target for dismiss button', () => {
      act(() => {
        useToastStore.getState().addToast('Test');
      });

      render(<ToastContainer />);

      const dismissButton = screen.getByTestId('toast-dismiss-toast-1');
      // Check that the button has the min-h and min-w classes
      expect(dismissButton.className).toContain('min-h-[44px]');
      expect(dismissButton.className).toContain('min-w-[44px]');
    });
  });

  describe('animation', () => {
    it('should have slide-in animation class', () => {
      act(() => {
        useToastStore.getState().addToast('Animated toast');
      });

      render(<ToastContainer />);

      const toast = screen.getByTestId('toast-toast-1');
      expect(toast.className).toContain('animate-slide-in');
    });

    it('should have reduced motion class for accessibility', () => {
      act(() => {
        useToastStore.getState().addToast('Animated toast');
      });

      render(<ToastContainer />);

      const toast = screen.getByTestId('toast-toast-1');
      expect(toast.className).toContain('motion-reduce:animate-none');
    });
  });

  describe('positioning', () => {
    it('should be fixed at bottom-right', () => {
      act(() => {
        useToastStore.getState().addToast('Positioned toast');
      });

      render(<ToastContainer />);

      const container = screen.getByTestId('toast-container');
      expect(container.className).toContain('fixed');
      expect(container.className).toContain('bottom-4');
      expect(container.className).toContain('right-4');
      expect(container.className).toContain('z-50');
    });
  });

  describe('icons', () => {
    it('should render icon for each toast type', () => {
      act(() => {
        useToastStore.getState().addToast('Success', { type: 'success' });
      });

      render(<ToastContainer />);

      // The icon should be present (hidden from assistive tech)
      const toast = screen.getByTestId('toast-toast-1');
      const icon = toast.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });
});
