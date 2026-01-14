# Phase 1: Core Editor & Document Management Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core TipTap editor with autosave, Supabase auth with magic links, and CRUD for projects/documents.

**Architecture:** Next.js App Router with server components for data fetching, client components for interactive UI. Supabase handles auth and Postgres storage with RLS policies. TipTap provides rich text editing with grant-specific extensions.

**Tech Stack:** Next.js 14+, TipTap, Supabase (auth + Postgres + RLS), Zod validation, Vitest + React Testing Library, Playwright E2E

---

## Pre-requisites

Before starting, ensure:

- Node.js 18+ installed
- Supabase CLI installed (`npx supabase --version`)
- Project initialized with `npx create-next-app@latest`
- Supabase project linked (`npx supabase link`)

---

## Task 0: Supabase Setup & Database Schema

**Files:**

- Create: `supabase/migrations/20260113000000_initial_schema.sql`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/database.types.ts`

### Step 0.1: Install Supabase SSR package

Run: `npm install @supabase/ssr @supabase/supabase-js`
Expected: Packages added to package.json

### Step 0.2: Create initial schema migration

Create `supabase/migrations/20260113000000_initial_schema.sql`:

```sql
-- Projects table
CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'funded')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Documents table
CREATE TABLE public.documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content jsonb DEFAULT '{"type": "doc", "content": []}'::jsonb,
  content_text text DEFAULT '',
  sort_order integer DEFAULT 0,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Auth attempts table for rate limiting
CREATE TABLE public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now() NOT NULL,
  success boolean DEFAULT false
);

-- Indexes
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX idx_documents_project_id ON public.documents(project_id);
CREATE INDEX idx_documents_sort_order ON public.documents(project_id, sort_order);
CREATE INDEX idx_auth_attempts_email ON public.auth_attempts(email, created_at);
CREATE INDEX idx_auth_attempts_ip ON public.auth_attempts(ip_address, created_at);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Projects: users can only access their own
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Documents: users can access documents in their projects
CREATE POLICY "Users can view documents in own projects" ON public.documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create documents in own projects" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update documents in own projects" ON public.documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete documents in own projects" ON public.documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Rate limit check function
CREATE OR REPLACE FUNCTION check_auth_rate_limit(
  p_email text,
  p_ip inet,
  max_attempts int DEFAULT 5,
  window_minutes int DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  attempt_count int;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_attempts
  WHERE (email = p_email OR ip_address = p_ip)
    AND created_at > now() - (window_minutes || ' minutes')::interval;
  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 0.3: Apply migration

Run: `npx supabase db reset`
Expected: "Resetting local database... Done"

### Step 0.4: Generate TypeScript types

Run: `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
Expected: File created with Database type definitions

### Step 0.5: Create server client helper

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
```

### Step 0.6: Create browser client helper

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Step 0.7: Commit

```bash
git add supabase/migrations src/lib/supabase
git commit -m "chore: add Supabase setup with schema, RLS, and client helpers"
```

---

## Task 1: Testing Infrastructure

**Files:**

- Create: `src/lib/testing/test-setup.ts`
- Create: `src/lib/testing/supabase-mock.ts`
- Create: `src/lib/testing/tiptap-mock.ts`
- Create: `src/lib/testing/fixtures.ts`
- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/errors.ts`

### Step 1.1: Create API types

Create `src/lib/api/types.ts`:

```typescript
export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string; details?: unknown };

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalCount?: number;
}
```

### Step 1.2: Create API error classes

Create `src/lib/api/errors.ts`:

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### Step 1.3: Create test setup utilities

Create `src/lib/testing/test-setup.ts`:

```typescript
import { vi } from 'vitest';

export function setupTests() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as unknown as typeof IntersectionObserver;

  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
}
```

### Step 1.4: Create enhanced Supabase mock

Create `src/lib/testing/supabase-mock.ts`:

```typescript
import { vi } from 'vitest';

export interface MockSupabaseOptions {
  authenticated?: boolean;
  userId?: string;
  userEmail?: string;
}

export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const { authenticated = true, userId = 'user-test-123', userEmail = 'test@example.com' } = options;

  const createQueryBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockResolve: function (data: unknown) {
      this.single.mockResolvedValue({ data, error: null });
      return this;
    },
    mockReject: function (message: string, code = 'ERROR') {
      this.single.mockResolvedValue({ data: null, error: { message, code } });
      return this;
    },
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: userId, email: userEmail } : null },
        error: null,
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
    from: vi.fn(() => createQueryBuilder()),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

export function createUnauthenticatedMock() {
  return createMockSupabaseClient({ authenticated: false });
}
```

### Step 1.5: Create TipTap mock

Create `src/lib/testing/tiptap-mock.ts`:

```typescript
import { vi } from 'vitest';

export function createMockEditor() {
  const chainMethods = {
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleHeading: vi.fn().mockReturnThis(),
    toggleBulletList: vi.fn().mockReturnThis(),
    toggleOrderedList: vi.fn().mockReturnThis(),
    setTextAlign: vi.fn().mockReturnThis(),
    toggleHighlight: vi.fn().mockReturnThis(),
    undo: vi.fn().mockReturnThis(),
    redo: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue(true),
  };

  return {
    chain: vi.fn(() => chainMethods),
    ...chainMethods,
    isActive: vi.fn().mockReturnValue(false),
    getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
    getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
    getText: vi.fn().mockReturnValue('Test content'),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    state: {
      doc: {
        content: {
          content: [{ type: { name: 'paragraph' }, content: { size: 10 } }],
        },
      },
    },
    storage: {
      characterCount: {
        words: vi.fn().mockReturnValue(2),
        characters: vi.fn().mockReturnValue(12),
      },
    },
  };
}
```

### Step 1.6: Create test fixtures

Create `src/lib/testing/fixtures.ts`:

```typescript
export const fixtureUser = {
  id: 'user-fixture-123',
  email: 'fixture@example.com',
  created_at: new Date().toISOString(),
};

