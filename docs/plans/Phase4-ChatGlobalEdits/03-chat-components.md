# Task 4.3: Chat Components

> **Phase 4** | [← Intent Detection](./02-intent-detection.md) | [Next: Diff Utilities →](./04-diff-utilities.md)

---

## Context

**This task creates the UI components for the chat interface.** These components display chat modes, individual messages, and the input field with live mode detection.

### Prerequisites

- **Task 4.1** completed (ChatContext with ChatMessage type)

### What This Task Creates

- `src/components/chat/ModeIndicator.tsx` - Mode badge component
- `src/components/chat/ChatMessage.tsx` - Message display component
- `src/components/chat/ChatInput.tsx` - Input with mode detection
- `src/components/ui/ConfirmDialog.tsx` - Non-blocking confirmation dialog (Best Practice)
- Test files for each component

### Tasks That Depend on This

- **Task 4.8** (ChatSidebar) - Uses all three components

### Parallel Tasks

This task can be done in parallel with:

- **Task 4.2** (Intent Detection)
- **Task 4.4** (Diff Utilities)

---

## Files to Create/Modify

- `src/components/chat/ModeIndicator.tsx` (create)
- `src/components/chat/__tests__/ModeIndicator.test.tsx` (create)
- `src/components/chat/ChatMessage.tsx` (create)
- `src/components/chat/__tests__/ChatMessage.test.tsx` (create)
- `src/components/chat/ChatInput.tsx` (create)
- `src/components/chat/__tests__/ChatInput.test.tsx` (create)
- `src/components/ui/ConfirmDialog.tsx` (create)
- `src/components/ui/__tests__/ConfirmDialog.test.tsx` (create)

---

## Task 10: ModeIndicator Component

### Step 1: Write failing test for ModeIndicator

Create `src/components/chat/__tests__/ModeIndicator.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeIndicator } from '../ModeIndicator';

describe('ModeIndicator', () => {
  it('should render discussion mode with correct label', () => {
    render(<ModeIndicator mode="discussion" />);
    expect(screen.getByText('Discussion')).toBeInTheDocument();
  });

  it('should render global_edit mode with correct label', () => {
    render(<ModeIndicator mode="global_edit" />);
    expect(screen.getByText('Global Edit')).toBeInTheDocument();
  });

  it('should render research mode with correct label', () => {
    render(<ModeIndicator mode="research" />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('should show confidence when not high', () => {
    render(<ModeIndicator mode="discussion" confidence="medium" />);
    expect(screen.getByText('(medium)')).toBeInTheDocument();
  });

  it('should have correct data-mode attribute', () => {
    render(<ModeIndicator mode="global_edit" />);
    expect(screen.getByTestId('chat-mode-indicator')).toHaveAttribute('data-mode', 'global_edit');
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/chat/__tests__/ModeIndicator.test.tsx
```

**Expected:** FAIL - module not found

### Step 3: Write ModeIndicator component

Create `src/components/chat/ModeIndicator.tsx`:

```typescript
'use client';

import { Edit3, MessageCircle, Search } from 'lucide-react';

export type ChatMode = 'discussion' | 'global_edit' | 'research';

interface ModeIndicatorProps {
  mode: ChatMode;
  confidence?: 'high' | 'medium' | 'low';
}

// Use semantic CSS variable classes (Best Practice: Semantic color variables)
// These should map to CSS variables defined in your global styles
const MODE_CONFIG = {
  discussion: {
    icon: MessageCircle,
    label: 'Discussion',
    color: 'text-[var(--color-mode-discussion)] bg-[var(--color-mode-discussion-bg)] border-[var(--color-mode-discussion-border)]',
  },
  global_edit: {
    icon: Edit3,
    label: 'Global Edit',
    color: 'text-[var(--color-mode-edit)] bg-[var(--color-mode-edit-bg)] border-[var(--color-mode-edit-border)]',
  },
  research: {
    icon: Search,
    label: 'Research',
    color: 'text-[var(--color-mode-research)] bg-[var(--color-mode-research-bg)] border-[var(--color-mode-research-border)]',
  },
};

/*
 * Add to your global CSS (e.g., globals.css):
 *
 * :root {
 *   --color-mode-discussion: #2563eb;
 *   --color-mode-discussion-bg: #eff6ff;
 *   --color-mode-discussion-border: #bfdbfe;
 *
 *   --color-mode-edit: #ea580c;
 *   --color-mode-edit-bg: #fff7ed;
 *   --color-mode-edit-border: #fed7aa;
 *
 *   --color-mode-research: #16a34a;
 *   --color-mode-research-bg: #f0fdf4;
 *   --color-mode-research-border: #bbf7d0;
 * }
 */

export function ModeIndicator({ mode, confidence }: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}
      data-testid="chat-mode-indicator"
      data-mode={mode}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
      {confidence && confidence !== 'high' && (
        <span className="opacity-60">({confidence})</span>
      )}
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/chat/__tests__/ModeIndicator.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/chat/ModeIndicator.tsx src/components/chat/__tests__/ModeIndicator.test.tsx
git commit -m "feat: add ModeIndicator component for chat modes"
```

