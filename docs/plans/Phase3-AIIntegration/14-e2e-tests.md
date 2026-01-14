# Task 3.14: E2E Tests with Playwright

> **Phase 3** | [← Selection Toolbar](./13-selection-toolbar.md) | [Next: Editor Integration →](./15-editor-integration.md)

---

## Context

**This task creates Playwright E2E tests for the AI features.** These tests verify the complete user flow from text selection through AI generation to content acceptance, including accessibility and keyboard-only operation.

### Prerequisites

- **Task 3.13** completed (Selection Toolbar) - component to test

### What This Task Creates

- `e2e/selection-toolbar.spec.ts` - Selection toolbar E2E tests
- `e2e/cursor-generation.spec.ts` - Cmd+K cursor generation tests

### Tasks That Depend on This

- None (final test task)

### Design System: Visual Regression Testing

E2E tests should verify [Quill Design System](../../design-system.md) compliance. Add these visual assertions:

**Color Token Verification:**

```typescript
// Verify toolbar uses design system tokens
await expect(aiPage.toolbar).toHaveCSS('background-color', 'rgb(255, 255, 255)'); // --color-surface
await expect(aiPage.toolbar).toHaveCSS('border-color', 'rgb(231, 229, 228)'); // --color-ink-faint

// Verify Accept button uses quill brand color
await expect(aiPage.acceptButton).toHaveCSS('background-color', 'rgb(124, 58, 237)'); // --color-quill
```

**Typography Verification:**

```typescript
// Verify font-ui is applied
await expect(aiPage.refineButton).toHaveCSS('font-family', /Source Sans 3/);
await expect(aiPage.refineButton).toHaveCSS('font-size', '14px'); // text-sm
```

**Focus Ring Verification:**

```typescript
// Verify focus ring matches design system
await aiPage.refineButton.focus();
await expect(aiPage.refineButton).toHaveCSS('outline-offset', '2px');
// Focus ring should be quill color (#7c3aed)
```

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.15** (Editor Integration)

---

## Files to Create/Modify

- `e2e/pages/AIToolbarPage.ts` (create - per Phase 2 Page Object pattern)
- `e2e/config/timeouts.ts` (modify - add AI-specific timeout constants)
- `e2e/ai/ai-selection-toolbar.spec.ts` (create)
- `e2e/ai/ai-cursor-generation.spec.ts` (create)
- `e2e/ai/ai-error-states.spec.ts` (create - error UI tests)
- `e2e/ai/ai-reject-undo.spec.ts` (create - reject and undo flow tests)

---

## Steps

### Step 1: Create AI Page Object (per Phase 2 patterns)

Per best practices, create a Page Object for AI toolbar following the `VaultPage.ts` pattern:

```typescript
// e2e/pages/AIToolbarPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';
import { waitForFormReady } from '../helpers/hydration';

export class AIToolbarPage {
  readonly page: Page;
  readonly editor: Locator;
  readonly toolbar: Locator;
  readonly refineButton: Locator;
  readonly extendButton: Locator;
  readonly shortenButton: Locator;
  readonly simplifyButton: Locator;
  readonly acceptButton: Locator;
  readonly rejectButton: Locator;
  readonly statusRegion: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editor = page.locator('[role="textbox"]');
    this.toolbar = page.getByRole('toolbar', { name: /text formatting/i });
    this.refineButton = this.toolbar.getByRole('button', { name: /refine/i });
    this.extendButton = this.toolbar.getByRole('button', { name: /extend/i });
    this.shortenButton = this.toolbar.getByRole('button', { name: /shorten/i });
    this.simplifyButton = this.toolbar.getByRole('button', { name: /simplify/i });
    this.acceptButton = this.toolbar.getByRole('button', { name: /accept/i });
    this.rejectButton = this.toolbar.getByRole('button', { name: /reject/i });
    this.statusRegion = this.page.getByRole('status');
  }

  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await waitForFormReady(this.page);
  }

  async selectText(text: string) {
    await this.editor.click();
    await this.editor.pressSequentially(text);
    await this.editor.press('Control+a');
  }

  async selectAllText() {
    await this.editor.press('Control+a');
  }

  async clickRefine() {
    await this.refineButton.click();
  }

  async clickExtend() {
    await this.extendButton.click();
  }

  async clickShorten() {
    await this.shortenButton.click();
  }

  async clickSimplify() {
    await this.simplifyButton.click();
  }

  async accept() {
    await this.acceptButton.click(VISIBILITY_WAIT);
  }

  async reject() {
    await this.rejectButton.click();
  }

  /**
   * Wait for AI streaming to complete - per Phase 2 async processing pattern
   * Uses expect().toPass() polling pattern for async operations
   */
  async waitForStreamingComplete() {
    await expect(async () => {
      // Check either Accept button appears (success) or error shown
      const acceptVisible = await this.acceptButton.isVisible();
      const hasError = await this.page.locator('[data-error="true"]').isVisible();
      expect(acceptVisible || hasError).toBe(true);
    }).toPass({ timeout: TIMEOUTS.API_CALL * 6 }); // Allow time for streaming
  }

  /**
   * Wait for toolbar to appear after selection
   */
  async waitForToolbar() {
    await expect(this.toolbar).toBeVisible(VISIBILITY_WAIT);
  }

  /**
   * Verify toolbar is closed
   */
  async expectToolbarHidden() {
    await expect(this.toolbar).not.toBeVisible();
  }

  /**
   * Get current editor content
   */
  async getEditorContent(): Promise<string> {
    return this.editor.textContent() ?? '';
  }
}
```

