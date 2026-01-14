# Task 4.3: Chat Components

> **Phase 4** | [← Intent Detection](./02-intent-detection.md) | [Next: Diff Utilities →](./04-diff-utilities.md)

---

## Context

**This task creates the UI components for the chat interface.** These components display chat modes, individual messages, and the input field with live mode detection.

### Design System Reference

All components follow the **Scholarly Craft** aesthetic from `docs/design-system.md`:

| Component     | Primary Tokens                                         | Typography                                   |
| ------------- | ------------------------------------------------------ | -------------------------------------------- |
| ModeIndicator | `bg-quill-lighter`, `text-quill`, `border-quill-light` | `font-ui`, `text-xs`, `font-medium`          |
| ChatMessage   | `bg-surface`, `bg-bg-secondary`, `text-ink-primary`    | `font-ui`, `text-sm`                         |
| ChatInput     | `bg-surface`, `border-ink-faint`, `focus:ring-quill`   | `font-ui`, `text-sm`                         |
| ConfirmDialog | `bg-surface`, `shadow-xl`, `border-ink-faint`          | `font-display` for title, `font-ui` for body |

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
- `e2e/fixtures/claude-cli-mock.ts` (create) - **Moved from Task 4.11 for earlier availability**

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

/**
 * Mode configuration using Quill Design System tokens (Scholarly Craft aesthetic)
 *
 * Design tokens reference: docs/design-system.md
 * - Discussion: Uses info semantic colors for scholarly discussion
 * - Global Edit: Uses warning semantic colors for edit operations (caution)
 * - Research: Uses success semantic colors for research/discovery
 */
const MODE_CONFIG = {
  discussion: {
    icon: MessageCircle,
    label: 'Discussion',
    // Info semantic: scholarly discussion mode
    color: 'text-info-dark bg-info-light border-info/20',
  },
  global_edit: {
    icon: Edit3,
    label: 'Global Edit',
    // Warning semantic: edit operations require attention
    color: 'text-warning-dark bg-warning-light border-warning/20',
  },
  research: {
    icon: Search,
    label: 'Research',
    // Success semantic: research and discovery
    color: 'text-success-dark bg-success-light border-success/20',
  },
};

