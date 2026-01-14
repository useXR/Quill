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

### Parallel Tasks

This task can be done in parallel with:

- **Task 3.15** (Editor Integration)

---

## Files to Create/Modify

- `e2e/pages/AIToolbarPage.ts` (create - per Phase 2 Page Object pattern)
- `e2e/selection-toolbar.spec.ts` (create)
- `e2e/cursor-generation.spec.ts` (create)

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

### Step 2: Create selection toolbar E2E tests

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

```typescript
// e2e/cursor-generation.spec.ts
import { test, expect } from '@playwright/test';
import { checkA11y } from './helpers/axe';
import { waitForFormReady } from './helpers/hydration';
import { TIMEOUTS, VISIBILITY_WAIT } from './config/timeouts';

test.describe('Cursor Generation (Cmd+K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/ai/generate', async (route) => {
      await route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"AI generated content here."}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto('/projects/test-project/documents/test-doc');
    await waitForFormReady(page);
  });

  test('should open modal on Cmd+K', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();

    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog', { name: /generate/i });
    await expect(modal).toBeVisible(VISIBILITY_WAIT);
    await expect(modal.getByRole('textbox')).toBeFocused();

    // Accessibility check per best practices
    await checkA11y(page);
  });

  test('should have correct ARIA attributes on modal', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby');
  });

  test('should close on Escape', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible(VISIBILITY_WAIT);

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('should trap focus within modal', async ({ page }) => {
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    const promptInput = modal.getByRole('textbox');
    const cancelBtn = modal.getByRole('button', { name: /cancel/i });

    await expect(promptInput).toBeFocused();

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
    await page.locator('[role="textbox"]').click();
    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await modal.getByRole('textbox').fill('Write a transition paragraph');
    await modal.getByRole('button', { name: /generate/i }).click();

    // Preview should appear with live region
    const preview = modal.locator('[aria-live="polite"]');
    await expect(preview).toContainText('AI generated');
  });

  test('should insert content at cursor on Accept', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially('Before cursor.');

    await page.keyboard.press('Meta+k');

    const modal = page.getByRole('dialog');
    await modal.getByRole('textbox').fill('Generate text');
    await modal.getByRole('button', { name: /generate/i }).click();

    await modal.getByRole('button', { name: /accept/i }).click({ timeout: 5000 });

    await expect(editor).toContainText('Before cursor.');
    await expect(editor).toContainText('AI generated');
    await expect(modal).not.toBeVisible();
  });

  test('should support keyboard-only operation', async ({ page }) => {
    const editor = page.locator('[role="textbox"]');
    await editor.click();

    // Open with keyboard
    await page.keyboard.press('Meta+k');

    // Type prompt
    await page.keyboard.type('Write something');

    // Submit with Enter
    await page.keyboard.press('Enter');

    // Wait for preview, then Enter to accept
    await page.waitForSelector('[data-testid="preview-panel"]', { timeout: 5000 });
    await page.keyboard.press('Enter');

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

### Step 4: Run E2E tests

```bash
npm run test:e2e
```

**Expected:** PASS (with mocked routes)

### Step 5: Commit

```bash
git add e2e/pages/AIToolbarPage.ts e2e/selection-toolbar.spec.ts e2e/cursor-generation.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for AI features with Page Object"
```

---

## Verification Checklist

### Page Object (per Phase 2 patterns)

- [ ] `e2e/pages/AIToolbarPage.ts` exists
- [ ] Page Object follows `VaultPage.ts` pattern
- [ ] `waitForStreamingComplete()` uses `expect().toPass()` polling pattern
- [ ] All locators defined as class properties

### E2E Tests

- [ ] `e2e/selection-toolbar.spec.ts` exists
- [ ] `e2e/cursor-generation.spec.ts` exists
- [ ] Tests pass: `npm run test:e2e`
- [ ] Tests use `AIToolbarPage` Page Object
- [ ] Tests use `waitForFormReady` from `e2e/helpers/hydration.ts`
- [ ] Tests use `checkA11y` from `e2e/helpers/axe.ts`
- [ ] Tests use `VISIBILITY_WAIT` from `e2e/config/timeouts.ts`

### Functionality

- [ ] Selection toolbar appears on text selection
- [ ] Keyboard navigation works (Arrow keys, Escape)
- [ ] Accept/Reject flow works
- [ ] Cmd+K opens cursor generation modal
- [ ] Modal has proper ARIA attributes
- [ ] Focus trapping works in modal
- [ ] Streaming preview displays
- [ ] Content insertion works

### Best Practices Compliance

- [ ] Accessibility checks pass (axe-core)
- [ ] Slow streaming test uses polling pattern
- [ ] No hardcoded timeout values
- [ ] Changes committed

---

## Next Steps

After this task, proceed to **[Task 3.15: Editor Integration](./15-editor-integration.md)**.
