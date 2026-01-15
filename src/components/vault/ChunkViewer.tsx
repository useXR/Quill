'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Hash, CheckCircle, AlertCircle } from 'lucide-react';
import type { ChunkData } from '@/app/api/vault/[id]/chunks/route';

interface ChunkViewerProps {
  vaultItemId: string;
  filename: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChunkViewer({ vaultItemId, filename, isOpen, onClose }: ChunkViewerProps) {
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen && vaultItemId) {
      fetchChunks();
    }
  }, [isOpen, vaultItemId]);

  async function fetchChunks() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vault/${vaultItemId}/chunks`);
      if (!response.ok) {
        throw new Error('Failed to fetch chunks');
      }
      const data = await response.json();
      setChunks(data);
      // Expand first chunk by default
      if (data.length > 0) {
        setExpandedChunks(new Set([0]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function toggleChunk(index: number) {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedChunks(new Set(chunks.map((_, i) => i)));
  }

  function collapseAll() {
    setExpandedChunks(new Set());
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-surface rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-faint">
          <div>
            <h2 className="text-lg font-semibold text-ink-primary">Chunk Viewer</h2>
            <p className="text-sm text-ink-secondary truncate max-w-md">{filename}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-ink-tertiary hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        {chunks.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-b border-ink-faint bg-surface-subtle">
            <span className="text-sm text-ink-secondary">{chunks.length} chunks</span>
            <button onClick={expandAll} className="text-sm text-quill hover:underline">
              Expand all
            </button>
            <button onClick={collapseAll} className="text-sm text-quill hover:underline">
              Collapse all
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-quill"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-error p-4 bg-error-light rounded-md">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && chunks.length === 0 && (
            <div className="text-center py-8 text-ink-tertiary">No chunks found for this document.</div>
          )}

          {!loading && !error && chunks.length > 0 && (
            <div className="space-y-2">
              {chunks.map((chunk, index) => (
                <div key={chunk.id} className="border border-ink-faint rounded-lg overflow-hidden">
                  {/* Chunk header */}
                  <button
                    onClick={() => toggleChunk(index)}
                    className="w-full flex items-center gap-3 p-3 bg-surface-subtle hover:bg-surface-hover text-left"
                  >
                    {expandedChunks.has(index) ? (
                      <ChevronDown className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                    )}

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Hash className="w-4 h-4 text-ink-tertiary" />
                      <span className="font-mono text-sm text-ink-secondary">{chunk.chunk_index}</span>
                    </div>

                    {chunk.heading_context && (
                      <span className="text-sm text-quill bg-quill-lighter px-2 py-0.5 rounded truncate max-w-xs">
                        {chunk.heading_context}
                      </span>
                    )}

                    <div className="flex-1" />

                    {chunk.has_embedding ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle className="w-3 h-3" />
                        Embedded
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-warning">
                        <AlertCircle className="w-3 h-3" />
                        No embedding
                      </span>
                    )}

                    <span className="text-xs text-ink-tertiary">{chunk.content.length} chars</span>
                  </button>

                  {/* Chunk content */}
                  {expandedChunks.has(index) && (
                    <div className="p-4 bg-surface border-t border-ink-faint">
                      <pre className="whitespace-pre-wrap font-mono text-sm text-ink-primary leading-relaxed">
                        {chunk.content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
