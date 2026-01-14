# Phase 1: Core Editor & Document Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core TipTap editor with autosave, Supabase auth with magic links, and CRUD for projects/documents.

**Architecture:** Next.js App Router with server components for data fetching, client components for interactive UI. Supabase handles auth and Postgres storage. TipTap provides rich text editing with grant-specific extensions.

**Tech Stack:** Next.js 14+, TipTap, Supabase (auth + Postgres), Zod validation, Vitest + React Testing Library, Playwright E2E

---

## Pre-requisites

Before starting, ensure:

- Node.js 18+ installed
- Supabase CLI installed (`npx supabase --version`)
- Project initialized with `npx create-next-app@latest`
- Supabase project linked (`npx supabase link`)

---

## Task 0: Testing Infrastructure

**Files:**

- Create: `src/lib/testing/test-setup.ts`
- Create: `src/lib/testing/supabase-mock.ts`
- Create: `src/lib/testing/tiptap-mock.ts`
- Create: `src/lib/testing/fixtures.ts`
- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/errors.ts`

### Step 0.1: Create API types

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

### Step 0.2: Create API error classes

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

### Step 0.3: Create test setup utilities

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

### Step 0.4: Create Supabase mock

Create `src/lib/testing/supabase-mock.ts`:

```typescript
import { vi } from 'vitest';

export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token' } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'id123' }, error: null }),
    }),
  };
}
```

### Step 0.5: Create TipTap mock

Create `src/lib/testing/tiptap-mock.ts`:

```typescript
import { vi } from 'vitest';

export function createMockEditor() {
  return {
    chain: vi.fn().mockReturnThis(),
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
    isActive: vi.fn().mockReturnValue(false),
    getHTML: vi.fn().mockReturnValue('<p>Content</p>'),
    getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    state: { doc: { content: { content: [] } } },
    storage: { characterCount: { words: () => 0, characters: () => 0 } },
  };
}
```

### Step 0.6: Create test fixtures

Create `src/lib/testing/fixtures.ts`:

```typescript
export const fixtureUser = {
  id: 'user-fixture-123',
  email: 'fixture@example.com',
  name: 'Test User',
  created_at: new Date().toISOString(),
};

export const fixtureProject = {
  id: 'project-fixture-123',
  user_id: fixtureUser.id,
  title: 'Test Project',
  status: 'draft' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const fixtureDocument = {
  id: 'doc-fixture-123',
  project_id: fixtureProject.id,
  title: 'Test Document',
  content: { type: 'doc', content: [] },
  content_text: 'Test content',
  sort_order: 0,
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

### Step 0.7: Install zod

Run: `npm install zod`
Expected: Package added to package.json

### Step 0.8: Commit

```bash
git add src/lib/testing src/lib/api
git commit -m "chore: add testing infrastructure and API utilities"
```

---

## Task 1: TipTap Editor Setup

**Files:**

- Create: `src/components/editor/extensions/index.ts`
- Create: `src/components/editor/__tests__/Editor.test.tsx`
- Create: `src/components/editor/Editor.tsx`

### Step 1.1: Install TipTap dependencies

Run:

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-text-align @tiptap/extension-image @tiptap/extension-highlight
```

Expected: Packages added to package.json

### Step 1.2: Write the failing test for Editor rendering

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

### Step 1.3: Run test to verify it fails

Run: `npm test src/components/editor/__tests__/Editor.test.tsx`
Expected: FAIL - module '../Editor' not found

### Step 1.4: Create extensions configuration

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

### Step 1.5: Implement Editor component

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
```

### Step 1.6: Run test to verify it passes

Run: `npm test src/components/editor/__tests__/Editor.test.tsx`
Expected: PASS

### Step 1.7: Commit

```bash
git add src/components/editor
git commit -m "feat: add TipTap editor with grant writing extensions"
```

---

## Task 2: Editor Toolbar

**Files:**

- Create: `src/components/editor/__tests__/Toolbar.test.tsx`
- Create: `src/components/editor/Toolbar.tsx`
- Modify: `src/components/editor/Editor.tsx`

### Step 2.1: Install icons

Run: `npm install lucide-react`
Expected: Package added to package.json

### Step 2.2: Write the failing test for Toolbar

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
      expect(mockEditor.toggleBold).toHaveBeenCalled();
      expect(mockEditor.run).toHaveBeenCalled();
    });

    it('should execute heading command with level', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as any} />);

      await user.click(screen.getByLabelText('Heading 1'));

      expect(mockEditor.toggleHeading).toHaveBeenCalled();
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
    it('should have proper ARIA labels', () => {
      render(<Toolbar editor={mockEditor as any} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });
});
```

### Step 2.3: Run test to verify it fails

Run: `npm test src/components/editor/__tests__/Toolbar.test.tsx`
Expected: FAIL - module '../Toolbar' not found

### Step 2.4: Implement Toolbar component

Create `src/components/editor/Toolbar.tsx`:

```typescript
'use client';

