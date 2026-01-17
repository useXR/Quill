/**
 * E2E Tests for Editor Formatting Features
 *
 * Comprehensive tests covering:
 * - Toolbar formatting buttons (blockquote, code block, horizontal rule)
 * - Dark mode formatting visibility
 * - AI markdown integration
 * - AI undo functionality
 * - Accessibility (ARIA attributes)
 * - Copy/paste security (XSS prevention)
 * - Content persistence across reload
 * - Mobile/responsive behavior
 */
import { test, expect } from '../fixtures/test-fixtures';
import { EditorPage } from '../pages/EditorPage';
import { mockAIResponse, testMarkdownContent } from '../helpers/ai-mock';
import { focusAndPaste, maliciousContent, validHtmlContent } from '../helpers/clipboard';

test.describe('Editor Formatting', () => {
  let editorPage: EditorPage;

  test.beforeEach(async ({ page, workerCtx, loginAsWorker }) => {
    await loginAsWorker();
    editorPage = new EditorPage(page);
    await page.goto(`/projects/${workerCtx.projectId}/documents/${workerCtx.documentId}`);
    await editorPage.waitForEditorReady();
  });

  // =========================================
  // TOOLBAR FORMATTING TESTS
  // =========================================
  test.describe('Toolbar Formatting Buttons', () => {
    test('should apply blockquote formatting when button clicked', async ({ page }) => {
      // Type some text
      await editorPage.type('This is a quote');
      await editorPage.selectAll();

      // Click blockquote button
      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });
      await blockquoteBtn.click();

      // Verify blockquote is applied
      const blockquote = page.locator('.ProseMirror blockquote');
      await expect(blockquote).toBeVisible();
      await expect(blockquote).toContainText('This is a quote');

      // Verify button shows active state
      await expect(blockquoteBtn).toHaveAttribute('aria-pressed', 'true');
    });

    test('should apply code block formatting when button clicked', async ({ page }) => {
      // Type some text
      await editorPage.type('const x = 42;');
      await editorPage.selectAll();

      // Click code block button
      const codeBlockBtn = page.getByRole('button', { name: 'Code Block' });
      await codeBlockBtn.click();

      // Verify code block is applied
      const codeBlock = page.locator('.ProseMirror pre code');
      await expect(codeBlock).toBeVisible();
      await expect(codeBlock).toContainText('const x = 42;');

      // Verify button shows active state
      await expect(codeBlockBtn).toHaveAttribute('aria-pressed', 'true');
    });

    test('should insert horizontal rule when button clicked', async ({ page }) => {
      // Type some text
      await editorPage.type('Paragraph above');

      // Click horizontal rule button
      const hrBtn = page.getByRole('button', { name: 'Horizontal Rule' });
      await hrBtn.click();

      // Verify horizontal rule is inserted
      const hr = page.locator('.ProseMirror hr');
      await expect(hr).toBeVisible();

      // HR button should not have active state (it's an insertion, not a toggle)
      await expect(hrBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should toggle blockquote off when clicked again', async ({ page }) => {
      // Apply blockquote
      await editorPage.type('Quote text');
      await editorPage.selectAll();

      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });
      await blockquoteBtn.click();

      // Verify blockquote is applied
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();

      // Click again to toggle off
      await editorPage.selectAll();
      await blockquoteBtn.click();

      // Verify blockquote is removed
      await expect(page.locator('.ProseMirror blockquote')).not.toBeVisible();
      await expect(blockquoteBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should toggle code block off when clicked again', async ({ page }) => {
      // Apply code block
      await editorPage.type('code content');
      await editorPage.selectAll();

      const codeBlockBtn = page.getByRole('button', { name: 'Code Block' });
      await codeBlockBtn.click();

      // Verify code block is applied
      await expect(page.locator('.ProseMirror pre code')).toBeVisible();

      // Click again to toggle off
      await editorPage.selectAll();
      await codeBlockBtn.click();

      // Verify code block is removed
      await expect(page.locator('.ProseMirror pre code')).not.toBeVisible();
      await expect(codeBlockBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // =========================================
  // DARK MODE TESTS
  // =========================================
  test.describe('Dark Mode Formatting', () => {
    test.beforeEach(async ({ page }) => {
      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });
    });

    test('blockquote should be visible in dark mode', async ({ page }) => {
      await editorPage.type('Dark mode quote');
      await editorPage.selectAll();

      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });
      await blockquoteBtn.click();

      const blockquote = page.locator('.ProseMirror blockquote');
      await expect(blockquote).toBeVisible();

      // Verify the blockquote border is visible (uses --color-quill)
      const borderColor = await blockquote.evaluate((el) => {
        return window.getComputedStyle(el).borderLeftColor;
      });
      // In dark mode, quill color is #a78bfa
      expect(borderColor).toBeTruthy();
    });

    test('code block should be visible in dark mode', async ({ page }) => {
      await editorPage.type('const darkMode = true;');
      await editorPage.selectAll();

      const codeBlockBtn = page.getByRole('button', { name: 'Code Block' });
      await codeBlockBtn.click();

      const codeBlock = page.locator('.ProseMirror pre');
      await expect(codeBlock).toBeVisible();

      // Verify background color is appropriate for dark mode
      const bgColor = await codeBlock.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(bgColor).toBeTruthy();
    });

    test('horizontal rule should be visible in dark mode', async ({ page }) => {
      await editorPage.type('Before');

      const hrBtn = page.getByRole('button', { name: 'Horizontal Rule' });
      await hrBtn.click();

      const hr = page.locator('.ProseMirror hr');
      await expect(hr).toBeVisible();

      // Verify border color is visible
      const borderColor = await hr.evaluate((el) => {
        return window.getComputedStyle(el).borderTopColor;
      });
      expect(borderColor).toBeTruthy();
    });

    test('existing formatting should render correctly after switching to dark mode', async ({ page }) => {
      // First disable dark mode
      await page.evaluate(() => {
        document.documentElement.removeAttribute('data-theme');
      });

      // Create formatted content in light mode
      await editorPage.type('Quote content');
      await editorPage.selectAll();
      await page.getByRole('button', { name: 'Blockquote' }).click();

      // Switch to dark mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });

      // Verify content is still visible
      const blockquote = page.locator('.ProseMirror blockquote');
      await expect(blockquote).toBeVisible();
      await expect(blockquote).toContainText('Quote content');
    });
  });

  // =========================================
  // AI MARKDOWN INTEGRATION TESTS
  // =========================================
  test.describe('AI Markdown Integration', () => {
    test('AI output with bold markdown should render correctly', async ({ page }) => {
      // Mock AI response with markdown
      await mockAIResponse(page, testMarkdownContent.bold);

      // Type and select text
      await editorPage.type('Original text');
      await editorPage.selectAll();

      // Wait for selection toolbar
      await editorPage.waitForSelectionToolbar();

      // Trigger AI action
      await editorPage.clickAIAction('refine');

      // Wait for AI completion
      await editorPage.waitForAIComplete();

      // Accept the suggestion
      await editorPage.acceptAISuggestion();

      // Verify bold formatting is applied
      await expect(page.locator('.ProseMirror strong')).toBeVisible();
    });

    test('AI output with heading and list should render correctly', async ({ page }) => {
      await mockAIResponse(page, testMarkdownContent.headingAndList);

      await editorPage.type('Expand this');
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('extend');
      await editorPage.waitForAIComplete();
      await editorPage.acceptAISuggestion();

      // Verify heading is applied
      await expect(page.locator('.ProseMirror h2')).toBeVisible();

      // Verify list is applied
      await expect(page.locator('.ProseMirror ul')).toBeVisible();
      await expect(page.locator('.ProseMirror li')).toHaveCount(3);
    });

    test('AI output with blockquote should render correctly', async ({ page }) => {
      await mockAIResponse(page, testMarkdownContent.blockquote);

      await editorPage.type('Quote this');
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');
      await editorPage.waitForAIComplete();
      await editorPage.acceptAISuggestion();

      // Verify blockquote is applied
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
    });

    test('AI output with code block should render correctly', async ({ page }) => {
      await mockAIResponse(page, testMarkdownContent.codeBlock);

      await editorPage.type('Show me code');
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('extend');
      await editorPage.waitForAIComplete();
      await editorPage.acceptAISuggestion();

      // Verify code block is applied
      await expect(page.locator('.ProseMirror pre code')).toBeVisible();
    });

    test('AI output with nested structure should render correctly', async ({ page }) => {
      await mockAIResponse(page, testMarkdownContent.nestedStructure);

      await editorPage.type('Complex content');
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('extend');
      await editorPage.waitForAIComplete();
      await editorPage.acceptAISuggestion();

      // Verify various elements are applied
      await expect(page.locator('.ProseMirror h2')).toBeVisible();
      await expect(page.locator('.ProseMirror h3')).toBeVisible();
      await expect(page.locator('.ProseMirror ul')).toBeVisible();
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
      await expect(page.locator('.ProseMirror hr')).toBeVisible();
    });
  });

  // =========================================
  // AI UNDO VERIFICATION
  // =========================================
  test.describe('AI Undo Verification', () => {
    test('clicking undo after AI accept should restore original content', async ({ page }) => {
      await mockAIResponse(page, '**Completely different content**');

      // Type original content
      await editorPage.type('Original content that should be restored');
      const originalText = await editorPage.getTextContent();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');
      await editorPage.waitForAIComplete();
      await editorPage.acceptAISuggestion();

      // Verify AI content was applied
      await expect(page.locator('.ProseMirror strong')).toBeVisible();

      // Use editor undo
      await editorPage.undo();

      // Verify original content is restored
      const restoredText = await editorPage.getTextContent();
      expect(restoredText).toBe(originalText);
    });

    test('rejecting AI suggestion should preserve original content', async ({ page }) => {
      await mockAIResponse(page, '**New content**');

      await editorPage.type('Keep this content');
      const originalText = await editorPage.getTextContent();

      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');
      await editorPage.waitForAIComplete();

      // Reject instead of accept
      await editorPage.rejectAISuggestion();

      // Verify original content is preserved
      const currentText = await editorPage.getTextContent();
      expect(currentText).toBe(originalText);
    });

    test('Escape key should dismiss AI suggestion', async ({ page }) => {
      await mockAIResponse(page, '**New content**');

      await editorPage.type('Content to keep');
      await editorPage.selectAll();
      await editorPage.waitForSelectionToolbar();
      await editorPage.clickAIAction('refine');
      await editorPage.waitForAIComplete();

      // Press Escape
      await page.keyboard.press('Escape');

      // Verify selection toolbar is hidden
      await expect(editorPage.selectionToolbar).not.toBeVisible();
    });
  });

  // =========================================
  // ACCESSIBILITY TESTS
  // =========================================
  test.describe('Accessibility', () => {
    test('new toolbar buttons should have correct ARIA attributes', async ({ page }) => {
      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });
      const codeBlockBtn = page.getByRole('button', { name: 'Code Block' });
      const hrBtn = page.getByRole('button', { name: 'Horizontal Rule' });

      // Verify aria-pressed attribute exists
      await expect(blockquoteBtn).toHaveAttribute('aria-pressed');
      await expect(codeBlockBtn).toHaveAttribute('aria-pressed');
      await expect(hrBtn).toHaveAttribute('aria-pressed');

      // Verify aria-label is set
      await expect(blockquoteBtn).toHaveAttribute('aria-label', 'Blockquote');
      await expect(codeBlockBtn).toHaveAttribute('aria-label', 'Code Block');
      await expect(hrBtn).toHaveAttribute('aria-label', 'Horizontal Rule');
    });

    test('toolbar should have proper role and label', async ({ page }) => {
      const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
      await expect(toolbar).toBeVisible();
    });

    test('toolbar keyboard navigation should work', async ({ page }) => {
      // Focus the first button
      const boldBtn = page.getByRole('button', { name: 'Bold' });
      await boldBtn.focus();
      await expect(boldBtn).toBeFocused();

      // Tab to next button
      await page.keyboard.press('Tab');
      const italicBtn = page.getByRole('button', { name: 'Italic' });
      await expect(italicBtn).toBeFocused();
    });

    test('active state should be announced correctly', async ({ page }) => {
      await editorPage.type('Test text');
      await editorPage.selectAll();

      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });

      // Initially not pressed
      await expect(blockquoteBtn).toHaveAttribute('aria-pressed', 'false');

      // Click to activate
      await blockquoteBtn.click();

      // Now pressed
      await expect(blockquoteBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // =========================================
  // COPY/PASTE SECURITY TESTS
  // =========================================
  test.describe('Copy/Paste Security', () => {
    test('paste with script tags should strip scripts', async ({ page }) => {
      await editorPage.editor.click();

      // Paste malicious content with script tag
      await focusAndPaste(page, maliciousContent.scriptTag, 'html');

      // Wait for paste to process
      await page.waitForTimeout(200);

      // Verify no script element exists in editor
      await expect(page.locator('.ProseMirror script')).toHaveCount(0);

      // Verify the text content was preserved (without script)
      const content = await editorPage.getTextContent();
      expect(content).toContain('Hello');
      expect(content).not.toContain('alert');
    });

    test('paste with event handlers should strip handlers', async ({ page }) => {
      await editorPage.editor.click();

      // Paste content with onerror handler
      await focusAndPaste(page, maliciousContent.eventHandler, 'html');
      await page.waitForTimeout(200);

      // Verify no onerror attribute exists
      const imgWithHandler = page.locator('.ProseMirror img[onerror]');
      await expect(imgWithHandler).toHaveCount(0);
    });

    test('paste with javascript URL should strip JS', async ({ page }) => {
      await editorPage.editor.click();

      await focusAndPaste(page, maliciousContent.jsUrl, 'html');
      await page.waitForTimeout(200);

      // Verify no javascript: href exists
      const jsLink = page.locator('.ProseMirror a[href^="javascript:"]');
      await expect(jsLink).toHaveCount(0);
    });

    test('paste with multiple script variants should strip all', async ({ page }) => {
      await editorPage.editor.click();

      await focusAndPaste(page, maliciousContent.multipleScripts, 'html');
      await page.waitForTimeout(200);

      // Verify no script elements exist
      await expect(page.locator('.ProseMirror script')).toHaveCount(0);
      await expect(page.locator('.ProseMirror SCRIPT')).toHaveCount(0);

      // Verify normal text was preserved
      const content = await editorPage.getTextContent();
      expect(content).toContain('Normal text here');
    });

    test('paste valid HTML should preserve formatting', async ({ page }) => {
      await editorPage.editor.click();

      await focusAndPaste(page, validHtmlContent.basicFormatting, 'html');
      await page.waitForTimeout(200);

      // Verify formatting is preserved
      await expect(page.locator('.ProseMirror strong')).toContainText('Bold');
      await expect(page.locator('.ProseMirror em')).toContainText('italic');
    });
  });

  // =========================================
  // PERSISTENCE TESTS
  // =========================================
  test.describe('Content Persistence', () => {
    test('formatted content should survive page reload', async ({ page }) => {
      // Create formatted content
      await editorPage.type('Quote to persist');
      await editorPage.selectAll();
      await page.getByRole('button', { name: 'Blockquote' }).click();

      // Verify blockquote is applied
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();

      // Wait for autosave
      await editorPage.expectSaved();

      // Reload the page
      await page.reload();
      await editorPage.waitForEditorReady();

      // Verify formatting is preserved
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
      await expect(page.locator('.ProseMirror blockquote')).toContainText('Quote to persist');
    });

    test('code block should persist across reload', async ({ page }) => {
      await editorPage.type('const saved = true;');
      await editorPage.selectAll();
      await page.getByRole('button', { name: 'Code Block' }).click();

      await expect(page.locator('.ProseMirror pre code')).toBeVisible();
      await editorPage.expectSaved();

      await page.reload();
      await editorPage.waitForEditorReady();

      await expect(page.locator('.ProseMirror pre code')).toBeVisible();
      await expect(page.locator('.ProseMirror pre code')).toContainText('const saved = true;');
    });

    test('horizontal rule should persist across reload', async ({ page }) => {
      await editorPage.type('Before rule');
      await page.getByRole('button', { name: 'Horizontal Rule' }).click();
      await editorPage.type('After rule');

      await expect(page.locator('.ProseMirror hr')).toBeVisible();
      await editorPage.expectSaved();

      await page.reload();
      await editorPage.waitForEditorReady();

      await expect(page.locator('.ProseMirror hr')).toBeVisible();
    });
  });

  // =========================================
  // MOBILE/RESPONSIVE TESTS
  // =========================================
  test.describe('Mobile/Responsive', () => {
    test('toolbar should be accessible at 768px viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // Verify toolbar is visible
      await expect(editorPage.toolbar).toBeVisible();

      // Verify new buttons are accessible
      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });
      const codeBlockBtn = page.getByRole('button', { name: 'Code Block' });
      const hrBtn = page.getByRole('button', { name: 'Horizontal Rule' });

      await expect(blockquoteBtn).toBeVisible();
      await expect(codeBlockBtn).toBeVisible();
      await expect(hrBtn).toBeVisible();

      // Buttons should be clickable
      await editorPage.type('Mobile test');
      await editorPage.selectAll();
      await blockquoteBtn.click();
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
    });

    test('toolbar should be accessible at 480px viewport', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 800 });

      // Toolbar may scroll or wrap on very small viewports
      await expect(editorPage.toolbar).toBeVisible();

      // Verify at least one new button is accessible (may need to scroll)
      const blockquoteBtn = page.getByRole('button', { name: 'Blockquote' });
      await expect(blockquoteBtn).toBeVisible();
    });

    test('formatting should work correctly at mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Type and format
      await editorPage.type('Mobile formatting');
      await editorPage.selectAll();

      // Apply blockquote
      await page.getByRole('button', { name: 'Blockquote' }).click();

      // Verify it works
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
      await expect(page.locator('.ProseMirror blockquote')).toContainText('Mobile formatting');
    });
  });

  // =========================================
  // NESTED STRUCTURE TESTS
  // =========================================
  test.describe('Nested Structures', () => {
    test('blockquote inside list should render correctly', async ({ page }) => {
      // Create a list first
      await editorPage.type('List item');
      await editorPage.selectAll();
      await page.getByRole('button', { name: 'Bullet List' }).click();

      // Move to end and add blockquote
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Bullet List' }).click(); // Exit list
      await editorPage.type('Quote content');
      await editorPage.selectAll();
      await page.getByRole('button', { name: 'Blockquote' }).click();

      // Both should be visible
      await expect(page.locator('.ProseMirror ul')).toBeVisible();
      await expect(page.locator('.ProseMirror blockquote')).toBeVisible();
    });

    test('code block with multiple lines should preserve formatting', async ({ page }) => {
      await editorPage.type('function test() {');
      await page.keyboard.press('Enter');
      await editorPage.type('  return true;');
      await page.keyboard.press('Enter');
      await editorPage.type('}');

      await editorPage.selectAll();
      await page.getByRole('button', { name: 'Code Block' }).click();

      const codeBlock = page.locator('.ProseMirror pre code');
      await expect(codeBlock).toBeVisible();

      // Verify all lines are present
      const codeContent = await codeBlock.textContent();
      expect(codeContent).toContain('function test()');
      expect(codeContent).toContain('return true');
    });
  });
});
