import { describe, it, expect } from 'vitest';
import { sanitizePrompt, sanitizeContext, SanitizationError } from '../sanitize';

describe('sanitizePrompt', () => {
  it('should pass through valid prompts', () => {
    expect(sanitizePrompt('Hello world')).toBe('Hello world');
  });

  it('should pass through prompts with special characters', () => {
    expect(sanitizePrompt("What's the weather like?")).toBe("What's the weather like?");
    expect(sanitizePrompt('Use `code` formatting')).toBe('Use `code` formatting');
  });

  it('should remove control characters', () => {
    expect(sanitizePrompt('Hello\x00World')).toBe('HelloWorld');
    expect(sanitizePrompt('Test\x01\x02\x03End')).toBe('TestEnd');
  });

  it('should preserve newlines and tabs', () => {
    expect(sanitizePrompt('Hello\n\tWorld')).toBe('Hello\n\tWorld');
    expect(sanitizePrompt('Line 1\nLine 2\nLine 3')).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should preserve carriage returns', () => {
    expect(sanitizePrompt('Hello\r\nWorld')).toBe('Hello\r\nWorld');
  });

  it('should reject prompts starting with CLI flags', () => {
    expect(() => sanitizePrompt('--dangerous')).toThrow(SanitizationError);
    expect(() => sanitizePrompt('-p injection')).toThrow(SanitizationError);
    expect(() => sanitizePrompt('--system-prompt "malicious"')).toThrow(SanitizationError);
  });

  it('should not reject prompts with flags in the middle', () => {
    expect(sanitizePrompt('Use the --help flag')).toBe('Use the --help flag');
    expect(sanitizePrompt('Pass -v for verbose')).toBe('Pass -v for verbose');
  });

  it('should reject prompts starting with flags after trimming', () => {
    expect(() => sanitizePrompt('  --dangerous')).toThrow(SanitizationError);
    expect(() => sanitizePrompt('\n--dangerous')).toThrow(SanitizationError);
  });

  it('should reject empty prompts', () => {
    expect(() => sanitizePrompt('')).toThrow(SanitizationError);
    expect(() => sanitizePrompt('   ')).toThrow(SanitizationError);
  });

  it('should reject prompts exceeding max length', () => {
    const longPrompt = 'x'.repeat(60000);
    expect(() => sanitizePrompt(longPrompt)).toThrow(SanitizationError);
  });

  it('should accept prompts at max length', () => {
    const maxPrompt = 'x'.repeat(50000);
    expect(sanitizePrompt(maxPrompt)).toBe(maxPrompt);
  });

  it('should throw SanitizationError with descriptive message', () => {
    try {
      sanitizePrompt('');
    } catch (e) {
      expect(e).toBeInstanceOf(SanitizationError);
      expect((e as SanitizationError).message).toContain('non-empty');
    }
  });
});

describe('sanitizeContext', () => {
  it('should return empty string for falsy input', () => {
    expect(sanitizeContext('')).toBe('');
    expect(sanitizeContext(null as unknown as string)).toBe('');
    expect(sanitizeContext(undefined as unknown as string)).toBe('');
  });

  it('should pass through valid context', () => {
    const context = 'This is document context with <html> and other content.';
    expect(sanitizeContext(context)).toBe(context);
  });

  it('should remove control characters from context', () => {
    expect(sanitizeContext('Hello\x00World')).toBe('HelloWorld');
  });

  it('should preserve newlines and tabs in context', () => {
    expect(sanitizeContext('Line 1\nLine 2\tTabbed')).toBe('Line 1\nLine 2\tTabbed');
  });

  it('should truncate oversized context with indicator', () => {
    const longContext = 'x'.repeat(150000);
    const result = sanitizeContext(longContext);
    expect(result).toContain('[Context truncated...]');
    expect(result.length).toBeLessThan(110000);
  });

  it('should not truncate context at max size', () => {
    const maxContext = 'x'.repeat(100000);
    const result = sanitizeContext(maxContext);
    expect(result).toBe(maxContext);
    expect(result).not.toContain('[Context truncated...]');
  });

  it('should truncate gracefully with indicator at the end', () => {
    const longContext = 'Start of content\n' + 'x'.repeat(150000);
    const result = sanitizeContext(longContext);
    expect(result.endsWith('[Context truncated...]')).toBe(true);
  });
});

describe('SanitizationError', () => {
  it('should be an instance of Error', () => {
    const error = new SanitizationError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SanitizationError);
  });

  it('should have correct name property', () => {
    const error = new SanitizationError('test');
    expect(error.name).toBe('SanitizationError');
  });
});
