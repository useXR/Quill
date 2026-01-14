import { describe, it, expect } from 'vitest';

describe('Example test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with arrays', () => {
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('should work with objects', () => {
    expect({ name: 'test' }).toHaveProperty('name', 'test');
  });
});
