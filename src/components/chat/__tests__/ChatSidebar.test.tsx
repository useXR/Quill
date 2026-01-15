import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatProvider } from '@/contexts/ChatContext';
import { ChatSidebar } from '../ChatSidebar';

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

  describe('Toggle Behavior', () => {
    it('should render toggle button when closed', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      expect(screen.getByTestId('chat-sidebar-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    });

    it('should open sidebar when toggle clicked', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    });

    it('should close sidebar when close button clicked', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);

      // Open sidebar
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();

      // Close sidebar (toggle button is also in the header when open)
      const closeButton = screen.getByLabelText('Close chat sidebar');
      fireEvent.click(closeButton);
      expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no messages', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should display Document Chat title', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByText('Document Chat')).toBeInTheDocument();
    });

    it('should have clear history button', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByTestId('chat-clear-history')).toBeInTheDocument();
    });
  });

  describe('Clear History', () => {
    it('should show confirm dialog when clear button clicked', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      fireEvent.click(screen.getByTestId('chat-clear-history'));
      expect(screen.getByText('Clear Chat History')).toBeInTheDocument();
    });

    it('should close dialog when cancelled', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      fireEvent.click(screen.getByTestId('chat-clear-history'));

      fireEvent.click(screen.getByTestId('confirm-cancel'));
      expect(screen.queryByText('Clear Chat History')).not.toBeInTheDocument();
    });

    it('should call clear history API when confirmed', async () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
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
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('should render send button when sidebar is open', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible toggle button', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      const toggle = screen.getByTestId('chat-sidebar-toggle');
      expect(toggle).toHaveAttribute('aria-label', 'Open chat sidebar');
    });

    it('should have accessible close button when open', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByLabelText('Close chat sidebar')).toBeInTheDocument();
    });

    it('should have accessible clear history button', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByLabelText('Clear chat history')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should render message list container', () => {
      renderWithProvider(<ChatSidebar documentId="doc-1" projectId="proj-1" />);
      fireEvent.click(screen.getByTestId('chat-sidebar-toggle'));
      expect(screen.getByTestId('chat-message-list')).toBeInTheDocument();
    });
  });
});
