export type ChatMode = 'discussion' | 'global_edit' | 'research';

export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

interface Pattern {
  pattern: RegExp;
  weight: number;
  description: string;
}

const EDIT_PATTERNS: Pattern[] = [
  { pattern: /\b(change|modify|update|edit)\s+(?:all|every|each)/i, weight: 3, description: 'bulk change' },
  { pattern: /\bthroughout\b/i, weight: 2, description: 'throughout' },
  { pattern: /\beverywhere\b/i, weight: 2, description: 'everywhere' },
  { pattern: /\ball\s+(sections?|paragraphs?|headings?|sentences?)\b/i, weight: 2, description: 'all sections' },
  { pattern: /\breplace\s+(?:all|every)/i, weight: 3, description: 'replace all' },
  { pattern: /\bremove\s+(?:all|every)/i, weight: 3, description: 'remove all' },
  { pattern: /\bdelete\s+(?:all|every)/i, weight: 3, description: 'delete all' },
  { pattern: /\brewrite\s+(the\s+)?(entire|whole|document)/i, weight: 3, description: 'rewrite document' },
  { pattern: /\bfix\s+(all|every)\s+/i, weight: 2, description: 'fix all' },
];

export function detectChatMode(message: string): ModeDetectionResult {
  let editScore = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, weight, description } of EDIT_PATTERNS) {
    if (pattern.test(message)) {
      editScore += weight;
      matchedPatterns.push(`edit:${description}`);
    }
  }

  const confidence: 'high' | 'medium' | 'low' = editScore >= 5 ? 'high' : editScore >= 3 ? 'medium' : 'low';

  if (editScore >= 2) {
    return { mode: 'global_edit', confidence, matchedPatterns };
  }

  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
