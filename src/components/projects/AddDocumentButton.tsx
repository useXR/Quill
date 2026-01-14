'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddDocumentButtonProps {
  projectId: string;
}

export function AddDocumentButton({ projectId }: AddDocumentButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleClick = async () => {
    if (isCreating) return;

    setIsCreating(true);

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          title: 'Untitled Document',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create document');
      }

      const document = await response.json();
      router.push(`/projects/${projectId}/documents/${document.id}`);
    } catch (error) {
      console.error('Failed to create document:', error);
      setIsCreating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isCreating}
      className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
      </svg>
      {isCreating ? 'Creating...' : 'Add Document'}
    </button>
  );
}