export function ModeIndicator({ mode, confidence }: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-full
        text-xs font-ui font-medium
        border
        ${config.color}
      `}
      data-testid="chat-mode-indicator"
      data-mode={mode}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
      {confidence && confidence !== 'high' && (
        <span className="text-ink-tertiary">({confidence})</span>
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

/**
 * ChatMessage Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - User messages: bg-bg-secondary (warm cream background)
 * - Assistant messages: bg-surface (clean white)
 * - Typography: font-ui (Source Sans 3) for readability
 * - Icons: Lucide icons at --icon-sm (16px)
 */
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
      className={`
        flex gap-3 p-4
        ${isUser ? 'bg-bg-secondary' : 'bg-surface'}
      `}
      data-testid="chat-message"
      data-role={role}
      data-streaming={isStreaming}
    >
      {/* Avatar - uses quill brand colors for assistant, subtle for user */}
      <div className={`
        flex-shrink-0 w-8 h-8
        rounded-full
        flex items-center justify-center
        ${isUser
          ? 'bg-bg-tertiary text-ink-secondary'
          : 'bg-quill-lighter text-quill'
        }
      `}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header with role, mode, and timestamp */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-ui font-semibold text-sm text-ink-primary">
            {isUser ? 'You' : 'Claude'}
          </span>
          {mode && <ModeIndicator mode={mode} />}
          <span className="font-ui text-xs text-ink-tertiary">
            {timestamp.toLocaleTimeString()}
          </span>
        </div>

        {/* Message content with proper text colors */}
        <div className={`
          font-ui text-sm whitespace-pre-wrap
          ${isError ? 'text-error' : 'text-ink-secondary'}
        `}>
          {content}
          {/* Streaming cursor - uses quill brand color, respects reduced motion */}
          {isStreaming && (
            <span className="
              inline-block w-2 h-4 ml-1
              bg-quill
              animate-pulse
              motion-reduce:animate-none motion-reduce:opacity-70
            " />
          )}
        </div>

        {/* Error state with retry - follows alert pattern from design system */}
        {isError && (
          <div className="
            flex items-center gap-2 mt-2
            text-error
          ">
            <AlertCircle size={14} />
            <span className="font-ui text-xs">Failed to send</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="
                  flex items-center gap-1
                  px-2 py-1
                  font-ui text-xs text-quill
                  hover:underline
                  rounded-md
                  focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
                  min-h-[44px] min-w-[44px]
                "
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

/**
 * ChatInput Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Input: bg-surface, border-ink-faint, focus:ring-quill
 * - Send button: bg-quill, hover:bg-quill-dark (Primary Button pattern)
 * - Cancel button: bg-error-light, text-error (Warning state)
 * - Touch targets: min 44x44px for accessibility
 */
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
    <div className="border-t border-ink-faint p-4 bg-surface">
      {/* Live mode detection indicator */}
      {message.length > 0 && (
        <div className="mb-2">
          <ModeIndicator mode={detectedMode} />
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Text input following design system form input pattern */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none
            px-3 py-2.5
            bg-surface
            font-ui text-sm text-ink-primary
            placeholder:text-ink-subtle
            border border-ink-faint rounded-md
            shadow-sm
            transition-all duration-150
            hover:border-ink-subtle
            focus:outline-none focus:ring-2 focus:ring-quill focus:border-quill
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-secondary
          "
          data-testid="chat-input"
        />

        {/* Buttons with proper touch targets (Best Practice: 44x44px minimum) */}
        {isStreaming ? (
          // Cancel button - uses error semantic colors
          <button
            onClick={onCancel}
            className="
              flex-shrink-0
              p-3 min-w-[44px] min-h-[44px]
              rounded-md
              bg-error-light text-error
              hover:bg-error/20
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2
            "
            data-testid="chat-cancel-stream"
            aria-label="Cancel streaming"
          >
            <Square size={20} />
          </button>
        ) : (
          // Send button - Primary button pattern from design system
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="
              flex-shrink-0
              p-3 min-w-[44px] min-h-[44px]
              rounded-md
              bg-quill text-white
              shadow-sm
              hover:bg-quill-dark hover:shadow-md
              active:bg-quill-darker
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-quill
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
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

/**
 * ConfirmDialog Component - Scholarly Craft Design System
 *
 * Design tokens from docs/design-system.md:
 * - Modal: bg-surface, shadow-xl, rounded-lg (Elevation 3)
 * - Backdrop: color-overlay (rgba with 50% opacity)
 * - Title: font-display (Libre Baskerville) for scholarly emphasis
 * - Body: font-ui (Source Sans 3) for readability
 * - Buttons: Primary/Secondary button patterns
 */
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

  // Variant styles using design system semantic colors
  const variantStyles = {
    danger: 'bg-error hover:bg-error-dark focus:ring-error',
    warning: 'bg-warning hover:bg-warning-dark focus:ring-warning',
    info: 'bg-quill hover:bg-quill-dark focus:ring-quill',
  };

  const iconStyles = {
    danger: 'bg-error-light text-error',
    warning: 'bg-warning-light text-warning',
    info: 'bg-quill-lighter text-quill',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
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
        className="
          bg-surface
          rounded-lg shadow-xl
          w-full max-w-md mx-4 p-6
          focus:outline-none
        "
        data-testid="confirm-dialog"
      >
        <div className="flex items-start gap-4">
          {/* Icon container with semantic color */}
          <div className={`
            flex-shrink-0 w-10 h-10
            rounded-full
            flex items-center justify-center
            ${iconStyles[variant]}
          `}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            {/* Title uses display font for scholarly emphasis */}
            <h3
              id="confirm-title"
              className="font-display text-lg font-bold text-ink-primary"
            >
              {title}
            </h3>
            {/* Message uses UI font for readability */}
            <p
              id="confirm-message"
              className="mt-2 font-ui text-sm text-ink-secondary"
            >
              {message}
            </p>
          </div>
        </div>

        {/* Buttons with proper touch targets (Best Practice: 44x44px minimum) */}
        <div className="mt-6 flex justify-end gap-3">
          {/* Cancel button - Secondary button pattern */}
          <button
            onClick={onClose}
            className="
              px-4 py-2.5 min-h-[44px]
              font-ui text-sm font-semibold
              text-ink-primary
              bg-surface hover:bg-surface-hover active:bg-surface-active
              border border-ink-faint
              rounded-md shadow-sm
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-quill focus:ring-offset-2
            "
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          {/* Confirm button - Primary button with variant color */}
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2.5 min-h-[44px]
              font-ui text-sm font-semibold
              text-white
              rounded-md shadow-sm
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${variantStyles[variant]}
            `}
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

## Task 14: E2E Test Infrastructure - Claude CLI Mock (Moved from Task 4.11)

