# Phase 1: Core Editor & Document Management - Detailed Implementation Plan

> **Generated from:** Agent reviews of the Quill MVP Implementation Plan
> **Date:** 2026-01-13
> **Scope:** Tasks 1.1-1.7 with enhanced detail from technical and testing reviews

---

## Executive Summary

This detailed plan expands Phase 1 of the Quill MVP to address critical gaps identified in technical and testing reviews:

**Technical Gaps Addressed:**

- Missing TipTap extensions for grant writing (tables, links, images, text-align)
- Security hardening for auth (CSRF protection, rate limiting, input validation)
- API patterns (error handling, pagination, zod validation)
- Autosave resilience (offline handling, conflict resolution, retry logic)
- Audit logging and soft deletes

**Testing Gaps Addressed:**

- Comprehensive unit tests for Editor and Toolbar components
- Auth middleware and flow tests
- Integration tests for Projects/Documents CRUD
- Autosave edge case coverage
- Full E2E Playwright test scenarios

---

## Pre-Phase 1: Testing Infrastructure Setup

Before implementing Phase 1 features, establish testing utilities.

### Task P1.0: Create Testing Infrastructure

**Files:**

- Create: `src/lib/testing/test-setup.ts`
- Create: `src/lib/testing/supabase-mock.ts`
- Create: `src/lib/testing/tiptap-mock.ts`
- Create: `src/lib/testing/fixtures.ts`
- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/errors.ts`

**Step 1: Create global test setup**

Create `src/lib/testing/test-setup.ts`:

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

export function setupTests() {
  // Mock window.matchMedia for responsive tests
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

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;
}
```

**Step 2: Create Supabase mock utilities**

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
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'new_token' } },
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
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob() }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  };
}
```

**Step 3: Create TipTap editor mock**

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
    run: vi.fn().mockReturnValue(true),
    isActive: vi.fn().mockReturnValue(false),
    getHTML: vi.fn().mockReturnValue('<p>Content</p>'),
    getText: vi.fn().mockReturnValue('Content'),
    getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    storage: { characterCount: { words: () => 0, characters: () => 0 } },
  };
}
```

**Step 4: Create test fixtures**

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

**Step 5: Create API types and error handling**

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

**Step 6: Install zod for validation**

```bash
npm install zod
```

**Step 7: Commit**

```bash
git add .
git commit -m "chore: add testing infrastructure and API utilities"
```

---

## Task 1.1: Set Up TipTap Editor Package (Enhanced)

**Files:**

- Modify: `package.json`
- Create: `src/components/editor/Editor.tsx`
- Create: `src/components/editor/extensions/index.ts`
- Create: `src/components/editor/__tests__/Editor.test.tsx`

**Step 1: Install TipTap dependencies (expanded)**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-text-align @tiptap/extension-image @tiptap/extension-blockquote @tiptap/extension-highlight
```

**Step 2: Create extensions configuration**

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

**Step 3: Write comprehensive Editor tests (TDD)**

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

    it('should handle unicode characters', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Editor onChange={onChange} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('中文 émoji 🎓');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.stringContaining('中文')
        );
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

  describe('Content Sanitization', () => {
    it('should sanitize XSS attempts in content', () => {
      const xssContent = '<img src=x onerror="alert(\'xss\')" />';
      render(<Editor content={xssContent} />);

      // TipTap sanitizes by default - verify no script execution
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = '<p>Unclosed<div>Nested</p></div>';
      render(<Editor content={malformedHtml} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
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

**Step 4: Run tests (expect failure)**

```bash
npm test src/components/editor/__tests__/Editor.test.tsx
```

Expected: FAIL - module not found

**Step 5: Implement Editor component**

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
  onUpdate?: (editor: ReturnType<typeof useEditor>) => void;
  editable?: boolean;
  className?: string;
}

export function Editor({
  content = '',
  placeholder = 'Start writing your grant proposal...',
  characterLimit,
  onChange,
  onUpdate,
  editable = true,
  className = '',
}: EditorProps) {
  const editor = useEditor({
    extensions: createExtensions({ placeholder, characterLimit }),
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML(), editor.getJSON());
      onUpdate?.(editor);
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

**Step 6: Run tests**

```bash
npm test src/components/editor/__tests__/Editor.test.tsx
```

Expected: PASS

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add TipTap editor with grant writing extensions"
```