export const fixtureProject = {
  id: 'project-fixture-123',
  user_id: fixtureUser.id,
  title: 'Test Grant Project',
  description: 'A test project for unit tests',
  status: 'draft' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const fixtureDocument = {
  id: 'doc-fixture-123',
  project_id: fixtureProject.id,
  title: 'Project Narrative',
  content: { type: 'doc', content: [] },
  content_text: '',
  sort_order: 0,
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function createFixtureProject(overrides: Partial<typeof fixtureProject> = {}) {
  return { ...fixtureProject, id: `project-${Date.now()}`, ...overrides };
}

export function createFixtureDocument(overrides: Partial<typeof fixtureDocument> = {}) {
  return { ...fixtureDocument, id: `doc-${Date.now()}`, ...overrides };
}
```

### Step 1.7: Install zod

Run: `npm install zod`
Expected: Package added to package.json

### Step 1.8: Commit

```bash
git add src/lib/testing src/lib/api
git commit -m "chore: add testing infrastructure with mocks and fixtures"
```

---

## Task 2: TipTap Editor Setup

**Files:**

- Create: `src/components/editor/extensions/index.ts`
- Create: `src/components/editor/__tests__/Editor.test.tsx`
- Create: `src/components/editor/Editor.tsx`

### Step 2.1: Install TipTap dependencies

Run:

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-text-align @tiptap/extension-image @tiptap/extension-highlight
```

Expected: Packages added to package.json

### Step 2.2: Write the failing test for Editor

Create `src/components/editor/__tests__/Editor.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '../Editor';

describe('Editor Component', () => {
  describe('Rendering', () => {
    it('should render the editor with role textbox', () => {
      render(<Editor />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should display placeholder when empty', () => {
      render(<Editor placeholder="Start writing..." />);
      expect(screen.getByText('Start writing...')).toBeInTheDocument();
    });

    it('should render with initial content', () => {
      render(<Editor content="<p>Hello world</p>" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should render in read-only mode when editable is false', () => {
      render(<Editor editable={false} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });
  });

  describe('Text Input', () => {
    it('should call onChange when text is entered', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Editor onChange={onChange} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('Hello');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('should handle null onChange gracefully', async () => {
      const user = userEvent.setup();
      render(<Editor onChange={undefined} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('test');

      expect(editor).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup editor on unmount', () => {
      const { unmount } = render(<Editor />);
      expect(() => unmount()).not.toThrow();
    });
  });
});
```

### Step 2.3: Run test to verify it fails

Run: `npm test src/components/editor/__tests__/Editor.test.tsx`
Expected: FAIL - module '../Editor' not found

### Step 2.4: Create extensions configuration

Create `src/components/editor/extensions/index.ts`:

```typescript
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';

export interface ExtensionConfig {
  placeholder?: string;
  characterLimit?: number;
}

export function createExtensions(config: ExtensionConfig = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({
      placeholder: config.placeholder || 'Start writing your grant proposal...',
    }),
    CharacterCount.configure({
      limit: config.characterLimit,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-blue-600 underline' },
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    Highlight.configure({
      multicolor: true,
    }),
  ];
}
```

### Step 2.5: Implement Editor component

Create `src/components/editor/Editor.tsx`:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from './extensions';

export interface EditorProps {
  content?: string;
  placeholder?: string;
  characterLimit?: number;
  onChange?: (html: string, json: object) => void;
  editable?: boolean;
  className?: string;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  onChange,
  editable = true,
  className = '',
}: EditorProps) {
  const editor = useEditor({
    extensions: createExtensions({ placeholder, characterLimit }),
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML(), editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: `prose prose-lg max-w-none focus:outline-none min-h-[200px] p-4 ${className}`,
        role: 'textbox',
        'aria-label': 'Document editor',
        'aria-multiline': 'true',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <EditorContent editor={editor} />
    </div>
  );
}

export { useEditor };
export type { Editor as TiptapEditor } from '@tiptap/react';
```

### Step 2.6: Run test to verify it passes

Run: `npm test src/components/editor/__tests__/Editor.test.tsx`
Expected: PASS

### Step 2.7: Commit

```bash
git add src/components/editor
git commit -m "feat: add TipTap editor with grant writing extensions"
```

---

## Task 3: Editor Toolbar

**Files:**

- Create: `src/components/editor/__tests__/Toolbar.test.tsx`
- Create: `src/components/editor/Toolbar.tsx`
- Modify: `src/components/editor/Editor.tsx`

### Step 3.1: Install icons

Run: `npm install lucide-react`
Expected: Package added to package.json

### Step 3.2: Write the failing test for Toolbar

Create `src/components/editor/__tests__/Toolbar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';
import { createMockEditor } from '@/lib/testing/tiptap-mock';

describe('Toolbar Component', () => {
  let mockEditor: ReturnType<typeof createMockEditor>;

  beforeEach(() => {
    mockEditor = createMockEditor();
  });

  describe('Rendering', () => {
    it('should render all formatting buttons', () => {
      render(<Toolbar editor={mockEditor as any} />);

      expect(screen.getByLabelText('Bold')).toBeInTheDocument();
      expect(screen.getByLabelText('Italic')).toBeInTheDocument();
      expect(screen.getByLabelText('Heading 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Heading 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Bullet List')).toBeInTheDocument();
      expect(screen.getByLabelText('Numbered List')).toBeInTheDocument();
      expect(screen.getByLabelText('Align Left')).toBeInTheDocument();
      expect(screen.getByLabelText('Align Center')).toBeInTheDocument();
      expect(screen.getByLabelText('Align Right')).toBeInTheDocument();
    });

    it('should render null when editor is null', () => {
      const { container } = render(<Toolbar editor={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Button Actions', () => {
    it('should execute bold command on click', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as any} />);

      await user.click(screen.getByLabelText('Bold'));

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it('should execute heading command on click', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as any} />);

      await user.click(screen.getByLabelText('Heading 1'));

      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe('Active State', () => {
    it('should highlight active formatting button', () => {
      mockEditor.isActive = vi.fn((format) => format === 'bold');
      render(<Toolbar editor={mockEditor as any} />);

      const boldButton = screen.getByLabelText('Bold');
      expect(boldButton).toHaveClass('bg-gray-200');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on all buttons', () => {
      render(<Toolbar editor={mockEditor as any} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });
});
```

### Step 3.3: Run test to verify it fails

Run: `npm test src/components/editor/__tests__/Toolbar.test.tsx`
Expected: FAIL - module '../Toolbar' not found

### Step 3.4: Implement Toolbar component

Create `src/components/editor/Toolbar.tsx`:

```typescript
'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo,
  Redo,
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButton {
  icon: React.ElementType;
  label: string;
  action: () => boolean;
  isActive: () => boolean;
  group: string;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const buttons: ToolbarButton[] = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      group: 'format',
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      group: 'format',
    },
    {
      icon: Highlighter,
      label: 'Highlight',
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      group: 'format',
    },
    {
      icon: Heading1,
      label: 'Heading 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
      group: 'heading',
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
      group: 'heading',
    },
    {
      icon: List,
      label: 'Bullet List',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
      group: 'list',
    },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
      group: 'list',
    },
    {
      icon: AlignLeft,
      label: 'Align Left',
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
      group: 'align',
    },
    {
      icon: AlignCenter,
      label: 'Align Center',
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      group: 'align',
    },
    {
      icon: AlignRight,
      label: 'Align Right',
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      group: 'align',
    },
  ];

  const historyButtons: ToolbarButton[] = [
    {
      icon: Undo,
      label: 'Undo',
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
      group: 'history',
    },
    {
      icon: Redo,
      label: 'Redo',
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
      group: 'history',
    },
  ];

  const renderButton = (button: ToolbarButton) => {
    const Icon = button.icon;
    return (
      <button
        key={button.label}
        type="button"
        onClick={button.action}
        aria-label={button.label}
        aria-pressed={button.isActive()}
        title={button.label}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${
          button.isActive() ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  const groups = ['format', 'heading', 'list', 'align'];

  return (
    <div
      className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap"
      role="toolbar"
      aria-label="Editor formatting toolbar"
    >
      {groups.map((group, index) => (
        <div key={group} className="flex items-center">
          {buttons.filter((b) => b.group === group).map(renderButton)}
          {index < groups.length - 1 && (
            <div className="w-px h-6 bg-gray-300 mx-2" />
          )}
        </div>
      ))}
      <div className="w-px h-6 bg-gray-300 mx-2" />
      <div className="flex items-center">
        {historyButtons.map(renderButton)}
      </div>
    </div>
  );
}
```

### Step 3.5: Run test to verify it passes

Run: `npm test src/components/editor/__tests__/Toolbar.test.tsx`
Expected: PASS

### Step 3.6: Update Editor to include Toolbar

Modify `src/components/editor/Editor.tsx` to add toolbar support:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from './extensions';
import { Toolbar } from './Toolbar';

export interface EditorProps {
  content?: string;
  placeholder?: string;
  characterLimit?: number;
  onChange?: (html: string, json: object) => void;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  onChange,
  editable = true,
  className = '',
  showToolbar = true,
}: EditorProps) {
  const editor = useEditor({
    extensions: createExtensions({ placeholder, characterLimit }),
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML(), editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: `prose prose-lg max-w-none focus:outline-none min-h-[200px] p-4 ${className}`,
        role: 'textbox',
        'aria-label': 'Document editor',
        'aria-multiline': 'true',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {showToolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

export { useEditor };
export type { Editor as TiptapEditor } from '@tiptap/react';
```

### Step 3.7: Run all editor tests

Run: `npm test src/components/editor`
Expected: PASS (all tests)

### Step 3.8: Commit

```bash
git add src/components/editor
git commit -m "feat: add editor toolbar with formatting, alignment, and history"
```

---

## Task 4: Supabase Auth with Magic Link

**Files:**

- Create: `src/lib/auth/rate-limit.ts`
- Create: `src/lib/auth/__tests__/rate-limit.test.ts`
- Create: `src/app/api/auth/check-rate-limit/route.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/components/auth/__tests__/LoginForm.test.tsx`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`

### Step 4.1: Write the failing test for rate limiting

Create `src/lib/auth/__tests__/rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit, recordAuthAttempt } from '../rate-limit';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow when under limit', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await checkRateLimit('test@example.com', '127.0.0.1');

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block when over limit', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await checkRateLimit('spam@example.com', '127.0.0.1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(3600);
    });

    it('should fail open on database error', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await checkRateLimit('test@example.com', '127.0.0.1');

      expect(result.allowed).toBe(true);
    });
  });

  describe('recordAuthAttempt', () => {
    it('should record attempt to database', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({ insert: insertMock }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await recordAuthAttempt('test@example.com', '127.0.0.1', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('auth_attempts');
      expect(insertMock).toHaveBeenCalledWith({
        email: 'test@example.com',
        ip_address: '127.0.0.1',
        success: true,
      });
    });
  });
});
```

### Step 4.2: Run test to verify it fails

Run: `npm test src/lib/auth/__tests__/rate-limit.test.ts`
Expected: FAIL - module '../rate-limit' not found

### Step 4.3: Implement rate limiting helper

Create `src/lib/auth/rate-limit.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(email: string, ipAddress: string): Promise<RateLimitResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('check_auth_rate_limit', {
    p_email: email,
    p_ip: ipAddress,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true }; // Fail open but log
  }

  return {
    allowed: data === true,
    retryAfter: data === true ? undefined : 3600,
  };
}

export async function recordAuthAttempt(email: string, ipAddress: string, success: boolean): Promise<void> {
  const supabase = await createClient();

  await supabase.from('auth_attempts').insert({
    email,
    ip_address: ipAddress,
    success,
  });
}
```

### Step 4.4: Run test to verify it passes

Run: `npm test src/lib/auth/__tests__/rate-limit.test.ts`
Expected: PASS

### Step 4.5: Create rate limit API route

Create `src/app/api/auth/check-rate-limit/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkRateLimit, recordAuthAttempt } from '@/lib/auth/rate-limit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ allowed: false, error: 'Email is required' }, { status: 400 });
    }

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    const result = await checkRateLimit(email, ipAddress);

    if (!result.allowed) {
      await recordAuthAttempt(email, ipAddress, false);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Rate limit check error:', error);
    return NextResponse.json({ allowed: true });
  }
}
```

### Step 4.6: Create auth callback route

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_REDIRECTS = ['/', '/projects', '/editor'];

function isValidRedirect(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) {
    return ALLOWED_REDIRECTS.some((allowed) => url === allowed || url.startsWith(allowed + '/'));
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  const redirectTo = isValidRedirect(next) ? next : '/projects';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    console.error('Auth callback error:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### Step 4.7: Write the failing test for LoginForm

Create `src/components/auth/__tests__/LoginForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

