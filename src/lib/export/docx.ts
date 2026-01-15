import { Document as DocxDocument, Packer, Paragraph, TextRun } from 'docx';
import { convertHtmlToDocx } from './html-to-docx';
import { getDocumentStyles, getNumberingConfig, getPageSize, DOCX_STYLES } from './docx-styles';
import type { DocxExportOptions } from './types';

/**
 * Export HTML content to a DOCX buffer
 *
 * @param htmlContent - The HTML content to convert
 * @param options - Export options (title, author, page size, etc.)
 * @returns Promise<Buffer> - The DOCX file as a buffer
 */
export async function exportToDocx(htmlContent: string, options: DocxExportOptions): Promise<Buffer> {
  const { title, author, includeTitle = true, pageSize = 'letter' } = options;

  // Convert HTML to docx elements
  const bodyElements = convertHtmlToDocx(htmlContent);

  // Build the document sections
  const children = [];

  // Add title if requested
  if (includeTitle && title) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: DOCX_STYLES.sizes.h1,
            font: DOCX_STYLES.fonts.heading,
          }),
        ],
        spacing: {
          after: 400, // Extra space after title
        },
      })
    );
  }

  // Add body content
  children.push(...bodyElements);

  // Get page dimensions
  const { width, height } = getPageSize(pageSize);

  // Create the document
  const doc = new DocxDocument({
    creator: author || 'Quill',
    title,
    description: `Document exported from Quill: ${title}`,
    styles: getDocumentStyles(),
    numbering: getNumberingConfig(),
    sections: [
      {
        properties: {
          page: {
            size: {
              width,
              height,
            },
            margin: {
              top: DOCX_STYLES.margins.page,
              right: DOCX_STYLES.margins.page,
              bottom: DOCX_STYLES.margins.page,
              left: DOCX_STYLES.margins.page,
            },
          },
        },
        children,
      },
    ],
  });

  // Generate the document buffer
  const buffer = await Packer.toBuffer(doc);

  return buffer;
}
