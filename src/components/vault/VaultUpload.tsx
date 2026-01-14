'use client';

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS, FILE_TYPE_MAP } from '@/lib/vault/constants';

interface VaultUploadProps {
  projectId: string;
  onUpload: () => void;
  disabled?: boolean;
}

type UploadState = 'idle' | 'uploading';

export function VaultUpload({ projectId, onUpload, disabled = false }: VaultUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const validateFile = (file: File): string | null => {
    // Check if file type is supported
    const isAllowedMimeType = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
    if (!isAllowedMimeType) {
      return 'Unsupported file type. Please upload PDF, DOCX, or TXT files.';
    }

    // Get file extension and check size limits
    const extension = getFileExtension(file.name);
    const fileType = FILE_TYPE_MAP[extension] as keyof typeof FILE_SIZE_LIMITS | undefined;

    if (fileType && file.size > FILE_SIZE_LIMITS[fileType]) {
      const maxSizeMB = FILE_SIZE_LIMITS[fileType] / (1024 * 1024);
      return `File too large. Maximum size for ${extension.toUpperCase()} files is ${maxSizeMB}MB.`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploadState('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      const response = await fetch('/api/vault/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      onUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploadState('idle');
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadFile(files[0]);
      }
    },
    [disabled, projectId, onUpload]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFile(files[0]);
      }
    },
    [projectId, onUpload]
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const isUploading = uploadState === 'uploading';
  const isDisabled = disabled || isUploading;

  const zoneClasses = [
    'border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-150',
    isDragOver && !isDisabled
      ? 'border-quill bg-quill-lighter'
      : 'border-ink-faint bg-bg-secondary hover:border-ink-subtle hover:bg-surface-hover',
    isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full">
      <div
        data-testid="vault-upload-zone"
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={zoneClasses}
        aria-label="Upload files to vault"
        aria-disabled={isDisabled}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-quill motion-safe:animate-spin" />
            <p className="font-ui font-medium text-ink-primary">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-ink-tertiary" />
            <div>
              <p className="font-ui font-medium text-ink-primary">Drag files here or click to browse</p>
              <p className="font-ui text-sm text-ink-tertiary mt-1">
                PDF, DOCX, or TXT (max 100MB for PDF, 50MB for DOCX, 10MB for TXT)
              </p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        data-testid="vault-file-input"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileChange}
        disabled={isDisabled}
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <div role="alert" className="mt-3 p-3 bg-error-light border border-error/20 rounded-md">
          <p className="text-sm font-ui text-error-dark">{error}</p>
        </div>
      )}
    </div>
  );
}