global.fetch = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ allowed: true }),
    });
  });

  describe('Rendering', () => {
    it('should render email input and submit button', () => {
      render(<LoginForm />);

      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Magic Link' })).toBeInTheDocument();
    });
  });

  describe('Submission', () => {
    it('should show loading state when submitting', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });

    it('should show success message after magic link sent', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('should show rate limit error when exceeded', async () => {
      (fetch as any).mockResolvedValue({
        json: () => Promise.resolve({ allowed: false, retryAfter: 3600 }),
      });

      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/Too many attempts/)).toBeInTheDocument();
      });
    });
  });
});
```

### Step 4.8: Run test to verify it fails

Run: `npm test src/components/auth/__tests__/LoginForm.test.tsx`
Expected: FAIL - module '../LoginForm' not found

### Step 4.9: Implement LoginForm component

Create `src/components/auth/LoginForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type LoginState = 'idle' | 'loading' | 'success' | 'error' | 'rate_limited';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');

    try {
      const rateLimitResponse = await fetch('/api/auth/check-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const rateLimitData = await rateLimitResponse.json();

      if (!rateLimitData.allowed) {
        setState('rate_limited');
        setErrorMessage(
          `Too many attempts. Please try again in ${Math.ceil(
            rateLimitData.retryAfter / 60
          )} minutes.`
        );
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setState('error');
        setErrorMessage('Failed to send magic link. Please try again.');
        return;
      }

      setState('success');
    } catch {
      setState('error');
      setErrorMessage('An unexpected error occurred.');
    }
  };

  if (state === 'success') {
    return (
      <div className="text-center p-6">
        <h2 className="text-xl font-semibold text-green-600 mb-2">
          Check your email
        </h2>
        <p className="text-gray-600">
          We sent a magic link to <strong>{email}</strong>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={state === 'loading'}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {(state === 'error' || state === 'rate_limited') && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={state === 'loading' || state === 'rate_limited'}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
```

### Step 4.10: Run test to verify it passes

Run: `npm test src/components/auth/__tests__/LoginForm.test.tsx`
Expected: PASS

### Step 4.11: Create login page

Create `src/app/login/page.tsx`:

```typescript
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">
          Sign in to Quill
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
```

### Step 4.12: Commit

```bash
git add src/lib/auth src/app/api/auth src/app/auth src/components/auth src/app/login
git commit -m "feat: add auth with magic link, rate limiting, and login form"
```

---

## Task 5: Auth Middleware

**Files:**

- Create: `src/middleware.ts`
- Create: `src/__tests__/middleware.test.ts`

### Step 5.1: Write the failing test for middleware

Create `src/__tests__/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated user from /projects to /login', async () => {
      // Mock unauthenticated user
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/projects');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/projects');

      const response = await middleware(request as any);

      expect(response.status).toBe(307); // Redirect
    });

    it('should allow authenticated user to access /projects', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
          }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/projects');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/projects');

      const response = await middleware(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('Public Routes', () => {
    it('should allow access to /login without auth', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/login');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/login');

      const response = await middleware(request as any);

      expect(response.status).toBe(200);
    });

    it('should redirect authenticated user from /login to /projects', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
          }),
        },
      };
      vi.mocked(require('@supabase/ssr').createServerClient).mockReturnValue(mockSupabase);

      const { middleware } = await import('../middleware');
      const request = new Request('http://localhost/login');
      (request as any).cookies = { getAll: () => [] };
      (request as any).nextUrl = new URL('http://localhost/login');

      const response = await middleware(request as any);

      expect(response.status).toBe(307);
    });
  });
});
```

### Step 5.2: Run test to verify it fails

Run: `npm test src/__tests__/middleware.test.ts`
Expected: FAIL - module '../middleware' not found

### Step 5.3: Implement middleware

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/projects', '/editor', '/vault'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Step 5.4: Run test to verify it passes

Run: `npm test src/__tests__/middleware.test.ts`
Expected: PASS

### Step 5.5: Commit

```bash
git add src/middleware.ts src/__tests__/middleware.test.ts
git commit -m "feat: add auth middleware for route protection"
```

---

## Task 6: Projects CRUD

**Files:**

- Create: `src/lib/api/schemas/project.ts`
- Create: `src/lib/api/projects.ts`
- Create: `src/lib/api/__tests__/projects.test.ts`
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`
- Create: `src/components/projects/ProjectCard.tsx`
- Create: `src/components/projects/ProjectList.tsx`
- Create: `src/components/projects/NewProjectForm.tsx`
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/new/page.tsx`
- Create: `src/app/projects/[id]/page.tsx`

### Step 6.1: Create validation schemas

Create `src/lib/api/schemas/project.ts`:

```typescript
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
});

export const UpdateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim().optional(),
  status: z.enum(['draft', 'submitted', 'funded']).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
```

### Step 6.2: Write the failing test for projects API

Create `src/lib/api/__tests__/projects.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProjects, getProject, createProject, updateProject, deleteProject } from '../projects';
import { ApiError } from '../errors';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Projects API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await expect(getProjects()).rejects.toThrow(ApiError);
    });

    it('should return paginated projects for authenticated user', async () => {
      const mockProjects = [{ id: '1', title: 'Project 1', updated_at: new Date().toISOString() }];
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockProjects, count: 1, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await getProjects();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Project 1');
    });
  });

  describe('createProject', () => {
    it('should create project with valid data', async () => {
      const mockProject = { id: '123', title: 'New Project', status: 'draft' };
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await createProject({ title: 'New Project' });

      expect(result.title).toBe('New Project');
    });
  });
});
```

### Step 6.3: Run test to verify it fails

Run: `npm test src/lib/api/__tests__/projects.test.ts`
Expected: FAIL - module '../projects' not found

### Step 6.4: Implement projects API helpers

Create `src/lib/api/projects.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { PaginatedResponse } from './types';
import { ApiError, ErrorCodes } from './errors';

type Project = Database['public']['Tables']['projects']['Row'];

export interface GetProjectsOptions {
  cursor?: string;
  limit?: number;
}

export async function getProjects(options: GetProjectsOptions = {}): Promise<PaginatedResponse<Project>> {
  const { cursor, limit = 20 } = options;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
    query = query.lt('updated_at', decodedCursor);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  const hasMore = (data?.length || 0) > limit;
  const items = hasMore ? data?.slice(0, limit) : data;

  return {
    items: items || [],
    nextCursor: hasMore && items?.length ? Buffer.from(items[items.length - 1].updated_at).toString('base64') : null,
    totalCount: count || undefined,
  };
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase.from('projects').select('*').eq('id', id).eq('user_id', user.id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function createProject(input: { title: string; description?: string }): Promise<Project> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function updateProject(
  id: string,
  input: { title?: string; status?: 'draft' | 'submitted' | 'funded' }
): Promise<Project> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Project not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}
```

### Step 6.5: Run test to verify it passes

Run: `npm test src/lib/api/__tests__/projects.test.ts`
Expected: PASS

### Step 6.6: Create API routes

Create `src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/api/projects';
import { CreateProjectSchema } from '@/lib/api/schemas/project';
import { ApiError } from '@/lib/api/errors';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getProjects({ cursor, limit });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const project = await createProject(parsed.data);
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

Create `src/app/api/projects/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getProject, updateProject, deleteProject } from '@/lib/api/projects';
import { UpdateProjectSchema } from '@/lib/api/schemas/project';
import { ApiError } from '@/lib/api/errors';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const project = await updateProject(id, parsed.data);
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteProject(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Step 6.7: Create UI components (ProjectCard, ProjectList, NewProjectForm)

Create `src/components/projects/ProjectCard.tsx`:

```typescript
import Link from 'next/link';
import type { Database } from '@/lib/supabase/database.types';

type Project = Database['public']['Tables']['projects']['Row'];

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  funded: 'bg-green-100 text-green-700',
};

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[project.status as keyof typeof statusColors]}`}>
          {project.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Updated {new Date(project.updated_at).toLocaleDateString()}
      </p>
    </Link>
  );
}
```

Create `src/components/projects/ProjectList.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from './ProjectCard';
import type { Database } from '@/lib/supabase/database.types';

type Project = Database['public']['Tables']['projects']['Row'];

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        if (data.success) {
          setProjects(data.data.items);
        } else {
          setError(data.error);
        }
      } catch {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) return <div className="text-center py-8">Loading projects...</div>;
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>;
  if (projects.length === 0) return <div className="text-center py-8 text-gray-500">No projects yet.</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
    </div>
  );
}
```

Create `src/components/projects/NewProjectForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewProjectForm() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await response.json();
      if (data.success) {
        router.push(`/projects/${data.data.id}`);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">Project Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="NSF Grant 2026"
          required
          disabled={loading}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
}
```

### Step 6.8: Create pages

Create `src/app/projects/page.tsx`:

```typescript
import Link from 'next/link';
import { ProjectList } from '@/components/projects/ProjectList';

export default function ProjectsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Link href="/projects/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          New Project
        </Link>
      </div>
      <ProjectList />
    </div>
  );
}
```

Create `src/app/projects/new/page.tsx`:

```typescript
import Link from 'next/link';
import { NewProjectForm } from '@/components/projects/NewProjectForm';

export default function NewProjectPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/projects" className="text-blue-600 hover:underline mb-4 block">Back to Projects</Link>
      <h1 className="text-3xl font-bold mb-8">Create New Project</h1>
      <NewProjectForm />
    </div>
  );
}
```