### Step 1b: Create CursorPrompt Page Object

Create `e2e/pages/CursorPromptPage.ts` for the Cmd+K cursor prompt modal:

```typescript
// e2e/pages/CursorPromptPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';
import { waitForFormReady } from '../helpers/hydration';

/**
 * Page Object for the Cursor Prompt (Cmd+K) modal
 * Follows Phase 2 VaultPage.ts patterns
 */
export class CursorPromptPage {
  readonly page: Page;
  readonly editor: Locator;
  readonly modal: Locator;
  readonly promptInput: Locator;
  readonly generateButton: Locator;
  readonly acceptButton: Locator;
  readonly rejectButton: Locator;
  readonly cancelButton: Locator;
  readonly previewPanel: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly statusRegion: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editor = page.locator('[role="textbox"]');
    this.modal = page.getByRole('dialog', { name: /generate/i });
    this.promptInput = this.modal.getByRole('textbox');
    this.generateButton = this.modal.getByRole('button', { name: /generate/i });
    this.acceptButton = this.modal.getByRole('button', { name: /accept/i });
    this.rejectButton = this.modal.getByRole('button', { name: /reject/i });
    this.cancelButton = this.modal.getByRole('button', { name: /cancel/i });
    this.previewPanel = this.modal.locator('[data-testid="preview-panel"]');
    this.loadingIndicator = this.modal.locator('[data-testid="loading-indicator"]');
    this.errorMessage = this.modal.locator('[role="alert"]');
    this.statusRegion = this.modal.locator('[aria-live="polite"]');
  }

  /**
   * Navigate to a document and wait for editor to be ready
   */
  async goto(projectId: string, documentId: string) {
    await this.page.goto(`/projects/${projectId}/documents/${documentId}`);
    await waitForFormReady(this.page);
  }

  /**
   * Open the cursor prompt modal with Cmd+K (or Ctrl+K on non-Mac)
   */
  async openModal() {
    await this.editor.click();
    await this.page.keyboard.press('Meta+k');
    await expect(this.modal).toBeVisible(VISIBILITY_WAIT);
  }

  /**
   * Open modal with Ctrl+K (for cross-platform testing)
   */
  async openModalWithCtrl() {
    await this.editor.click();
    await this.page.keyboard.press('Control+k');
    await expect(this.modal).toBeVisible(VISIBILITY_WAIT);
  }

  /**
   * Type a prompt into the input field
   */
  async typePrompt(prompt: string) {
    await this.promptInput.fill(prompt);
  }

  /**
   * Click the Generate button to start AI generation
   */
  async clickGenerate() {
    await this.generateButton.click();
  }

  /**
   * Submit prompt by pressing Enter
   */
  async submitWithEnter() {
    await this.page.keyboard.press('Enter');
  }

  /**
   * Accept the generated content
   */
  async accept() {
    await this.acceptButton.click();
  }

  /**
   * Reject/cancel the generated content
   */
  async reject() {
    await this.rejectButton.click();
  }

  /**
   * Cancel and close the modal
   */
  async cancel() {
    await this.cancelButton.click();
  }

  /**
   * Close modal with Escape key
   */
  async closeWithEscape() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Wait for the preview panel to appear (streaming complete)
   * Uses expect().toPass() polling pattern per Phase 2
   */
  async waitForPreview() {
    await expect(async () => {
      const previewVisible = await this.previewPanel.isVisible();
      const acceptVisible = await this.acceptButton.isVisible();
      expect(previewVisible || acceptVisible).toBe(true);
    }).toPass({ timeout: TIMEOUTS.API_CALL * 6 });
  }

  /**
   * Wait for streaming to complete and Accept button to appear
   */
  async waitForStreamingComplete() {
    await expect(this.acceptButton).toBeVisible({ timeout: TIMEOUTS.API_CALL * 6 });
  }

  /**
   * Check if modal is visible
   */
  async isModalVisible(): Promise<boolean> {
    return this.modal.isVisible();
  }

  /**
   * Expect modal to be hidden
   */
  async expectModalHidden() {
    await expect(this.modal).not.toBeVisible();
  }

  /**
   * Expect modal to be visible
   */
  async expectModalVisible() {
    await expect(this.modal).toBeVisible(VISIBILITY_WAIT);
  }

  /**
   * Expect prompt input to be focused
   */
  async expectPromptFocused() {
    await expect(this.promptInput).toBeFocused();
  }

  /**
   * Get current editor content
   */
  async getEditorContent(): Promise<string> {
    return this.editor.textContent() ?? '';
  }

  /**
   * Type text into the editor before opening modal
   */
  async typeInEditor(text: string) {
    await this.editor.click();
    await this.editor.pressSequentially(text);
  }

  /**
   * Full flow: open modal, type prompt, generate, and accept
   */
  async generateAndAccept(prompt: string) {
    await this.openModal();
    await this.typePrompt(prompt);
    await this.clickGenerate();
    await this.waitForStreamingComplete();
    await this.accept();
    await this.expectModalHidden();
  }

  /**
   * Full flow: open modal, type prompt, generate, and reject
   */
  async generateAndReject(prompt: string) {
    await this.openModal();
    await this.typePrompt(prompt);
    await this.clickGenerate();
    await this.waitForStreamingComplete();
    await this.reject();
    await this.expectModalHidden();
  }
}
```

