import { describe, it, expect } from 'vitest';
import { detectChatMode } from '../intent-detection';

describe('detectChatMode', () => {
  it('should return discussion mode for general questions', () => {
    const result = detectChatMode('Can you explain this paragraph?');
    expect(result.mode).toBe('discussion');
  });

  it('should return discussion mode for simple requests', () => {
    const result = detectChatMode('What do you think about this?');
    expect(result.mode).toBe('discussion');
  });
});

describe('global_edit mode', () => {
  it('should detect edit for "change all" patterns', () => {
    const result = detectChatMode('Change all instances of "the" to "a"');
    expect(result.mode).toBe('global_edit');
  });

  it('should detect edit for "throughout" patterns', () => {
    const result = detectChatMode('Make the tone more formal throughout');
    expect(result.mode).toBe('global_edit');
  });

  it('should detect edit for "everywhere" patterns', () => {
    const result = detectChatMode('Fix grammar everywhere');
    expect(result.mode).toBe('global_edit');
  });

  it('should detect edit for "rewrite entire" patterns', () => {
    const result = detectChatMode('Rewrite the entire introduction');
    expect(result.mode).toBe('global_edit');
  });

  it('should have high confidence for multiple edit pattern matches', () => {
    const result = detectChatMode('Change all headings throughout the entire document');
    expect(result.mode).toBe('global_edit');
    expect(result.confidence).toBe('high');
  });
});