Create `src/app/projects/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/api/projects';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{project.title}</h1>
      <p className="text-gray-500">Status: {project.status}</p>
      {/* Document list and editor will be added in later tasks */}
    </div>
  );
}
```

### Step 6.9: Commit

```bash
git add src/lib/api/schemas src/lib/api/projects.ts src/lib/api/__tests__ src/app/api/projects src/components/projects src/app/projects
git commit -m "feat: add projects CRUD with validation, pagination, and UI"
```

---

## Task 7: Documents CRUD

**Files:**

- Create: `src/lib/api/schemas/document.ts`
- Create: `src/lib/api/__tests__/documents.test.ts`
- Create: `src/lib/api/documents.ts`
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`

### Step 7.1: Create document validation schemas

Create `src/lib/api/schemas/document.ts`:

```typescript
import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim(),
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less').trim().optional(),
  content: z.any().optional(),
  content_text: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
```

### Step 7.2: Write the failing test for documents API

Create `src/lib/api/__tests__/documents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocuments, getDocument, createDocument, updateDocument, deleteDocument } from '../documents';
import { ApiError } from '../errors';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Documents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDocuments', () => {
    it('should throw UNAUTHORIZED when not authenticated', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await expect(getDocuments('project-123')).rejects.toThrow(ApiError);
    });

    it('should return documents for a project', async () => {
      const mockDocs = [
        { id: 'doc-1', title: 'Doc 1', sort_order: 0 },
        { id: 'doc-2', title: 'Doc 2', sort_order: 1 },
      ];
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockDocs, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await getDocuments('project-123');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Doc 1');
    });
  });

  describe('createDocument', () => {
    it('should create document with correct sort_order', async () => {
      const mockDoc = { id: 'doc-new', title: 'New Doc', sort_order: 2, version: 1 };
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { sort_order: 1 }, error: null }),
          insert: vi.fn().mockReturnThis(),
        }),
      };
      // Override for insert chain
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { sort_order: 1 }, error: null }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          };
        }
        return {};
      });
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await createDocument({ project_id: 'proj-123', title: 'New Doc' });

      expect(result.title).toBe('New Doc');
    });
  });

  describe('updateDocument', () => {
    it('should update document title', async () => {
      const mockDoc = { id: 'doc-1', title: 'Updated Title', version: 2 };
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockDoc, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      const result = await updateDocument('doc-1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw CONFLICT on version mismatch', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { version: 5 }, error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await expect(updateDocument('doc-1', { title: 'New', expectedVersion: 3 })).rejects.toThrow('Version conflict');
    });
  });

  describe('deleteDocument', () => {
    it('should delete document', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user123' } } }) },
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
      vi.mocked(require('@/lib/supabase/server').createClient).mockResolvedValue(mockSupabase);

      await expect(deleteDocument('doc-1')).resolves.not.toThrow();
    });
  });
});
```

### Step 7.3: Run test to verify it fails

Run: `npm test src/lib/api/__tests__/documents.test.ts`
Expected: FAIL - module '../documents' not found

### Step 7.4: Implement documents API helpers

Create `src/lib/api/documents.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { ApiError, ErrorCodes } from './errors';

type Document = Database['public']['Tables']['documents']['Row'];

export async function getDocuments(projectId: string): Promise<Document[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data || [];
}

export async function getDocument(id: string): Promise<Document | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function createDocument(input: { project_id: string; title: string }): Promise<Document> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  // Get max sort_order for this project
  const { data: maxOrder } = await supabase
    .from('documents')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (maxOrder?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      content: { type: 'doc', content: [] },
      content_text: '',
      sort_order: sortOrder,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function updateDocument(
  id: string,
  input: { title?: string; content?: unknown; content_text?: string; expectedVersion?: number }
): Promise<Document> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  // Version conflict detection
  if (input.expectedVersion !== undefined) {
    const { data: current } = await supabase.from('documents').select('version').eq('id', id).single();

    if (current && current.version !== input.expectedVersion) {
      throw new ApiError(409, ErrorCodes.CONFLICT, 'Version conflict detected');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.content !== undefined) updateData.content = input.content;
  if (input.content_text !== undefined) updateData.content_text = input.content_text;
  if (input.expectedVersion !== undefined) updateData.version = input.expectedVersion + 1;

  const { data, error } = await supabase.from('documents').update(updateData).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Document not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }

  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Not authenticated');
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}
```

### Step 7.5: Run test to verify it passes

Run: `npm test src/lib/api/__tests__/documents.test.ts`
Expected: PASS

### Step 7.6: Create documents API routes

Create `src/app/api/documents/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDocuments, createDocument } from '@/lib/api/documents';
import { CreateDocumentSchema } from '@/lib/api/schemas/document';
import { ApiError } from '@/lib/api/errors';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'project_id is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const documents = await getDocuments(projectId);
    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const document = await createDocument(parsed.data);
    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

Create `src/app/api/documents/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDocument, updateDocument, deleteDocument } from '@/lib/api/documents';
import { UpdateDocumentSchema } from '@/lib/api/schemas/document';
import { ApiError } from '@/lib/api/errors';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const document = await getDocument(id);

    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: document });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const document = await updateDocument(id, parsed.data);
    return NextResponse.json({ success: true, data: document });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteDocument(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Step 7.7: Commit

```bash
git add src/lib/api/schemas/document.ts src/lib/api/documents.ts src/lib/api/__tests__/documents.test.ts src/app/api/documents
git commit -m "feat: add documents CRUD with version conflict detection"
```

---

## Task 8: Autosave Hook

**Files:**

- Create: `src/hooks/__tests__/useAutosave.test.ts`
- Create: `src/hooks/useAutosave.ts`
- Create: `src/components/editor/SaveStatus.tsx`
- Create: `src/components/editor/DocumentEditor.tsx`

### Step 8.1: Write failing test for useAutosave

Create `src/hooks/__tests__/useAutosave.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutosave, SaveStatus } from '../useAutosave';

// Mock timers for debounce testing
jest.useFakeTimers();

