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
