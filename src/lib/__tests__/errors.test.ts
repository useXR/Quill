import { describe, it, expect } from 'vitest';
import {
  AppError,
  NetworkError,
  AuthError,
  NotFoundError,
  AITimeoutError,
  ValidationError,
  isAppError,
  toAppError,
} from '../errors';

describe('AppError', () => {
  it('should create an error with default values', () => {
    const error = new AppError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.recoverable).toBe(false);
    expect(error.cause).toBeUndefined();
  });

  it('should create an error with custom values', () => {
    const cause = new Error('Original error');
    const error = new AppError('Custom error', {
      code: 'NETWORK_ERROR',
      statusCode: 503,
      recoverable: true,
      cause,
    });

    expect(error.message).toBe('Custom error');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.statusCode).toBe(503);
    expect(error.recoverable).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it('should serialize to JSON correctly', () => {
    const error = new AppError('Test error', {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      recoverable: true,
    });

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'AppError',
      message: 'Test error',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      recoverable: true,
    });
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('NetworkError', () => {
  it('should create with default message', () => {
    const error = new NetworkError();

    expect(error.message).toBe('Network request failed');
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.statusCode).toBe(503);
    expect(error.recoverable).toBe(true);
  });

  it('should create with custom message and cause', () => {
    const cause = new Error('Connection refused');
    const error = new NetworkError('Failed to connect to server', { cause });

    expect(error.message).toBe('Failed to connect to server');
    expect(error.cause).toBe(cause);
  });

  it('should be an instance of AppError', () => {
    const error = new NetworkError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('AuthError', () => {
  it('should create with default message', () => {
    const error = new AuthError();

    expect(error.message).toBe('Authentication required');
    expect(error.name).toBe('AuthError');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.recoverable).toBe(false);
  });

  it('should create with custom message', () => {
    const error = new AuthError('Session expired');
    expect(error.message).toBe('Session expired');
  });

  it('should be an instance of AppError', () => {
    const error = new AuthError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('NotFoundError', () => {
  it('should create with default message', () => {
    const error = new NotFoundError();

    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.recoverable).toBe(false);
  });

  it('should create with resource details', () => {
    const error = new NotFoundError('Document not found', {
      resourceType: 'document',
      resourceId: '123',
    });

    expect(error.message).toBe('Document not found');
    expect(error.resourceType).toBe('document');
    expect(error.resourceId).toBe('123');
  });

  it('should include resource details in JSON', () => {
    const error = new NotFoundError('Project not found', {
      resourceType: 'project',
      resourceId: 'abc',
    });

    const json = error.toJSON();

    expect(json.resourceType).toBe('project');
    expect(json.resourceId).toBe('abc');
  });

  it('should be an instance of AppError', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('AITimeoutError', () => {
  it('should create with default message', () => {
    const error = new AITimeoutError();

    expect(error.message).toBe('AI operation timed out');
    expect(error.name).toBe('AITimeoutError');
    expect(error.code).toBe('AI_TIMEOUT');
    expect(error.statusCode).toBe(504);
    expect(error.recoverable).toBe(true);
  });

  it('should create with operation details', () => {
    const error = new AITimeoutError('Text generation timed out', {
      operation: 'generateText',
      timeoutMs: 30000,
    });

    expect(error.message).toBe('Text generation timed out');
    expect(error.operation).toBe('generateText');
    expect(error.timeoutMs).toBe(30000);
  });

  it('should include operation details in JSON', () => {
    const error = new AITimeoutError('Timed out', {
      operation: 'summarize',
      timeoutMs: 60000,
    });

    const json = error.toJSON();

    expect(json.operation).toBe('summarize');
    expect(json.timeoutMs).toBe(60000);
  });

  it('should be an instance of AppError', () => {
    const error = new AITimeoutError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('should create with default message', () => {
    const error = new ValidationError();

    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.recoverable).toBe(true);
  });

  it('should create with field errors', () => {
    const error = new ValidationError('Invalid input', {
      fieldErrors: {
        email: 'Invalid email format',
        password: 'Password too short',
      },
    });

    expect(error.message).toBe('Invalid input');
    expect(error.fieldErrors).toEqual({
      email: 'Invalid email format',
      password: 'Password too short',
    });
  });

  it('should include field errors in JSON', () => {
    const error = new ValidationError('Validation failed', {
      fieldErrors: { name: 'Name is required' },
    });

    const json = error.toJSON();

    expect(json.fieldErrors).toEqual({ name: 'Name is required' });
  });

  it('should be an instance of AppError', () => {
    const error = new ValidationError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('isAppError', () => {
  it('should return true for AppError instances', () => {
    expect(isAppError(new AppError('test'))).toBe(true);
    expect(isAppError(new NetworkError())).toBe(true);
    expect(isAppError(new AuthError())).toBe(true);
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new AITimeoutError())).toBe(true);
    expect(isAppError(new ValidationError())).toBe(true);
  });

  it('should return false for non-AppError values', () => {
    expect(isAppError(new Error('test'))).toBe(false);
    expect(isAppError('error')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError({ message: 'test' })).toBe(false);
  });
});

describe('toAppError', () => {
  it('should return AppError unchanged', () => {
    const original = new AppError('test');
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it('should return subclass errors unchanged', () => {
    const network = new NetworkError();
    const auth = new AuthError();

    expect(toAppError(network)).toBe(network);
    expect(toAppError(auth)).toBe(auth);
  });

  it('should wrap Error in AppError', () => {
    const original = new Error('Original message');
    const result = toAppError(original);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Original message');
    expect(result.cause).toBe(original);
  });

  it('should wrap string in AppError', () => {
    const result = toAppError('string error');

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('string error');
  });

  it('should wrap other types in AppError', () => {
    const result = toAppError(42);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('42');
  });
});
