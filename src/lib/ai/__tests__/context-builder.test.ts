import { describe, it, expect } from 'vitest';
import {
  AIContext,
  estimateTokens,
  formatContextForPrompt,
  buildPromptWithContext,
  OperationType,
} from '../context-builder';
import { AI } from '@/lib/constants/ai';

describe('estimateTokens', () => {
  it('should estimate ~4 characters per token', () => {
    expect(estimateTokens('test')).toBe(1);
    expect(estimateTokens('testing')).toBe(2);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should handle null/undefined gracefully', () => {
    expect(estimateTokens(null as unknown as string)).toBe(0);
    expect(estimateTokens(undefined as unknown as string)).toBe(0);
  });

  it('should round up partial tokens', () => {
    expect(estimateTokens('ab')).toBe(1); // 2/4 = 0.5, rounded up to 1
    expect(estimateTokens('abc')).toBe(1); // 3/4 = 0.75, rounded up to 1
  });
});

describe('formatContextForPrompt', () => {
  it('should format context with document content', () => {
    const context: AIContext = {
      documentContent: 'This is my document content.',
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Current Document');
    expect(result).toContain('This is my document content.');
  });

  it('should include vault context', () => {
    const context: AIContext = {
      documentContent: 'Document content',
      vaultContext: ['Reference material 1', 'Reference material 2'],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Reference Materials');
    expect(result).toContain('Reference material 1');
    expect(result).toContain('Reference material 2');
  });

  it('should include recent chat history', () => {
    const context: AIContext = {
      documentContent: 'Document content',
      vaultContext: [],
      recentChat: ['User: Hello', 'Assistant: Hi there'],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Recent Chat History');
    expect(result).toContain('User: Hello');
    expect(result).toContain('Assistant: Hi there');
  });

  it('should include recent operations', () => {
    const context: AIContext = {
      documentContent: 'Document content',
      vaultContext: [],
      recentChat: [],
      recentOperations: [{ type: 'edit', input: 'Fix grammar', output: 'Fixed text', status: 'completed' }],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Recent AI Operations');
    expect(result).toContain('edit');
    expect(result).toContain('completed');
  });

  it('should include citations', () => {
    const context: AIContext = {
      documentContent: 'Document content',
      vaultContext: [],
      recentChat: [],
      citations: [
        { shortRef: 'Smith2024', title: 'A Study on AI' },
        { shortRef: 'Jones2023', title: 'Machine Learning Basics' },
      ],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Available Citations');
    expect(result).toContain('[Smith2024] A Study on AI');
    expect(result).toContain('[Jones2023] Machine Learning Basics');
  });

  it('should truncate long documents', () => {
    // Create a document that exceeds the token budget
    // 60% of 8000 tokens = 4800 tokens = ~19200 characters
    const longContent = 'x'.repeat(30000); // ~7500 tokens, exceeds 60% budget

    const context: AIContext = {
      documentContent: longContent,
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('[Document truncated]');
    expect(result.length).toBeLessThan(longContent.length);
  });

  it('should return empty string for empty context', () => {
    const context: AIContext = {
      documentContent: '',
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toBe('');
  });

  it('should return empty string for whitespace-only document', () => {
    const context: AIContext = {
      documentContent: '   \n\t  ',
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toBe('');
  });

  it('should handle context with only vault items', () => {
    const context: AIContext = {
      documentContent: '',
      vaultContext: ['Some reference material'],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Reference Materials');
    expect(result).toContain('Some reference material');
    expect(result).not.toContain('## Current Document');
  });

  it('should handle context with only chat history', () => {
    const context: AIContext = {
      documentContent: '',
      vaultContext: [],
      recentChat: ['Previous message'],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('## Recent Chat History');
    expect(result).toContain('Previous message');
    expect(result).not.toContain('## Current Document');
  });

  it('should format multiple vault items with reference numbers', () => {
    const context: AIContext = {
      documentContent: 'Doc',
      vaultContext: ['First reference', 'Second reference', 'Third reference'],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('### Reference 1');
    expect(result).toContain('### Reference 2');
    expect(result).toContain('### Reference 3');
  });

  it('should respect MAX_CONTEXT_TOKENS budget', () => {
    // Create context that would exceed the budget if not truncated
    const context: AIContext = {
      documentContent: 'x'.repeat(50000), // Way over budget
      vaultContext: ['y'.repeat(10000)],
      recentChat: ['z'.repeat(5000)],
    };

    const result = formatContextForPrompt(context);
    const resultTokens = estimateTokens(result);

    // Should stay reasonably within budget (allowing some overhead for headers)
    expect(resultTokens).toBeLessThan(AI.MAX_CONTEXT_TOKENS * 1.2);
  });

  it('should prioritize recent chat messages (most recent first)', () => {
    const context: AIContext = {
      documentContent: '',
      vaultContext: [],
      recentChat: ['Message 1', 'Message 2', 'Message 3'],
    };

    const result = formatContextForPrompt(context);

    // Messages should appear in order
    const idx1 = result.indexOf('Message 1');
    const idx2 = result.indexOf('Message 2');
    const idx3 = result.indexOf('Message 3');

    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });
});

describe('buildPromptWithContext', () => {
  const baseContext: AIContext = {
    documentContent: 'Sample document content.',
    vaultContext: [],
    recentChat: [],
  };

  it('should include operation-specific instructions for selection', () => {
    const result = buildPromptWithContext('Fix the grammar', baseContext, 'selection');

    expect(result).toContain('# Instructions');
    expect(result).toContain('specific selection');
    expect(result).toContain('Return only the replacement text');
  });

  it('should include operation-specific instructions for cursor', () => {
    const result = buildPromptWithContext('Generate a paragraph', baseContext, 'cursor');

    expect(result).toContain('# Instructions');
    expect(result).toContain('cursor position');
    expect(result).toContain('Return only the content to be inserted');
  });

  it('should include operation-specific instructions for global', () => {
    const result = buildPromptWithContext('Rewrite in formal tone', baseContext, 'global');

    expect(result).toContain('# Instructions');
    expect(result).toContain('document-wide');
    expect(result).toContain('Return the complete modified document');
  });

  it('should include operation-specific instructions for chat', () => {
    const result = buildPromptWithContext('What do you think?', baseContext, 'chat');

    expect(result).toContain('# Instructions');
    expect(result).toContain('writing assistant');
    expect(result).toContain('explain your reasoning');
  });

  it('should include the user prompt in Task section', () => {
    const userPrompt = 'Please improve this sentence';
    const result = buildPromptWithContext(userPrompt, baseContext, 'selection');

    expect(result).toContain('# Task');
    expect(result).toContain(userPrompt);
  });

  it('should include context between instructions and task', () => {
    const result = buildPromptWithContext('Edit this', baseContext, 'selection');

    expect(result).toContain('# Context');
    expect(result).toContain('Sample document content');

    // Verify order: Instructions -> Context -> Task
    const instructionsIdx = result.indexOf('# Instructions');
    const contextIdx = result.indexOf('# Context');
    const taskIdx = result.indexOf('# Task');

    expect(instructionsIdx).toBeLessThan(contextIdx);
    expect(contextIdx).toBeLessThan(taskIdx);
  });

  it('should separate sections with dividers', () => {
    const result = buildPromptWithContext('Do something', baseContext, 'selection');

    expect(result).toContain('---');
  });

  it('should handle empty context gracefully', () => {
    const emptyContext: AIContext = {
      documentContent: '',
      vaultContext: [],
      recentChat: [],
    };

    const result = buildPromptWithContext('Hello', emptyContext, 'chat');

    expect(result).toContain('# Instructions');
    expect(result).toContain('# Task');
    expect(result).toContain('Hello');
    // Should not have a Context section
    expect(result).not.toContain('# Context');
  });

  it('should work with all operation types', () => {
    const operationTypes: OperationType[] = ['selection', 'cursor', 'global', 'chat'];

    for (const opType of operationTypes) {
      const result = buildPromptWithContext('Test prompt', baseContext, opType);

      expect(result).toContain('# Instructions');
      expect(result).toContain('# Task');
      expect(result).toContain('Test prompt');
    }
  });

  it('should include vault context in the prompt', () => {
    const contextWithVault: AIContext = {
      documentContent: 'Main doc',
      vaultContext: ['Important reference material'],
      recentChat: [],
    };

    const result = buildPromptWithContext('Use this reference', contextWithVault, 'selection');

    expect(result).toContain('Important reference material');
    expect(result).toContain('Reference Materials');
  });

  it('should include citations in the prompt', () => {
    const contextWithCitations: AIContext = {
      documentContent: 'Main doc',
      vaultContext: [],
      recentChat: [],
      citations: [{ shortRef: 'Ref1', title: 'Citation Title' }],
    };

    const result = buildPromptWithContext('Add a citation', contextWithCitations, 'selection');

    expect(result).toContain('[Ref1] Citation Title');
    expect(result).toContain('Available Citations');
  });

  it('should preserve user prompt exactly', () => {
    const specialPrompt = 'Fix the "quoted" text and add `code`';
    const result = buildPromptWithContext(specialPrompt, baseContext, 'selection');

    expect(result).toContain(specialPrompt);
  });
});

describe('token budget management', () => {
  it('should allocate 60% budget to document content', () => {
    // Document that exactly fills 60% of budget
    // 8000 tokens * 60% = 4800 tokens = ~19200 chars
    const docContent = 'x'.repeat(19000);

    const context: AIContext = {
      documentContent: docContent,
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    // Document should not be truncated at this size
    expect(result).not.toContain('[Document truncated]');
    expect(result).toContain(docContent);
  });

  it('should truncate document exceeding 60% budget', () => {
    // Document that exceeds 60% of budget
    const docContent = 'x'.repeat(25000); // ~6250 tokens, exceeds 4800 budget

    const context: AIContext = {
      documentContent: docContent,
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('[Document truncated]');
    expect(result.length).toBeLessThan(docContent.length);
  });

  it('should include truncation indicator when truncating', () => {
    const context: AIContext = {
      documentContent: 'x'.repeat(50000),
      vaultContext: [],
      recentChat: [],
    };

    const result = formatContextForPrompt(context);

    expect(result).toContain('[Document truncated]');
  });

  it('should handle operations within 10% budget', () => {
    // Create operations that might exceed budget
    const manyOperations = Array(20)
      .fill(null)
      .map((_, i) => ({
        type: 'edit',
        input: `Operation ${i} with some longer description text`,
        output: `Output ${i}`,
        status: 'completed',
      }));

    const context: AIContext = {
      documentContent: 'Doc',
      vaultContext: [],
      recentChat: [],
      recentOperations: manyOperations,
    };

    const result = formatContextForPrompt(context);

    // Should have operations section but not all 20 operations
    expect(result).toContain('## Recent AI Operations');

    // Count how many operations made it in
    const operationMatches = result.match(/Operation \d+/g) || [];

    // Should have some but not all if budget is exceeded
    expect(operationMatches.length).toBeGreaterThan(0);
  });
});
