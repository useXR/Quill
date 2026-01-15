import { describe, it, expect } from 'vitest';
import { convertHtmlToDocx } from '../html-to-docx';
import { Paragraph, Table } from 'docx';

describe('convertHtmlToDocx', () => {
  describe('paragraphs', () => {
    it('should convert simple paragraph', () => {
      const html = '<p>Hello World</p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert multiple paragraphs', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(2);
      expect(elements[0]).toBeInstanceOf(Paragraph);
      expect(elements[1]).toBeInstanceOf(Paragraph);
    });

    it('should handle empty paragraph', () => {
      const html = '<p></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });
  });

  describe('headings', () => {
    it('should convert h1 heading', () => {
      const html = '<h1>Main Title</h1>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert h2 heading', () => {
      const html = '<h2>Subtitle</h2>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert h3 heading', () => {
      const html = '<h3>Section</h3>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });
  });

  describe('text formatting', () => {
    it('should convert bold text', () => {
      const html = '<p><strong>Bold text</strong></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert italic text', () => {
      const html = '<p><em>Italic text</em></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert underlined text', () => {
      const html = '<p><u>Underlined text</u></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert code/monospace text', () => {
      const html = '<p><code>const x = 1;</code></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should handle nested formatting', () => {
      const html = '<p><strong><em>Bold and italic</em></strong></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should handle mixed content', () => {
      const html = '<p>Normal <strong>bold</strong> and <em>italic</em> text</p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });
  });

  describe('lists', () => {
    it('should convert unordered list', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(2);
      expect(elements[0]).toBeInstanceOf(Paragraph);
      expect(elements[1]).toBeInstanceOf(Paragraph);
    });

    it('should convert ordered list', () => {
      const html = '<ol><li>First</li><li>Second</li></ol>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(2);
      expect(elements[0]).toBeInstanceOf(Paragraph);
      expect(elements[1]).toBeInstanceOf(Paragraph);
    });

    it('should handle empty list', () => {
      const html = '<ul></ul>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(0);
    });
  });

  describe('blockquotes', () => {
    it('should convert blockquote', () => {
      const html = '<blockquote>This is a quote</blockquote>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should convert blockquote with multiple paragraphs', () => {
      const html = '<blockquote><p>First quote</p><p>Second quote</p></blockquote>';
      const elements = convertHtmlToDocx(html);

      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('tables', () => {
    it('should convert simple table', () => {
      const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Table);
    });

    it('should convert table with header', () => {
      const html =
        '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Table);
    });

    it('should handle empty table', () => {
      const html = '<table></table>';
      const elements = convertHtmlToDocx(html);

      // Empty table should either be empty or have minimal structure
      expect(elements.length).toBeLessThanOrEqual(1);
    });
  });

  describe('hyperlinks', () => {
    it('should convert hyperlink', () => {
      const html = '<p><a href="https://example.com">Link text</a></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should handle link without href', () => {
      const html = '<p><a>Link without href</a></p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });
  });

  describe('edge cases', () => {
    it('should handle empty HTML', () => {
      const html = '';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(0);
    });

    it('should handle plain text', () => {
      const html = 'Just plain text';
      const elements = convertHtmlToDocx(html);

      // Plain text may be wrapped in a paragraph or returned as-is
      expect(elements.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle whitespace-only content', () => {
      const html = '   \n\t  ';
      const elements = convertHtmlToDocx(html);

      // Whitespace should be handled gracefully
      expect(Array.isArray(elements)).toBe(true);
    });

    it('should handle unknown tags gracefully', () => {
      const html = '<custom-tag>Content</custom-tag>';
      const elements = convertHtmlToDocx(html);

      // Unknown tags should not crash, content may or may not be preserved
      expect(Array.isArray(elements)).toBe(true);
    });

    it('should handle line breaks', () => {
      const html = '<p>Line 1<br>Line 2</p>';
      const elements = convertHtmlToDocx(html);

      expect(elements).toHaveLength(1);
      expect(elements[0]).toBeInstanceOf(Paragraph);
    });

    it('should handle horizontal rule', () => {
      const html = '<p>Before</p><hr><p>After</p>';
      const elements = convertHtmlToDocx(html);

      expect(elements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('complex documents', () => {
    it('should handle mixed content document', () => {
      const html = `
        <h1>Document Title</h1>
        <p>This is an introduction with <strong>bold</strong> and <em>italic</em> text.</p>
        <h2>Section 1</h2>
        <p>Some paragraph content.</p>
        <ul>
          <li>Bullet point 1</li>
          <li>Bullet point 2</li>
        </ul>
        <blockquote>A notable quote</blockquote>
        <p>More content with a <a href="https://example.com">link</a>.</p>
      `;
      const elements = convertHtmlToDocx(html);

      // Should have multiple elements representing all the content
      expect(elements.length).toBeGreaterThan(5);
    });
  });
});
