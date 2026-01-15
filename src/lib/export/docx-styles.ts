import { IStylesOptions, INumberingOptions, convertInchesToTwip, UnderlineType, LevelFormat } from 'docx';

/**
 * Document style constants based on design system:
 * - Body Font: Times New Roman (closest to Libre Baskerville in Word)
 * - Heading Font: Arial (clean sans-serif)
 * - Line Height: 1.6
 * - Page Margins: 1 inch
 */
export const DOCX_STYLES = {
  fonts: {
    body: 'Times New Roman',
    heading: 'Arial',
    mono: 'Courier New',
  },
  sizes: {
    body: 24, // 12pt (half-points)
    h1: 48, // 24pt
    h2: 36, // 18pt
    h3: 28, // 14pt
    h4: 24, // 12pt
    h5: 22, // 11pt
    h6: 20, // 10pt
  },
  spacing: {
    lineHeight: 384, // 1.6 * 240 twips
    paragraphAfter: 200, // ~10pt after paragraphs
    headingBefore: 240, // ~12pt before headings
    headingAfter: 120, // ~6pt after headings
  },
  margins: {
    page: convertInchesToTwip(1), // 1 inch margins
  },
  colors: {
    link: '0000FF',
    quoteBar: '808080',
    tableHeaderBg: 'E0E0E0',
  },
} as const;

/**
 * Get the document styles configuration for a DOCX file
 */
export function getDocumentStyles(): IStylesOptions {
  return {
    default: {
      document: {
        run: {
          font: DOCX_STYLES.fonts.body,
          size: DOCX_STYLES.sizes.body,
        },
        paragraph: {
          spacing: {
            line: DOCX_STYLES.spacing.lineHeight,
            after: DOCX_STYLES.spacing.paragraphAfter,
          },
        },
      },
      heading1: {
        run: {
          font: DOCX_STYLES.fonts.heading,
          size: DOCX_STYLES.sizes.h1,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: DOCX_STYLES.spacing.headingBefore,
            after: DOCX_STYLES.spacing.headingAfter,
          },
        },
      },
      heading2: {
        run: {
          font: DOCX_STYLES.fonts.heading,
          size: DOCX_STYLES.sizes.h2,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: DOCX_STYLES.spacing.headingBefore,
            after: DOCX_STYLES.spacing.headingAfter,
          },
        },
      },
      heading3: {
        run: {
          font: DOCX_STYLES.fonts.heading,
          size: DOCX_STYLES.sizes.h3,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: DOCX_STYLES.spacing.headingBefore,
            after: DOCX_STYLES.spacing.headingAfter,
          },
        },
      },
      heading4: {
        run: {
          font: DOCX_STYLES.fonts.heading,
          size: DOCX_STYLES.sizes.h4,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: DOCX_STYLES.spacing.headingBefore,
            after: DOCX_STYLES.spacing.headingAfter,
          },
        },
      },
      heading5: {
        run: {
          font: DOCX_STYLES.fonts.heading,
          size: DOCX_STYLES.sizes.h5,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: DOCX_STYLES.spacing.headingBefore,
            after: DOCX_STYLES.spacing.headingAfter,
          },
        },
      },
      heading6: {
        run: {
          font: DOCX_STYLES.fonts.heading,
          size: DOCX_STYLES.sizes.h6,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: DOCX_STYLES.spacing.headingBefore,
            after: DOCX_STYLES.spacing.headingAfter,
          },
        },
      },
      hyperlink: {
        run: {
          color: DOCX_STYLES.colors.link,
          underline: {
            type: UnderlineType.SINGLE,
          },
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Quote',
        name: 'Quote',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          italics: true,
          color: '666666',
        },
        paragraph: {
          indent: {
            left: convertInchesToTwip(0.5),
          },
          spacing: {
            before: 100,
            after: 100,
          },
        },
      },
      {
        id: 'Code',
        name: 'Code',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          font: DOCX_STYLES.fonts.mono,
          size: 20, // 10pt for code
        },
        paragraph: {
          spacing: {
            before: 100,
            after: 100,
          },
        },
      },
    ],
    characterStyles: [
      {
        id: 'Hyperlink',
        name: 'Hyperlink',
        basedOn: 'DefaultParagraphFont',
        run: {
          color: DOCX_STYLES.colors.link,
          underline: {
            type: UnderlineType.SINGLE,
          },
        },
      },
    ],
  };
}

/**
 * Get the numbering configuration for lists
 */
export function getNumberingConfig(): INumberingOptions {
  return {
    config: [
      {
        reference: 'default-numbering',
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: 'start',
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
          {
            level: 1,
            format: LevelFormat.LOWER_LETTER,
            text: '%2.',
            alignment: 'start',
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
          {
            level: 2,
            format: LevelFormat.LOWER_ROMAN,
            text: '%3.',
            alignment: 'start',
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
        ],
      },
      {
        reference: 'default-bullet',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022', // Bullet character
            alignment: 'start',
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: '\u25E6', // White bullet
            alignment: 'start',
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
          {
            level: 2,
            format: LevelFormat.BULLET,
            text: '\u25AA', // Black small square
            alignment: 'start',
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
        ],
      },
    ],
  };
}

/**
 * Get page size configuration
 */
export function getPageSize(size: 'letter' | 'a4'): { width: number; height: number } {
  if (size === 'a4') {
    return {
      width: convertInchesToTwip(8.27), // A4 width
      height: convertInchesToTwip(11.69), // A4 height
    };
  }

  // Default: US Letter
  return {
    width: convertInchesToTwip(8.5),
    height: convertInchesToTwip(11),
  };
}
