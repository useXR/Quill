'use client';

import { ChatProvider } from '@/contexts/ChatContext';
import { DiffProvider } from '@/contexts/DiffContext';
import { DocumentEditorProvider } from '@/contexts/DocumentEditorContext';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DiffPanelWrapper } from '@/components/editor/DiffPanelWrapper';
import type { Document } from '@/lib/supabase/types';

interface DocumentPageClientProps {
  documentId: string;
  projectId: string;
  document: Document;
}

/**
 * Client component wrapper for the document page.
 * Provides ChatContext, DiffContext, and DocumentEditorContext to enable
 * AI chat sidebar and diff panel functionality.
 */
export function DocumentPageClient({ documentId, projectId, document }: DocumentPageClientProps) {
  return (
    <ChatProvider>
      <DiffProvider>
        <DocumentEditorProvider documentId={documentId} projectId={projectId}>
          <DocumentEditor documentId={documentId} initialDocument={document} enableAI={true} />
          <ChatSidebar documentId={documentId} projectId={projectId} />
          <DiffPanelWrapper />
        </DocumentEditorProvider>
      </DiffProvider>
    </ChatProvider>
  );
}
