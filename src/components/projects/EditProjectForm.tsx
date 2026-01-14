'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import type { Database } from '@/lib/supabase/database.types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectStatus = 'draft' | 'submitted' | 'funded';

type FormStatus = 'idle' | 'loading' | 'error';

interface FormState {
  status: FormStatus;
  error: string;
}

interface EditProjectFormProps {
  project: Project;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'funded', label: 'Funded' },
];

export function EditProjectForm({ project }: EditProjectFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState<ProjectStatus>((project.status as ProjectStatus) || 'draft');
  const [formState, setFormState] = useState<FormState>({ status: 'idle', error: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Client-side validation
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
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update project';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Response was not JSON, use default error message
        }
        setFormState({ status: 'error', error: errorMessage });
        return;
      }

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

      <Select
        id="status"
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        disabled={isLoading}
        options={STATUS_OPTIONS}
      />

      {formState.error && <Alert variant="error">{formState.error}</Alert>}

      <div className="flex gap-4">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isLoading} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
