/**
 * AI Response Mock Helper for E2E Tests
 *
 * Provides utilities for mocking AI streaming responses with markdown content.
 * Used to test the AI markdown integration flow (selection -> AI action -> formatted output).
 */
import { Page, Route } from '@playwright/test';

/**
 * Mock an AI streaming response with markdown content.
 *
 * @param page - Playwright page object
 * @param markdownContent - The markdown content the AI should "generate"
 *
 * @example
 * ```typescript
 * await mockAIResponse(page, '**Bold text** and *italic*');
 * // Trigger AI action...
 * // Content will be streamed to the editor
 * ```
 */
export async function mockAIResponse(page: Page, markdownContent: string): Promise<void> {
  await page.route('**/api/ai/generate', async (route: Route) => {
    // Split content into chunks for realistic streaming simulation
    const chunks = markdownContent.match(/.{1,10}/g) || [markdownContent];

    // Build SSE response body
    const sseChunks = chunks.map(
      (chunk, i) => `data: ${JSON.stringify({ id: `chunk-${i}`, sequence: i, type: 'content', content: chunk })}\n\n`
    );
    sseChunks.push('data: {"type":"done"}\n\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of sseChunks) {
          // Small delay between chunks for realistic streaming
          await new Promise((r) => setTimeout(r, 20));
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
}

/**
 * Mock an AI response with an error.
 *
 * @param page - Playwright page object
 * @param errorMessage - The error message to return
 * @param statusCode - HTTP status code (default: 500)
 */
export async function mockAIError(page: Page, errorMessage: string, statusCode = 500): Promise<void> {
  await page.route('**/api/ai/generate', async (route: Route) => {
    await route.fulfill({
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errorMessage }),
    });
  });
}

/**
 * Mock an AI response with a network failure.
 *
 * @param page - Playwright page object
 */
export async function mockAINetworkError(page: Page): Promise<void> {
  await page.route('**/api/ai/generate', async (route: Route) => {
    await route.abort('connectionfailed');
  });
}

/**
 * Common markdown test content for various formatting scenarios.
 */
export const testMarkdownContent = {
  /** Bold text formatting */
  bold: '**This is bold text**',

  /** Italic text formatting */
  italic: '*This is italic text*',

  /** Mixed inline formatting */
  mixedInline: 'This has **bold** and *italic* and `code` formatting.',

  /** Heading with list */
  headingAndList: `## Summary

Here are the key points:

- First important point
- Second important point
- Third important point`,

  /** Blockquote */
  blockquote: `> This is a quoted passage that provides important context.
>
> It spans multiple lines for emphasis.`,

  /** Code block */
  codeBlock: `Here is some code:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\``,

  /** Complex nested structure */
  nestedStructure: `## Main Section

Here is the introduction paragraph.

### Subsection

- Item with **bold**
- Item with *italic*
- Item with \`code\`

> Important note here

---

Final paragraph with a [link](https://example.com).`,
};
