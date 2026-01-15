/**
 * Extract plain text from TipTap JSON content.
 * Used to populate content_text for AI chat context.
 */

interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
}

/**
 * Recursively extracts plain text from a TipTap JSON document.
 * Preserves paragraph breaks as double newlines for standard plain text formatting.
 */
export function extractTextFromTipTap(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  const node = content as TipTapNode;

  // If this node has text, return it
  if (node.text) {
    return node.text;
  }

  // Handle hard breaks (line breaks within a paragraph)
  if (node.type === 'hardBreak') {
    return '\n';
  }

  // If this node has children, recursively extract text
  if (Array.isArray(node.content)) {
    // For doc nodes, join paragraphs with double newlines
    if (node.type === 'doc') {
      return node.content
        .map((child) => extractTextFromTipTap(child))
        .filter((text) => text.length > 0)
        .join('\n\n');
    }

    // For paragraphs and headings, just concatenate children
    const texts = node.content.map((child) => extractTextFromTipTap(child));
    return texts.join('');
  }

  return '';
}
