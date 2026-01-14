# Task 12: Edit Project Page

> **Phase 1** | [<- Document Metadata](./12-document-metadata.md) | [Next: Verification ->](./99-verification.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an Edit Project page to allow users to update project title, description, and status.

**Architecture:** Client component form that fetches existing project data on mount, validates input with the existing `UpdateProjectSchema`, and calls `PATCH /api/projects/[id]`. Follows the existing `NewProjectForm` pattern with controlled inputs and form state management.

**Tech Stack:** Next.js App Router, Zod validation, Vitest + React Testing Library, Playwright E2E

---

## Context

### Prerequisites

- **Task 6** completed (Projects CRUD with API - `07-projects-crud.md`)
- **Task 10** completed (E2E infrastructure - `11-e2e-tests.md`)

### What This Task Creates

- `src/components/ui/Select.tsx` - Select UI component
- `src/components/ui/__tests__/Select.test.tsx` - Select unit tests
- `src/components/projects/EditProjectForm.tsx` - Edit project form component
- `src/components/projects/__tests__/EditProjectForm.test.tsx` - Unit tests
- `src/app/projects/[id]/edit/page.tsx` - Edit project page
- `e2e/pages/ProjectPage.ts` - Updated with edit methods
- `e2e/projects/project-edit.spec.ts` - E2E tests for editing

### Tasks That Depend on This

- None (final task before verification)

---

## Files to Create/Modify

- `src/components/ui/Select.tsx` (create)
- `src/components/ui/__tests__/Select.test.tsx` (create)
- `src/components/projects/EditProjectForm.tsx` (create)
- `src/components/projects/__tests__/EditProjectForm.test.tsx` (create)
- `src/app/projects/[id]/edit/page.tsx` (create)
- `e2e/pages/ProjectPage.ts` (modify)
- `e2e/projects/project-edit.spec.ts` (create)

---

## Steps

### Step 12.1: Write the failing test for Select component

Create `src/components/ui/__tests__/Select.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../Select';

const mockOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'funded', label: 'Funded' },
];

describe('Select', () => {
  describe('Rendering', () => {
    it('should render with label', () => {
      render(<Select id="status" label="Status" options={mockOptions} />);

      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    it('should render all options', () => {
      render(<Select id="status" label="Status" options={mockOptions} />);

      expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Submitted' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Funded' })).toBeInTheDocument();
    });

    it('should render helper text', () => {
      render(
        <Select id="status" label="Status" options={mockOptions} helperText="Select project status" />
      );

      expect(screen.getByText('Select project status')).toBeInTheDocument();
    });

    it('should render error state', () => {
      render(
        <Select id="status" label="Status" options={mockOptions} error="Status is required" />
      );

      expect(screen.getByText('Status is required')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onChange when selection changes', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <Select id="status" label="Status" options={mockOptions} onChange={handleChange} />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'submitted');

      expect(handleChange).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <Select id="status" label="Status" options={mockOptions} disabled />
      );

      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-describedby linking to helper text', () => {
      render(
        <Select id="status" label="Status" options={mockOptions} helperText="Help text" />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'status-helper');
    });

    it('should have aria-describedby linking to error', () => {
      render(
        <Select id="status" label="Status" options={mockOptions} error="Error message" />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'status-error');
    });

    it('should have aria-invalid when error is present', () => {
      render(
        <Select id="status" label="Status" options={mockOptions} error="Error message" />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
```

### Step 12.2: Run test to verify it fails

```bash
npm test src/components/ui/__tests__/Select.test.tsx
```

**Expected:** FAIL - module '../Select' not found

### Step 12.3: Implement Select UI component

Create `src/components/ui/Select.tsx`:

```typescript
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, helperText, error, className, id, ...props }, ref) => {
    const hasError = !!error;
    const helperId = id ? `${id}-helper` : undefined;
    const errorId = id ? `${id}-error` : undefined;
    const describedBy = hasError ? errorId : helperText ? helperId : undefined;

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--color-ink-secondary)]"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
          className={cn(
            'w-full px-4 py-2.5 rounded-[var(--radius-md)]',
            'bg-[var(--color-surface)] border border-[var(--color-ink-faint)]',
            'text-[var(--color-ink-primary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            hasError && 'border-[var(--color-error)] focus:ring-[var(--color-error)]',
            className
          )}
          style={{ fontFamily: 'var(--font-ui)' }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasError && (
          <p
            id={errorId}
            className="text-sm text-[var(--color-error)]"
            style={{ fontFamily: 'var(--font-ui)' }}
            role="alert"
          >
            {error}
          </p>
        )}
        {!hasError && helperText && (
          <p
            id={helperId}
            className="text-sm text-[var(--color-ink-tertiary)]"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
```

### Step 12.4: Run test to verify it passes

```bash
npm test src/components/ui/__tests__/Select.test.tsx
```

**Expected:** PASS

### Step 12.5: Write the failing test for EditProjectForm

Create `src/components/projects/__tests__/EditProjectForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditProjectForm } from '../EditProjectForm';

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('EditProjectForm', () => {
  const mockProject = {
    id: 'project-123',
    title: 'Existing Project',
    description: 'Existing description',
    status: 'draft' as const,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });
  });

  describe('Rendering', () => {
    it('should render form with project data pre-filled', () => {
      render(<EditProjectForm project={mockProject} />);

      expect(screen.getByLabelText(/project title/i)).toHaveValue('Existing Project');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Existing description');
      expect(screen.getByLabelText(/status/i)).toHaveValue('draft');
    });

    it('should render save and cancel buttons', () => {
      render(<EditProjectForm project={mockProject} />);

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render status select with all options', () => {
      render(<EditProjectForm project={mockProject} />);

      const statusSelect = screen.getByLabelText(/status/i);
      expect(statusSelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: /draft/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /submitted/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /funded/i })).toBeInTheDocument();
    });

    it('should handle null description gracefully', () => {
      const projectWithNullDesc = { ...mockProject, description: null };
      render(<EditProjectForm project={projectWithNullDesc} />);

      expect(screen.getByLabelText(/description/i)).toHaveValue('');
    });
  });

  describe('Form Submission', () => {
    it('should call PATCH API with updated data on submit', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `/api/projects/${mockProject.id}`,
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('Updated Title'),
          })
        );
      });
    });

    it('should include description in PATCH request', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const descInput = screen.getByLabelText(/description/i);
      await user.clear(descInput);
      await user.type(descInput, 'Updated description');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `/api/projects/${mockProject.id}`,
          expect.objectContaining({
            body: expect.stringContaining('Updated description'),
          })
        );
      });
    });

    it('should redirect to project page on successful save', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/projects/${mockProject.id}`);
      });
    });

    it('should show loading state while saving', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => Promise.resolve(mockProject) }), 100))
      );

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Button should show loading state (isLoading prop)
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });

    it('should show error message on API failure', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to update project' }),
      });

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to update/i);
      });
    });

    it('should handle network errors gracefully', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
      });
    });

    it('should handle non-JSON error responses', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to update/i);
      });
    });
  });

  describe('Validation', () => {
    it('should show error when title is empty', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/title is required/i);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should show error when title exceeds 255 characters', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'A'.repeat(256));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/255 characters/i);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should show error when description exceeds 1000 characters', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const descInput = screen.getByLabelText(/description/i);
      await user.clear(descInput);
      await user.type(descInput, 'B'.repeat(1001));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/1000 characters/i);
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cancel', () => {
    it('should call router.back() when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Character Count', () => {
    it('should show character count for title', () => {
      render(<EditProjectForm project={mockProject} />);

      // "Existing Project" = 16 characters
      expect(screen.getByText(/16\/255/)).toBeInTheDocument();
    });

    it('should show character count for description', () => {
      render(<EditProjectForm project={mockProject} />);

      // "Existing description" = 20 characters
      expect(screen.getByText(/20\/1000/)).toBeInTheDocument();
    });

    it('should update character count when typing', async () => {
      const user = userEvent.setup();
      render(<EditProjectForm project={mockProject} />);

      const titleInput = screen.getByLabelText(/project title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Test');

      expect(screen.getByText(/4\/255/)).toBeInTheDocument();
    });
  });
});
```

### Step 12.6: Run test to verify it fails

```bash
npm test src/components/projects/__tests__/EditProjectForm.test.tsx
```

**Expected:** FAIL - module '../EditProjectForm' not found

### Step 12.7: Implement EditProjectForm component

Create `src/components/projects/EditProjectForm.tsx`:

```typescript
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
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
```

### Step 12.8: Run test to verify it passes

```bash
npm test src/components/projects/__tests__/EditProjectForm.test.tsx
```

**Expected:** PASS

### Step 12.9: Create Edit Project page

Create `src/app/projects/[id]/edit/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProject, ApiError } from '@/lib/api';
import { EditProjectForm } from '@/components/projects/EditProjectForm';

