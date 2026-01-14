import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test-utils';
import { VaultUpload } from '../VaultUpload';
import { FILE_SIZE_LIMITS } from '@/lib/vault/constants';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('VaultUpload', () => {
  const defaultProps = {
    projectId: 'test-project-id',
    onUpload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, item: { id: 'item-1' } }),
    });
  });

  it('should render upload zone with instructions', () => {
    render(<VaultUpload {...defaultProps} />);

    expect(screen.getByTestId('vault-upload-zone')).toBeInTheDocument();
    expect(screen.getByText(/drag files here/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, DOCX, or TXT/i)).toBeInTheDocument();
  });

  it('should show drag-over state when file is dragged over', () => {
    render(<VaultUpload {...defaultProps} />);

    const uploadZone = screen.getByTestId('vault-upload-zone');

    fireEvent.dragOver(uploadZone);
    fireEvent.dragEnter(uploadZone, { dataTransfer: { types: ['Files'] } });

    expect(uploadZone).toHaveClass('border-quill');
    expect(uploadZone).toHaveClass('bg-quill-lighter');
  });

  it('should reset drag state on drag leave', () => {
    render(<VaultUpload {...defaultProps} />);

    const uploadZone = screen.getByTestId('vault-upload-zone');

    // First, trigger drag enter
    fireEvent.dragEnter(uploadZone, { dataTransfer: { types: ['Files'] } });
    expect(uploadZone).toHaveClass('border-quill');

    // Then, trigger drag leave
    fireEvent.dragLeave(uploadZone);
    expect(uploadZone).not.toHaveClass('border-quill');
    expect(uploadZone).toHaveClass('border-ink-faint');
  });

  it('should validate file size before upload (rejects >100MB PDFs)', async () => {
    render(<VaultUpload {...defaultProps} />);

    const fileInput = screen.getByTestId('vault-file-input');

    // Create a file that exceeds the PDF size limit (100MB)
    const oversizedFile = new File(['x'.repeat(1000)], 'large.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(oversizedFile, 'size', {
      value: FILE_SIZE_LIMITS.pdf + 1,
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });

    // Verify fetch was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should reject unsupported file types', async () => {
    render(<VaultUpload {...defaultProps} />);

    const fileInput = screen.getByTestId('vault-file-input');

    // Create an unsupported file type
    const unsupportedFile = new File(['content'], 'image.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [unsupportedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });

    // Verify fetch was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should call API and onUpload after successful upload', async () => {
    const onUpload = vi.fn();
    render(<VaultUpload {...defaultProps} onUpload={onUpload} />);

    const fileInput = screen.getByTestId('vault-file-input');

    // Create a valid PDF file
    const validFile = new File(['pdf content'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vault/upload',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalled();
    });
  });

  it('should show uploading state during upload', async () => {
    // Create a promise that we can control
    let resolveUpload: (value: Response) => void;
    const uploadPromise = new Promise<Response>((resolve) => {
      resolveUpload = resolve;
    });

    mockFetch.mockReturnValueOnce(uploadPromise);

    render(<VaultUpload {...defaultProps} />);

    const fileInput = screen.getByTestId('vault-file-input');

    // Create a valid PDF file
    const validFile = new File(['pdf content'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Should show uploading state with spinner
    await waitFor(() => {
      const uploadZone = screen.getByTestId('vault-upload-zone');
      expect(uploadZone).toHaveTextContent(/uploading/i);
      // Check for the spinner class (motion-safe:animate-spin)
      const spinner = uploadZone.querySelector('.motion-safe\\:animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    // Resolve the upload and wait for state to settle
    resolveUpload!({
      ok: true,
      json: () => Promise.resolve({ success: true, item: { id: 'item-1' } }),
    } as Response);

    // Wait for the component to finish updating after resolution
    await waitFor(() => {
      const uploadZone = screen.getByTestId('vault-upload-zone');
      expect(uploadZone).not.toHaveTextContent(/uploading/i);
    });
  });
});