describe('useAutosave', () => {
  const mockSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should start with idle status', () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 1000 }));

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('should debounce saves by configured ms', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 1000 }));

    // Trigger multiple saves rapidly
    act(() => {
      result.current.triggerSave('content 1');
      result.current.triggerSave('content 2');
      result.current.triggerSave('content 3');
    });

    // Should show pending status
    expect(result.current.status).toBe('pending');

    // Should not have called save yet
    expect(mockSave).not.toHaveBeenCalled();

    // Advance timers past debounce
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Should only save once with latest content
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('content 3');
  });

  it('should show saving status during save', async () => {
    let resolvePromise: () => void;
    mockSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 100 }));

    act(() => {
      result.current.triggerSave('content');
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.status).toBe('saving');

    await act(async () => {
      resolvePromise!();
    });

    expect(result.current.status).toBe('saved');
  });

  it('should retry with exponential backoff on failure', async () => {
    mockSave
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 100, maxRetries: 3 }));

    act(() => {
      result.current.triggerSave('content');
    });

    // Initial attempt
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('error');

    // First retry (1000ms backoff)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockSave).toHaveBeenCalledTimes(2);

    // Second retry (2000ms backoff)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('saved');
  });

  it('should save immediately on saveNow()', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 5000 }));

    act(() => {
      result.current.triggerSave('content');
    });

    // Don't wait for debounce, call saveNow
    await act(async () => {
      await result.current.saveNow();
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('content');
  });

  it('should save on window blur when configured', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 5000, saveOnBlur: true }));

    act(() => {
      result.current.triggerSave('content');
    });

    // Simulate window blur
    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('should track lastSavedAt timestamp', async () => {
    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 100 }));

    expect(result.current.lastSavedAt).toBeNull();

    act(() => {
      result.current.triggerSave('content');
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('should expose error on permanent failure', async () => {
    const error = new Error('Permanent failure');
    mockSave.mockRejectedValue(error);

    const { result } = renderHook(() => useAutosave({ save: mockSave, debounceMs: 100, maxRetries: 1 }));

    act(() => {
      result.current.triggerSave('content');
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Wait for retry
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(error);
  });
});
```

### Step 8.2: Run test to verify it fails

Run: `npm test src/hooks/__tests__/useAutosave.test.ts`
Expected: FAIL with "Cannot find module '../useAutosave'"

### Step 8.3: Implement useAutosave hook

Create `src/hooks/useAutosave.ts`:

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  save: (content: string) => Promise<void>;
  debounceMs?: number;
  maxRetries?: number;
  saveOnBlur?: boolean;
}

interface UseAutosaveReturn {
  triggerSave: (content: string) => void;
  saveNow: () => Promise<void>;
  status: SaveStatus;
  error: Error | null;
  lastSavedAt: Date | null;
}

export function useAutosave({
  save,
  debounceMs = 1000,
  maxRetries = 3,
  saveOnBlur = true,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pendingContentRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSave = useCallback(
    async (content: string) => {
      setStatus('saving');
      setError(null);

      try {
        await save(content);
        setStatus('saved');
        setLastSavedAt(new Date());
        retryCountRef.current = 0;
        pendingContentRef.current = null;
      } catch (err) {
        const saveError = err instanceof Error ? err : new Error('Save failed');

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setStatus('error');

          // Exponential backoff: 1s, 2s, 4s...
          const backoffMs = Math.pow(2, retryCountRef.current - 1) * 1000;

          retryTimerRef.current = setTimeout(() => {
            performSave(content);
          }, backoffMs);
        } else {
          setStatus('error');
          setError(saveError);
          retryCountRef.current = 0;
        }
      }
    },
    [save, maxRetries]
  );

  const triggerSave = useCallback(
    (content: string) => {
      pendingContentRef.current = content;
      setStatus('pending');

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        if (pendingContentRef.current !== null) {
          performSave(pendingContentRef.current);
        }
      }, debounceMs);
    },
    [debounceMs, performSave]
  );

  const saveNow = useCallback(async () => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Save immediately if there's pending content
    if (pendingContentRef.current !== null) {
      await performSave(pendingContentRef.current);
    }
  }, [performSave]);

  // Handle window blur
  useEffect(() => {
    if (!saveOnBlur) return;

    const handleBlur = () => {
      if (pendingContentRef.current !== null) {
        // Clear debounce and save immediately
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        performSave(pendingContentRef.current);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [saveOnBlur, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return {
    triggerSave,
    saveNow,
    status,
    error,
    lastSavedAt,
  };
}
```

### Step 8.4: Run test to verify it passes

Run: `npm test src/hooks/__tests__/useAutosave.test.ts`
Expected: PASS - All autosave hook tests pass

### Step 8.5: Write SaveStatus component test

Create `src/components/editor/__tests__/SaveStatus.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { SaveStatus, SaveStatusProps } from '../SaveStatus';

describe('SaveStatus', () => {
  const defaultProps: SaveStatusProps = {
    status: 'idle',
    lastSavedAt: null,
    error: null,
  };

  it('should show nothing when idle', () => {
    const { container } = render(<SaveStatus {...defaultProps} status="idle" />);
    expect(container.textContent).toBe('');
  });

  it('should show "Unsaved changes" when pending', () => {
    render(<SaveStatus {...defaultProps} status="pending" />);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('should show "Saving..." when saving', () => {
    render(<SaveStatus {...defaultProps} status="saving" />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('should show "Saved" with timestamp when saved', () => {
    const lastSavedAt = new Date('2024-01-15T10:30:00');
    render(<SaveStatus {...defaultProps} status="saved" lastSavedAt={lastSavedAt} />);
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });

  it('should show error message with retry option when error', () => {
    const error = new Error('Network error');
    render(<SaveStatus {...defaultProps} status="error" error={error} />);
    expect(screen.getByText(/Failed to save/)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', async () => {
    const error = new Error('Network error');
    const onRetry = jest.fn();
    render(<SaveStatus {...defaultProps} status="error" error={error} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    retryButton.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should show relative time for recent saves', () => {
    const lastSavedAt = new Date(Date.now() - 30000); // 30 seconds ago
    render(<SaveStatus {...defaultProps} status="saved" lastSavedAt={lastSavedAt} />);
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });
});
```

### Step 8.6: Implement SaveStatus component

Create `src/components/editor/SaveStatus.tsx`:

```typescript
'use client';

import { SaveStatus as SaveStatusType } from '@/hooks/useAutosave';

export interface SaveStatusProps {
  status: SaveStatusType;
  lastSavedAt: Date | null;
  error: Error | null;
  onRetry?: () => void;
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleTimeString();
}

export function SaveStatus({ status, lastSavedAt, error, onRetry }: SaveStatusProps) {
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      {status === 'pending' && (
        <>
          <span className="h-2 w-2 rounded-full bg-yellow-500" aria-hidden="true" />
          <span className="text-yellow-600 dark:text-yellow-400">Unsaved changes</span>
        </>
      )}

      {status === 'saving' && (
        <>
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
          <span className="text-blue-600 dark:text-blue-400">Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          <span className="text-green-600 dark:text-green-400">
            Saved {lastSavedAt ? formatRelativeTime(lastSavedAt) : ''}
          </span>
        </>
      )}

      {status === 'error' && (
        <>
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
          <span className="text-red-600 dark:text-red-400">
            Failed to save: {error?.message || 'Unknown error'}
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-2 text-red-600 hover:text-red-800 underline text-sm"
              type="button"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

### Step 8.7: Write DocumentEditor test

Create `src/components/editor/__tests__/DocumentEditor.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentEditor } from '../DocumentEditor';

// Mock the Editor component
jest.mock('../Editor', () => ({
  Editor: ({ initialContent, onChange }: { initialContent: string; onChange: (html: string, json: object) => void }) => (
    <div data-testid="mock-editor">
      <textarea
        data-testid="editor-textarea"
        defaultValue={initialContent}
        onChange={(e) => onChange(e.target.value, {})}
      />
    </div>
  ),
}));

// Mock fetch for save API
global.fetch = jest.fn();

describe('DocumentEditor', () => {
  const defaultProps = {
    documentId: 'doc-123',
    initialContent: '<p>Initial content</p>',
    initialVersion: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { version: 2 } }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render editor with initial content', () => {
    render(<DocumentEditor {...defaultProps} />);
    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
  });

  it('should show save status indicator', () => {
    render(<DocumentEditor {...defaultProps} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should trigger autosave on content change', async () => {
    render(<DocumentEditor {...defaultProps} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await waitFor(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/documents/doc-123',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Updated content'),
      })
    );
  });

  it('should include version for conflict detection', async () => {
    render(<DocumentEditor {...defaultProps} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });

    await waitFor(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/documents/doc-123',
      expect.objectContaining({
        body: expect.stringContaining('"expectedVersion":1'),
      })
    );
  });

  it('should update version after successful save', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { version: 2 } }),
    });

    render(<DocumentEditor {...defaultProps} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'First update' } });

    await waitFor(() => {
      jest.advanceTimersByTime(1000);
    });

    // Clear mock to check second call
    jest.clearAllMocks();

    fireEvent.change(textarea, { target: { value: 'Second update' } });

    await waitFor(() => {
      jest.advanceTimersByTime(1000);
    });

    // Second save should use updated version
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/documents/doc-123',
      expect.objectContaining({
        body: expect.stringContaining('"expectedVersion":2'),
      })
    );
  });

  it('should show error on version conflict', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: { code: 'CONFLICT', message: 'Version conflict detected' } }),
    });

    render(<DocumentEditor {...defaultProps} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });

    await waitFor(() => {
      jest.advanceTimersByTime(1000);
    });

    // Wait for error status to show
    await waitFor(() => {
      jest.advanceTimersByTime(3000); // Max retry time
    });

    expect(screen.getByText(/Failed to save/)).toBeInTheDocument();
  });
});
```

### Step 8.8: Implement DocumentEditor component

Create `src/components/editor/DocumentEditor.tsx`:

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { Editor } from './Editor';
import { SaveStatus } from './SaveStatus';
import { useAutosave } from '@/hooks/useAutosave';

interface DocumentEditorProps {
  documentId: string;
  initialContent: string;
  initialVersion: number;
}

export function DocumentEditor({
  documentId,
  initialContent,
  initialVersion,
}: DocumentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const versionRef = useRef(initialVersion);

  const saveDocument = useCallback(async (contentToSave: string) => {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: contentToSave,
        content_text: extractPlainText(contentToSave),
        expectedVersion: versionRef.current,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to save');
    }

    const result = await response.json();
    versionRef.current = result.data.version;
  }, [documentId]);

  const {
    triggerSave,
    saveNow,
    status,
    error,
    lastSavedAt,
  } = useAutosave({
    save: saveDocument,
    debounceMs: 1000,
    maxRetries: 3,
    saveOnBlur: true,
  });

  const handleChange = useCallback((html: string, _json: object) => {
    setContent(html);
    triggerSave(html);
  }, [triggerSave]);

  const handleRetry = useCallback(() => {
    triggerSave(content);
  }, [triggerSave, content]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 dark:bg-gray-900">
        <SaveStatus
          status={status}
          lastSavedAt={lastSavedAt}
          error={error}
          onRetry={handleRetry}
        />
        <button
          onClick={saveNow}
          disabled={status === 'saving' || status === 'idle'}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          Save Now
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <Editor
          initialContent={content}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

// Helper to extract plain text from HTML for search indexing
function extractPlainText(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: simple regex approach
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // Client-side: use DOM parser
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
```

### Step 8.9: Run all autosave tests

Run: `npm test -- --testPathPattern="(useAutosave|SaveStatus|DocumentEditor)"`
Expected: PASS - All autosave-related tests pass

### Step 8.10: Commit

```bash
git add src/hooks src/components/editor/SaveStatus.tsx src/components/editor/DocumentEditor.tsx
git commit -m "feat: add autosave hook with debouncing, retry, and conflict detection"
```

---

## Task 9: Word/Character Count

**Files:**

- Create: `src/components/editor/__tests__/WordCount.test.tsx`
- Create: `src/components/editor/WordCount.tsx`
- Create: `src/hooks/__tests__/useWordCount.test.ts`
- Create: `src/hooks/useWordCount.ts`
- Modify: `src/components/editor/Editor.tsx`

### Step 9.1: Write failing test for useWordCount hook

