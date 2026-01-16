import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { ChatSidebar } from '../ChatSidebar';
import { useEffect } from 'react';

// Mock the useStreamingChat hook
vi.mock('@/hooks/useStreamingChat', () => ({
  useStreamingChat: () => ({
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    retryLastMessage: vi.fn(),
    isLoading: false,
    isStreaming: false,
  }),
}));

// Mock fetch for the clear history functionality
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

/**
 * Helper component that opens the sidebar on mount.
 * Used for tests that need to interact with the open sidebar.
 */
function OpenSidebarWrapper({ children }: { children: React.ReactNode }) {
  const { dispatch } = useChat();
  useEffect(() => {
    dispatch({ type: 'OPEN_SIDEBAR' });
  }, [dispatch]);
  return <>{children}</>;
}

describe('ChatSidebar', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<ChatProvider>{ui}</ChatProvider>);
  };

  /**
   * Renders ChatSidebar with sidebar already open.
   * The FAB toggle is now in EditorCanvas, so tests need sidebar pre-opened.
   */
  const renderWithOpenSidebar = () => {
    return render(
      <ChatProvider>
        <OpenSidebarWrapper>
          <ChatSidebar documentId="doc-1" projectId="proj-1" />
        </OpenSidebarWrapper>
      </ChatProvider>
    );
  };

  describe('Sidebar State', () => {
    it('should render collapsed state when sidebar is closed', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      // When closed, the wrapper has w-0 and aria-hidden="true"
      const wrapper = screen.getByTestId('chat-sidebar-wrapper');
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    });

    it('should render expanded state when sidebar is open', () => {
      renderWithOpenSidebar();
      const wrapper = screen.getByTestId('chat-sidebar-wrapper');
      expect(wrapper).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    });

    it('should close sidebar when close button clicked', () => {
      renderWithOpenSidebar();
      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();

      // Close sidebar via close button in header
      const closeButton = screen.getByLabelText('Close chat sidebar');
      fireEvent.click(closeButton);
      expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no messages', () => {
      renderWithOpenSidebar();
      expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should display Document Chat title', () => {
      renderWithOpenSidebar();
      expect(screen.getByText('Document Chat')).toBeInTheDocument();
    });

    it('should have clear history button', () => {
      renderWithOpenSidebar();
      expect(screen.getByTestId('chat-clear-history')).toBeInTheDocument();
    });
  });

  describe('Clear History', () => {
    it('should show confirm dialog when clear button clicked', () => {
      renderWithOpenSidebar();
      fireEvent.click(screen.getByTestId('chat-clear-history'));
      expect(screen.getByText('Clear Chat History')).toBeInTheDocument();
    });

    it('should close dialog when cancelled', () => {
      renderWithOpenSidebar();
      fireEvent.click(screen.getByTestId('chat-clear-history'));

      fireEvent.click(screen.getByTestId('confirm-cancel'));
      expect(screen.queryByText('Clear Chat History')).not.toBeInTheDocument();
    });

    it('should call clear history API when confirmed', async () => {
      renderWithOpenSidebar();
      fireEvent.click(screen.getByTestId('chat-clear-history'));

      fireEvent.click(screen.getByTestId('confirm-confirm'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/chat/history', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: 'proj-1', documentId: 'doc-1' }),
        });
      });
    });
  });

  describe('Chat Input', () => {
    it('should render chat input when sidebar is open', () => {
      renderWithOpenSidebar();
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('should render send button when sidebar is open', () => {
      renderWithOpenSidebar();
      expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on wrapper', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      const wrapper = screen.getByTestId('chat-sidebar-wrapper');
      expect(wrapper).toHaveAttribute('aria-label', 'Document chat');
    });

    it('should have accessible close button when open', () => {
      renderWithOpenSidebar();
      expect(screen.getByLabelText('Close chat sidebar')).toBeInTheDocument();
    });

    it('should have accessible clear history button', () => {
      renderWithOpenSidebar();
      expect(screen.getByLabelText('Clear chat history')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should render message list container', () => {
      renderWithOpenSidebar();
      expect(screen.getByTestId('chat-message-list')).toBeInTheDocument();
    });
  });
});
