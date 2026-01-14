/**
 * Context Builder Module
 *
 * Assembles AI prompts with relevant document context, managing token budgets
 * to ensure prompts fit within Claude's context window.
 *
 * Token Budget Allocation:
 * - Current Document: 60%
 * - Recent AI Operations: 10%
 * - Reference Materials (Vault): Remaining budget
 * - Citations: Metadata only (minimal budget)
 */

import { AI } from '@/lib/constants/ai';

/**
 * Context information for AI prompt assembly.
 */
export interface AIContext {
  /** The current document content being edited */
  documentContent: string;
  /** Relevant vault documents for reference */
  vaultContext: string[];
  /** Recent chat messages for continuity */
  recentChat: string[];
  /** Recent AI operations for context */
  recentOperations?: Array<{
    type: string;
    input: string;
    output: string;
    status: string;
  }>;
  /** Available citations for reference */
  citations?: Array<{
    shortRef: string;
    title: string;
  }>;
}

/**
 * Token budget allocation percentages.
 */
const BUDGET = {
  DOCUMENT: 0.6, // 60% for current document
  OPERATIONS: 0.1, // 10% for recent operations
  // Remaining 30% for vault context and citations
} as const;

/**
 * Truncation indicator shown when content is cut off.
 */
const TRUNCATION_INDICATOR = '[Document truncated]';

/**
 * Estimates the number of tokens in a text string.
 * Uses a simple heuristic of ~4 characters per token.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncates text to fit within a token budget.
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum tokens allowed
 * @returns Truncated text with indicator if truncated
 */
function truncateToTokenBudget(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Reserve space for truncation indicator
  const indicatorTokens = estimateTokens(TRUNCATION_INDICATOR);
  const availableTokens = maxTokens - indicatorTokens;

  if (availableTokens <= 0) {
    return TRUNCATION_INDICATOR;
  }

  // Convert back to characters (4 chars per token)
  const maxChars = availableTokens * 4;
  const truncated = text.slice(0, maxChars);

  return truncated + '\n' + TRUNCATION_INDICATOR;
}

/**
 * Formats an AIContext into a structured prompt string.
 *
 * Builds context with the following sections:
 * - ## Current Document (60% budget)
 * - ## Recent AI Operations (10% budget)
 * - ## Reference Materials (remaining budget)
 * - ## Available Citations
 *
 * @param context - The context to format
 * @returns Formatted context string, or empty string if no content
 */
export function formatContextForPrompt(context: AIContext): string {
  const maxTokens = AI.MAX_CONTEXT_TOKENS;
  const sections: string[] = [];

  // Check if there's any content to format
  const hasDocument = context.documentContent?.trim();
  const hasVault = context.vaultContext?.length > 0;
  const hasChat = context.recentChat?.length > 0;
  const hasOperations = context.recentOperations?.length;
  const hasCitations = context.citations?.length;

  if (!hasDocument && !hasVault && !hasChat && !hasOperations && !hasCitations) {
    return '';
  }

  // Calculate budget allocations
  const documentBudget = Math.floor(maxTokens * BUDGET.DOCUMENT);
  const operationsBudget = Math.floor(maxTokens * BUDGET.OPERATIONS);
  const remainingBudget = maxTokens - documentBudget - operationsBudget;

  // 1. Current Document (60% budget)
  if (hasDocument) {
    const truncatedDoc = truncateToTokenBudget(context.documentContent, documentBudget);
    sections.push(`## Current Document\n\n${truncatedDoc}`);
  }

  // 2. Recent AI Operations (10% budget)
  if (hasOperations && context.recentOperations) {
    const operationsContent = formatOperations(context.recentOperations, operationsBudget);
    if (operationsContent) {
      sections.push(`## Recent AI Operations\n\n${operationsContent}`);
    }
  }

  // 3. Reference Materials (remaining budget, split between vault and chat)
  const vaultBudget = Math.floor(remainingBudget * 0.7); // 70% of remaining
  const chatBudget = Math.floor(remainingBudget * 0.3); // 30% of remaining

  if (hasVault) {
    const vaultContent = formatVaultContext(context.vaultContext, vaultBudget);
    if (vaultContent) {
      sections.push(`## Reference Materials\n\n${vaultContent}`);
    }
  }

  if (hasChat) {
    const chatContent = formatChatHistory(context.recentChat, chatBudget);
    if (chatContent) {
      sections.push(`## Recent Chat History\n\n${chatContent}`);
    }
  }

  // 4. Available Citations (metadata only, minimal budget)
  if (hasCitations && context.citations) {
    const citationsContent = formatCitations(context.citations);
    sections.push(`## Available Citations\n\n${citationsContent}`);
  }

  return sections.join('\n\n');
}

