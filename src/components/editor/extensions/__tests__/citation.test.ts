import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Citation } from '../citation';

function createTestEditor(content = '<p>Test content</p>') {
  return new Editor({
    extensions: [StarterKit, Citation],
    content,
  });
}

describe('Citation Extension', () => {
  it('should register citation mark', () => {
    const editor = createTestEditor();
    expect(editor.extensionManager.extensions.find((e) => e.name === 'citation')).toBeDefined();
    editor.destroy();
  });

  it('should add citation mark with attributes', () => {
    const editor = createTestEditor('<p>Test content</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setCitation({
      citationId: 'cite-123',
      displayText: '[1]',
      doi: '10.1000/test',
      title: 'Test Paper',
    });
    const html = editor.getHTML();
    expect(html).toContain('data-citation-id="cite-123"');
    expect(html).toContain('data-display-text="[1]"');
    editor.destroy();
  });

  it('should parse citation from HTML', () => {
    const html = '<p><cite data-citation-id="abc" data-display-text="[1]">[1]</cite></p>';
    const editor = createTestEditor(html);
    const json = editor.getJSON();
    const citeMark = json.content?.[0]?.content?.[0]?.marks?.[0];
    expect(citeMark?.type).toBe('citation');
    expect(citeMark?.attrs?.citationId).toBe('abc');
    editor.destroy();
  });

  it('should render citation as cite element with classes', () => {
    const editor = createTestEditor('<p>Test</p>');
    editor.commands.selectAll();
    editor.commands.setCitation({ citationId: 'test', displayText: '[1]' });
    const html = editor.getHTML();
    expect(html).toContain('<cite');
    expect(html).toContain('class=');
    editor.destroy();
  });

  it('should provide unsetCitation command', () => {
    const editor = createTestEditor('<p><cite data-citation-id="test">[1]</cite></p>');
    editor.commands.selectAll();
    editor.commands.unsetCitation();
    const html = editor.getHTML();
    expect(html).not.toContain('cite');
    editor.destroy();
  });
});