---

## Task 1.2: Add Editor Toolbar (Enhanced)

**Files:**

- Create: `src/components/editor/Toolbar.tsx`
- Create: `src/components/editor/__tests__/Toolbar.test.tsx`
- Modify: `src/components/editor/Editor.tsx`

**Step 1: Install icons**

```bash
npm install lucide-react
```

**Step 2: Write Toolbar tests (TDD)**

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

      expect(mockEditor.toggleHeading).toHaveBeenCalledWith({ level: 1 });
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

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      render(<Toolbar editor={mockEditor as any} />);

      const boldButton = screen.getByLabelText('Bold');
      boldButton.focus();
      await user.keyboard('{Enter}');

      expect(mockEditor.toggleBold).toHaveBeenCalled();
    });
  });
});
```

**Step 3: Implement Toolbar component**

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
  Link,
  Table,
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
  group?: string;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const buttons: ToolbarButton[] = [
    // Text formatting
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
    // Headings
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
    // Lists
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
    // Alignment
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

**Step 4: Update Editor to include Toolbar**

Update `src/components/editor/Editor.tsx` to add toolbar prop and render:

```typescript
// Add to imports
import { Toolbar } from './Toolbar';

// Add to props interface
showToolbar?: boolean;

// Add to component body before EditorContent
{showToolbar !== false && <Toolbar editor={editor} />}
```

**Step 5: Run tests**

```bash
npm test src/components/editor
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add editor toolbar with formatting, alignment, and history"
```

---

## Task 1.3: Set Up Supabase Auth with Magic Link (Enhanced)

**Files:**

- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/middleware.ts`
- Create: `src/lib/auth/rate-limit.ts`
- Create: `supabase/migrations/*_auth_attempts.sql`
- Create: `src/lib/auth/__tests__/auth.test.ts`
- Create: `src/middleware.test.ts`

**Step 1: Create rate limiting migration**

```bash
npx supabase migration new auth_rate_limiting
```

Edit migration file:

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

-- Cleanup old attempts (run via cron or scheduled function)
CREATE OR REPLACE FUNCTION cleanup_old_auth_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_attempts WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

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

**Step 2: Apply migration**

```bash
npx supabase db reset
```

**Step 3: Write auth tests**

Create `src/lib/auth/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Auth Rate Limiting', () => {
  it('should allow first attempt', async () => {
    const result = await checkRateLimit('test@example.com', '127.0.0.1');
    expect(result.allowed).toBe(true);
  });

  it('should block after max attempts', async () => {
    // Simulate 5 attempts
    for (let i = 0; i < 5; i++) {
      await recordAuthAttempt('spam@example.com', '127.0.0.1', false);
    }

    const result = await checkRateLimit('spam@example.com', '127.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});

describe('Auth Callback', () => {
  it('should exchange valid code for session', async () => {
    // Test implementation
  });

  it('should reject expired code', async () => {
    // Test implementation
  });

  it('should validate redirect URL', async () => {
    // Prevent open redirect attacks
  });
});
```

**Step 4: Create rate limiting helper**

