'use client';

import { FileText } from 'lucide-react';
import { VaultItemCard } from './VaultItemCard';
import type { VaultItem } from '@/lib/vault/types';

interface VaultItemListProps {
  items: VaultItem[];
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function VaultItemList({ items, onDelete, onRetry }: VaultItemListProps) {
  if (items.length === 0) {
    return (
      <div
        className="
        flex flex-col items-center justify-center
        py-16 px-4
        text-center
      "
      >
        <FileText className="w-16 h-16 text-ink-subtle mb-4" />
        <h3 className="font-display text-lg font-bold text-ink-primary mb-2">No files uploaded yet</h3>
        <p className="font-ui text-sm text-ink-tertiary max-w-sm">
          Upload PDFs, DOCX, or TXT files to build your knowledge vault.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <VaultItemCard key={item.id} item={item} onDelete={onDelete} onRetry={onRetry} />
      ))}
    </div>
  );
}
