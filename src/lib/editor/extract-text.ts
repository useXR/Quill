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
 * Preserves paragraph breaks as newlines.
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

  // If this node has children, recursively extract text
  if (Array.isArray(node.content)) {
    const texts = node.content.map((child) => extractTextFromTipTap(child));

    // Add newlines between block-level elements
    if (node.type === 'doc' || node.type === 'paragraph' || node.type === 'heading') {
      return texts.join('') + (node.type !== 'doc' ? '\n' : '');
    }

    return texts.join('');
  }

  return '';
}
