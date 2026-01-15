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

const RESEARCH_PATTERNS: Pattern[] = [
  {
    pattern: /\b(find|search\s+for|look\s+up)\s+.*(paper|study|article|research)/i,
    weight: 3,
    description: 'find papers',
  },
  { pattern: /\bcite|citation|reference\b/i, weight: 2, description: 'citation request' },
  {
    pattern: /\brecent\s+(papers?|studies?|research|findings?|publications?)\b/i,
    weight: 3,
    description: 'recent research',
  },
  { pattern: /\bsources?\s+(for|about|on)\b/i, weight: 2, description: 'sources for' },
  { pattern: /\bliterature\s+(review|search|on)\b/i, weight: 3, description: 'literature review' },
  { pattern: /\bpeer[- ]reviewed\b/i, weight: 2, description: 'peer reviewed' },
  { pattern: /\b(doi|pmid|pubmed|arxiv)\b/i, weight: 3, description: 'database reference' },
];

export function detectChatMode(message: string): ModeDetectionResult {
  let editScore = 0;
  let researchScore = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, weight, description } of EDIT_PATTERNS) {
    if (pattern.test(message)) {
      editScore += weight;
      matchedPatterns.push(`edit:${description}`);
    }
  }

  for (const { pattern, weight, description } of RESEARCH_PATTERNS) {
    if (pattern.test(message)) {
      researchScore += weight;
      matchedPatterns.push(`research:${description}`);
    }
  }

  const maxScore = Math.max(editScore, researchScore);
  const confidence: 'high' | 'medium' | 'low' = maxScore >= 5 ? 'high' : maxScore >= 3 ? 'medium' : 'low';

  if (editScore > researchScore && editScore >= 2) {
    return { mode: 'global_edit', confidence, matchedPatterns };
  }
  if (researchScore > editScore && researchScore >= 2) {
    return { mode: 'research', confidence, matchedPatterns };
  }

  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