/**
 * Formats recent operations within token budget.
 */
function formatOperations(operations: NonNullable<AIContext['recentOperations']>, maxTokens: number): string {
  const formatted: string[] = [];
  let usedTokens = 0;

  for (const op of operations) {
    const entry = `- ${op.type}: "${truncateString(op.input, 50)}" -> ${op.status}`;
    const entryTokens = estimateTokens(entry);

    if (usedTokens + entryTokens > maxTokens) {
      break;
    }

    formatted.push(entry);
    usedTokens += entryTokens;
  }

  return formatted.join('\n');
}

/**
 * Formats vault context within token budget.
 */
function formatVaultContext(vaultItems: string[], maxTokens: number): string {
  const formatted: string[] = [];
  let usedTokens = 0;

  for (let i = 0; i < vaultItems.length; i++) {
    const item = vaultItems[i];
    const header = `### Reference ${i + 1}\n`;
    const headerTokens = estimateTokens(header);

    if (usedTokens + headerTokens >= maxTokens) {
      break;
    }

    const availableForContent = maxTokens - usedTokens - headerTokens;
    const truncatedContent = truncateToTokenBudget(item, availableForContent);
    const fullEntry = header + truncatedContent;
    const entryTokens = estimateTokens(fullEntry);

    formatted.push(fullEntry);
    usedTokens += entryTokens;

    // If we're getting close to budget, stop adding more items
    if (usedTokens >= maxTokens * 0.9) {
      break;
    }
  }

  return formatted.join('\n\n');
}

/**
 * Formats chat history within token budget.
 */
function formatChatHistory(chatMessages: string[], maxTokens: number): string {
  const formatted: string[] = [];
  let usedTokens = 0;

  // Process most recent messages first (reverse order)
  const reversed = [...chatMessages].reverse();

  for (const message of reversed) {
    const entryTokens = estimateTokens(message);

    if (usedTokens + entryTokens > maxTokens) {
      break;
    }

    formatted.unshift(message); // Add to front to maintain order
    usedTokens += entryTokens;
  }

  return formatted.join('\n');
}

/**
 * Formats citations as a reference list.
 */
function formatCitations(citations: NonNullable<AIContext['citations']>): string {
  return citations.map((c) => `- [${c.shortRef}] ${c.title}`).join('\n');
}

/**
 * Truncates a string to a maximum length with ellipsis.
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Operation type for prompt building.
 */
export type OperationType = 'selection' | 'cursor' | 'global' | 'chat';

/**
 * System instructions for different operation types.
 */
const OPERATION_INSTRUCTIONS: Record<OperationType, string> = {
  selection: `You are helping edit a specific selection of text within a document.
Focus on the selected text while considering the surrounding context.
Return only the replacement text for the selection, without additional explanation.`,

  cursor: `You are helping insert or generate content at the cursor position.
Consider the surrounding context to ensure the generated content flows naturally.
Return only the content to be inserted, without additional explanation.`,

  global: `You are helping make document-wide changes.
Consider the entire document structure and maintain consistency throughout.
Return the complete modified document content.`,

  chat: `You are a helpful writing assistant engaged in a conversation about the document.
Provide clear, helpful responses to questions and suggestions.
When suggesting edits, explain your reasoning.`,
};

/**
 * Builds a complete prompt with context and instructions.
 *
 * Combines system instructions appropriate for the operation type,
 * formatted context, and the user's prompt.
 *
 * @param userPrompt - The user's original prompt/instruction
 * @param context - The context to include
 * @param operationType - The type of operation being performed
 * @returns Complete prompt ready for the AI
 */
export function buildPromptWithContext(userPrompt: string, context: AIContext, operationType: OperationType): string {
  const instructions = OPERATION_INSTRUCTIONS[operationType];
  const formattedContext = formatContextForPrompt(context);

  const parts: string[] = [];

  // 1. System instructions
  parts.push(`# Instructions\n\n${instructions}`);

  // 2. Context (if any)
  if (formattedContext) {
    parts.push(`# Context\n\n${formattedContext}`);
  }

  // 3. User prompt
  parts.push(`# Task\n\n${userPrompt}`);

  return parts.join('\n\n---\n\n');
}
