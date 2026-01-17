/**
 * Clipboard Helper for E2E Tests
 *
 * Provides utilities for simulating paste operations in the editor.
 * Used to test content sanitization, XSS prevention, and paste handling.
 */
import { Page } from '@playwright/test';

/**
 * Simulate pasting content into the ProseMirror editor.
 *
 * @param page - Playwright page object
 * @param content - The content to paste
 * @param type - The content type: 'text' for plain text, 'html' for HTML content
 *
 * @example
 * ```typescript
 * // Paste plain text
 * await pasteContent(page, 'Hello World', 'text');
 *
 * // Paste HTML content
 * await pasteContent(page, '<strong>Bold</strong>', 'html');
 * ```
 */
export async function pasteContent(page: Page, content: string, type: 'text' | 'html' = 'text'): Promise<void> {
  await page.evaluate(
    async ({ content, type }) => {
      const dataTransfer = new DataTransfer();

      if (type === 'html') {
        dataTransfer.setData('text/html', content);
        // Also set plain text fallback (browsers do this automatically)
        dataTransfer.setData('text/plain', content.replace(/<[^>]*>/g, ''));
      } else {
        dataTransfer.setData('text/plain', content);
      }

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      const editor = document.querySelector('.ProseMirror');
      if (editor) {
        editor.dispatchEvent(pasteEvent);
      } else {
        throw new Error('ProseMirror editor not found');
      }
    },
    { content, type }
  );
}

/**
 * Focus the editor and paste content.
 * Combines clicking the editor to focus it, then pasting content.
 *
 * @param page - Playwright page object
 * @param content - The content to paste
 * @param type - The content type: 'text' for plain text, 'html' for HTML content
 */
export async function focusAndPaste(page: Page, content: string, type: 'text' | 'html' = 'text'): Promise<void> {
  // Click editor to ensure focus
  await page.locator('.ProseMirror').click();

  // Wait for focus to settle
  await page.waitForTimeout(100);

  // Paste content
  await pasteContent(page, content, type);
}

/**
 * Common malicious content for XSS/security testing.
 */
export const maliciousContent = {
  /** Basic script tag injection */
  scriptTag: '<script>alert("XSS")</script>Hello',

  /** Event handler injection */
  eventHandler: '<img src="x" onerror="alert(\'XSS\')">',

  /** JavaScript URL injection */
  jsUrl: '<a href="javascript:alert(\'XSS\')">Click me</a>',

  /** SVG with script */
  svgScript: '<svg onload="alert(\'XSS\')"><circle r="10"/></svg>',

  /** Style with expression (IE) */
  styleExpression: '<div style="background:url(javascript:alert(\'XSS\'))">Text</div>',

  /** Multiple script variants */
  multipleScripts: `
    <script>alert(1)</script>
    <SCRIPT>alert(2)</SCRIPT>
    <scRiPt>alert(3)</scRiPt>
    Normal text here
  `,

  /** Data URL injection */
  dataUrl: '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>',

  /** Form action injection */
  formAction: '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>',
};

/**
 * Valid HTML content for testing proper paste handling.
 */
export const validHtmlContent = {
  /** Basic formatting */
  basicFormatting: '<p><strong>Bold</strong> and <em>italic</em> text.</p>',

  /** Headings */
  heading: '<h2>This is a Heading</h2><p>With a paragraph below.</p>',

  /** List */
  list: '<ul><li>First item</li><li>Second item</li><li>Third item</li></ul>',

  /** Nested list */
  nestedList: '<ul><li>Parent item<ul><li>Child item 1</li><li>Child item 2</li></ul></li></ul>',

  /** Blockquote */
  blockquote: '<blockquote><p>This is a quote.</p></blockquote>',

  /** Code */
  code: '<pre><code>const x = 42;</code></pre>',

  /** Table */
  table: '<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>',

  /** Complex mixed content */
  complex: `
    <h2>Title</h2>
    <p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
    </ul>
    <blockquote>A quote</blockquote>
  `,
};