Create `src/lib/auth/rate-limit.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds
  remaining?: number;
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
    retryAfter: data === true ? undefined : 3600, // 1 hour
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

**Step 5: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_REDIRECTS = ['/', '/projects', '/editor'];

function isValidRedirect(url: string): boolean {
  // Prevent open redirect attacks
  if (url.startsWith('/') && !url.startsWith('//')) {
    return ALLOWED_REDIRECTS.some((allowed) => url === allowed || url.startsWith(allowed + '/'));
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  // Validate redirect URL
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

**Step 6: Create LoginForm component**

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
      // Check rate limit first via API
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

**Step 7: Create login page**

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

**Step 8: Create middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/projects', '/editor', '/vault'];
const PUBLIC_ROUTES = ['/', '/login', '/auth/callback'];

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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
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

  // Check if route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from login to projects
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

**Step 9: Write middleware tests**

Create `src/middleware.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Auth Middleware', () => {
  describe('Protected Routes', () => {
    it('should redirect unauthenticated user from /projects to /login', async () => {
      // Test implementation
    });

    it('should allow authenticated user to access /projects', async () => {
      // Test implementation
    });

    it('should protect nested routes like /projects/123', async () => {
      // Test implementation
    });
  });

  describe('Public Routes', () => {
    it('should allow access to / without auth', async () => {
      // Test implementation
    });

    it('should redirect authenticated user from /login to /projects', async () => {
      // Test implementation
    });
  });

  describe('Auth Callback', () => {
    it('should allow access to /auth/callback', async () => {
      // Test implementation
    });
  });
});
```

**Step 10: Commit**

```bash
git add .
git commit -m "feat: add Supabase auth with magic link and rate limiting"
```

---

## Task 1.4: Create Projects CRUD (Enhanced)

**Files:**

- Create: `src/lib/api/projects.ts`
- Create: `src/lib/api/schemas/project.ts`
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/new/page.tsx`
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`
- Create: `src/components/projects/ProjectList.tsx`
- Create: `src/components/projects/ProjectCard.tsx`
- Create: `src/components/projects/NewProjectForm.tsx`
- Create: `src/lib/api/__tests__/projects.test.ts`

**Step 1: Create validation schemas**

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

**Step 2: Create projects API helpers**

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
    if (error.code === 'PGRST116') return null; // Not found
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

  const updateData: Record<string, any> = {};
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

**Step 3: Create API routes**

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

**Step 4: Create components and pages**

(Implementation details for ProjectList, ProjectCard, NewProjectForm, and pages follow similar patterns to the original plan but with enhanced error handling and loading states)

**Step 5: Write integration tests**

Create `src/lib/api/__tests__/projects.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestClient } from '@/lib/supabase/test-utils';

describe('Projects API', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await createTestUser('projects-test@example.com', 'password');
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) await deleteTestUser(testUserId);
  });

  describe('createProject', () => {
    it('should create project with valid data', async () => {
      // Test implementation
    });

    it('should reject empty title', async () => {
      // Test implementation
    });

    it('should trim whitespace from title', async () => {
      // Test implementation
    });
  });

  describe('getProjects', () => {
    it('should return paginated projects', async () => {
      // Test implementation
    });

    it('should only return user own projects (RLS)', async () => {
      // Test implementation
    });
  });

  describe('updateProject', () => {
    it('should update project title', async () => {
      // Test implementation
    });

    it('should update project status', async () => {
      // Test implementation
    });
  });

  describe('deleteProject', () => {
    it('should delete project', async () => {
      // Test implementation
    });

    it('should cascade delete documents', async () => {
      // Test implementation
    });
  });
});
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add projects CRUD with validation and pagination"
```

---

## Task 1.5: Create Documents CRUD (Enhanced)

(Similar structure to Task 1.4 with document-specific logic)

---

## Task 1.6: Add Document Autosave (Enhanced)

**Files:**

- Create: `src/components/editor/DocumentEditor.tsx`
- Create: `src/components/editor/SaveStatus.tsx`
- Create: `src/hooks/useAutosave.ts`
- Create: `src/hooks/useOfflineQueue.ts`
- Create: `src/components/editor/__tests__/DocumentEditor.autosave.test.tsx`

**Step 1: Create autosave hook**

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

        // Return to idle after 2 seconds
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Save failed');
        setLastError(err);
        setSaveState('error');
        onError?.(err);

        // Retry with exponential backoff
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

  // Cleanup on unmount
  useEffect(() => {
    return () => clearSaveTimeout();
  }, [clearSaveTimeout]);

  // Save on window blur
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

**Step 2: Create SaveStatus component**

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
      className: 'text-blue-500 animate-spin',
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
      <Icon className={`w-4 h-4 ${config.className}`} />
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

**Step 3: Create DocumentEditor component**

Create `src/components/editor/DocumentEditor.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Editor, useEditor } from './Editor';
import { SaveStatus } from './SaveStatus';
import { useAutosave } from '@/hooks/useAutosave';
import { updateDocument } from '@/lib/api/documents';

interface DocumentEditorProps {
  documentId: string;
  initialContent?: string;
  initialVersion?: number;
}

