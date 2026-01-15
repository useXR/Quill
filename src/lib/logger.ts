import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Typed logger for vault operations
export function vaultLogger(context: { userId?: string; itemId?: string; projectId?: string }) {
  return logger.child({ module: 'vault', ...context });
}

// Typed logger for export operations
export function exportLogger(context: { userId?: string; documentId?: string; format?: string }) {
  return logger.child({ module: 'export', ...context });
}