### Step 2: Add AI timeout constants

Add AI-specific timeout constants to `e2e/config/timeouts.ts`:

```typescript
// e2e/config/timeouts.ts - add to existing file

// AI-specific timeouts (add to existing exports)
export const AI_TIMEOUTS = {
  /** Maximum time to wait for AI streaming response to complete */
  AI_STREAMING: 30000,
  /** Heartbeat interval for SSE connection keep-alive */
  AI_HEARTBEAT: 6000,
  /** Time to wait for error UI to appear */
  AI_ERROR_DISPLAY: 3000,
  /** Rate limit countdown display time */
  AI_RATE_LIMIT_WAIT: 60000,
};

// Update TIMEOUTS export if using a consolidated object
export const TIMEOUTS = {
  // ... existing timeouts ...
  AI_STREAMING: 30000,
  AI_HEARTBEAT: 6000,
};
```

### Step 3: Create selection toolbar E2E tests

**Note:** Use the `AIToolbarPage` Page Object for cleaner, more maintainable tests.

```typescript
// e2e/selection-toolbar.spec.ts
import { test, expect } from '@playwright/test';
import { checkA11y } from './helpers/axe';
import { TIMEOUTS, VISIBILITY_WAIT } from './config/timeouts';
import { AIToolbarPage } from './pages/AIToolbarPage';

test.describe('Selection Toolbar', () => {
  let aiPage: AIToolbarPage;

  test.beforeEach(async ({ page }) => {
    aiPage = new AIToolbarPage(page);

    // Mock the AI endpoint
    await page.route('/api/ai/generate', async (route) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"content":"Refined text with better clarity."}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: Buffer.from(await new Response(stream).arrayBuffer()),
      });
    });

    await aiPage.goto('test-project', 'test-doc');
  });

  test('should appear when text is selected', async ({ page }) => {
    await aiPage.selectText('This is some text to select.');
    await aiPage.waitForToolbar();

    await expect(aiPage.refineButton).toBeVisible(VISIBILITY_WAIT);

    // Accessibility check per best practices
    await checkA11y(page);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await aiPage.selectText('Select this text');
    await aiPage.waitForToolbar();

    // First button should be focused
    await expect(aiPage.refineButton).toBeFocused();

    // Arrow right moves to next
    await page.keyboard.press('ArrowRight');
    await expect(aiPage.extendButton).toBeFocused();

    // Escape closes
    await page.keyboard.press('Escape');
    await aiPage.expectToolbarHidden();
  });

  test('should show loading spinner during generation', async ({ page }) => {
    // Delay mock response to test loading state
    await page.route('/api/ai/generate', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Result"}\n\ndata: [DONE]\n\n',
      });
    });

    await aiPage.selectText('Test');
    await aiPage.waitForToolbar();
    await aiPage.clickRefine();

    // Should show aria-busy and loading indicator
    await expect(aiPage.toolbar).toHaveAttribute('aria-busy', 'true');
  });

  test('should accept and replace selected text', async ({ page }) => {
    await aiPage.selectText('Original text');
    await aiPage.waitForToolbar();
    await aiPage.clickRefine();

    // Use waitForStreamingComplete per Phase 2 async pattern
    await aiPage.waitForStreamingComplete();
    await aiPage.accept();

    // Text should be replaced
    await expect(aiPage.editor).toContainText('Refined text');
  });

  test('should have proper ARIA live regions', async ({ page }) => {
    await aiPage.selectText('Test');
    await aiPage.waitForToolbar();

    // Check for live region
    await expect(aiPage.statusRegion).toBeAttached();
  });

  test('should use polling pattern for slow streaming', async ({ page }) => {
    // Test with realistic slow streaming response per Phase 2 pattern
    await page.route('/api/ai/generate', async (route) => {
      const chunks = [
        'data: {"id":"chunk-0","sequence":0,"content":"This "}\n\n',
        'data: {"id":"chunk-1","sequence":1,"content":"is "}\n\n',
        'data: {"id":"chunk-2","sequence":2,"content":"slow "}\n\n',
        'data: {"id":"chunk-3","sequence":3,"content":"streaming."}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            await new Promise((r) => setTimeout(r, 200)); // Simulate slow stream
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
    });

    await aiPage.selectText('Original');
    await aiPage.waitForToolbar();
    await aiPage.clickRefine();

    // Use expect().toPass() polling pattern per Phase 2
    await aiPage.waitForStreamingComplete();

    await expect(aiPage.acceptButton).toBeVisible();
  });
});
```

