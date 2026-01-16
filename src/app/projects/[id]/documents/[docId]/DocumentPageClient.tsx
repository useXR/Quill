'use client';

import { ChatProvider } from '@/contexts/ChatContext';
import { DiffProvider } from '@/contexts/DiffContext';
import { DocumentEditorProvider } from '@/contexts/DocumentEditorContext';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DiffPanelWrapper } from '@/components/editor/DiffPanelWrapper';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
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
 *
 * Layout: Flex container with EditorCanvas (page-on-canvas) and ChatSidebar as siblings.
 * The sidebar pushes content rather than overlaying.
 */
export function DocumentPageClient({ documentId, projectId, document }: DocumentPageClientProps) {
  return (
    <ChatProvider>
      <DiffProvider>
        <DocumentEditorProvider documentId={documentId} projectId={projectId}>
          <div className="flex h-full overflow-hidden">
            <EditorCanvas>
              <DocumentEditor documentId={documentId} initialDocument={document} enableAI={true} />
            </EditorCanvas>
            <ChatSidebar documentId={documentId} projectId={projectId} />
          </div>
          <DiffPanelWrapper />
        </DocumentEditorProvider>
      </DiffProvider>
    </ChatProvider>
  );
}
