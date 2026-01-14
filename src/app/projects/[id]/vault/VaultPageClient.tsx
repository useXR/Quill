'use client';

import { useState, useCallback } from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { VaultUpload } from '@/components/vault/VaultUpload';
import { VaultItemList } from '@/components/vault/VaultItemList';
import { VaultSearch } from '@/components/vault/VaultSearch';
import type { VaultItem } from '@/lib/vault/types';

interface VaultPageClientProps {
  projectId: string;
  initialItems: VaultItem[];
}

function VaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-4 text-center bg-error-light border border-error/20 rounded-lg"
    >
      <AlertCircle className="w-12 h-12 text-error mb-4" aria-hidden="true" />
      <h2 className="font-display text-lg font-bold text-error-dark mb-2">Something went wrong</h2>
      <p className="font-ui text-sm text-error-dark mb-4">{error.message}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="inline-flex items-center gap-2 px-4 py-2 bg-error hover:bg-error-dark text-white font-ui font-semibold text-sm rounded-md shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

function VaultPageContent({ projectId, initialItems }: VaultPageClientProps) {
  const [items, setItems] = useState<VaultItem[]>(initialItems);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    const response = await fetch(`/api/vault?projectId=${projectId}`);
    if (response.ok) {
      const data = await response.json();
      setItems(data.items);
    }
  }, [projectId]);

  const handleUpload = useCallback(() => {
    refreshItems();
  }, [refreshItems]);

  const handleDelete = useCallback(
    async (id: string) => {
      // Store the item for potential rollback
      const itemToDelete = items.find((item) => item.id === id);
      if (!itemToDelete) return;

      // Optimistic update: remove item immediately
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteError(null);

      try {
        const response = await fetch(`/api/vault/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Delete failed');
        }
      } catch {
        // Rollback: restore the item
        setItems((prev) => [...prev, itemToDelete]);
        setDeleteError('Failed to delete item. Please try again.');
      }
    },
    [items]
  );

  const handleRetry = useCallback(
    async (id: string) => {
      const response = await fetch('/api/vault/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vaultItemId: id }),
      });

      if (response.ok) {
        // Refresh items to get updated status
        refreshItems();
      }
    },
    [refreshItems]
  );

  const handleDismissError = useCallback(() => {
    setDeleteError(null);
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <h1 className="font-display text-3xl font-bold text-ink-primary tracking-tight">Knowledge Vault</h1>

      {/* Upload Section */}
      <section aria-labelledby="upload-section">
        <VaultUpload projectId={projectId} onUpload={handleUpload} />
      </section>

      {/* Delete Error Alert */}
      {deleteError && (
        <div role="alert" className="flex items-start gap-3 p-4 bg-error-light border border-error/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="flex-1 font-ui text-sm text-error-dark">{deleteError}</p>
          <button
            type="button"
            onClick={handleDismissError}
            className="p-1 rounded-md text-error hover:bg-error/10 focus:outline-none focus:ring-2 focus:ring-error"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Search Section */}
      <section aria-labelledby="search-heading">
        <h2 id="search-heading" className="font-display text-xl font-semibold text-ink-primary mb-4">
          Search
        </h2>
        <VaultSearch projectId={projectId} />
      </section>

      {/* Files Section */}
      <section aria-labelledby="files-heading">
        <h2 id="files-heading" className="font-display text-xl font-semibold text-ink-primary mb-4">
          Files
        </h2>
        <VaultItemList items={items} onDelete={handleDelete} onRetry={handleRetry} />
      </section>
    </div>
  );
}

export function VaultPageClient({ projectId, initialItems }: VaultPageClientProps) {
  return (
    <ErrorBoundary FallbackComponent={VaultErrorFallback}>
      <VaultPageContent projectId={projectId} initialItems={initialItems} />
    </ErrorBoundary>
  );
}