### Step 3: Create cursor generation E2E tests

**Note:** Use the `CursorPromptPage` Page Object for cleaner, more maintainable tests.

```typescript
// e2e/ai/ai-cursor-generation.spec.ts
import { test, expect } from '@playwright/test';
import { checkA11y } from '../helpers/axe';
import { CursorPromptPage } from '../pages/CursorPromptPage';
import { VISIBILITY_WAIT } from '../config/timeouts';

test.describe('Cursor Generation (Cmd+K)', () => {
  let cursorPrompt: CursorPromptPage;

  test.beforeEach(async ({ page }) => {
    cursorPrompt = new CursorPromptPage(page);

    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI generated content here."}\n\ndata: [DONE]\n\n',
      });
    });

    await cursorPrompt.goto('test-project', 'test-doc');
  });

  test('should open modal on Cmd+K', async ({ page }) => {
    await cursorPrompt.openModal();
    await cursorPrompt.expectModalVisible();
    await cursorPrompt.expectPromptFocused();

    // Accessibility check per best practices
    await checkA11y(page);
  });

  test('should have correct ARIA attributes on modal', async ({ page }) => {
    await cursorPrompt.openModal();

    await expect(cursorPrompt.modal).toHaveAttribute('aria-modal', 'true');
    await expect(cursorPrompt.modal).toHaveAttribute('aria-labelledby');
  });

  test('should close on Escape', async ({ page }) => {
    await cursorPrompt.openModal();
    await cursorPrompt.closeWithEscape();
    await cursorPrompt.expectModalHidden();
  });

  test('should trap focus within modal', async ({ page }) => {
    await cursorPrompt.openModal();
    await cursorPrompt.expectPromptFocused();

    // Tab through all elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should loop back (focus trap)
    await page.keyboard.press('Tab');
    // Focus should still be within modal
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeAttached();
  });

  test('should show streaming preview', async ({ page }) => {
    await cursorPrompt.openModal();
    await cursorPrompt.typePrompt('Write a transition paragraph');
    await cursorPrompt.clickGenerate();

    // Preview should appear with live region
    await expect(cursorPrompt.statusRegion).toContainText('AI generated');
  });

  test('should insert content at cursor on Accept', async ({ page }) => {
    await cursorPrompt.typeInEditor('Before cursor.');
    await cursorPrompt.openModal();
    await cursorPrompt.typePrompt('Generate text');
    await cursorPrompt.clickGenerate();
    await cursorPrompt.waitForStreamingComplete();
    await cursorPrompt.accept();

    await expect(cursorPrompt.editor).toContainText('Before cursor.');
    await expect(cursorPrompt.editor).toContainText('AI generated');
    await cursorPrompt.expectModalHidden();
  });

  test('should support keyboard-only operation', async ({ page }) => {
    await cursorPrompt.editor.click();

    // Open with keyboard
    await page.keyboard.press('Meta+k');
    await cursorPrompt.expectModalVisible();

    // Type prompt
    await page.keyboard.type('Write something');

    // Submit with Enter
    await cursorPrompt.submitWithEnter();

    // Wait for preview, then Enter to accept
    await cursorPrompt.waitForPreview();
    await page.keyboard.press('Enter');

    // Modal should close
    await cursorPrompt.expectModalHidden();
  });
});

test.describe('Cursor Generation - Multiple Sequential Operations', () => {
  let cursorPrompt: CursorPromptPage;

  test.beforeEach(async ({ page }) => {
    cursorPrompt = new CursorPromptPage(page);

    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"Generated text"}\n\ndata: [DONE]\n\n',
      });
    });

    await cursorPrompt.goto('test-project', 'test-doc');
  });

  test('can accept generation, then open modal again for new generation', async ({ page }) => {
    // First generation
    await cursorPrompt.typeInEditor('Start. ');
    await cursorPrompt.generateAndAccept('Add first sentence');

    // Verify first generation was inserted
    await expect(cursorPrompt.editor).toContainText('Generated text');

    // Second generation
    await cursorPrompt.openModal();
    await cursorPrompt.typePrompt('Add second sentence');
    await cursorPrompt.clickGenerate();
    await cursorPrompt.waitForStreamingComplete();
    await cursorPrompt.accept();

    // Modal should close after second accept
    await cursorPrompt.expectModalHidden();
  });

  test('can reject generation and immediately open modal again', async ({ page }) => {
    await cursorPrompt.typeInEditor('Original. ');

    // First attempt - reject
    await cursorPrompt.openModal();
    await cursorPrompt.typePrompt('Generate something');
    await cursorPrompt.clickGenerate();
    await cursorPrompt.waitForStreamingComplete();
    await cursorPrompt.reject();
    await cursorPrompt.expectModalHidden();

    // Second attempt - accept
    await cursorPrompt.openModal();
    await cursorPrompt.typePrompt('Generate something else');
    await cursorPrompt.clickGenerate();
    await cursorPrompt.waitForStreamingComplete();
    await cursorPrompt.accept();

    await expect(cursorPrompt.editor).toContainText('Generated text');
  });

  test('can cancel modal and immediately reopen', async ({ page }) => {
    await cursorPrompt.openModal();
    await cursorPrompt.typePrompt('Test prompt');
    await cursorPrompt.cancel();
    await cursorPrompt.expectModalHidden();

    // Immediately reopen
    await cursorPrompt.openModal();
    await cursorPrompt.expectModalVisible();
    await cursorPrompt.expectPromptFocused();
  });
});
```

