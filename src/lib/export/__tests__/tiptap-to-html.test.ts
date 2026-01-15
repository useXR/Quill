import { describe, it, expect } from 'vitest';
import { tiptapToHtml } from '../tiptap-to-html';

describe('tiptapToHtml', () => {
  describe('basic nodes', () => {
    it('should convert empty doc', () => {
      const doc = { type: 'doc', content: [] };
      expect(tiptapToHtml(doc)).toBe('');
    });

    it('should convert simple paragraph', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p>Hello World</p>');
    });

    it('should convert multiple paragraphs', () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p>First</p><p>Second</p>');
    });

    it('should convert headings', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Subtitle' }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<h1>Title</h1><h2>Subtitle</h2>');
    });
  });

  describe('text marks', () => {
    it('should convert bold text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p><strong>Bold</strong></p>');
    });

    it('should convert italic text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Italic', marks: [{ type: 'italic' }] }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p><em>Italic</em></p>');
    });

    it('should convert underlined text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Underlined', marks: [{ type: 'underline' }] }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p><u>Underlined</u></p>');
    });

    it('should convert code text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'const x = 1', marks: [{ type: 'code' }] }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p><code>const x = 1</code></p>');
    });

    it('should convert strikethrough text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Strikethrough', marks: [{ type: 'strike' }] }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p><s>Strikethrough</s></p>');
    });

    it('should convert link', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Link',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p><a href="https://example.com">Link</a></p>');
    });

    it('should convert nested marks', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Bold and Italic',
                marks: [{ type: 'bold' }, { type: 'italic' }],
              },
            ],
          },
        ],
      };
      const result = tiptapToHtml(doc);
      // Both marks should be applied
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });
  });

  describe('lists', () => {
    it('should convert bullet list', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
            ],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>');
    });

    it('should convert ordered list', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
            ],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<ol><li><p>First</p></li><li><p>Second</p></li></ol>');
    });
  });

  describe('other nodes', () => {
    it('should convert blockquote', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<blockquote><p>Quote</p></blockquote>');
    });

    it('should convert hard break', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line 1' }, { type: 'hardBreak' }, { type: 'text', text: 'Line 2' }],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p>Line 1<br>Line 2</p>');
    });

    it('should convert horizontal rule', () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
          { type: 'horizontalRule' },
          { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<p>Before</p><hr><p>After</p>');
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      expect(tiptapToHtml(null)).toBe('');
    });

    it('should handle undefined input', () => {
      expect(tiptapToHtml(undefined)).toBe('');
    });

    it('should handle non-object input', () => {
      expect(tiptapToHtml('string')).toBe('');
    });

    it('should handle invalid doc type', () => {
      const doc = { type: 'invalid', content: [] };
      expect(tiptapToHtml(doc)).toBe('');
    });

    it('should escape HTML in text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '<script>alert("xss")</script>' }],
          },
        ],
      };
      const result = tiptapToHtml(doc);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('tables', () => {
    it('should convert simple table', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 1' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 2' }] }] },
                ],
              },
            ],
          },
        ],
      };
      expect(tiptapToHtml(doc)).toBe('<table><tr><td><p>Cell 1</p></td><td><p>Cell 2</p></td></tr></table>');
    });
  });
});