---

## Task 11: ChatMessage Component

### Step 1: Write failing test for ChatMessage

Create `src/components/chat/__tests__/ChatMessage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  const baseProps = {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Hello world',
    timestamp: new Date('2024-01-01T12:00:00'),
    status: 'sent' as const,
  };

  it('should render user message with correct role indicator', () => {
    render(<ChatMessage {...baseProps} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('should render assistant message with Claude label', () => {
    render(<ChatMessage {...baseProps} role="assistant" />);
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('should show streaming cursor when streaming', () => {
    render(<ChatMessage {...baseProps} status="streaming" />);
    expect(screen.getByTestId('chat-message')).toHaveAttribute('data-streaming', 'true');
  });

  it('should show error state with retry button', () => {
    const onRetry = vi.fn();
    render(<ChatMessage {...baseProps} status="error" onRetry={onRetry} />);

    expect(screen.getByText('Failed to send')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should display mode indicator when mode provided', () => {
    render(<ChatMessage {...baseProps} mode="global_edit" />);
    expect(screen.getByTestId('chat-mode-indicator')).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/chat/__tests__/ChatMessage.test.tsx
```

**Expected:** FAIL - module not found

### Step 3: Write ChatMessage component

Create `src/components/chat/ChatMessage.tsx`:

```typescript
'use client';

import { User, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { ModeIndicator, ChatMode } from './ModeIndicator';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'streaming' | 'error';
  mode?: ChatMode;
  onRetry?: () => void;
}

export function ChatMessage({
  id,
  role,
  content,
  timestamp,
  status,
  mode,
  onRetry,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isError = status === 'error';
  const isStreaming = status === 'streaming';

  return (
    <div
      className={`flex gap-3 p-4 ${isUser ? 'bg-gray-50' : 'bg-white'}`}
      data-testid="chat-message"
      data-role={role}
      data-streaming={isStreaming}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
      }`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{isUser ? 'You' : 'Claude'}</span>
          {mode && <ModeIndicator mode={mode} />}
          <span className="text-xs text-gray-400">{timestamp.toLocaleTimeString()}</span>
        </div>

        <div className={`text-sm whitespace-pre-wrap ${isError ? 'text-red-600' : 'text-gray-700'}`}>
          {content}
          {/* Streaming cursor with reduced motion support (Best Practice: Reduced motion) */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-purple-400 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70" />
          )}
        </div>

        {isError && (
          <div className="flex items-center gap-2 mt-2 text-red-600">
            <AlertCircle size={14} />
            <span className="text-xs">Failed to send</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[44px] min-w-[44px]"
                data-testid="chat-retry"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/chat/__tests__/ChatMessage.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/chat/ChatMessage.tsx src/components/chat/__tests__/ChatMessage.test.tsx
git commit -m "feat: add ChatMessage component"
```

---

## Task 12: ChatInput Component

### Step 1: Write failing test for ChatInput

Create `src/components/chat/__tests__/ChatInput.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

// Mock intent detection
vi.mock('@/lib/ai/intent-detection', () => ({
  detectChatMode: (msg: string) => ({
    mode: msg.includes('change all') ? 'global_edit' : 'discussion',
    confidence: 'high',
    matchedPatterns: [],
  }),
}));

describe('ChatInput', () => {
  it('should render textarea and send button', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
  });

  it('should call onSend with message when send clicked', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('chat-send-button'));

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should clear input after sending', () => {
    render(<ChatInput onSend={vi.fn()} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('chat-send-button'));

    expect(input).toHaveValue('');
  });

  it('should send on Enter key', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('should not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should show cancel button when streaming', () => {
    const onCancel = vi.fn();
    render(<ChatInput onSend={vi.fn()} onCancel={onCancel} isStreaming />);

    expect(screen.getByTestId('chat-cancel-stream')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-cancel-stream'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/chat/__tests__/ChatInput.test.tsx
```

**Expected:** FAIL - module not found

### Step 3: Write ChatInput component

Create `src/components/chat/ChatInput.tsx`:

```typescript
'use client';

import { useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { ModeIndicator } from './ModeIndicator';
import { detectChatMode } from '@/lib/ai/intent-detection';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  disabled = false,
  isStreaming = false,
  placeholder = 'Ask a question or request changes...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const { mode: detectedMode } = detectChatMode(message);

  const handleSend = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4 bg-white">
      {message.length > 0 && (
        <div className="mb-2">
          <ModeIndicator mode={detectedMode} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
          data-testid="chat-input"
        />

        {/* Buttons with proper touch targets (Best Practice: 44x44px minimum) */}
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex-shrink-0 p-3 min-w-[44px] min-h-[44px] rounded-lg bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            data-testid="chat-cancel-stream"
            aria-label="Cancel streaming"
          >
            <Square size={20} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="flex-shrink-0 p-3 min-w-[44px] min-h-[44px] rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="chat-send-button"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/chat/__tests__/ChatInput.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/chat/ChatInput.tsx src/components/chat/__tests__/ChatInput.test.tsx
git commit -m "feat: add ChatInput component with mode detection"
```

---

## Task 13: ConfirmDialog Component (Best Practice: Avoid blocking confirm())

The ChatSidebar requires a non-blocking confirmation dialog. Per best practices, we should avoid using `window.confirm()` which blocks the main thread.

### Step 1: Write failing test for ConfirmDialog

Create `src/components/ui/__tests__/ConfirmDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure?',
  };

  it('should not render when open is false', () => {
    render(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('should render when open is true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should call onClose when Cancel clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should call onConfirm when Confirm clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(baseProps.onConfirm).toHaveBeenCalled();
  });

  it('should call onClose when backdrop clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByTestId('confirm-backdrop'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose when Escape key pressed', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm test src/components/ui/__tests__/ConfirmDialog.test.tsx
```

**Expected:** FAIL - module not found

### Step 3: Write ConfirmDialog component

Create `src/components/ui/ConfirmDialog.tsx`:

```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key handler (Best Practice: Keyboard accessibility)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  // Handle backdrop click (not propagating from dialog content)
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-500',
    info: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="confirm-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 focus:outline-none"
        data-testid="confirm-dialog"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 id="confirm-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <p id="confirm-message" className="mt-2 text-sm text-gray-600">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons with proper touch targets (Best Practice: 44x44px minimum) */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantStyles[variant]}`}
            data-testid="confirm-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm test src/components/ui/__tests__/ConfirmDialog.test.tsx
```

**Expected:** PASS

### Step 5: Commit

```bash
git add src/components/ui/ConfirmDialog.tsx src/components/ui/__tests__/ConfirmDialog.test.tsx
git commit -m "feat: add ConfirmDialog component for non-blocking confirmations"
```

---

## Verification Checklist

- [ ] ModeIndicator renders all three modes correctly
- [ ] ChatMessage renders user and assistant messages
- [ ] ChatMessage shows error state with retry button
- [ ] ChatInput sends messages on click and Enter
- [ ] ChatInput shows cancel button when streaming
- [ ] ConfirmDialog renders when open
- [ ] ConfirmDialog calls onClose/onConfirm correctly
- [ ] ConfirmDialog handles Escape key
- [ ] All tests pass: `npm test src/components/chat/__tests__/ src/components/ui/__tests__/ConfirmDialog.test.tsx`
- [ ] Changes committed (4 commits for Tasks 10-13)

---

## Next Steps

After this task, proceed to **[Task 4.4: Diff Utilities](./04-diff-utilities.md)**.