### Step 5: Create error states E2E tests

Create `e2e/ai/ai-error-states.spec.ts` for comprehensive error UI testing:

```typescript
// e2e/ai/ai-error-states.spec.ts
import { test, expect } from '@playwright/test';
import { AIToolbarPage } from '../pages/AIToolbarPage';
import { waitForFormReady } from '../helpers/hydration';
import { AI_TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

test.describe('AI Error States', () => {
  let aiPage: AIToolbarPage;

  test.beforeEach(async ({ page }) => {
    aiPage = new AIToolbarPage(page);
    await aiPage.goto('test-project', 'test-doc');
  });

  test.describe('Error Alerts', () => {
    test('should display error alert on API failure', async ({ page }) => {
      await page.route('/api/ai/generate', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error', code: 'SERVER_ERROR' }),
        });
      });

      await aiPage.selectText('Test content');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Error alert should appear with design system styling
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: AI_TIMEOUTS.AI_ERROR_DISPLAY });
      await expect(errorAlert).toHaveClass(/bg-error-light/);
      await expect(errorAlert).toContainText(/error/i);
    });

    test('should show retry button for retryable errors', async ({ page }) => {
      await page.route('/api/ai/generate', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error', code: 'SERVER_ERROR', retryable: true }),
        });
      });

      await aiPage.selectText('Test');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      const retryButton = page.getByRole('button', { name: /retry/i });
      await expect(retryButton).toBeVisible({ timeout: AI_TIMEOUTS.AI_ERROR_DISPLAY });
    });

    test('should display rate limit countdown', async ({ page }) => {
      await page.route('/api/ai/generate', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMITED',
            retryAfter: 30000,
          }),
        });
      });

      await aiPage.selectText('Test');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Rate limit warning should appear
      const rateLimitAlert = page.locator('[role="alert"]');
      await expect(rateLimitAlert).toBeVisible({ timeout: AI_TIMEOUTS.AI_ERROR_DISPLAY });
      await expect(rateLimitAlert).toHaveClass(/bg-warning-light/);

      // Should show countdown
      await expect(rateLimitAlert).toContainText(/wait/i);
      await expect(rateLimitAlert).toContainText(/seconds/i);
    });

    test('should display validation error inline', async ({ page }) => {
      await page.route('/api/ai/generate', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid prompt', code: 'VALIDATION_ERROR' }),
        });
      });

      await aiPage.selectText('x');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Validation error should appear
      const errorMessage = page.locator('[data-testid="validation-error"]');
      await expect(errorMessage).toBeVisible({ timeout: AI_TIMEOUTS.AI_ERROR_DISPLAY });
      await expect(errorMessage).toHaveClass(/text-error/);
    });
  });

  test.describe('Network Failure Recovery', () => {
    test('should handle network disconnection gracefully', async ({ page }) => {
      // Start with working endpoint
      await page.route('/api/ai/generate', async (route) => {
        // Simulate network failure
        await route.abort('failed');
      });

      await aiPage.selectText('Test content');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Should show network error
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: AI_TIMEOUTS.AI_ERROR_DISPLAY });
      await expect(errorAlert).toContainText(/network|connection/i);
    });

    test('should allow retry after network failure', async ({ page }) => {
      let requestCount = 0;

      await page.route('/api/ai/generate', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          await route.abort('failed');
        } else {
          await route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'data: {"content":"Success after retry"}\n\ndata: [DONE]\n\n',
          });
        }
      });

      await aiPage.selectText('Test');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Wait for error and retry button
      const retryButton = page.getByRole('button', { name: /retry/i });
      await expect(retryButton).toBeVisible({ timeout: AI_TIMEOUTS.AI_ERROR_DISPLAY });

      // Click retry
      await retryButton.click();

      // Should succeed on retry
      await aiPage.waitForStreamingComplete();
      await expect(aiPage.acceptButton).toBeVisible();
    });

    test('should handle stream timeout', async ({ page }) => {
      await page.route('/api/ai/generate', async (route) => {
        // Never respond - simulate timeout
        await new Promise(() => {}); // Hang forever
      });

      await aiPage.selectText('Test');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Should show timeout error after AI_STREAMING timeout
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: AI_TIMEOUTS.AI_STREAMING + 5000 });
      await expect(errorAlert).toContainText(/timeout|timed out/i);
    });
  });
});
```