import { Editor } from '@tiptap/react';
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

### Step 2.5: Run test to verify it passes

Run: `npm test src/components/editor/__tests__/Toolbar.test.tsx`
Expected: PASS

### Step 2.6: Update Editor to include Toolbar

Modify `src/components/editor/Editor.tsx` - add import and prop:

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
```

### Step 2.7: Run all editor tests

Run: `npm test src/components/editor`
Expected: PASS

### Step 2.8: Commit

```bash
git add src/components/editor
git commit -m "feat: add editor toolbar with formatting, alignment, and history"
```

---

## Task 3: Supabase Auth with Magic Link

**Files:**

- Create: `supabase/migrations/20260113000001_auth_rate_limiting.sql`
- Create: `src/lib/auth/rate-limit.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`

### Step 3.1: Create rate limiting migration

Create `supabase/migrations/20260113000001_auth_rate_limiting.sql`:

```sql
-- Rate limiting table for auth attempts
CREATE TABLE public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now() NOT NULL,
  success boolean DEFAULT false
);

-- Index for efficient lookups
CREATE INDEX idx_auth_attempts_email_created ON public.auth_attempts(email, created_at);
CREATE INDEX idx_auth_attempts_ip_created ON public.auth_attempts(ip_address, created_at);

-- Function to check rate limit
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
$$ LANGUAGE plpgsql;
```

### Step 3.2: Apply migration

Run: `npx supabase db reset`
Expected: Database reset with new migration applied

### Step 3.3: Create rate limiting helper

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
    return { allowed: true };
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

### Step 3.4: Create auth callback route

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

### Step 3.5: Create LoginForm component

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

### Step 3.6: Create login page

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

### Step 3.7: Create middleware

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

### Step 3.8: Commit

```bash
git add supabase/migrations src/lib/auth src/app/auth src/app/login src/components/auth src/middleware.ts
git commit -m "feat: add Supabase auth with magic link and rate limiting"
```

---

## Task 4: Projects CRUD

**Files:**

- Create: `src/lib/api/schemas/project.ts`
- Create: `src/lib/api/projects.ts`
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`
- Create: `src/components/projects/ProjectCard.tsx`
- Create: `src/components/projects/ProjectList.tsx`
- Create: `src/components/projects/NewProjectForm.tsx`
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/new/page.tsx`

### Step 4.1: Create validation schemas

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
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
```

### Step 4.2: Create projects API helpers

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

### Step 4.3: Create API routes

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
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);

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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const parsed = UpdateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const project = await updateProject(params.id, parsed.data);
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteProject(params.id);
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

### Step 4.4: Create ProjectCard component

Create `src/components/projects/ProjectCard.tsx`:

```typescript
import Link from 'next/link';
import type { Database } from '@/lib/supabase/database.types';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectCardProps {
  project: Project;
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  funded: 'bg-green-100 text-green-700',
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
        <span
          className={`px-2 py-1 text-xs rounded-full ${statusColors[project.status as keyof typeof statusColors]}`}
        >
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

### Step 4.5: Create ProjectList component

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

  if (loading) {
    return <div className="text-center py-8">Loading projects...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">{error}</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No projects yet. Create your first project to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

### Step 4.6: Create NewProjectForm component

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
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Project Title
        </label>
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

### Step 4.7: Create projects page

Create `src/app/projects/page.tsx`:

```typescript
import Link from 'next/link';
import { ProjectList } from '@/components/projects/ProjectList';

export default function ProjectsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Link
          href="/projects/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Project
        </Link>
      </div>
      <ProjectList />
    </div>
  );
}
```

### Step 4.8: Create new project page

Create `src/app/projects/new/page.tsx`:

```typescript
import Link from 'next/link';
import { NewProjectForm } from '@/components/projects/NewProjectForm';

export default function NewProjectPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/projects" className="text-blue-600 hover:underline mb-4 block">
        ← Back to Projects
      </Link>
      <h1 className="text-3xl font-bold mb-8">Create New Project</h1>
      <NewProjectForm />
    </div>
  );
}
```

### Step 4.9: Commit

```bash
git add src/lib/api/schemas src/lib/api/projects.ts src/app/api/projects src/components/projects src/app/projects
git commit -m "feat: add projects CRUD with validation and pagination"
```

---

## Task 5: Documents CRUD

**Files:**

- Create: `src/lib/api/schemas/document.ts`
- Create: `src/lib/api/documents.ts`
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`

### Step 5.1: Create document validation schemas

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
  expectedVersion: z.number().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
```

### Step 5.2: Create documents API helpers

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
  updateData.version = input.expectedVersion ? input.expectedVersion + 1 : undefined;

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

### Step 5.3: Create documents API routes

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
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const document = await getDocument(params.id);

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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const parsed = UpdateDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const document = await updateDocument(params.id, parsed.data);
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteDocument(params.id);
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

### Step 5.4: Commit

```bash
git add src/lib/api/schemas/document.ts src/lib/api/documents.ts src/app/api/documents
git commit -m "feat: add documents CRUD with version conflict detection"
```

---

## Task 6: Document Autosave

**Files:**

- Create: `src/hooks/useAutosave.ts`
- Create: `src/components/editor/SaveStatus.tsx`
- Create: `src/components/editor/DocumentEditor.tsx`

### Step 6.1: Create autosave hook

Create `src/hooks/useAutosave.ts`:

```typescript
'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

export type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  debounceMs?: number;
  onSave: (content: string) => Promise<void>;
  onError?: (error: Error) => void;
  maxRetries?: number;
}

