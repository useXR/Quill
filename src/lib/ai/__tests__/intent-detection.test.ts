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