### Step 6: Create reject and undo flow E2E tests

Create `e2e/ai/ai-reject-undo.spec.ts`:

```typescript
// e2e/ai/ai-reject-undo.spec.ts
import { test, expect } from '@playwright/test';
import { AIToolbarPage } from '../pages/AIToolbarPage';
import { waitForFormReady } from '../helpers/hydration';
import { VISIBILITY_WAIT } from '../config/timeouts';

test.describe('AI Reject and Undo Flows', () => {
  let aiPage: AIToolbarPage;

  test.beforeEach(async ({ page }) => {
    aiPage = new AIToolbarPage(page);

    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI generated replacement text"}\n\ndata: [DONE]\n\n',
      });
    });

    await aiPage.goto('test-project', 'test-doc');
  });

  test.describe('Reject Flow', () => {
    test('should restore original text on reject', async ({ page }) => {
      const originalText = 'Original text to preserve';
      await aiPage.selectText(originalText);
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      await aiPage.waitForStreamingComplete();

      // Reject the change
      await aiPage.reject();

      // Original text should be preserved
      const content = await aiPage.getEditorContent();
      expect(content).toContain(originalText);
      expect(content).not.toContain('AI generated');
    });

    test('should close toolbar on reject', async ({ page }) => {
      await aiPage.selectText('Test');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      await aiPage.waitForStreamingComplete();
      await aiPage.reject();

      // Toolbar should be hidden
      await aiPage.expectToolbarHidden();
    });

    test('should cancel streaming on reject during generation', async ({ page }) => {
      // Use slow streaming to test cancellation
      await page.route('/api/ai/generate', async (route) => {
        const chunks = Array.from({ length: 10 }, (_, i) => `data: {"content":"chunk${i} "}\n\n`).join('');

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            for (const chunk of chunks.split('\n\n').filter(Boolean)) {
              await new Promise((r) => setTimeout(r, 500));
              controller.enqueue(encoder.encode(chunk + '\n\n'));
            }
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: Buffer.from(await new Response(stream).arrayBuffer()),
        });
      });

      await aiPage.selectText('Test');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      // Wait briefly for streaming to start
      await page.waitForTimeout(1000);

      // Press Escape to cancel during streaming
      await page.keyboard.press('Escape');

      // Toolbar should close
      await aiPage.expectToolbarHidden();
    });
  });

  test.describe('Undo Flow', () => {
    test('should undo accepted changes with Ctrl+Z', async ({ page }) => {
      const originalText = 'Original text before AI';
      await aiPage.selectText(originalText);
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();

      await aiPage.waitForStreamingComplete();
      await aiPage.accept();

      // Verify AI text is inserted
      let content = await aiPage.getEditorContent();
      expect(content).toContain('AI generated');

      // Undo with Ctrl+Z
      await page.keyboard.press('Control+z');

      // Original text should be restored
      content = await aiPage.getEditorContent();
      expect(content).toContain(originalText);
      expect(content).not.toContain('AI generated');
    });

    test('should support multiple undo operations', async ({ page }) => {
      // Make first AI change
      await aiPage.selectText('First text');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();
      await aiPage.waitForStreamingComplete();
      await aiPage.accept();

      // Clear selection and type more
      await page.keyboard.press('End');
      await page.keyboard.type(' Additional text');

      // Make second AI change
      await page.keyboard.press('Control+a');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();
      await aiPage.waitForStreamingComplete();
      await aiPage.accept();

      // Undo second AI change
      await page.keyboard.press('Control+z');

      // Undo additional typing
      await page.keyboard.press('Control+z');

      // Undo first AI change
      await page.keyboard.press('Control+z');

      // Should be back to original
      const content = await aiPage.getEditorContent();
      expect(content).toContain('First text');
    });

    test('should support redo after undo with Ctrl+Shift+Z', async ({ page }) => {
      await aiPage.selectText('Test text');
      await aiPage.waitForToolbar();
      await aiPage.clickRefine();
      await aiPage.waitForStreamingComplete();
      await aiPage.accept();

      // Undo
      await page.keyboard.press('Control+z');
      let content = await aiPage.getEditorContent();
      expect(content).toContain('Test text');

      // Redo
      await page.keyboard.press('Control+Shift+z');
      content = await aiPage.getEditorContent();
      expect(content).toContain('AI generated');
    });
  });

  test.describe('Cursor Prompt Reject/Undo', () => {
    test('should close modal on cancel', async ({ page }) => {
      await page.locator('[role="textbox"]').click();
      await page.keyboard.press('Meta+k');

      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible(VISIBILITY_WAIT);

      // Click cancel
      await modal.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(modal).not.toBeVisible();
    });

    test('should undo cursor insertion with Ctrl+Z', async ({ page }) => {
      await page.locator('[role="textbox"]').click();
      await page.keyboard.type('Before cursor. ');

      await page.keyboard.press('Meta+k');
      const modal = page.getByRole('dialog');
      await modal.getByRole('textbox').fill('Generate content');
      await modal.getByRole('button', { name: /generate/i }).click();
      await modal.getByRole('button', { name: /accept/i }).click({ timeout: 10000 });

      // Undo
      await page.keyboard.press('Control+z');

      const content = await page.locator('[role="textbox"]').textContent();
      expect(content).toBe('Before cursor. ');
    });
  });
});
```