export function DocumentEditor({
  documentId,
  initialContent = '',
  initialVersion = 1,
}: DocumentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);

  const handleSave = useCallback(async (htmlContent: string) => {
    const result = await updateDocument(documentId, {
      content: htmlContent,
      expectedVersion: version,
    });
    setVersion(result.version);
  }, [documentId, version]);

  const { saveState, lastError, triggerSave, saveNow, retry } = useAutosave({
    onSave: handleSave,
    debounceMs: 1000,
    maxRetries: 3,
  });

  const handleChange = useCallback((html: string) => {
    setContent(html);
    triggerSave(html);
  }, [triggerSave]);

  // Keyboard shortcut for manual save
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

**Step 4: Write comprehensive autosave tests**

Create `src/components/editor/__tests__/DocumentEditor.autosave.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentEditor } from '../DocumentEditor';

describe('DocumentEditor Autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Debouncing', () => {
    it('should debounce saves by 1 second', async () => {
      const mockSave = vi.fn().mockResolvedValue({ version: 2 });
      vi.mock('@/lib/api/documents', () => ({
        updateDocument: mockSave,
      }));

      render(<DocumentEditor documentId="doc123" />);

      // Type rapidly
      const editor = screen.getByRole('textbox');
      await userEvent.type(editor, 'abc', { delay: null });

      // No save yet
      expect(mockSave).not.toHaveBeenCalled();

      // After 1 second
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset debounce on new input', async () => {
      // Test implementation
    });
  });

  describe('Save Status', () => {
    it('should show unsaved indicator while editing', async () => {
      render(<DocumentEditor documentId="doc123" />);

      const editor = screen.getByRole('textbox');
      await userEvent.type(editor, 'test', { delay: null });

      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    it('should show saving indicator during save', async () => {
      // Test implementation
    });

    it('should show saved indicator after successful save', async () => {
      // Test implementation
    });

    it('should show error indicator on save failure', async () => {
      // Test implementation
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed saves with exponential backoff', async () => {
      // Test implementation
    });

    it('should preserve content on save failure', async () => {
      // Test implementation
    });

    it('should show retry button on error', async () => {
      // Test implementation
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect version conflicts', async () => {
      // Test implementation
    });
  });
});
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add document autosave with debouncing, retry, and status"
```

---

## Task 1.7: Add Word/Character Count (Enhanced)

**Files:**

- Create: `src/components/editor/WordCount.tsx`
- Create: `src/components/editor/__tests__/WordCount.test.tsx`
- Modify: `src/components/editor/Editor.tsx`

**Step 1: Create WordCount component**

Create `src/components/editor/WordCount.tsx`:

```typescript
'use client';

import { Editor } from '@tiptap/react';
import { useMemo } from 'react';

interface WordCountProps {
  editor: Editor | null;
  wordLimit?: number;
  characterLimit?: number;
  warningThreshold?: number; // 0-1, e.g., 0.9 for 90%
}

export function WordCount({
  editor,
  wordLimit,
  characterLimit,
  warningThreshold = 0.9,
}: WordCountProps) {
  if (!editor) return null;

  const stats = useMemo(() => {
    const words = editor.storage.characterCount.words();
    const characters = editor.storage.characterCount.characters();
    const paragraphs = editor.state.doc.content.content.filter(
      (node) => node.type.name === 'paragraph' && node.content.size > 0
    ).length;
    const readingTime = Math.ceil(words / 200); // 200 wpm average

    return { words, characters, paragraphs, readingTime };
  }, [editor.state.doc]);

  const wordPercentage = wordLimit ? stats.words / wordLimit : 0;
  const charPercentage = characterLimit ? stats.characters / characterLimit : 0;

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
        {stats.words}{wordLimit ? ` / ${wordLimit}` : ''} words
      </span>
      <span className={getColor(isCharWarning, isCharOver)}>
        {stats.characters}{characterLimit ? ` / ${characterLimit}` : ''} characters
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">{stats.paragraphs} paragraphs</span>
      <span className="text-gray-500">~{stats.readingTime} min read</span>
    </div>
  );
}
```

**Step 2: Write tests and integrate**