export function useAutosave(options: UseAutosaveOptions) {
  const { debounceMs = 1000, onSave, onError, maxRetries = 3 } = options;

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastError, setLastError] = useState<Error | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const pendingContentRef = useRef<string | null>(null);

  const clearSaveTimeout = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
  }, []);

  const performSave = useCallback(
    async (content: string) => {
      setSaveState('saving');
      setLastError(null);

      try {
        await onSave(content);
        setSaveState('saved');
        retryCountRef.current = 0;
        pendingContentRef.current = null;

        setTimeout(() => setSaveState('idle'), 2000);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Save failed');
        setLastError(err);
        setSaveState('error');
        onError?.(err);

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const backoffMs = Math.pow(2, retryCountRef.current) * 1000;
          setTimeout(() => {
            if (pendingContentRef.current) {
              performSave(pendingContentRef.current);
            }
          }, backoffMs);
        }
      }
    },
    [onSave, onError, maxRetries]
  );

  const triggerSave = useCallback(
    (content: string) => {
      pendingContentRef.current = content;
      setSaveState('unsaved');
      clearSaveTimeout();

      saveTimeoutRef.current = setTimeout(() => {
        performSave(content);
      }, debounceMs);
    },
    [debounceMs, performSave, clearSaveTimeout]
  );

  const saveNow = useCallback(() => {
    if (pendingContentRef.current) {
      clearSaveTimeout();
      performSave(pendingContentRef.current);
    }
  }, [clearSaveTimeout, performSave]);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    if (pendingContentRef.current) {
      performSave(pendingContentRef.current);
    }
  }, [performSave]);

  useEffect(() => {
    return () => clearSaveTimeout();
  }, [clearSaveTimeout]);

  useEffect(() => {
    const handleBlur = () => {
      if (pendingContentRef.current && saveState === 'unsaved') {
        clearSaveTimeout();
        performSave(pendingContentRef.current);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [saveState, clearSaveTimeout, performSave]);

  return {
    saveState,
    lastError,
    triggerSave,
    saveNow,
    retry,
  };
}
```

### Step 6.2: Create SaveStatus component

Create `src/components/editor/SaveStatus.tsx`:

```typescript
'use client';

import { SaveState } from '@/hooks/useAutosave';
import { Check, AlertCircle, Loader2, Circle } from 'lucide-react';

interface SaveStatusProps {
  state: SaveState;
  error?: Error | null;
  onRetry?: () => void;
}

export function SaveStatus({ state, error, onRetry }: SaveStatusProps) {
  const statusConfig = {
    idle: { icon: null, text: '', className: '' },
    unsaved: {
      icon: Circle,
      text: 'Unsaved changes',
      className: 'text-orange-500',
    },
    saving: {
      icon: Loader2,
      text: 'Saving...',
      className: 'text-blue-500',
    },
    saved: {
      icon: Check,
      text: 'Saved',
      className: 'text-green-500',
    },
    error: {
      icon: AlertCircle,
      text: error?.message || 'Save failed',
      className: 'text-red-500',
    },
  };

  const config = statusConfig[state];
  if (!config.icon) return null;

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`w-4 h-4 ${config.className} ${state === 'saving' ? 'animate-spin' : ''}`} />
      <span className={config.className}>{config.text}</span>
      {state === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="text-blue-600 hover:underline ml-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

### Step 6.3: Create DocumentEditor component

Create `src/components/editor/DocumentEditor.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Editor } from './Editor';
import { SaveStatus } from './SaveStatus';
import { useAutosave } from '@/hooks/useAutosave';

interface DocumentEditorProps {
  documentId: string;
  initialContent?: string;
  initialVersion?: number;
  onSave: (content: string, version: number) => Promise<{ version: number }>;
}

export function DocumentEditor({
  documentId,
  initialContent = '',
  initialVersion = 1,
  onSave,
}: DocumentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);

  const handleSave = useCallback(async (htmlContent: string) => {
    const result = await onSave(htmlContent, version);
    setVersion(result.version);
  }, [onSave, version]);

  const { saveState, lastError, triggerSave, saveNow, retry } = useAutosave({
    onSave: handleSave,
    debounceMs: 1000,
    maxRetries: 3,
  });

  const handleChange = useCallback((html: string) => {
    setContent(html);
    triggerSave(html);
  }, [triggerSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveNow]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b bg-white">
        <SaveStatus state={saveState} error={lastError} onRetry={retry} />
        <span className="text-sm text-gray-500">v{version}</span>
      </div>
      <div className="flex-1 overflow-auto">
        <Editor
          content={content}
          onChange={handleChange}
          showToolbar
        />
      </div>
    </div>
  );
}
```

### Step 6.4: Commit

```bash
git add src/hooks/useAutosave.ts src/components/editor/SaveStatus.tsx src/components/editor/DocumentEditor.tsx
git commit -m "feat: add document autosave with debouncing, retry, and status"
```

---

## Task 7: Word/Character Count

**Files:**

- Create: `src/components/editor/WordCount.tsx`
- Modify: `src/components/editor/Editor.tsx`

### Step 7.1: Create WordCount component

Create `src/components/editor/WordCount.tsx`:

```typescript
'use client';

import { Editor } from '@tiptap/react';

interface WordCountProps {
  editor: Editor | null;
  wordLimit?: number;
  characterLimit?: number;
  warningThreshold?: number;
}

export function WordCount({
  editor,
  wordLimit,
  characterLimit,
  warningThreshold = 0.9,
}: WordCountProps) {
  if (!editor) return null;

  const words = editor.storage.characterCount.words();
  const characters = editor.storage.characterCount.characters();
  const paragraphs = editor.state.doc.content.content.filter(
    (node) => node.type.name === 'paragraph' && node.content.size > 0
  ).length;
  const readingTime = Math.ceil(words / 200);

  const wordPercentage = wordLimit ? words / wordLimit : 0;
  const charPercentage = characterLimit ? characters / characterLimit : 0;

  const isWordWarning = wordPercentage >= warningThreshold;
  const isCharWarning = charPercentage >= warningThreshold;
  const isWordOver = wordPercentage > 1;
  const isCharOver = charPercentage > 1;

  const getColor = (isWarning: boolean, isOver: boolean) => {
    if (isOver) return 'text-red-600';
    if (isWarning) return 'text-orange-500';
    return 'text-gray-500';
  };

  return (
    <div className="flex items-center gap-4 text-sm px-4 py-2 border-t bg-gray-50">
      <span className={getColor(isWordWarning, isWordOver)}>
        {words}{wordLimit ? ` / ${wordLimit}` : ''} words
      </span>
      <span className={getColor(isCharWarning, isCharOver)}>
        {characters}{characterLimit ? ` / ${characterLimit}` : ''} characters
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">{paragraphs} paragraphs</span>
      <span className="text-gray-500">~{readingTime} min read</span>
    </div>
  );
}
```

### Step 7.2: Update Editor to export editor instance

Modify `src/components/editor/Editor.tsx` to add `onEditorReady` callback:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import { createExtensions } from './extensions';
import { Toolbar } from './Toolbar';
import { WordCount } from './WordCount';
import type { Editor as TiptapEditor } from '@tiptap/react';

export interface EditorProps {
  content?: string;
  placeholder?: string;
  characterLimit?: number;
  wordLimit?: number;
  onChange?: (html: string, json: object) => void;
  onEditorReady?: (editor: TiptapEditor) => void;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
  showWordCount?: boolean;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  wordLimit,
  onChange,
  onEditorReady,
  editable = true,
  className = '',
  showToolbar = true,
  showWordCount = true,
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

  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {showToolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {showWordCount && (
        <WordCount
          editor={editor}
          wordLimit={wordLimit}
          characterLimit={characterLimit}
        />
      )}
    </div>
  );
}

export { useEditor };
```

### Step 7.3: Commit

```bash
git add src/components/editor/WordCount.tsx src/components/editor/Editor.tsx
git commit -m "feat: add word and character count with limits and warnings"
```

---

## Phase 1 Completion Checklist

**Verification Commands:**

```bash
npm test                    # All unit tests pass
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
- [ ] Formatting buttons work (bold, italic, headings, lists, alignment)
- [ ] Autosave triggers after 1 second of inactivity
- [ ] Save status indicator shows unsaved/saving/saved/error states
- [ ] Word/character count updates in real-time
- [ ] Manual save works with Cmd+S
- [ ] Save errors show retry button

---

## Dependencies & Task Order

```
Task 0: Testing Infrastructure (FIRST)
  ↓
Task 1: TipTap Editor
  ↓
Task 2: Editor Toolbar
  ↓
Task 3: Supabase Auth ─────────────────┐
  ↓                                    │
Task 4: Projects CRUD ←────────────────┘
  ↓
Task 5: Documents CRUD
  ↓
Task 6: Document Autosave
  ↓
Task 7: Word/Character Count
```

**Critical Dependencies:**

- Task 0 must complete before any feature work (provides test utilities)
- Task 1 must complete before Task 2 (toolbar needs editor)
- Task 3 must complete before Tasks 4/5 (auth middleware required)
- Task 5 must complete before Task 6 (autosave needs document API)
- Task 6 must complete before Task 7 (word count integrated with DocumentEditor)