### Step 7: Create cross-phase integration tests

Create `e2e/ai/ai-cross-phase-integration.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { AIToolbarPage } from '../pages/AIToolbarPage';
import { TIMEOUTS } from '../config/timeouts';

test.describe('AI Cross-Phase Integration', () => {
  test('AI changes persist through autosave (Phase 1)', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Navigate to document
    // Select text and apply AI refine
    // Accept changes
    // Wait for autosave indicator
    // Reload page
    // Verify AI changes persisted
  });

  test('AI works within project document context (Phase 1)', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Create/navigate to project document
    // Use AI features
    // Verify changes save to correct project/document
  });

  test('vault context available for AI generation (Phase 2)', async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    // Upload document to vault
    // Wait for extraction
    // Navigate to editor
    // Trigger AI with vault context
    // Verify response can reference vault content
  });

  test('auth session expiry during AI streaming handled gracefully (Phase 1)', async ({ page }) => {
    // Start AI generation
    // Simulate session expiry mid-stream
    // Verify graceful error handling (not crash)
  });
});
```

### Step 8: Add axe-core accessibility check for CursorPrompt modal

Update `e2e/ai/ai-cursor-generation.spec.ts` to include accessibility checks for the modal:

```typescript
// Add to ai-cursor-generation.spec.ts - in the existing test file

test('CursorPrompt modal passes axe-core accessibility audit', async ({ page }) => {
  await page.locator('[role="textbox"]').click();
  await page.keyboard.press('Meta+k');

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible(VISIBILITY_WAIT);

  // Run axe-core accessibility check on the modal
  await checkA11y(page, {
    include: ['[role="dialog"]'],
  });
});

test('CursorPrompt modal with preview passes accessibility audit', async ({ page }) => {
  await page.locator('[role="textbox"]').click();
  await page.keyboard.press('Meta+k');

  const modal = page.getByRole('dialog');
  await modal.getByRole('textbox').fill('Generate test content');
  await modal.getByRole('button', { name: /generate/i }).click();

  // Wait for preview to appear
  await page.waitForSelector('[data-testid="preview-panel"]', { timeout: 5000 });

  // Run axe-core check on modal with preview content
  await checkA11y(page, {
    include: ['[role="dialog"]'],
  });
});
```

### Step 9: Run E2E tests

```bash
# Run all AI E2E tests
npm run test:e2e -- --grep "ai/"

# Or run specific test files
npx playwright test e2e/ai/
```

**Expected:** PASS (with mocked routes)

### Step 10: Commit

