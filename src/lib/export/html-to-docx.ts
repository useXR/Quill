import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ExternalHyperlink,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
  IRunOptions,
} from 'docx';
import { parse, HTMLElement, TextNode, Node } from 'node-html-parser';

type DocxElement = Paragraph | Table;

interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  link?: string;
}

/**
 * Convert HTML content to docx elements (Paragraphs, Tables, etc.)
 */
export function convertHtmlToDocx(html: string): DocxElement[] {
  if (!html || html.trim() === '') {
    return [];
  }

  const root = parse(html, {
    lowerCaseTagName: true,
    comment: false,
  });

  const elements: DocxElement[] = [];
  processNodes(root.childNodes, elements, {});

  return elements;
}

/**
 * Process an array of nodes and add converted elements to the result array
 */
function processNodes(nodes: Node[], elements: DocxElement[], formatting: TextFormatting): void {
  for (const node of nodes) {
    processNode(node, elements, formatting);
  }
}

/**
 * Process a single node and add its converted element(s) to the result array
 */
function processNode(node: Node, elements: DocxElement[], formatting: TextFormatting): void {
  if (node instanceof TextNode) {
    // Text nodes are handled by their parent elements
    return;
  }

  if (!(node instanceof HTMLElement)) {
    return;
  }

  const tagName = node.tagName?.toLowerCase();

  switch (tagName) {
    case 'p':
      elements.push(createParagraph(node, formatting));
      break;

    case 'h1':
      elements.push(createHeading(node, HeadingLevel.HEADING_1, formatting));
      break;

    case 'h2':
      elements.push(createHeading(node, HeadingLevel.HEADING_2, formatting));
      break;

    case 'h3':
      elements.push(createHeading(node, HeadingLevel.HEADING_3, formatting));
      break;

    case 'h4':
      elements.push(createHeading(node, HeadingLevel.HEADING_4, formatting));
      break;

    case 'h5':
      elements.push(createHeading(node, HeadingLevel.HEADING_5, formatting));
      break;

    case 'h6':
      elements.push(createHeading(node, HeadingLevel.HEADING_6, formatting));
      break;

    case 'ul':
      processListItems(node, elements, 'bullet', formatting);
      break;

    case 'ol':
      processListItems(node, elements, 'number', formatting);
      break;

    case 'blockquote':
      processBlockquote(node, elements, formatting);
      break;

    case 'table':
      const table = createTable(node, formatting);
      if (table) {
        elements.push(table);
      }
      break;

    case 'hr':
      elements.push(createHorizontalRule());
      break;

    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
    case 'nav':
    case 'aside':
      // Container elements - process children
      processNodes(node.childNodes, elements, formatting);
      break;

    case 'br':
      // Line breaks are handled inline
      break;

    default:
      // For unknown elements, try to process children
      processNodes(node.childNodes, elements, formatting);
      break;
  }
}

/**
 * Create a paragraph element from an HTML paragraph node
 */
function createParagraph(node: HTMLElement, formatting: TextFormatting): Paragraph {
  const children = extractTextRuns(node, formatting);

  return new Paragraph({
    children,
    spacing: {
      after: 200, // Space after paragraph
      line: 276, // 1.15 line height (276 = 1.15 * 240)
    },
  });
}

/**
 * Create a heading element with appropriate style
 */
function createHeading(
  node: HTMLElement,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  formatting: TextFormatting
): Paragraph {
  const children = extractTextRuns(node, formatting);

  return new Paragraph({
    children,
    heading: level,
    spacing: {
      before: 240,
      after: 120,
    },
  });
}

/**
 * Process list items (ul/ol)
 */
function processListItems(
  node: HTMLElement,
  elements: DocxElement[],
  type: 'bullet' | 'number',
  formatting: TextFormatting
): void {
  const items = node.querySelectorAll('li');

  items.forEach((item) => {
    const children = extractTextRuns(item as HTMLElement, formatting);

    const paragraph = new Paragraph({
      children,
      bullet: type === 'bullet' ? { level: 0 } : undefined,
      numbering: type === 'number' ? { reference: 'default-numbering', level: 0 } : undefined,
      spacing: {
        after: 100,
      },
    });

    elements.push(paragraph);
  });
}

