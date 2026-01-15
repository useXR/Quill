/**
 * Tests for Claude CLI streaming module.
 *
 * Tests chunk emission, cancellation, partial content recovery,
 * and the convenience function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockClaude } from './mocks/mock-claude-cli';

// Use vi.hoisted to create a stable mock reference
const mocks = vi.hoisted(() => {
  return {
    spawn: vi.fn(),
  };
});

// Mock child_process
vi.mock('child_process', () => {
  const mockModule = {
    spawn: mocks.spawn,
    ChildProcess: class {},
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Import module under test
import { ClaudeStream, streamClaude, StreamChunk } from '../streaming';

describe('ClaudeStream', () => {
  let stream: ClaudeStream;

  beforeEach(() => {
    mocks.spawn.mockReset();
    stream = new ClaudeStream();
  });

  afterEach(() => {
    stream.cancel();
  });

  describe('stream()', () => {
    it('should emit chunks as they arrive', async () => {
      setupMockClaude(
        {
          scenario: 'success',
          responseChunks: ['{"content":"Hello "}', '{"content":"world"}'],
        },
        mocks.spawn
      );

      const chunks: StreamChunk[] = [];
      const onChunk = vi.fn((chunk: StreamChunk) => chunks.push(chunk));
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test prompt', { onChunk, onComplete, onError });

      // Should have received 2 content chunks + 1 done chunk
      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(chunks[0].content).toBe('Hello ');
      expect(chunks[0].sequence).toBe(0);
      expect(chunks[0].done).toBe(false);
      expect(chunks[1].content).toBe('world');
      expect(chunks[1].sequence).toBe(1);
      expect(chunks[1].done).toBe(false);
      expect(chunks[2].done).toBe(true);

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should concatenate all content via getContent()', async () => {
      setupMockClaude(
        {
          scenario: 'success',
          responseChunks: ['{"content":"Hello "}', '{"content":"world"}', '{"content":"!"}'],
        },
        mocks.spawn
      );

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      expect(stream.getContent()).toBe('Hello world!');
    });

    it('should return all chunks via getChunks()', async () => {
      setupMockClaude(
        {
          scenario: 'success',
          responseChunks: ['{"content":"A"}', '{"content":"B"}'],
        },
        mocks.spawn
      );

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      const allChunks = stream.getChunks();
      expect(allChunks).toHaveLength(3); // 2 content + 1 done
      expect(allChunks[0].content).toBe('A');
      expect(allChunks[1].content).toBe('B');
      expect(allChunks[2].done).toBe(true);
    });

    it('should return chunks after a sequence number via getChunksAfter()', async () => {
      setupMockClaude(
        {
          scenario: 'success',
          responseChunks: ['{"content":"A"}', '{"content":"B"}', '{"content":"C"}'],
        },
        mocks.spawn
      );

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      const afterSeq1 = stream.getChunksAfter(1);
      expect(afterSeq1).toHaveLength(2); // Chunks with sequence 2 and 3
      expect(afterSeq1[0].content).toBe('C');
      expect(afterSeq1[1].done).toBe(true);
    });

    it('should have unique stream ID for each chunk', async () => {
      setupMockClaude(
        {
          scenario: 'success',
          responseChunks: ['{"content":"A"}', '{"content":"B"}'],
        },
        mocks.spawn
      );

      const chunks: StreamChunk[] = [];
      const onChunk = vi.fn((chunk: StreamChunk) => chunks.push(chunk));
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      // All chunks should have the same stream ID
      const streamId = chunks[0].id;
      expect(streamId).toBeTruthy();
      expect(chunks.every((c) => c.id === streamId)).toBe(true);
    });

    it('should recover partial content on error', async () => {
      setupMockClaude({ scenario: 'partial_then_error' }, mocks.spawn);

      const chunks: StreamChunk[] = [];
      const onChunk = vi.fn((chunk: StreamChunk) => chunks.push(chunk));
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      // Should have content chunk before error
      expect(chunks.some((c) => c.content === 'Partial')).toBe(true);

      // Should have error chunk at the end
      const errorChunk = chunks.find((c) => c.error);
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.done).toBe(true);

      // Error callback should be called
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();

      // Partial content should be preserved
      expect(stream.getContent()).toBe('Partial');
    });

    it('should handle auth errors', async () => {
      setupMockClaude({ scenario: 'auth_error' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].code).toBe('AUTH_FAILURE');
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should handle CLI not found error', async () => {
      setupMockClaude({ scenario: 'cli_not_found' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].code).toBe('CLI_NOT_FOUND');
    });

    it('should handle rate limit errors', async () => {
      setupMockClaude({ scenario: 'rate_limit' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].code).toBe('RATE_LIMITED');
      expect(onError.mock.calls[0][0].retryable).toBe(true);
    });

    it('should handle empty response', async () => {
      setupMockClaude({ scenario: 'empty_response' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      // Should emit done chunk
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk.mock.calls[0][0].done).toBe(true);

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
      expect(stream.getContent()).toBe('');
    });

    it('should handle interleaved output gracefully', async () => {
      setupMockClaude({ scenario: 'interleaved_output' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      expect(stream.getContent()).toBe('First second');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle process crash with partial content', async () => {
      setupMockClaude({ scenario: 'process_crash' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].code).toBe('PROCESS_CRASH');

      // Should preserve partial content
      expect(stream.getContent()).toBe('Partial before crash');
    });

    it('should skip malformed JSON lines', async () => {
      setupMockClaude({ scenario: 'malformed_json' }, mocks.spawn);

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await stream.stream('Test', { onChunk, onComplete, onError });

      // Should only get valid content
      expect(stream.getContent()).toBe('valid');
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel()', () => {
    it('should support cancellation', async () => {
      setupMockClaude(
        {
          scenario: 'slow_stream',
          responseChunks: ['{"content":"Slow "}', '{"content":"streaming "}', '{"content":"response"}'],
          delayMs: 100,
        },
        mocks.spawn
      );

      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      // Start streaming but cancel after a short delay
      const streamPromise = stream.stream('Test', { onChunk, onComplete, onError });

      // Cancel after first chunk should have been emitted
      setTimeout(() => {
        stream.cancel();
      }, 150);

      await streamPromise;

      // Should have received at most 1-2 chunks before cancellation
      // onComplete and onError should not be called after cancel
      const chunkCount = onChunk.mock.calls.length;
      expect(chunkCount).toBeLessThan(4); // Less than all 3 content + 1 done
    });

    it('should be safe to cancel multiple times', () => {
      stream.cancel();
      stream.cancel();
      stream.cancel();
      // Should not throw
    });

    it('should be safe to cancel before streaming starts', () => {
      stream.cancel();
      // Should not throw
    });
  });
});

describe('streamClaude convenience function', () => {
  beforeEach(() => {
    mocks.spawn.mockReset();
  });

  it('should work with simple callbacks', async () => {
    setupMockClaude(
      {
        scenario: 'success',
        responseChunks: ['{"content":"Hello "}', '{"content":"world"}'],
      },
      mocks.spawn
    );

    const chunks: string[] = [];
    const onChunk = vi.fn((content: string) => chunks.push(content));
    const onComplete = vi.fn();
    const onError = vi.fn();

    const cancel = streamClaude('Test', onChunk, onComplete, onError);

    // Wait for stream to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(chunks).toEqual(['Hello ', 'world']);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof cancel).toBe('function');
  });

  it('should return cancel function that works', async () => {
    setupMockClaude(
      {
        scenario: 'slow_stream',
        responseChunks: ['{"content":"A"}', '{"content":"B"}', '{"content":"C"}'],
        delayMs: 100,
      },
      mocks.spawn
    );

    const chunks: string[] = [];
    const onChunk = vi.fn((content: string) => chunks.push(content));
    const onComplete = vi.fn();
    const onError = vi.fn();

    const cancel = streamClaude('Test', onChunk, onComplete, onError);

    // Cancel after short delay
    setTimeout(cancel, 150);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have fewer chunks due to cancellation
    expect(chunks.length).toBeLessThan(3);
  });

  it('should pass error message string to onError', async () => {
    setupMockClaude({ scenario: 'auth_error' }, mocks.spawn);

    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    streamClaude('Test', onChunk, onComplete, onError);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(typeof onError.mock.calls[0][0]).toBe('string');
    expect(onError.mock.calls[0][0]).toContain('Authentication failed');
  });

  it('should support custom timeout', async () => {
    setupMockClaude(
      {
        scenario: 'success',
        responseChunks: ['{"content":"test"}'],
      },
      mocks.spawn
    );

    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    streamClaude('Test', onChunk, onComplete, onError, 5000);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
