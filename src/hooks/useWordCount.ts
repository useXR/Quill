'use client';

import { useState, useCallback, useMemo } from 'react';
import { EDITOR } from '@/lib/constants';

export interface UseWordCountOptions {
  wordLimit?: number;
  charLimit?: number;
  warningThreshold?: number; // percentage (default from constants)
}

export interface UseWordCountReturn {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  percentage: number | null;
  charPercentage: number | null;
  isNearLimit: boolean;
  isOverLimit: boolean;
  isCharNearLimit: boolean;
  isCharOverLimit: boolean;
  updateCount: (text: string) => void;
}

/**
 * Strip HTML tags and return plain text.
 * Uses DOMParser when available (browser), regex fallback otherwise (tests/SSR).
 */
function stripHtml(html: string): string {
  // In browser environment, use DOMParser for more accurate parsing
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch {
      // Fallback to regex if DOMParser fails
    }
  }

  // Regex fallback for Node.js/test environment
  return html
    .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/gi, ' ') // Replace &nbsp; with space
    .replace(/&amp;/gi, '&') // Decode &amp;
    .replace(/&lt;/gi, '<') // Decode &lt;
    .replace(/&gt;/gi, '>') // Decode &gt;
    .replace(/&quot;/gi, '"'); // Decode &quot;
}

/**
 * Count words in text.
 * Handles empty strings, whitespace, and multiple spaces between words.
 */
function countWords(text: string): number {
  const plainText = stripHtml(text).trim();
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
}

/**
 * Count characters in text (with and without spaces).
 */
function countChars(text: string): { withSpaces: number; withoutSpaces: number } {
  const plainText = stripHtml(text);
  return {
    withSpaces: plainText.length,
    withoutSpaces: plainText.replace(/\s/g, '').length,
  };
}

/**
 * Hook to track word and character counts with optional limits.
 */
export function useWordCount(options: UseWordCountOptions = {}): UseWordCountReturn {
  const { wordLimit, charLimit, warningThreshold = EDITOR.DEFAULT_WORD_WARNING_THRESHOLD } = options;

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [charCountNoSpaces, setCharCountNoSpaces] = useState(0);

  const updateCount = useCallback((text: string) => {
    const words = countWords(text);
    const chars = countChars(text);

    setWordCount(words);
    setCharCount(chars.withSpaces);
    setCharCountNoSpaces(chars.withoutSpaces);
  }, []);

  const percentage = useMemo(() => {
    if (wordLimit == null || wordLimit <= 0) return null;
    return Math.round((wordCount / wordLimit) * 100);
  }, [wordCount, wordLimit]);

  const charPercentage = useMemo(() => {
    if (charLimit == null || charLimit <= 0) return null;
    return Math.round((charCount / charLimit) * 100);
  }, [charCount, charLimit]);

  const isOverLimit = useMemo(() => {
    if (wordLimit == null) return false;
    return wordCount > wordLimit;
  }, [wordCount, wordLimit]);

  const isNearLimit = useMemo(() => {
    if (percentage == null) return false;
    return percentage >= warningThreshold;
  }, [percentage, warningThreshold]);

  const isCharOverLimit = useMemo(() => {
    if (charLimit == null) return false;
    return charCount > charLimit;
  }, [charCount, charLimit]);

  const isCharNearLimit = useMemo(() => {
    if (charPercentage == null) return false;
    return charPercentage >= warningThreshold;
  }, [charPercentage, warningThreshold]);

  return {
    wordCount,
    charCount,
    charCountNoSpaces,
    percentage,
    charPercentage,
    isNearLimit,
    isOverLimit,
    isCharNearLimit,
    isCharOverLimit,
    updateCount,
  };
}