export const dynamic = 'force-dynamic';

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let project;
  try {
    project = await getProject(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2" style={{ fontFamily: 'var(--font-ui)' }}>
            <li>
              <Link
                href="/projects"
                className="text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-primary)] transition-colors duration-150"
              >
                Projects
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <Link
                href={`/projects/${id}`}
                className="ml-2 text-sm text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-primary)] transition-colors duration-150"
              >
                {project.title}
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <span className="ml-2 text-sm text-[var(--color-ink-secondary)] font-medium">Edit</span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-[var(--color-ink-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Edit Project
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-tertiary)]" style={{ fontFamily: 'var(--font-ui)' }}>
            Update your project details below.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] border border-[var(--color-ink-faint)] p-6">
          <EditProjectForm project={project} />
        </div>
      </div>
    </div>
  );
}
```

### Step 12.10: Run the application and verify manually

```bash
npm run dev
```

Navigate to `/projects/{id}/edit` and verify:

- Form loads with existing project data (title, description, status)
- Title can be edited
- Description can be edited
- Status can be changed
- Save redirects back to project page
- Cancel goes back

### Step 12.11: Update ProjectPage page object for E2E tests

Modify `e2e/pages/ProjectPage.ts` to add edit-related methods.

Add these properties to the constructor:

```typescript
// Edit project form elements
readonly editTitleInput: Locator;
readonly editDescriptionInput: Locator;
readonly editStatusSelect: Locator;
readonly editTitleCharCount: Locator;
readonly editDescriptionCharCount: Locator;
readonly saveButton: Locator;
readonly editFormError: Locator;
readonly editButton: Locator;
readonly editCancelButton: Locator;
```

In the constructor, add:

```typescript
// Edit project page elements
this.editButton = page.getByRole('link', { name: /edit/i });
this.editTitleInput = page.locator('#title');
this.editDescriptionInput = page.locator('#description');
this.editStatusSelect = page.locator('#status');
this.editTitleCharCount = page.locator('#title-helper');
this.editDescriptionCharCount = page.locator('#description-helper');
this.saveButton = page.getByRole('button', { name: /save changes/i });
this.editCancelButton = page.getByRole('button', { name: /cancel/i });
this.editFormError = page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
```

Add these methods:

```typescript
/**
 * Navigate to edit project page.
 */
