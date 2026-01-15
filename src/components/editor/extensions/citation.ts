import { Mark, mergeAttributes } from '@tiptap/core';

export interface CitationAttributes {
  citationId: string;
  displayText: string;
  doi?: string;
  title?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      setCitation: (attributes: CitationAttributes) => ReturnType;
      unsetCitation: () => ReturnType;
    };
  }
}

export const Citation = Mark.create({
  name: 'citation',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-citation-id'),
        renderHTML: (attributes) => ({ 'data-citation-id': attributes.citationId }),
      },
      displayText: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-display-text'),
        renderHTML: (attributes) => ({ 'data-display-text': attributes.displayText }),
      },
      doi: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-doi'),
        renderHTML: (attributes) => (attributes.doi ? { 'data-doi': attributes.doi } : {}),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => (attributes.title ? { 'data-title': attributes.title } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'cite[data-citation-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'cite',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class:
          'citation-mark cursor-pointer text-quill hover:text-quill-dark hover:underline transition-colors duration-150',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCitation:
        (attributes: CitationAttributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetCitation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default Citation;
