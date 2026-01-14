import { describe, it, expect } from 'vitest';
import type { ClaudeRequest, ClaudeResponse, ClaudeErrorCode, ClaudeError, CLIStatus, AIProvider } from '../types';

describe('AI Types', () => {
  it('ClaudeRequest should have required prompt field', () => {
    const request: ClaudeRequest = { prompt: 'test' };
    expect(request.prompt).toBe('test');
  });

  it('ClaudeRequest should accept optional fields', () => {
    const request: ClaudeRequest = {
      prompt: 'test prompt',
      context: 'some context',
      timeout: 30000,
    };
    expect(request.context).toBe('some context');
    expect(request.timeout).toBe(30000);
  });

  it('ClaudeErrorCode should include expected error types', () => {
    const codes: ClaudeErrorCode[] = ['CLI_NOT_FOUND', 'AUTH_FAILURE', 'RATE_LIMITED', 'TIMEOUT'];
    expect(codes).toHaveLength(4);
  });

  it('ClaudeError should have required fields', () => {
    const error: ClaudeError = {
      code: 'AUTH_FAILURE',
      message: 'Authentication failed',
      retryable: false,
    };
    expect(error.code).toBe('AUTH_FAILURE');
    expect(error.retryable).toBe(false);
  });

  it('ClaudeError should accept optional fields', () => {
    const error: ClaudeError = {
      code: 'RATE_LIMITED',
      message: 'Rate limited',
      retryable: true,
      retryAfterMs: 60000,
      partialContent: 'Some partial output',
      suggestion: 'Wait and retry',
    };
    expect(error.retryAfterMs).toBe(60000);
    expect(error.partialContent).toBe('Some partial output');
  });

  it('CLIStatus should have status field', () => {
    const status: CLIStatus = { status: 'ready', version: '1.0.0' };
    expect(status.status).toBe('ready');
  });

  it('CLIStatus should support all status values', () => {
    const statuses: CLIStatus['status'][] = ['ready', 'not_installed', 'outdated', 'auth_required', 'error'];
    expect(statuses).toHaveLength(5);
  });

  it('ClaudeResponse should have content field', () => {
    const response: ClaudeResponse = { content: 'Generated text' };
    expect(response.content).toBe('Generated text');
  });
});