/**
 * Process blockquote element
 */
function processBlockquote(node: HTMLElement, elements: DocxElement[], formatting: TextFormatting): void {
  // Check if blockquote contains paragraphs
  const paragraphs = node.querySelectorAll('p');

  if (paragraphs.length > 0) {
    paragraphs.forEach((p) => {
      const children = extractTextRuns(p as HTMLElement, formatting);
      elements.push(
        new Paragraph({
          children,
          indent: {
            left: convertInchesToTwip(0.5),
          },
          spacing: {
            after: 200,
          },
          style: 'Quote',
        })
      );
    });
  } else {
    // Blockquote with direct text content
    const children = extractTextRuns(node, formatting);
    elements.push(
      new Paragraph({
        children,
        indent: {
          left: convertInchesToTwip(0.5),
        },
        spacing: {
          after: 200,
        },
        style: 'Quote',
      })
    );
  }
}

/**
 * Create a table from HTML table element
 */
function createTable(node: HTMLElement, formatting: TextFormatting): Table | null {
  const rows: TableRow[] = [];

  // Get all rows (from thead and tbody)
  const headerRows = node.querySelectorAll('thead tr');
  const bodyRows = node.querySelectorAll('tbody tr');
  const directRows = node.querySelectorAll(':scope > tr');

  const allRows = [...headerRows, ...bodyRows, ...(directRows.length > 0 ? directRows : [])];

  if (allRows.length === 0) {
    return null;
  }

  allRows.forEach((row) => {
    const cells: TableCell[] = [];
    const cellElements = row.querySelectorAll('td, th');

    cellElements.forEach((cell) => {
      const isHeader = (cell as HTMLElement).tagName?.toLowerCase() === 'th';
      const children = extractTextRuns(cell as HTMLElement, formatting);

      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children,
              alignment: AlignmentType.LEFT,
            }),
          ],
          shading: isHeader
            ? {
                fill: 'E0E0E0',
              }
            : undefined,
        })
      );
    });

    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  });

  if (rows.length === 0) {
    return null;
  }

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * Create a horizontal rule representation
 */
function createHorizontalRule(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: 'auto',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: {
      before: 200,
      after: 200,
    },
  });
}

/**
 * Extract TextRun elements from an HTML element, preserving formatting
 */
function extractTextRuns(node: HTMLElement, parentFormatting: TextFormatting): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  function processInlineNode(inlineNode: Node, formatting: TextFormatting): void {
    if (inlineNode instanceof TextNode) {
      const text = inlineNode.text;
      if (text) {
        const runOptions: IRunOptions = {
          text,
          bold: formatting.bold,
          italics: formatting.italic,
          underline: formatting.underline ? {} : undefined,
          font: formatting.code ? { name: 'Courier New' } : undefined,
        };

        if (formatting.link) {
          runs.push(
            new ExternalHyperlink({
              children: [
                new TextRun({
                  ...runOptions,
                  style: 'Hyperlink',
                }),
              ],
              link: formatting.link,
            })
          );
        } else {
          runs.push(new TextRun(runOptions));
        }
      }
      return;
    }

    if (!(inlineNode instanceof HTMLElement)) {
      return;
    }

    const tagName = inlineNode.tagName?.toLowerCase();
    const newFormatting = { ...formatting };

    switch (tagName) {
      case 'strong':
      case 'b':
        newFormatting.bold = true;
        break;
      case 'em':
      case 'i':
        newFormatting.italic = true;
        break;
      case 'u':
        newFormatting.underline = true;
        break;
      case 'code':
        newFormatting.code = true;
        break;
      case 'a':
        const href = inlineNode.getAttribute('href');
        if (href) {
          newFormatting.link = href;
        }
        break;
      case 'br':
        runs.push(new TextRun({ break: 1 }));
        return;
      case 'span':
      case 'mark':
        // Pass through spans and marks
        break;
      default:
        // Unknown inline element - process children with current formatting
        break;
    }

    for (const child of inlineNode.childNodes) {
      processInlineNode(child, newFormatting);
    }
  }

  for (const child of node.childNodes) {
    processInlineNode(child, parentFormatting);
  }

  return runs;
}