(Tests and integration follow the same pattern)

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add word and character count with limits and warnings"
```

---

## Phase 1 E2E Tests (Playwright)

Create `e2e/phase1-core.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 1: Core Editor & Document Management', () => {
  test.describe('Authentication', () => {
    test('should complete magic link sign up flow', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[type="email"]', 'e2e@example.com');
      await page.click('button:has-text("Send Magic Link")');

      await expect(page.locator('text=Check your email')).toBeVisible();
    });

    test('should redirect unauthenticated users from /projects', async ({ page }) => {
      await page.goto('/projects');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Project Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login helper
      await page.goto('/login');
      // ... auth setup
    });

    test('should create new project', async ({ page }) => {
      await page.goto('/projects');
      await page.click('button:has-text("New Project")');
      await page.fill('input[placeholder*="title"]', 'NSF Grant 2026');
      await page.click('button:has-text("Create")');

      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
      await expect(page.locator('text=NSF Grant 2026')).toBeVisible();
    });

    test('should list projects with pagination', async ({ page }) => {
      // Create multiple projects and verify pagination
    });
  });

  test.describe('Document Editor', () => {
    test('should type and format text', async ({ page }) => {
      // Navigate to editor
      await page.goto('/projects');
      // ... create project and document

      const editor = page.locator('[role="textbox"]');
      await editor.click();
      await editor.type('Grant Abstract');

      // Select and bold
      await page.keyboard.press('Control+a');
      await page.click('button[aria-label="Bold"]');

      await expect(editor.locator('strong')).toContainText('Grant Abstract');
    });

    test('should autosave changes', async ({ page }) => {
      // Navigate to editor
      const editor = page.locator('[role="textbox"]');
      await editor.type('Autosave test content');

      // Wait for autosave
      await page.waitForTimeout(1500);
      await expect(page.locator('text=Saved')).toBeVisible();
    });

    test('should display word count', async ({ page }) => {
      const editor = page.locator('[role="textbox"]');
      await editor.type('one two three four five');

      await expect(page.locator('text=5 words')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.route('**/api/documents/**', (route) => route.abort());

      // Navigate and try to save
      // ... verify error UI appears
    });
  });
});
```

---

## Phase 1 Completion Checklist

**Verification Steps:**

- [ ] All unit tests pass: `npm test`
- [ ] All E2E tests pass: `npm run test:e2e`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] Supabase running: `npx supabase status`

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

**Security Verification:**

- [ ] Rate limiting prevents spam magic link requests
- [ ] Auth callback validates redirect URLs
- [ ] API endpoints validate input with zod
- [ ] RLS policies prevent cross-user data access
- [ ] XSS attempts in editor content are sanitized

---

## Dependencies & Task Order

```
P1.0: Testing Infrastructure (FIRST)
  ↓
1.1: TipTap Editor
  ↓
1.2: Editor Toolbar
  ↓
1.3: Supabase Auth ─────────────────┐
  ↓                                 │
1.4: Projects CRUD ←────────────────┘
  ↓
1.5: Documents CRUD
  ↓
1.6: Document Autosave
  ↓
1.7: Word/Character Count
  ↓
E2E Tests (Final validation)
```

**Critical Dependencies:**

- P1.0 must complete before any feature work (provides test utilities)
- 1.1 must complete before 1.2 (toolbar needs editor)
- 1.3 must complete before 1.4/1.5 (auth middleware required)
- 1.5 must complete before 1.6 (autosave needs document API)
- 1.6 must complete before 1.7 (word count integrated with DocumentEditor)

---

## Risk Mitigation

| Risk                          | Mitigation                                            |
| ----------------------------- | ----------------------------------------------------- |
| TipTap SSR issues             | Use 'use client' directive, dynamic imports if needed |
| Supabase rate limits          | Implement client-side throttling, batch operations    |
| Auth token expiry mid-session | Refresh tokens in middleware, handle 401 gracefully   |
| Autosave conflicts            | Version-based conflict detection, merge UI            |
| Large document performance    | Virtualize editor content, lazy load extensions       |

---

## Estimated Complexity

| Task | Files | New Tests | Complexity |
| ---- | ----- | --------- | ---------- |
| P1.0 | 5     | 0         | Low        |
| 1.1  | 4     | 15+       | Medium     |
| 1.2  | 2     | 10+       | Low        |
| 1.3  | 7     | 20+       | High       |
| 1.4  | 8     | 15+       | Medium     |
| 1.5  | 6     | 15+       | Medium     |
| 1.6  | 4     | 25+       | High       |
| 1.7  | 2     | 5+        | Low        |
| E2E  | 1     | 15+       | Medium     |

**Total: ~40 files, 120+ test cases**
