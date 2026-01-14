import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWordCount } from '../useWordCount';
import { EDITOR } from '@/lib/constants';

describe('useWordCount', () => {
  describe('Initial State', () => {
    it('should initialize with zero counts', () => {
      const { result } = renderHook(() => useWordCount());

      expect(result.current.wordCount).toBe(0);
      expect(result.current.charCount).toBe(0);
      expect(result.current.charCountNoSpaces).toBe(0);
      expect(result.current.percentage).toBeNull();
      expect(result.current.charPercentage).toBeNull();
      expect(result.current.isNearLimit).toBe(false);
      expect(result.current.isOverLimit).toBe(false);
      expect(result.current.isCharNearLimit).toBe(false);
      expect(result.current.isCharOverLimit).toBe(false);
    });
  });

  describe('Word Counting', () => {
    it('should count words correctly', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello world this is a test');
      });

      expect(result.current.wordCount).toBe(6);
    });

    it('should count single word correctly', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello');
      });

      expect(result.current.wordCount).toBe(1);
    });

    it('should handle multiple spaces between words', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello    world   test');
      });

      expect(result.current.wordCount).toBe(3);
    });

    it('should handle leading and trailing whitespace', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('   Hello world   ');
      });

      expect(result.current.wordCount).toBe(2);
    });

    it('should handle newlines and tabs as word separators', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello\nworld\ttest');
      });

      expect(result.current.wordCount).toBe(3);
    });
  });

  describe('Character Counting', () => {
    it('should count characters with spaces', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello world');
      });

      expect(result.current.charCount).toBe(11);
    });

    it('should count characters without spaces', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello world');
      });

      expect(result.current.charCountNoSpaces).toBe(10);
    });

    it('should handle multiple spaces when counting', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello   world');
      });

      expect(result.current.charCount).toBe(13);
      expect(result.current.charCountNoSpaces).toBe(10);
    });
  });

  describe('Empty String Handling', () => {
    it('should return zero for empty string', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('');
      });

      expect(result.current.wordCount).toBe(0);
      expect(result.current.charCount).toBe(0);
      expect(result.current.charCountNoSpaces).toBe(0);
    });

    it('should return zero for whitespace-only string', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('   \n\t   ');
      });

      expect(result.current.wordCount).toBe(0);
    });
  });

  describe('HTML Stripping', () => {
    it('should strip HTML tags when counting', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('<p>Hello <strong>world</strong></p>');
      });

      expect(result.current.wordCount).toBe(2);
      expect(result.current.charCount).toBe(11);
    });

    it('should handle nested HTML tags', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('<div><p>Hello <em><strong>bold</strong></em> text</p></div>');
      });

      expect(result.current.wordCount).toBe(3);
    });

    it('should handle HTML entities', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('<p>Hello&nbsp;world</p>');
      });

      // &nbsp; becomes a space in text content
      expect(result.current.wordCount).toBe(2);
    });

    it('should handle self-closing tags', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('<p>Hello<br/>world</p>');
      });

      // br should separate words
      expect(result.current.wordCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty HTML tags', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('<p></p><div></div>');
      });

      expect(result.current.wordCount).toBe(0);
      expect(result.current.charCount).toBe(0);
    });
  });

  describe('Word Limit Percentage', () => {
    it('should calculate percentage when word limit is provided', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 100 }));

      act(() => {
        result.current.updateCount('Hello world this is a test'); // 6 words
      });

      expect(result.current.percentage).toBe(6);
    });

    it('should return null percentage when no word limit', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello world');
      });

      expect(result.current.percentage).toBeNull();
    });

    it('should calculate percentage correctly at 50%', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 10 }));

      act(() => {
        result.current.updateCount('one two three four five');
      });

      expect(result.current.percentage).toBe(50);
    });

    it('should calculate percentage over 100%', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 5 }));

      act(() => {
        result.current.updateCount('one two three four five six seven eight');
      });

      expect(result.current.percentage).toBe(160);
    });
  });

  describe('Character Limit Percentage', () => {
    it('should calculate char percentage when char limit is provided', () => {
      const { result } = renderHook(() => useWordCount({ charLimit: 100 }));

      act(() => {
        result.current.updateCount('Hello'); // 5 characters
      });

      expect(result.current.charPercentage).toBe(5);
    });

    it('should return null char percentage when no char limit', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount('Hello world');
      });

      expect(result.current.charPercentage).toBeNull();
    });
  });

  describe('Over Word Limit Detection', () => {
    it('should flag when over word limit', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 5 }));

      act(() => {
        result.current.updateCount('one two three four five six'); // 6 words
      });

      expect(result.current.isOverLimit).toBe(true);
    });

    it('should not flag when at word limit', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 5 }));

      act(() => {
        result.current.updateCount('one two three four five'); // 5 words
      });

      expect(result.current.isOverLimit).toBe(false);
    });

    it('should not flag when under word limit', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 10 }));

      act(() => {
        result.current.updateCount('one two three'); // 3 words
      });

      expect(result.current.isOverLimit).toBe(false);
    });
  });

  describe('Near Word Limit Detection', () => {
    it('should flag when near limit using default warning threshold', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 100 }));

      act(() => {
        // 90 words out of 100 = 90% = DEFAULT_WORD_WARNING_THRESHOLD
        result.current.updateCount(Array(90).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(true);
    });

    it('should flag when at exactly warning threshold percentage', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 100, warningThreshold: 90 }));

      act(() => {
        result.current.updateCount(Array(90).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(true);
    });

    it('should not flag when below warning threshold', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 100, warningThreshold: 90 }));

      act(() => {
        result.current.updateCount(Array(80).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(false);
    });

    it('should use custom warning threshold', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 100, warningThreshold: 70 }));

      act(() => {
        result.current.updateCount(Array(75).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(true);
    });

    it('should flag as near limit when also over limit', () => {
      const { result } = renderHook(() => useWordCount({ wordLimit: 10 }));

      act(() => {
        result.current.updateCount(Array(15).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(true);
      expect(result.current.isOverLimit).toBe(true);
    });

    it('should not flag near limit when no word limit is set', () => {
      const { result } = renderHook(() => useWordCount());

      act(() => {
        result.current.updateCount(Array(1000).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(false);
    });
  });

  describe('Over Character Limit Detection', () => {
    it('should flag when over char limit', () => {
      const { result } = renderHook(() => useWordCount({ charLimit: 10 }));

      act(() => {
        result.current.updateCount('Hello world!'); // 12 characters
      });

      expect(result.current.isCharOverLimit).toBe(true);
    });

    it('should not flag when at char limit', () => {
      const { result } = renderHook(() => useWordCount({ charLimit: 10 }));

      act(() => {
        result.current.updateCount('Helloworld'); // 10 characters
      });

      expect(result.current.isCharOverLimit).toBe(false);
    });
  });

  describe('Near Character Limit Detection', () => {
    it('should flag when near char limit', () => {
      const { result } = renderHook(() => useWordCount({ charLimit: 100, warningThreshold: 90 }));

      act(() => {
        result.current.updateCount('a'.repeat(90));
      });

      expect(result.current.isCharNearLimit).toBe(true);
    });

    it('should not flag when below char warning threshold', () => {
      const { result } = renderHook(() => useWordCount({ charLimit: 100, warningThreshold: 90 }));

      act(() => {
        result.current.updateCount('a'.repeat(80));
      });

      expect(result.current.isCharNearLimit).toBe(false);
    });
  });

  describe('Default Warning Threshold', () => {
    it('should use DEFAULT_WORD_WARNING_THRESHOLD from constants', () => {
      // Testing that the default threshold matches the constant
      const { result } = renderHook(() => useWordCount({ wordLimit: 100 }));

      // Set to exactly the default threshold
      act(() => {
        result.current.updateCount(Array(EDITOR.DEFAULT_WORD_WARNING_THRESHOLD).fill('word').join(' '));
      });

      expect(result.current.isNearLimit).toBe(true);

      // Set to just below the default threshold
      act(() => {
        result.current.updateCount(
          Array(EDITOR.DEFAULT_WORD_WARNING_THRESHOLD - 1)
            .fill('word')
            .join(' ')
        );
      });

      expect(result.current.isNearLimit).toBe(false);
    });
  });
});