Create `src/hooks/__tests__/useWordCount.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useWordCount } from '../useWordCount';

describe('useWordCount', () => {
  it('should initialize with zero counts', () => {
    const { result } = renderHook(() => useWordCount());

    expect(result.current.wordCount).toBe(0);
    expect(result.current.charCount).toBe(0);
    expect(result.current.charCountNoSpaces).toBe(0);
  });

  it('should count words correctly', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello world this is a test');
    });

    expect(result.current.wordCount).toBe(6);
  });

  it('should count characters with spaces', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello world');
    });

    expect(result.current.charCount).toBe(11); // "Hello world" = 11 chars
  });

  it('should count characters without spaces', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello world');
    });

    expect(result.current.charCountNoSpaces).toBe(10); // "Helloworld" = 10 chars
  });

  it('should handle empty string', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('');
    });

    expect(result.current.wordCount).toBe(0);
    expect(result.current.charCount).toBe(0);
    expect(result.current.charCountNoSpaces).toBe(0);
  });

  it('should handle whitespace-only string', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('   \n\t  ');
    });

    expect(result.current.wordCount).toBe(0);
    expect(result.current.charCount).toBe(7); // whitespace counts as chars
    expect(result.current.charCountNoSpaces).toBe(0);
  });

  it('should handle multiple spaces between words', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello    world');
    });

    expect(result.current.wordCount).toBe(2);
  });

  it('should handle newlines and tabs', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('Hello\nworld\ttest');
    });

    expect(result.current.wordCount).toBe(3);
  });

  it('should handle hyphenated words as one word', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('well-known state-of-the-art');
    });

    expect(result.current.wordCount).toBe(2);
  });

  it('should strip HTML tags when counting', () => {
    const { result } = renderHook(() => useWordCount());

    act(() => {
      result.current.updateCount('<p>Hello <strong>world</strong></p>');
    });

    expect(result.current.wordCount).toBe(2);
    expect(result.current.charCount).toBe(11); // "Hello world"
  });

  it('should calculate percentage when limit provided', () => {
    const { result } = renderHook(() => useWordCount({ wordLimit: 100 }));

    act(() => {
      result.current.updateCount('word '.repeat(50).trim());
    });

    expect(result.current.wordCount).toBe(50);
    expect(result.current.percentage).toBe(50);
    expect(result.current.isOverLimit).toBe(false);
  });

  it('should flag when over word limit', () => {
    const { result } = renderHook(() => useWordCount({ wordLimit: 10 }));

    act(() => {
      result.current.updateCount('word '.repeat(15).trim());
    });

    expect(result.current.wordCount).toBe(15);
    expect(result.current.percentage).toBe(150);
    expect(result.current.isOverLimit).toBe(true);
  });

  it('should flag when near word limit', () => {
    const { result } = renderHook(() => useWordCount({ wordLimit: 100, warningThreshold: 90 }));

    act(() => {
      result.current.updateCount('word '.repeat(92).trim());
    });

    expect(result.current.isNearLimit).toBe(true);
    expect(result.current.isOverLimit).toBe(false);
  });

  it('should support character limits', () => {
    const { result } = renderHook(() => useWordCount({ charLimit: 100 }));

    act(() => {
      result.current.updateCount('a'.repeat(95));
    });

    expect(result.current.charCount).toBe(95);
    expect(result.current.charPercentage).toBe(95);
    expect(result.current.isCharOverLimit).toBe(false);
  });

  it('should flag when over character limit', () => {
    const { result } = renderHook(() => useWordCount({ charLimit: 100 }));

    act(() => {
      result.current.updateCount('a'.repeat(110));
    });

    expect(result.current.isCharOverLimit).toBe(true);
    expect(result.current.charPercentage).toBe(110);
  });
});
```

### Step 9.2: Run test to verify it fails

Run: `npm test src/hooks/__tests__/useWordCount.test.ts`
Expected: FAIL with "Cannot find module '../useWordCount'"

### Step 9.3: Implement useWordCount hook

Create `src/hooks/useWordCount.ts`:

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';

interface UseWordCountOptions {
  wordLimit?: number;
  charLimit?: number;
  warningThreshold?: number; // percentage (default 90)
}

interface UseWordCountReturn {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  percentage: number | null;
  charPercentage: number | null;
  isNearLimit: boolean;
  isOverLimit: boolean;
  isCharNearLimit: boolean;
  isCharOverLimit: boolean;
  updateCount: (text: string) => void;
}

