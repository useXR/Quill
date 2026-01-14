'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

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
      <Input
        id="title"
        type="text"
        label="Project Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isLoading}
        placeholder="Enter project title"
        maxLength={255}
        helperText={`${title.length}/255 characters`}
        required
      />

      <Textarea
        id="description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={isLoading}
        placeholder="Optional description for your project"
        rows={4}
        maxLength={1000}
        helperText={`${description.length}/1000 characters`}
      />

      {formState.error && <Alert variant="error">{formState.error}</Alert>}

      <div className="flex gap-4">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isLoading} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isLoading ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