```bash
git add e2e/pages/AIToolbarPage.ts e2e/config/timeouts.ts e2e/ai/
git commit -m "test(e2e): add comprehensive AI E2E tests with error states, reject and undo flows"
```

---

## Verification Checklist

### Page Objects (per Phase 2 patterns)

- [ ] `e2e/pages/AIToolbarPage.ts` exists
- [ ] `e2e/pages/CursorPromptPage.ts` exists
- [ ] Page Objects follow `VaultPage.ts` pattern
- [ ] `waitForStreamingComplete()` uses `expect().toPass()` polling pattern
- [ ] All locators defined as class properties
- [ ] CursorPromptPage includes: modal, promptInput, generateButton, acceptButton, rejectButton, cancelButton, previewPanel

### Timeout Constants

- [ ] `e2e/config/timeouts.ts` updated with AI constants
- [ ] `AI_STREAMING: 30000` constant defined
- [ ] `AI_HEARTBEAT: 6000` constant defined
- [ ] `AI_ERROR_DISPLAY: 3000` constant defined

### E2E Test Files

- [ ] `e2e/ai/ai-selection-toolbar.spec.ts` exists
- [ ] `e2e/ai/ai-cursor-generation.spec.ts` exists
- [ ] `e2e/ai/ai-error-states.spec.ts` exists
- [ ] `e2e/ai/ai-reject-undo.spec.ts` exists
- [ ] `e2e/ai/ai-cli-status.spec.ts` exists (CLI status error display tests)
- [ ] All tests pass: `npx playwright test e2e/ai/`
- [ ] Tests use `AIToolbarPage` Page Object
- [ ] Tests use `CursorPromptPage` Page Object
- [ ] Tests use `waitForFormReady` from `e2e/helpers/hydration.ts`
- [ ] Tests use `checkA11y` from `e2e/helpers/axe.ts`
- [ ] Tests use timeout constants from `e2e/config/timeouts.ts`

### Individual Action Button Tests

- [ ] Extend button triggers AI generation with extend prompt
- [ ] Shorten button triggers AI generation with shorten prompt
- [ ] Simplify button triggers AI generation with simplify prompt
- [ ] Refine button triggers AI generation with refine prompt
- [ ] Each action button replaces text correctly when accepted

### CLI Status Error Display Tests

- [ ] "CLI not installed" error displays to user with installation instructions
- [ ] "Authentication required" error displays with login command
- [ ] "CLI outdated" warning displays with version information
- [ ] CLI ready state proceeds with AI operation

### Multiple Sequential Operations Tests

- [ ] Can select text, accept AI change, then select new text for another operation
- [ ] Can perform multiple AI operations without page reload
- [ ] Can reject AI change and immediately start new operation
- [ ] Can accept cursor generation, then open modal again for new generation
- [ ] Can reject cursor generation and immediately open modal again

### Error State Tests

- [ ] Error alert display test passes
- [ ] Retry button appears for retryable errors
- [ ] Rate limit countdown displays
- [ ] Validation errors show inline
- [ ] Network failure recovery works
- [ ] Stream timeout is handled

### Reject and Undo Tests

- [ ] Reject restores original text
- [ ] Reject closes toolbar
- [ ] Streaming cancellation works on reject
- [ ] Undo reverses accepted changes
- [ ] Multiple undo operations work
- [ ] Redo after undo works
- [ ] Cursor prompt cancel closes modal
- [ ] Cursor insertion can be undone

### Core Functionality

- [ ] Selection toolbar appears on text selection
- [ ] Keyboard navigation works (Arrow keys, Escape)
- [ ] Accept/Reject flow works
- [ ] Cmd+K opens cursor generation modal
- [ ] Modal has proper ARIA attributes
- [ ] Focus trapping works in modal
- [ ] Streaming preview displays
- [ ] Content insertion works

### Cross-Phase Integration Tests

- [ ] `e2e/ai/ai-cross-phase-integration.spec.ts` exists
- [ ] AI changes persist through autosave (Phase 1) test exists
- [ ] AI works within project document context (Phase 1) test exists
- [ ] Vault context available for AI generation (Phase 2) test exists
- [ ] Auth session expiry during AI streaming handled gracefully test exists

### CursorPrompt Modal Accessibility

- [ ] `checkA11y` runs on CursorPrompt modal (initial state)
- [ ] `checkA11y` runs on CursorPrompt modal (with preview)
- [ ] Modal accessibility tests added to `e2e/ai/ai-cursor-generation.spec.ts`

### Best Practices Compliance

- [ ] Accessibility checks pass (axe-core) for both toolbar and CursorPrompt modal
- [ ] Slow streaming test uses polling pattern
- [ ] No hardcoded timeout values
- [ ] All tests use AI_TIMEOUTS constants
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.15: Editor Integration](./15-editor-integration.md)**.
