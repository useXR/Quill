/**
 * Page layout constants for PDF export and page estimation.
 * Based on US Letter size (8.5" x 11") at 96 DPI with 1" margins.
 */
export const PAGE = {
  // US Letter dimensions at 96 DPI
  WIDTH_PX: 816, // 8.5 inches
  HEIGHT_PX: 1056, // 11 inches
  MARGIN_PX: 96, // 1 inch

  // Content area (page minus margins)
  CONTENT_WIDTH_PX: 624, // 6.5 inches
  CONTENT_HEIGHT_PX: 864, // 9 inches

  // Typography (must match between editor and PDF export)
  FONT_FAMILY: "'Libre Baskerville', Georgia, serif",
  FONT_SIZE_PT: 12,
  LINE_HEIGHT: 1.6,
};