function stripHtml(html: string): string {
  // Handle both server and client rendering
  if (typeof window === 'undefined') {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function countWords(text: string): number {
  const plainText = stripHtml(text).trim();
  if (!plainText) return 0;

  // Split on whitespace, filter empty strings
  const words = plainText.split(/\s+/).filter(Boolean);
  return words.length;
}

function countChars(text: string, includeSpaces: boolean): number {
  const plainText = stripHtml(text);
  if (includeSpaces) {
    return plainText.length;
  }
  return plainText.replace(/\s/g, '').length;
}

export function useWordCount(options: UseWordCountOptions = {}): UseWordCountReturn {
  const { wordLimit, charLimit, warningThreshold = 90 } = options;

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [charCountNoSpaces, setCharCountNoSpaces] = useState(0);

  const updateCount = useCallback((text: string) => {
    setWordCount(countWords(text));
    setCharCount(countChars(text, true));
    setCharCountNoSpaces(countChars(text, false));
  }, []);

  const percentage = useMemo(() => {
    if (!wordLimit) return null;
    return Math.round((wordCount / wordLimit) * 100);
  }, [wordCount, wordLimit]);

  const charPercentage = useMemo(() => {
    if (!charLimit) return null;
    return Math.round((charCount / charLimit) * 100);
  }, [charCount, charLimit]);

  const isNearLimit = useMemo(() => {
    if (percentage === null) return false;
    return percentage >= warningThreshold && percentage < 100;
  }, [percentage, warningThreshold]);

  const isOverLimit = useMemo(() => {
    if (percentage === null) return false;
    return percentage > 100;
  }, [percentage]);

  const isCharNearLimit = useMemo(() => {
    if (charPercentage === null) return false;
    return charPercentage >= warningThreshold && charPercentage < 100;
  }, [charPercentage, warningThreshold]);

  const isCharOverLimit = useMemo(() => {
    if (charPercentage === null) return false;
    return charPercentage > 100;
  }, [charPercentage]);

  return {
    wordCount,
    charCount,
    charCountNoSpaces,
    percentage,
    charPercentage,
    isNearLimit,
    isOverLimit,
    isCharNearLimit,
    isCharOverLimit,
    updateCount,
  };
}
```

### Step 9.4: Run test to verify it passes

Run: `npm test src/hooks/__tests__/useWordCount.test.ts`
Expected: PASS - All word count hook tests pass

### Step 9.5: Write failing test for WordCount component

Create `src/components/editor/__tests__/WordCount.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { WordCount, WordCountProps } from '../WordCount';

describe('WordCount', () => {
  const defaultProps: WordCountProps = {
    wordCount: 150,
    charCount: 850,
  };

  it('should display word count', () => {
    render(<WordCount {...defaultProps} />);
    expect(screen.getByText(/150 words/)).toBeInTheDocument();
  });

  it('should display character count', () => {
    render(<WordCount {...defaultProps} />);
    expect(screen.getByText(/850 characters/)).toBeInTheDocument();
  });

  it('should display singular "word" for count of 1', () => {
    render(<WordCount {...defaultProps} wordCount={1} />);
    expect(screen.getByText(/1 word/)).toBeInTheDocument();
  });

  it('should display singular "character" for count of 1', () => {
    render(<WordCount {...defaultProps} charCount={1} />);
    expect(screen.getByText(/1 character/)).toBeInTheDocument();
  });

  it('should show percentage when word limit provided', () => {
    render(<WordCount {...defaultProps} wordLimit={500} />);
    expect(screen.getByText(/150 \/ 500 words/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('should show warning color when near word limit', () => {
    render(
      <WordCount
        {...defaultProps}
        wordCount={450}
        wordLimit={500}
        isNearLimit={true}
      />
    );
    const wordText = screen.getByTestId('word-count');
    expect(wordText).toHaveClass('text-yellow-600');
  });

  it('should show error color when over word limit', () => {
    render(
      <WordCount
        {...defaultProps}
        wordCount={550}
        wordLimit={500}
        isOverLimit={true}
      />
    );
    const wordText = screen.getByTestId('word-count');
    expect(wordText).toHaveClass('text-red-600');
  });

  it('should show progress bar when limit provided', () => {
    render(<WordCount {...defaultProps} wordLimit={500} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should not show progress bar without limit', () => {
    render(<WordCount {...defaultProps} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should cap progress bar at 100% visually but show actual percentage', () => {
    render(
      <WordCount
        {...defaultProps}
        wordCount={600}
        wordLimit={500}
        isOverLimit={true}
      />
    );
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '120');
    // Visual width should be capped
    const progressFill = progressBar.querySelector('[data-testid="progress-fill"]');
    expect(progressFill).toHaveStyle({ width: '100%' });
  });

  it('should show character limit when provided', () => {
    render(<WordCount {...defaultProps} charLimit={1000} />);
    expect(screen.getByText(/850 \/ 1000 characters/)).toBeInTheDocument();
  });

  it('should be accessible with proper ARIA labels', () => {
    render(<WordCount {...defaultProps} wordLimit={500} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-label', 'Word count progress');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('should show condensed format when compact prop is true', () => {
    render(<WordCount {...defaultProps} compact />);
    expect(screen.getByText('150w')).toBeInTheDocument();
    expect(screen.getByText('850c')).toBeInTheDocument();
  });
});
```

### Step 9.6: Implement WordCount component

Create `src/components/editor/WordCount.tsx`:

```typescript
'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface WordCountProps {
  wordCount: number;
  charCount: number;
  wordLimit?: number;
  charLimit?: number;
  isNearLimit?: boolean;
  isOverLimit?: boolean;
  isCharNearLimit?: boolean;
  isCharOverLimit?: boolean;
  compact?: boolean;
  className?: string;
}

export function WordCount({
  wordCount,
  charCount,
  wordLimit,
  charLimit,
  isNearLimit = false,
  isOverLimit = false,
  isCharNearLimit = false,
  isCharOverLimit = false,
  compact = false,
  className,
}: WordCountProps) {
  const wordPercentage = useMemo(() => {
    if (!wordLimit) return null;
    return Math.round((wordCount / wordLimit) * 100);
  }, [wordCount, wordLimit]);

  const wordColorClass = useMemo(() => {
    if (isOverLimit) return 'text-red-600 dark:text-red-400';
    if (isNearLimit) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  }, [isOverLimit, isNearLimit]);

  const charColorClass = useMemo(() => {
    if (isCharOverLimit) return 'text-red-600 dark:text-red-400';
    if (isCharNearLimit) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-500';
  }, [isCharOverLimit, isCharNearLimit]);

  const progressColorClass = useMemo(() => {
    if (isOverLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  }, [isOverLimit, isNearLimit]);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        <span className={wordColorClass}>{wordCount}w</span>
        <span className={charColorClass}>{charCount}c</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between text-sm">
        <span data-testid="word-count" className={wordColorClass}>
          {wordLimit ? (
            <>
              {wordCount} / {wordLimit} {wordCount === 1 ? 'word' : 'words'}
              {wordPercentage !== null && (
                <span className="ml-2 text-xs">({wordPercentage}%)</span>
              )}
            </>
          ) : (
            `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`
          )}
        </span>
        <span data-testid="char-count" className={charColorClass}>
          {charLimit ? (
            `${charCount} / ${charLimit} ${charCount === 1 ? 'character' : 'characters'}`
          ) : (
            `${charCount} ${charCount === 1 ? 'character' : 'characters'}`
          )}
        </span>
      </div>

      {wordLimit && (
        <div
          role="progressbar"
          aria-label="Word count progress"
          aria-valuenow={wordPercentage ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        >
          <div
            data-testid="progress-fill"
            className={cn('h-full transition-all duration-300', progressColorClass)}
            style={{ width: `${Math.min(wordPercentage ?? 0, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

### Step 9.7: Run WordCount component tests

Run: `npm test src/components/editor/__tests__/WordCount.test.tsx`
Expected: PASS - All WordCount component tests pass

### Step 9.8: Integrate WordCount into Editor

Modify `src/components/editor/Editor.tsx` - Add word count display:

Add import at top:

```typescript
import { WordCount } from './WordCount';
import { useWordCount } from '@/hooks/useWordCount';
```

Add hook usage inside Editor component:

```typescript
// Add props for optional limits
interface EditorProps {
  initialContent?: string;
  onChange?: (html: string, json: object) => void;
  wordLimit?: number;
  charLimit?: number;
}

export function Editor({
  initialContent = '',
  onChange,
  wordLimit,
  charLimit,
}: EditorProps) {
  // ... existing code ...

  const {
    wordCount,
    charCount,
    isNearLimit,
    isOverLimit,
    isCharNearLimit,
    isCharOverLimit,
    updateCount,
  } = useWordCount({ wordLimit, charLimit });

  // Update count when editor changes
  const handleUpdate = useCallback(({ editor: updatedEditor }: { editor: TiptapEditor }) => {
    const html = updatedEditor.getHTML();
    const json = updatedEditor.getJSON();
    updateCount(html);
    onChange?.(html, json);
  }, [onChange, updateCount]);

  // ... existing editor setup with onUpdate: handleUpdate ...

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-auto p-4">
        <EditorContent editor={editor} />
      </div>
      <div className="border-t px-4 py-2 bg-gray-50 dark:bg-gray-900">
        <WordCount
          wordCount={wordCount}
          charCount={charCount}
          wordLimit={wordLimit}
          charLimit={charLimit}
          isNearLimit={isNearLimit}
          isOverLimit={isOverLimit}
          isCharNearLimit={isCharNearLimit}
          isCharOverLimit={isCharOverLimit}
        />
      </div>
    </div>
  );
}
```

### Step 9.9: Write integration test for Editor with WordCount

Add to `src/components/editor/__tests__/Editor.test.tsx`:

```typescript
describe('Editor with WordCount', () => {
  it('should display word count for content', async () => {
    render(<Editor initialContent="<p>Hello world test</p>" />);

    await waitFor(() => {
      expect(screen.getByText(/3 words/)).toBeInTheDocument();
    });
  });

  it('should update word count on typing', async () => {
    const { user } = render(<Editor initialContent="" />);

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.type(editor, 'one two three four five');

    await waitFor(() => {
      expect(screen.getByText(/5 words/)).toBeInTheDocument();
    });
  });

  it('should show limit progress when wordLimit provided', async () => {
    render(<Editor initialContent="<p>word word word</p>" wordLimit={10} />);

    await waitFor(() => {
      expect(screen.getByText(/3 \/ 10 words/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('should show warning when near word limit', async () => {
    render(<Editor initialContent="<p>{'word '.repeat(9)}</p>" wordLimit={10} />);

    await waitFor(() => {
      const wordCount = screen.getByTestId('word-count');
      expect(wordCount).toHaveClass('text-yellow-600');
    });
  });

  it('should show error when over word limit', async () => {
    render(<Editor initialContent="<p>{'word '.repeat(12)}</p>" wordLimit={10} />);

    await waitFor(() => {
      const wordCount = screen.getByTestId('word-count');
      expect(wordCount).toHaveClass('text-red-600');
    });
  });
});
```

### Step 9.10: Run all word count tests

Run: `npm test -- --testPathPattern="(useWordCount|WordCount|Editor)"`
Expected: PASS - All word count and editor tests pass

### Step 9.11: Commit

```bash
git add src/hooks/useWordCount.ts src/hooks/__tests__/useWordCount.test.ts src/components/editor/WordCount.tsx src/components/editor/__tests__/WordCount.test.tsx src/components/editor/Editor.tsx src/components/editor/__tests__/Editor.test.tsx
git commit -m "feat: add word/character count with limit warnings"
```

---

## Task 10: E2E Tests with Playwright

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/auth.setup.ts` (auth state setup)
- Create: `e2e/auth.spec.ts`
- Create: `e2e/projects.spec.ts`
- Create: `e2e/editor.spec.ts`
- Create: `.env.test.local` (test environment variables)

### Step 10.1: Install Playwright

Run: `npm init playwright@latest`
Expected: Playwright configured with test directory

### Step 10.2: Create test environment file

Create `.env.test.local`:

```bash
# E2E Test User (create this user in Supabase dashboard or via SQL)
E2E_TEST_EMAIL=e2e-test@example.com
E2E_TEST_PASSWORD=e2e-test-password-123

# Supabase test project (can be same as dev or separate)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key

# Enable test mode for bypassing email verification
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Note:** Add `.env.test.local` to `.gitignore` if not already present.

### Step 10.3: Create Playwright config with auth setup

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test.local') });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Setup project - runs first to create auth state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Browser tests depend on setup completing first
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Unauthenticated tests (auth.spec.ts)
    {
      name: 'chromium-unauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Step 10.4: Create auth setup file

Create `e2e/auth.setup.ts`:

```typescript
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Ensure .auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Option 1: Use Supabase Admin API to create session directly (faster)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const testEmail = process.env.E2E_TEST_EMAIL!;
  const testPassword = process.env.E2E_TEST_PASSWORD!;

  if (!supabaseUrl || !serviceRoleKey || !testEmail || !testPassword) {
    throw new Error(
      'Missing required environment variables for E2E auth setup. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ' +
        'E2E_TEST_EMAIL, and E2E_TEST_PASSWORD are set in .env.test.local'
    );
  }

  // Create admin client to manage test user
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure test user exists (create if not)
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  const testUser = existingUser?.users.find((u) => u.email === testEmail);

  if (!testUser) {
    // Create test user
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Skip email verification
    });

    if (createError) {
      throw new Error(`Failed to create test user: ${createError.message}`);
    }
    console.log('Created test user:', testEmail);
  }

  // Create session for test user
  const { data: signInData, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: testEmail,
  });

  if (signInError || !signInData) {
    throw new Error(`Failed to generate auth link: ${signInError?.message}`);
  }

  // Navigate to the magic link to establish session
  await page.goto(signInData.properties.action_link);

  // Wait for redirect to authenticated page
  await page.waitForURL('**/projects**', { timeout: 10000 });

  // Verify we're authenticated
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible({ timeout: 5000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });
  console.log('Auth state saved to:', authFile);
});

setup('create test project', async ({ page }) => {
  // Load authenticated state from previous setup
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authFile)) {
    throw new Error('Auth file not found. Run authentication setup first.');
  }

  // Navigate to projects and create a test project for editor tests
  await page.goto('/projects/new');
  await page.fill('input#title', 'E2E Test Project');
  await page.fill('textarea#description', 'Project created for E2E testing');
  await page.click('button[type="submit"]');

  // Wait for project creation and store project ID
  await page.waitForURL(/\/projects\/[a-f0-9-]+/);
  const projectUrl = page.url();
  const projectId = projectUrl.split('/').pop();

  // Store project ID for use in other tests
  const testDataFile = path.join(authDir, 'test-data.json');
  fs.writeFileSync(testDataFile, JSON.stringify({ projectId }, null, 2));
  console.log('Test project created:', projectId);
});
```

### Step 10.5: Add .gitignore entries

Add to `.gitignore`:

```
# Playwright
/e2e/.auth/
/playwright-report/
/blob-report/
/playwright/.cache/
.env.test.local
```

### Step 10.6: Create auth E2E tests (unauthenticated)

Create `e2e/auth.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Magic Link' })).toBeVisible();
  });

  test('should show success after email submission', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Check your email')).toBeVisible();
  });

  test('should redirect protected routes to login', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show rate limit message on too many attempts', async ({ page }) => {
    await page.goto('/login');

    // Simulate multiple rapid attempts
    for (let i = 0; i < 6; i++) {
      await page.fill('input[type="email"]', `test${i}@example.com`);
      await page.click('button[type="submit"]');
      // Reset form for next attempt
      if (i < 5) {
        await page.goto('/login');
      }
    }

    // Should show rate limit warning
    await expect(page.getByText(/too many attempts/i)).toBeVisible();
  });
});
```

### Step 10.7: Create projects E2E tests

Create `e2e/projects.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// Note: storageState is configured at project level in playwright.config.ts
// Tests in this file automatically use authenticated state

test.describe('Projects', () => {
  test('should list projects', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test('should create new project', async ({ page }) => {
    await page.goto('/projects/new');

    // Fill project form
    await page.fill('input#title', 'New E2E Project');
    await page.fill('textarea#description', 'Created during E2E test');
    await page.click('button[type="submit"]');

    // Should redirect to project detail page
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);

    // Should show project title
    await expect(page.getByRole('heading', { name: 'New E2E Project' })).toBeVisible();
  });

  test('should edit project', async ({ page }) => {
    // Navigate to projects list
    await page.goto('/projects');

    // Click on first project
    await page.locator('[data-testid="project-card"]').first().click();

    // Click edit button
    await page.click('button[aria-label="Edit project"]');

    // Update title
    await page.fill('input#title', 'Updated Project Title');
    await page.click('button[type="submit"]');

    // Verify update
    await expect(page.getByRole('heading', { name: 'Updated Project Title' })).toBeVisible();
  });

  test('should delete project', async ({ page }) => {
    // First create a project to delete
    await page.goto('/projects/new');
    await page.fill('input#title', 'Project To Delete');
    await page.click('button[type="submit"]');

    // Wait for project page
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);

    // Click delete button
    await page.click('button[aria-label="Delete project"]');

    // Confirm deletion in modal
    await page.click('button:has-text("Delete")');

    // Should redirect to projects list
    await expect(page).toHaveURL('/projects');

    // Deleted project should not appear
    await expect(page.getByText('Project To Delete')).not.toBeVisible();
  });

  test('should show empty state when no projects', async ({ page }) => {
    // This test assumes we can set up an empty state
    // In practice, would need test isolation or cleanup
    await page.goto('/projects');

    // Check for empty state or project list
    const projectList = page.locator('[data-testid="project-list"]');
    const emptyState = page.locator('[data-testid="empty-state"]');

    // One of these should be visible
    await expect(projectList.or(emptyState)).toBeVisible();
  });
});
```

### Step 10.8: Create editor E2E tests

Create `e2e/editor.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Helper to get test data from setup
function getTestData(): { projectId: string } {
  const testDataPath = path.join(__dirname, '.auth/test-data.json');
  if (!fs.existsSync(testDataPath)) {
    throw new Error('Test data not found. Ensure auth.setup.ts ran successfully.');
  }
  return JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
}

test.describe('Document Editor', () => {
  let projectId: string;

  test.beforeAll(() => {
    const testData = getTestData();
    projectId = testData.projectId;
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to project and create/open a document
    await page.goto(`/projects/${projectId}`);

    // Create new document or open existing
    const newDocButton = page.getByRole('button', { name: 'New Document' });
    if (await newDocButton.isVisible()) {
      await newDocButton.click();
      await page.fill('input#title', 'Test Document');
      await page.click('button[type="submit"]');
    }

    // Wait for editor to load
    await page.waitForSelector('[data-testid="editor"]', { timeout: 10000 });
  });

  test('should render editor with toolbar', async ({ page }) => {
    await expect(page.getByRole('toolbar')).toBeVisible();
    await expect(page.locator('.ProseMirror')).toBeVisible();
  });

  test('should apply bold formatting', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Bold text');
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: /bold/i }).click();

    await expect(page.locator('.ProseMirror strong')).toContainText('Bold text');
  });

  test('should apply italic formatting', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Italic text');
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: /italic/i }).click();

    await expect(page.locator('.ProseMirror em')).toContainText('Italic text');
  });

  test('should create bullet list', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.getByRole('button', { name: /bullet list/i }).click();
    await page.keyboard.type('First item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');

    await expect(page.locator('.ProseMirror ul li')).toHaveCount(2);
  });

  test('should show word count', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('one two three four five');

    await expect(page.getByText(/5 words/)).toBeVisible();
  });

  test('should show character count', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Hello');

    // "Hello" = 5 characters
    await expect(page.getByText(/5 characters/)).toBeVisible();
  });

  test('should autosave after typing', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Autosave test content');

    // Should show unsaved indicator first
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Wait for autosave (debounce is 1000ms)
    await page.waitForTimeout(1500);

    // Should show saved indicator
    await expect(page.getByText(/Saved/)).toBeVisible();
  });

  test('should save immediately on Save Now button', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Manual save test');

    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Click save now button
    await page.getByRole('button', { name: 'Save Now' }).click();

    // Should show saved immediately
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 2000 });
  });

  test('should persist content after page reload', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Persistent content test');

    // Wait for autosave
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Saved/)).toBeVisible();

    // Reload page
    await page.reload();

    // Wait for editor to load
    await page.waitForSelector('[data-testid="editor"]');

    // Content should persist
    await expect(page.locator('.ProseMirror')).toContainText('Persistent content test');
  });

  test('should undo/redo changes', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Original text');

    // Select all and delete
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');

    // Editor should be empty
    await expect(editor).not.toContainText('Original text');

    // Undo
    await page.keyboard.press('Control+z');

    // Content should be restored
    await expect(editor).toContainText('Original text');

    // Redo
    await page.keyboard.press('Control+Shift+z');

    // Content should be deleted again
    await expect(editor).not.toContainText('Original text');
  });

  test('should support keyboard shortcuts for formatting', async ({ page }) => {
    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type and bold with Ctrl+B
    await page.keyboard.type('Bold');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    await expect(page.locator('.ProseMirror strong')).toContainText('Bold');

    // Clear and type with italic Ctrl+I
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Italic');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+i');
    await expect(page.locator('.ProseMirror em')).toContainText('Italic');
  });
});
```

### Step 10.9: Install required dependencies

Run:

```bash
npm install -D @playwright/test dotenv
npx playwright install
```

Expected: Playwright browsers installed

### Step 10.10: Run E2E tests

Run: `npx playwright test`
Expected: All E2E tests pass

### Step 10.11: Commit

```bash
git add playwright.config.ts e2e .gitignore .env.test.local.example
git commit -m "test: add Playwright E2E tests for auth, projects, and editor"
```

**Note:** Create `.env.test.local.example` with placeholder values for documentation:

```bash
# Copy this to .env.test.local and fill in values
E2E_TEST_EMAIL=your-test-email@example.com
E2E_TEST_PASSWORD=your-test-password
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Phase 1 Completion Checklist