> **Best Practice:** Create test infrastructure early so subsequent tasks can use it for E2E testing.

### Step 1: Write the mock fixture using SSE streaming pattern

Create `e2e/fixtures/claude-cli-mock.ts`:

```typescript
import { Page, Route } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export interface MockClaudeResponse {
  content: string;
  streamChunks?: string[];
  delayMs?: number;
  error?: { type: 'network' | 'timeout' | 'api'; message: string };
}

export class ClaudeCLIMock {
  private responses: Map<string, MockClaudeResponse> = new Map();

  registerResponse(promptPattern: string, response: MockClaudeResponse): void {
    this.responses.set(promptPattern, response);
  }

  async setupRoutes(page: Page): Promise<void> {
    await page.route('**/api/ai/chat', (route) => this.handleChatRoute(route));
    await page.route('**/api/ai/global-edit', (route) => this.handleGlobalEditRoute(route));
  }

  private async handleChatRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const mockResponse = this.findMatchingResponse(postData.content || '');

    if (mockResponse?.error) {
      if (mockResponse.error.type === 'network') {
        await route.abort('connectionfailed');
      } else {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: mockResponse.error.message }) });
      }
      return;
    }

    // Use ReadableStream pattern from Phase 3 best practices
    const content = mockResponse?.content || 'Mock response';
    const chunks = mockResponse?.streamChunks || [content];
    const delayMs = mockResponse?.delayMs ?? 50;

    const sseChunks = chunks.map(
      (chunk, i) => `data: {"id":"chunk-${i}","sequence":${i},"type":"content","content":"${chunk}"}\n\n`
    );
    sseChunks.push('data: {"type":"done"}\n\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of sseChunks) {
          await new Promise((r) => setTimeout(r, delayMs));
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: Buffer.from(await new Response(stream).arrayBuffer()),
    });
  }

  private async handleGlobalEditRoute(route: Route): Promise<void> {
    const request = route.request();
    const postData = JSON.parse(request.postData() || '{}');
    const mockResponse = this.findMatchingResponse(postData.instruction || '');

    if (mockResponse?.error) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: mockResponse.error.message }) });
      return;
    }

    const modifiedContent = mockResponse?.content || 'Modified content.';
    const chunks = [
      `data: {"type":"content","content":"${modifiedContent}"}\n\n`,
      `data: {"type":"done","operationId":"test-op-id","modifiedContent":"${modifiedContent}","diff":[{"type":"remove","value":"${postData.currentContent || 'Original'}","lineNumber":1},{"type":"add","value":"${modifiedContent}","lineNumber":1}]}\n\n`,
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await new Promise((r) => setTimeout(r, 50));
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: Buffer.from(await new Response(stream).arrayBuffer()),
    });
  }

  private findMatchingResponse(input: string): MockClaudeResponse | undefined {
    for (const [pattern, response] of this.responses) {
      if (input.toLowerCase().includes(pattern.toLowerCase())) {
        return response;
      }
    }
    return undefined;
  }
}

export const mockResponses = {
  simpleDiscussion: { content: 'This is a helpful response about your document.' },
  globalEdit: { content: 'The document has been updated with your requested changes.' },
  networkError: { content: '', error: { type: 'network' as const, message: 'Connection failed' } },
  slowResponse: { content: 'Slow response', delayMs: TIMEOUTS.API_CALL },
};
```

### Step 2: Commit

```bash
git add e2e/fixtures/claude-cli-mock.ts
git commit -m "feat: add Claude CLI mock fixture with SSE streaming pattern (moved earlier)"
```

---

## E2E Tests

### Required E2E Test File: `e2e/chat/chat-components.spec.ts`

Create E2E tests that verify real browser behavior for chat components:

