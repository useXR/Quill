/**
 * Convert TipTap JSON content to HTML for export.
 * This is a server-side utility that doesn't require TipTap extensions.
 */

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

interface TipTapDocument {
  type: 'doc';
  content?: TipTapNode[];
}

/**
 * Convert TipTap JSON document to HTML string
 */
export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== 'object') {
    return '';
  }

  const typedDoc = doc as TipTapDocument;

  if (typedDoc.type !== 'doc' || !Array.isArray(typedDoc.content)) {
    return '';
  }

  return typedDoc.content.map(nodeToHtml).join('');
}

/**
 * Convert a TipTap node to HTML
 */
function nodeToHtml(node: TipTapNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`;

    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      return `<h${level}>${renderChildren(node)}</h${level}>`;
    }

    case 'text':
      return renderText(node);

    case 'hardBreak':
      return '<br>';

    case 'bulletList':
      return `<ul>${renderChildren(node)}</ul>`;

    case 'orderedList': {
      const start = (node.attrs?.start as number) || 1;
      return start === 1 ? `<ol>${renderChildren(node)}</ol>` : `<ol start="${start}">${renderChildren(node)}</ol>`;
    }

    case 'listItem':
      return `<li>${renderChildren(node)}</li>`;

    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`;

    case 'codeBlock': {
      const language = node.attrs?.language || '';
      const content = renderChildren(node);
      return language
        ? `<pre><code class="language-${language}">${escapeHtml(content)}</code></pre>`
        : `<pre><code>${escapeHtml(content)}</code></pre>`;
    }

    case 'horizontalRule':
      return '<hr>';

    case 'table':
      return `<table>${renderChildren(node)}</table>`;

    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`;

    case 'tableCell':
      return `<td>${renderChildren(node)}</td>`;

    case 'tableHeader':
      return `<th>${renderChildren(node)}</th>`;

    case 'image': {
      const src = node.attrs?.src as string;
      const alt = (node.attrs?.alt as string) || '';
      const title = (node.attrs?.title as string) || '';
      if (!src) return '';
      return title
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title)}">`
        : `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
    }

    case 'citation': {
      const citationId = node.attrs?.citationId as string;
      const number = node.attrs?.number as number;
      return `<sup data-citation-id="${citationId}">[${number || '?'}]</sup>`;
    }

    default:
      // For unknown nodes, try to render children
      return renderChildren(node);
  }
}

/**
 * Render child nodes to HTML
 */
function renderChildren(node: TipTapNode): string {
  if (!node.content || !Array.isArray(node.content)) {
    return '';
  }
  return node.content.map(nodeToHtml).join('');
}

/**
 * Render a text node with marks applied
 */
function renderText(node: TipTapNode): string {
  if (!node.text) {
    return '';
  }

  let text = escapeHtml(node.text);

  if (!node.marks || node.marks.length === 0) {
    return text;
  }

  // Apply marks in order
  for (const mark of node.marks) {
    text = applyMark(text, mark);
  }

  return text;
}

/**
 * Apply a mark to text
 */
function applyMark(text: string, mark: TipTapMark): string {
  switch (mark.type) {
    case 'bold':
      return `<strong>${text}</strong>`;

    case 'italic':
      return `<em>${text}</em>`;

    case 'underline':
      return `<u>${text}</u>`;

    case 'strike':
      return `<s>${text}</s>`;

    case 'code':
      return `<code>${text}</code>`;

    case 'link': {
      const href = mark.attrs?.href as string;
      const target = mark.attrs?.target as string;
      const rel = mark.attrs?.rel as string;

      let linkHtml = `<a href="${escapeHtml(href || '')}"`;
      if (target) linkHtml += ` target="${escapeHtml(target)}"`;
      if (rel) linkHtml += ` rel="${escapeHtml(rel)}"`;
      linkHtml += `>${text}</a>`;
      return linkHtml;
    }

    case 'highlight':
      return `<mark>${text}</mark>`;

    case 'textStyle': {
      const color = mark.attrs?.color as string;
      if (color) {
        return `<span style="color: ${escapeHtml(color)}">${text}</span>`;
      }
      return text;
    }

    default:
      return text;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
