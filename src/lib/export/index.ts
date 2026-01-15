// Types
export type { DocxExportOptions, PdfExportOptions, DocumentWithProject, Document, Project } from './types';

// DOCX Export
export { exportToDocx } from './docx';
export { convertHtmlToDocx } from './html-to-docx';
export { getDocumentStyles, getNumberingConfig, getPageSize, DOCX_STYLES } from './docx-styles';

// PDF Export
export { exportToPdf, escapeHtml, closeBrowser } from './pdf';
export { pdfStyles, footerTemplate } from './pdf-styles';

// TipTap to HTML conversion
export { tiptapToHtml } from './tiptap-to-html';