**Verification Commands:**

```bash
npm test                    # All unit tests pass
npx playwright test         # All E2E tests pass
npm run lint               # Lint passes
npm run build              # Build succeeds
npm run dev                # Dev server starts
npx supabase status        # Supabase running
```

**Functional Verification:**

- [ ] Can send magic link and sign in
- [ ] Protected routes redirect to login
- [ ] Can create/read/update/delete projects
- [ ] Can create/read/update/delete documents
- [ ] Editor renders with toolbar
- [ ] Formatting buttons work
- [ ] Autosave triggers after 1 second
- [ ] Save status shows unsaved/saving/saved/error
- [ ] Word/character count updates in real-time
- [ ] Manual save works with Cmd+S
- [ ] E2E tests pass in CI

---

## Dependencies & Task Order

```
Task 0: Supabase Setup (FIRST - creates schema, clients)
  ↓
Task 1: Testing Infrastructure
  ↓
Task 2: TipTap Editor
  ↓
Task 3: Editor Toolbar
  ↓
Task 4: Auth (magic link, rate limiting)
  ↓
Task 5: Auth Middleware
  ↓
Task 6: Projects CRUD ─────────────────┐
  ↓                                    │
Task 7: Documents CRUD ←───────────────┘
  ↓
Task 8: Autosave Hook
  ↓
Task 9: Word/Character Count
  ↓
Task 10: E2E Tests (Final validation)
```

**Critical Dependencies:**

- Task 0 MUST complete first (provides database schema and Supabase clients)
- Task 1 before Tasks 2-9 (provides test utilities)
- Task 2 before Task 3 (toolbar needs editor)
- Tasks 4-5 before Tasks 6-7 (auth required for API)
- Task 7 before Task 8 (autosave needs document API)
- Task 8 before Task 9 (word count integrated with DocumentEditor)
- Task 10 after all others (validates complete flow)