```typescript
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Chat Component E2E Tests', () => {
  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
  });

  test.describe('ConfirmDialog', () => {
    test('should close when backdrop is clicked', async ({ page }) => {
      // Open chat and trigger clear history to show confirm dialog
      await page.getByTestId('chat-sidebar-toggle').click();
      await page.getByTestId('chat-clear-history').click();

      // Verify dialog is visible
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();

      // Click backdrop (outside dialog)
      await page.getByTestId('confirm-backdrop').click({ position: { x: 10, y: 10 } });

      // Dialog should be closed
      await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    });

    test('should close when Escape key is pressed', async ({ page }) => {
      // Open chat and trigger clear history to show confirm dialog
      await page.getByTestId('chat-sidebar-toggle').click();
      await page.getByTestId('chat-clear-history').click();

      // Verify dialog is visible
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();

      // Press Escape key
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    });
  });

  test.describe('ChatInput Keyboard Navigation', () => {
    test('should send message on Enter key', async ({ page }) => {
      await page.getByTestId('chat-sidebar-toggle').click();

      const input = page.getByTestId('chat-input');
      await input.fill('Test message via Enter');
      await input.press('Enter');

      // Message should appear in the list
      await expect(page.getByTestId('chat-message').first()).toContainText('Test message via Enter');
    });

    test('should NOT send message on Shift+Enter (allows newlines)', async ({ page }) => {
      await page.getByTestId('chat-sidebar-toggle').click();

      const input = page.getByTestId('chat-input');
      await input.fill('Line 1');
      await input.press('Shift+Enter');
      await input.type('Line 2');

      // Message should NOT be sent (still in input)
      await expect(input).toHaveValue('Line 1\nLine 2');
    });

    test('should focus input when sidebar opens', async ({ page }) => {
      await page.getByTestId('chat-sidebar-toggle').click();

      // Input should be focusable and ready for typing
      const input = page.getByTestId('chat-input');
      await expect(input).toBeVisible();
      await input.focus();
      await expect(input).toBeFocused();
    });
  });
});
```

### Additional E2E Tests

Add to `e2e/chat/chat-components.spec.ts`:

```typescript
test.describe('ChatMessage Streaming States', () => {
  test('ChatMessage shows streaming cursor during AI response', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Mock slow streaming response
    await page.route('**/api/ai/chat', async (route) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Send chunks slowly to observe streaming state
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 500));
            controller.enqueue(encoder.encode(`data: {"type":"content","content":"chunk ${i}"}\n\n`));
          }
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: Buffer.from(await new Response(stream).arrayBuffer()),
      });
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test streaming');
    await page.getByTestId('chat-send-button').click();

    // Verify cursor animation visible during streaming
    const streamingMessage = page.getByTestId('chat-message').last();
    await expect(streamingMessage).toHaveAttribute('data-streaming', 'true');
  });

  test('ChatMessage retry button works after error', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    let callCount = 0;

    await page.route('**/api/ai/chat', async (route) => {
      callCount++;
      if (callCount === 1) {
        // First call fails
        await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
      } else {
        // Retry succeeds
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'data: {"type":"content","content":"Success"}\n\ndata: {"type":"done"}\n\n',
        });
      }
    });

    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();
    await page.getByTestId('chat-input').fill('Test retry');
    await page.getByTestId('chat-send-button').click();

    // Verify error state and retry button
    await expect(page.getByTestId('chat-retry')).toBeVisible();
    await page.getByTestId('chat-retry').click();

    // Verify retry succeeded
    await expect(page.getByTestId('chat-message').last()).toContainText('Success');
  });
});

test.describe('ModeIndicator Styling', () => {
  test('ModeIndicator shows correct color for each mode', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await page.getByTestId('chat-sidebar-toggle').click();

    // Test discussion mode (info colors)
    await page.getByTestId('chat-input').fill('explain this');
    const indicator = page.getByTestId('chat-mode-indicator');
    await expect(indicator).toHaveClass(/text-info-dark/);
    await expect(indicator).toHaveClass(/bg-info-light/);

    // Test global edit mode (warning colors)
    await page.getByTestId('chat-input').clear();
    await page.getByTestId('chat-input').fill('change all headings');
    await expect(indicator).toHaveClass(/text-warning-dark/);
    await expect(indicator).toHaveClass(/bg-warning-light/);

    // Test research mode (success colors)
    await page.getByTestId('chat-input').clear();
    await page.getByTestId('chat-input').fill('find papers on');
    await expect(indicator).toHaveClass(/text-success-dark/);
    await expect(indicator).toHaveClass(/bg-success-light/);
  });
});
```

### E2E Test Execution (Required Before Proceeding)

```bash
npm run test:e2e e2e/chat/chat-components.spec.ts
```

**Gate:** All tests must pass before proceeding to Task 4.4.

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
- [ ] **ClaudeCLIMock fixture created** (available for subsequent tasks)
- [ ] All unit tests pass: `npm test src/components/chat/__tests__/ src/components/ui/__tests__/ConfirmDialog.test.tsx`
- [ ] **E2E tests pass:** `npm run test:e2e e2e/chat/chat-components.spec.ts`
- [ ] Changes committed (5 commits for Tasks 10-14)

---

## Next Steps

After this task, proceed to **[Task 4.4: Diff Utilities](./04-diff-utilities.md)**.
