import { describe, it, expect } from 'vitest';
import { generateDiff, getDiffStats } from '../diff-generator';

describe('generateDiff', () => {
  it('should detect added lines', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nNew Line\nLine 2';

    const diff = generateDiff(original, modified);
    const additions = diff.filter((d) => d.type === 'add');

    expect(additions.length).toBeGreaterThan(0);
  });

  it('should detect removed lines', () => {
    const original = 'Line 1\nLine 2\nLine 3';
    const modified = 'Line 1\nLine 3';

    const diff = generateDiff(original, modified);
    const removals = diff.filter((d) => d.type === 'remove');

    expect(removals.length).toBeGreaterThan(0);
  });

  it('should detect unchanged lines', () => {
    const original = 'Line 1\nLine 2';
    const modified = 'Line 1\nLine 2';

    const diff = generateDiff(original, modified);
    const unchanged = diff.filter((d) => d.type === 'unchanged');

    expect(unchanged.length).toBeGreaterThan(0);
  });
});

describe('getDiffStats', () => {
  it('should count additions, deletions, and unchanged', () => {
    const diff = [
      { type: 'unchanged' as const, value: 'Line 1\n', lineNumber: 1 },
      { type: 'remove' as const, value: 'Old line\n', lineNumber: 2 },
      { type: 'add' as const, value: 'New line\n', lineNumber: 2 },
    ];

    const stats = getDiffStats(diff);

    expect(stats.additions).toBe(1);
    expect(stats.deletions).toBe(1);
    expect(stats.unchanged).toBe(1);
  });
});