async gotoEdit(projectId: string) {
  await this.page.goto(`/projects/${projectId}/edit`);
  await this.page.waitForLoadState('domcontentloaded');
}

/**
 * Fill the edit title field.
 */
async fillEditTitle(title: string) {
  await this.editTitleInput.fill(title);
}

/**
 * Clear and fill the edit title field.
 */
async clearAndFillEditTitle(title: string) {
  await this.editTitleInput.clear();
  await this.editTitleInput.fill(title);
}

/**
 * Fill the edit description field.
 */
async fillEditDescription(description: string) {
  await this.editDescriptionInput.fill(description);
}

/**
 * Select a status option.
 */
async selectStatus(status: 'draft' | 'submitted' | 'funded') {
  await this.editStatusSelect.selectOption(status);
}

/**
 * Submit the edit form.
 */
async submitEdit() {
  await this.saveButton.click();
}

/**
 * Cancel the edit form.
 */
async cancelEdit() {
  await this.editCancelButton.click();
}

/**
 * Edit a project with new values.
 * Returns the project ID.
 */
async editProject(
  projectId: string,
  title?: string,
  description?: string,
  status?: 'draft' | 'submitted' | 'funded'
): Promise<string> {
  await this.gotoEdit(projectId);

  if (title !== undefined) {
    await this.clearAndFillEditTitle(title);
  }

  if (description !== undefined) {
    await this.editDescriptionInput.clear();
    await this.editDescriptionInput.fill(description);
  }

  if (status) {
    await this.selectStatus(status);
  }

  await this.submitEdit();

  // Wait for redirect to project detail page
  await this.page.waitForURL(/\/projects\/[^/]+$/, { timeout: TIMEOUTS.NAVIGATION });

  return projectId;
}

