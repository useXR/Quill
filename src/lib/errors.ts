/**
 * Custom error classes for application-wide error handling.
 *
 * All errors extend AppError which provides structured error information
 * including error codes, HTTP status codes, and recoverability hints.
 */

export type ErrorCode =
  | 'UNKNOWN_ERROR'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'AI_TIMEOUT'
  | 'VALIDATION_ERROR';

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  /** Machine-readable error code */
  readonly code: ErrorCode;

  /** HTTP status code for API responses */
  readonly statusCode: number;

  /** Whether the operation can be retried */
  readonly recoverable: boolean;

  /** Original error that caused this error, if any */
  readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      statusCode?: number;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.statusCode = options.statusCode ?? 500;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts error to a plain object for serialization.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      recoverable: this.recoverable,
    };
  }
}

/**
 * Network-related errors (connection failures, timeouts, etc.)
 */
export class NetworkError extends AppError {
  constructor(message = 'Network request failed', options: { cause?: Error } = {}) {
    super(message, {
      code: 'NETWORK_ERROR',
      statusCode: 503,
      recoverable: true,
      cause: options.cause,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Authentication and authorization errors.
 */
export class AuthError extends AppError {
  constructor(message = 'Authentication required', options: { cause?: Error } = {}) {
    super(message, {
      code: 'AUTH_ERROR',
      statusCode: 401,
      recoverable: false,
      cause: options.cause,
    });
    this.name = 'AuthError';
  }
}

/**
 * Resource not found errors.
 */
export class NotFoundError extends AppError {
  /** The type of resource that was not found */
  readonly resourceType?: string;

  /** The identifier of the resource */
  readonly resourceId?: string;

  constructor(
    message = 'Resource not found',
    options: { resourceType?: string; resourceId?: string; cause?: Error } = {}
  ) {
    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      recoverable: false,
      cause: options.cause,
    });
    this.name = 'NotFoundError';
    this.resourceType = options.resourceType;
    this.resourceId = options.resourceId;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resourceType: this.resourceType,
      resourceId: this.resourceId,
    };
  }
}

/**
 * AI operation timeout errors.
 */
export class AITimeoutError extends AppError {
  /** The AI operation that timed out */
  readonly operation?: string;

  /** Timeout duration in milliseconds */
  readonly timeoutMs?: number;

  constructor(
    message = 'AI operation timed out',
    options: { operation?: string; timeoutMs?: number; cause?: Error } = {}
  ) {
    super(message, {
      code: 'AI_TIMEOUT',
      statusCode: 504,
      recoverable: true,
      cause: options.cause,
    });
    this.name = 'AITimeoutError';
    this.operation = options.operation;
    this.timeoutMs = options.timeoutMs;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      timeoutMs: this.timeoutMs,
    };
  }
}

/**
 * Input validation errors.
 */
export class ValidationError extends AppError {
  /** Field-specific validation errors */
  readonly fieldErrors?: Record<string, string>;

  constructor(message = 'Validation failed', options: { fieldErrors?: Record<string, string>; cause?: Error } = {}) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      recoverable: true,
      cause: options.cause,
    });
    this.name = 'ValidationError';
    this.fieldErrors = options.fieldErrors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fieldErrors: this.fieldErrors,
    };
  }
}

/**
 * Type guard to check if an error is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Wraps an unknown error in an AppError.
 * If the error is already an AppError, returns it unchanged.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, { cause: error });
  }

  return new AppError(String(error));
}
