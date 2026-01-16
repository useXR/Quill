/**
 * PDF Export Styles
 *
 * CSS styles for PDF document generation using Puppeteer.
 * Typography matches the editor for accurate page count estimation:
 * - Body Font: Libre Baskerville (same as editor)
 * - Font Size: 12pt body, 18pt/14pt/12pt heading hierarchy
 * - Line Height: 1.6
 * - Color: #000 for maximum print contrast
 * - Max Width: 6.5in content area
 * - Margins: 1 inch
 */

export const pdfStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

  body {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    max-width: 6.5in;
    margin: 0 auto;
    padding: 1in;
  }
  h1 { font-size: 18pt; font-weight: bold; margin: 24pt 0 12pt; }
  h2 { font-size: 14pt; font-weight: bold; margin: 18pt 0 10pt; }
  h3 { font-size: 12pt; font-weight: bold; margin: 14pt 0 8pt; }
  p { margin: 0 0 12pt; text-align: justify; }
  ul, ol { margin: 0 0 12pt; padding-left: 24pt; }
  li { margin: 4pt 0; }
  blockquote {
    margin: 12pt 24pt;
    padding-left: 12pt;
    border-left: 3pt solid #ccc;
    font-style: italic;
  }
  code {
    font-family: 'Courier New', monospace;
    background: #f4f4f4;
    padding: 2pt 4pt;
  }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
  th, td { border: 1pt solid #000; padding: 6pt; text-align: left; }
  @media print { body { margin: 0; padding: 0; } }
  @page { size: letter; margin: 1in; }
`;

/**
 * Footer template for PDF page numbers.
 * Uses Puppeteer's built-in CSS classes for page numbering.
 */
export const footerTemplate = `
  <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
    <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>
`;
