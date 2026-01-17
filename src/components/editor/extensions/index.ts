import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { Markdown } from '@tiptap/markdown';
import { SelectionTracker } from './selection-tracker';
import { Citation } from './citation';

export interface ExtensionConfig {
  placeholder?: string;
  characterLimit?: number;
}

export function createExtensions(config: ExtensionConfig = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false, // We use our own Link extension with custom config
    }),
    Placeholder.configure({
      placeholder: config.placeholder || 'Start writing your grant proposal...',
    }),
    CharacterCount.configure({
      limit: config.characterLimit,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-blue-600 underline' },
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Markdown,
    SelectionTracker,
    Citation,
  ];
}

// Re-export selection tracker utilities
export { SelectionTracker } from './selection-tracker';
export type { SelectionState, SelectionListener, SelectionTrackerStorage } from './selection-tracker';

// Re-export citation extension and types
export { Citation } from './citation';
export type { CitationAttributes } from './citation';
