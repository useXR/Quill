'use client';

import { FileText, File, Clock, Loader2, CheckCircle, AlertCircle, Trash2, RefreshCw, Eye } from 'lucide-react';
import type { VaultItem } from '@/lib/vault/types';
import type { ExtractionStatus } from '@/lib/vault/types';

export interface VaultItemCardProps {
  item: VaultItem;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
  onViewChunks?: (item: VaultItem) => void;
}

const processingStatuses: ExtractionStatus[] = ['downloading', 'extracting', 'chunking', 'embedding'];

function getFileIcon(type: string) {
  if (type === 'pdf') {
    return <FileText className="w-5 h-5 text-ink-tertiary" data-testid="file-icon-pdf" aria-hidden="true" />;
  }
  return <File className="w-5 h-5 text-ink-tertiary" data-testid={`file-icon-${type}`} aria-hidden="true" />;
}

function getStatusIcon(status: ExtractionStatus) {
  if (status === 'pending') {
    return <Clock className="w-4 h-4 text-warning" aria-hidden="true" />;
  }

  if (processingStatuses.includes(status)) {
    return (
      <Loader2
        className="w-4 h-4 text-quill motion-safe:animate-spin"
        data-testid="status-spinner"
        aria-hidden="true"
      />
    );
  }

  if (status === 'success') {
    return <CheckCircle className="w-4 h-4 text-success" aria-hidden="true" />;
  }

  if (status === 'failed' || status === 'partial') {
    return <AlertCircle className="w-4 h-4 text-error" aria-hidden="true" />;
  }

  return null;
}

function getStatusColorClass(status: ExtractionStatus): string {
  if (status === 'pending') return 'text-warning';
  if (processingStatuses.includes(status)) return 'text-quill';
  if (status === 'success') return 'text-success';
  if (status === 'failed' || status === 'partial') return 'text-error';
  return 'text-ink-secondary';
}

export function VaultItemCard({ item, onDelete, onRetry, onViewChunks }: VaultItemCardProps) {
  const status = item.extraction_status as ExtractionStatus;
  const showRetryButton = status === 'failed' && onRetry;
  const showChunkCount = status === 'success' && item.chunk_count !== null;
  const showViewChunks = status === 'success' && item.chunk_count !== null && item.chunk_count > 0 && onViewChunks;

  return (
    <div className="flex items-center justify-between p-4 bg-surface border border-ink-faint rounded-lg shadow-sm hover:shadow-md hover:border-ink-subtle transition-all duration-200">
      {/* Left side: File icon and info */}
      <div className="flex items-center gap-3 min-w-0">
        {getFileIcon(item.type)}
        <div className="min-w-0">
          <p className="font-ui font-medium text-ink-primary truncate">{item.filename}</p>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <span className={`font-ui text-sm capitalize ${getStatusColorClass(status)}`}>{status}</span>
            {showChunkCount && <span className="font-ui text-sm text-ink-tertiary">{item.chunk_count} chunks</span>}
          </div>
        </div>
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {showViewChunks && (
          <button
            type="button"
            onClick={() => onViewChunks(item)}
            className="p-2 rounded-md text-quill hover:bg-quill-lighter focus:outline-none focus:ring-2 focus:ring-quill"
            aria-label="View chunks"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        {showRetryButton && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="p-2 rounded-md text-quill hover:bg-quill-lighter focus:outline-none focus:ring-2 focus:ring-quill"
            aria-label="Retry extraction"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="p-2 rounded-md text-error hover:bg-error-light focus:outline-none focus:ring-2 focus:ring-error"
          aria-label="Delete item"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
