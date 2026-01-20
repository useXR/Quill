/**
 * Tests for CLI Stream Processor
 *
 * Tests the parsing of JSONL events from Claude Code CLI.
 */

import { parseCLIEvent, CLIEvent, CLIAssistantEvent } from '../cli-stream';

describe('parseCLIEvent', () => {
  describe('init events', () => {
    it('parses init event', () => {
      const line = '{"type":"init","session_id":"abc123"}';
      const event = parseCLIEvent(line);

      expect(event).toEqual({
        type: 'init',
        session_id: 'abc123',
      });
    });
  });

  describe('assistant events with text blocks', () => {
    it('parses text content block', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.type).toBe('assistant');
      expect(event.message.content).toHaveLength(1);
      expect(event.message.content[0]).toEqual({
        type: 'text',
        text: 'Hello, world!',
      });
    });

    it('parses multiple text blocks', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'First part. ' },
            { type: 'text', text: 'Second part.' },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content).toHaveLength(2);
    });
  });

  describe('thinking blocks', () => {
    it('parses thinking content block', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'thinking', thinking: 'Let me analyze this...' }],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content[0]).toEqual({
        type: 'thinking',
        thinking: 'Let me analyze this...',
      });
    });
  });

  describe('tool_use blocks', () => {
    it('parses tool_use block for Read tool', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool_123',
              name: 'Read',
              input: { file_path: '/tmp/test.txt' },
            },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content[0]).toEqual({
        type: 'tool_use',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/tmp/test.txt' },
      });
    });

    it('parses tool_use block for Edit tool', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool_456',
              name: 'Edit',
              input: {
                file_path: '/tmp/test.txt',
                old_string: 'old',
                new_string: 'new',
              },
            },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content[0]).toMatchObject({
        type: 'tool_use',
        name: 'Edit',
      });
    });
  });

  describe('tool_result blocks', () => {
    it('parses successful tool_result with string content', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_123',
              content: 'File contents here',
            },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: 'File contents here',
      });
    });

    it('parses tool_result with array content', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_123',
              content: [{ type: 'text', text: 'Success message' }],
            },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content[0]).toMatchObject({
        type: 'tool_result',
        tool_use_id: 'tool_123',
      });
    });

    it('parses error tool_result', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_123',
              content: 'File not found',
              is_error: true,
            },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content[0]).toMatchObject({
        type: 'tool_result',
        is_error: true,
      });
    });
  });

  describe('result events with stats', () => {
    it('parses result event with stats', () => {
      const line = JSON.stringify({
        type: 'result',
        duration_ms: 3500,
        usage: {
          input_tokens: 1500,
          output_tokens: 500,
        },
      });

      const event = parseCLIEvent(line);

      expect(event).toEqual({
        type: 'result',
        duration_ms: 3500,
        usage: {
          input_tokens: 1500,
          output_tokens: 500,
        },
      });
    });
  });

  describe('malformed JSON', () => {
    it('returns null for invalid JSON', () => {
      const event = parseCLIEvent('not valid json');
      expect(event).toBeNull();
    });

    it('returns null for empty line', () => {
      const event = parseCLIEvent('');
      expect(event).toBeNull();
    });

    it('returns null for truncated JSON', () => {
      const event = parseCLIEvent('{"type":"assistant","message":');
      expect(event).toBeNull();
    });
  });

  describe('mixed content blocks', () => {
    it('parses message with thinking, text, and tool_use', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Analyzing the file...' },
            { type: 'text', text: "I'll read the file first." },
            {
              type: 'tool_use',
              id: 'tool_789',
              name: 'Read',
              input: { file_path: '/tmp/doc.txt' },
            },
          ],
        },
      });

      const event = parseCLIEvent(line) as CLIAssistantEvent;

      expect(event.message.content).toHaveLength(3);
      expect(event.message.content[0].type).toBe('thinking');
      expect(event.message.content[1].type).toBe('text');
      expect(event.message.content[2].type).toBe('tool_use');
    });
  });
});

describe('CLI Stream processing scenarios', () => {
  it('can correlate tool calls with results', () => {
    const events: CLIEvent[] = [
      // Tool call
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool_abc',
              name: 'Read',
              input: { file_path: '/tmp/test.txt' },
            },
          ],
        },
      },
      // Tool result
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_abc',
              content: 'File contents',
            },
          ],
        },
      },
    ];

    // Simulate correlation
    const toolCalls = new Map<string, { name: string; input: unknown }>();

    for (const event of events) {
      if (event.type === 'assistant') {
        for (const block of event.message.content) {
          if (block.type === 'tool_use') {
            toolCalls.set(block.id, { name: block.name, input: block.input });
          } else if (block.type === 'tool_result') {
            const call = toolCalls.get(block.tool_use_id);
            expect(call).toBeDefined();
            expect(call?.name).toBe('Read');
          }
        }
      }
    }
  });
});