/**
 * Click edit button on project detail page.
 */
async clickEdit() {
  await this.editButton.click();
}

/**
 * Expect edit form validation error.
 */
async expectEditError(pattern: string | RegExp) {
  await expect(this.editFormError).toContainText(pattern);
}
```

### Step 12.12: Create E2E tests for Edit Project

Create `e2e/projects/project-edit.spec.ts`:

```typescript
/**
 * Project Edit E2E tests
 *
 * Tests for editing project functionality including:
 * - Navigation to edit page
 * - Form pre-population
 * - Title and description editing with validation
 * - Status changes
 * - Save and cancel behavior
 * - Accessibility
 *
 * These tests run with authenticated storage state from auth.setup.ts.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';
import { ProjectPage } from '../pages/ProjectPage';
import { checkA11y } from '../helpers/axe';

test.describe('Project Editing', () => {
  // Store test project data
  const testData: { projectId?: string; projectTitle?: string; createdProjectIds: string[] } = {
    createdProjectIds: [],
  };

  // Helper to create a test project via API
  async function createTestProject(
    page: import('@playwright/test').Page,
    title?: string
  ): Promise<{ id: string; title: string }> {
    const timestamp = Date.now();
    const projectTitle = title || `Edit Test Project ${timestamp}`;
    const response = await page.request.post('/api/projects', {
      data: {
        title: projectTitle,
        description: 'A project for testing edit functionality.',
      },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create project: ${response.status()}`);
    }
    const project = await response.json();
    testData.createdProjectIds.push(project.id);
    return { id: project.id, title: projectTitle };
  }

  // Helper to delete test projects
  async function cleanupProjects(page: import('@playwright/test').Page) {
    for (const projectId of testData.createdProjectIds) {
      await page.request.delete(`/api/projects/${projectId}`).catch(() => {
        // Ignore cleanup errors
      });
    }
    testData.createdProjectIds = [];
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();

    const project = await createTestProject(page);
    testData.projectId = project.id;
    testData.projectTitle = project.title;

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.playwright/.auth/user.json',
    });
    const page = await context.newPage();
    await cleanupProjects(page);
    await context.close();
  });

  test.describe('Navigation', () => {
    test('should navigate to edit page from project detail', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoProject(testData.projectId!);

      await projectPage.clickEdit();

      await expect(page).toHaveURL(new RegExp(`/projects/${testData.projectId}/edit`));
    });

    test('should display edit page with breadcrumb', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      // Breadcrumb should show Projects > [Title] > Edit
      await expect(page.getByText('Projects').first()).toBeVisible();
      await expect(page.getByText(testData.projectTitle!)).toBeVisible();
      await expect(page.getByText('Edit')).toBeVisible();
    });

    test('should redirect to login when not authenticated', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/projects/${testData.projectId}/edit`);

      await expect(page).toHaveURL(/\/login/);

      await context.close();
    });
  });

  test.describe('Form Pre-population', () => {
    test('should pre-fill form with existing project data', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await expect(projectPage.editTitleInput).toHaveValue(testData.projectTitle!);
      await expect(projectPage.editStatusSelect).toHaveValue('draft');
    });

    test('should show correct character count for existing title', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      const titleLength = testData.projectTitle!.length;
      await expect(projectPage.editTitleCharCount).toContainText(`${titleLength}/255`);
    });
  });

  test.describe('Title Editing', () => {
    test('should update project title successfully', async ({ page }) => {
      const project = await createTestProject(page);
      const projectPage = new ProjectPage(page);
      const newTitle = `Updated Title ${Date.now()}`;

      await projectPage.editProject(project.id, newTitle);

      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
      await expect(page.getByRole('heading', { name: newTitle, level: 1 })).toBeVisible();
    });

    test('should show validation error when title is cleared', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await projectPage.editTitleInput.clear();
      await projectPage.submitEdit();

      await projectPage.expectEditError(/title is required/i);
      await expect(page).toHaveURL(/\/edit$/);
    });

    test('should update character count when typing', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await projectPage.clearAndFillEditTitle('Test');

      await expect(projectPage.editTitleCharCount).toContainText('4/255');
    });

    test('should enforce title character limit', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      const longTitle = 'A'.repeat(300);
      await projectPage.clearAndFillEditTitle(longTitle);

      const inputValue = await projectPage.editTitleInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(255);
    });
  });

  test.describe('Description Editing', () => {
    test('should update project description successfully', async ({ page }) => {
      const project = await createTestProject(page);
      const projectPage = new ProjectPage(page);
      const newDescription = `Updated description ${Date.now()}`;

      await projectPage.editProject(project.id, undefined, newDescription);

      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
      await expect(page.getByText(newDescription)).toBeVisible();
    });

    test('should allow clearing description', async ({ page }) => {
      const project = await createTestProject(page);
      const projectPage = new ProjectPage(page);

      await projectPage.editProject(project.id, undefined, '');

      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
    });
  });

  test.describe('Status Changes', () => {
    test('should update project status to submitted', async ({ page }) => {
      const project = await createTestProject(page);
      const projectPage = new ProjectPage(page);

      await projectPage.editProject(project.id, undefined, undefined, 'submitted');

      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
      await expect(page.getByText('Submitted')).toBeVisible();
    });

    test('should update project status to funded', async ({ page }) => {
      const project = await createTestProject(page);
      const projectPage = new ProjectPage(page);

      await projectPage.editProject(project.id, undefined, undefined, 'funded');

      await expect(page.getByText('Funded')).toBeVisible();
    });

    test('should display all status options', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await expect(page.getByRole('option', { name: /draft/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /submitted/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /funded/i })).toBeVisible();
    });
  });

  test.describe('Save and Cancel', () => {
    test('should show loading state while saving', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await page.route('**/api/projects/**', async (route) => {
        if (route.request().method() === 'PATCH') {
          await new Promise((r) => setTimeout(r, 500));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      await projectPage.submitEdit();

      // Button should be disabled during loading
      await expect(projectPage.saveButton).toBeDisabled();
    });

    test('should navigate back when cancel is clicked', async ({ page }) => {
      const projectPage = new ProjectPage(page);

      await projectPage.gotoProject(testData.projectId!);
      await projectPage.clickEdit();
      await expect(page).toHaveURL(/\/edit$/);

      await projectPage.cancelEdit();

      await expect(page).toHaveURL(new RegExp(`/projects/${testData.projectId}$`));
    });

    test('should not save when cancel is clicked after making changes', async ({ page }) => {
      const originalTitle = `Cancel Test ${Date.now()}`;
      const project = await createTestProject(page, originalTitle);

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(project.id);

      await projectPage.clearAndFillEditTitle('Changed Title');
      await projectPage.cancelEdit();

      await projectPage.gotoProject(project.id);
      await expect(page.getByRole('heading', { name: originalTitle, level: 1 })).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API error gracefully', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await page.route('**/api/projects/**', async (route) => {
        if (route.request().method() === 'PATCH') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.continue();
        }
      });

      await projectPage.submitEdit();

      await expect(projectPage.editFormError).toBeVisible({ timeout: TIMEOUTS.API_CALL });
    });

    test('should handle 404 for non-existent project', async ({ page }) => {
      await page.goto('/projects/00000000-0000-0000-0000-000000000000/edit');
      await page.waitForLoadState('networkidle');

      const isNotFound = await page
        .getByText(/not found|404/i)
        .first()
        .isVisible()
        .catch(() => false);
      const isRedirected = page.url().includes('/projects') && !page.url().includes('/edit');
      const isLogin = page.url().includes('/login');

      expect(isNotFound || isRedirected || isLogin).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('should pass accessibility audit on edit form', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await checkA11y(page, { skipFailures: true, detailedReport: true });
    });

    test('should have accessible form labels', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      const titleLabel = page.locator('label[for="title"]');
      await expect(titleLabel).toBeVisible();
      await expect(titleLabel).toContainText(/title/i);

      const descLabel = page.locator('label[for="description"]');
      await expect(descLabel).toBeVisible();
      await expect(descLabel).toContainText(/description/i);

      const statusLabel = page.locator('label[for="status"]');
      await expect(statusLabel).toBeVisible();
      await expect(statusLabel).toContainText(/status/i);
    });

    test('should support keyboard navigation', async ({ page }) => {
      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await projectPage.editTitleInput.focus();
      await page.keyboard.press('Tab'); // to description
      await page.keyboard.press('Tab'); // to status
      await page.keyboard.press('Tab'); // to cancel
      await page.keyboard.press('Tab'); // to save

      const activeElement = await page.evaluate(() => document.activeElement?.textContent);
      expect(activeElement).toMatch(/save/i);
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await expect(projectPage.editTitleInput).toBeVisible();
      await expect(projectPage.editDescriptionInput).toBeVisible();
      await expect(projectPage.editStatusSelect).toBeVisible();
      await expect(projectPage.saveButton).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const projectPage = new ProjectPage(page);
      await projectPage.gotoEdit(testData.projectId!);

      await expect(projectPage.editTitleInput).toBeVisible();
      await expect(projectPage.editStatusSelect).toBeVisible();
    });
  });
});
```

### Step 12.13: Run E2E tests

```bash
npm run test:e2e -- --grep "Project Editing"
```

**Expected:** All E2E tests pass

### Step 12.14: Run all tests to ensure no regressions

```bash
npm test && npm run test:e2e
```

**Expected:** All unit tests and E2E tests pass

### Step 12.15: Commit

```bash
git add src/components/ui/Select.tsx src/components/ui/__tests__/Select.test.tsx src/components/projects/EditProjectForm.tsx src/components/projects/__tests__/EditProjectForm.test.tsx src/app/projects/\[id\]/edit e2e/pages/ProjectPage.ts e2e/projects/project-edit.spec.ts
git commit -m "feat: add edit project page with form validation, status updates, and E2E tests"
```

---

## Verification Checklist

### Select Component

- [ ] Select component unit tests pass
- [ ] Select renders with label and options
- [ ] Select has proper aria-describedby for helper text
- [ ] Select has proper aria-describedby for error
- [ ] Select has aria-invalid when error is present
- [ ] Select uses var(--color-error) for error styling

### EditProjectForm Component

- [ ] EditProjectForm unit tests pass
- [ ] Form renders with pre-filled title, description, and status
- [ ] Title editing works with validation (required, max 255 chars)
- [ ] Description editing works with validation (max 1000 chars)
- [ ] Status select works with all options (draft, submitted, funded)
- [ ] Save redirects to project detail page
- [ ] Cancel navigates back
- [ ] Character count updates while typing for title and description
- [ ] API errors are handled gracefully
- [ ] Network errors are handled gracefully
- [ ] Non-JSON error responses are handled gracefully

### Edit Project Page

- [ ] Page loads with existing project data
- [ ] 404 handled for non-existent projects
- [ ] Unauthenticated users are redirected to login
- [ ] Breadcrumb navigation works

### E2E Tests

- [ ] ProjectPage page object updated with edit methods
- [ ] E2E tests for navigation pass
- [ ] E2E tests for form pre-population pass
- [ ] E2E tests for title editing pass
- [ ] E2E tests for description editing pass
- [ ] E2E tests for status changes pass
- [ ] E2E tests for save/cancel pass
- [ ] E2E tests for error handling pass
- [ ] E2E accessibility tests pass
- [ ] E2E responsive layout tests pass
- [ ] E2E test cleanup runs in afterAll

### Final

- [ ] All existing tests still pass (no regressions)
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Phase 1 Verification](./99-verification.md)** to confirm all features work.
