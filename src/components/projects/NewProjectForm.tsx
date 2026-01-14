'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type FormStatus = 'idle' | 'loading' | 'error';

interface FormState {
  status: FormStatus;
  error: string;
}

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formState, setFormState] = useState<FormState>({ status: 'idle', error: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate
    if (!title.trim()) {
      setFormState({ status: 'error', error: 'Title is required' });
      return;
    }

    if (title.length > 255) {
      setFormState({ status: 'error', error: 'Title must be 255 characters or less' });
      return;
    }

    if (description.length > 1000) {
      setFormState({ status: 'error', error: 'Description must be 1000 characters or less' });
      return;
    }

    setFormState({ status: 'loading', error: '' });

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormState({ status: 'error', error: data.error || 'Failed to create project' });
        return;
      }

      const project = await response.json();
      router.push(`/projects/${project.id}`);
    } catch {
      setFormState({ status: 'error', error: 'Something went wrong. Please try again.' });
    }
  };

  const isLoading = formState.status === 'loading';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Project Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          placeholder="Enter project title"
          maxLength={255}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">{title.length}/255 characters</p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          placeholder="Optional description for your project"
          rows={4}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">{description.length}/1000 characters</p>
      </div>

      {formState.error && (
        <div className="p-3 rounded-md text-sm bg-red-50 text-red-700 border border-red-200" role="alert">
          {formState.error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}
