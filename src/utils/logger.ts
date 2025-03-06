export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private context: Record<string, unknown> = {};
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'info') {
    this.logLevel = logLevel;
  }

  withContext(context: Record<string, unknown>): Logger {
    const newLogger = new Logger(this.logLevel);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  withRequestId(requestId: string): Logger {
    return this.withContext({ requestId });
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, error?: Error): string {
    const timestamp = new Date().toISOString();
    const context = Object.keys(this.context).length > 0 
      ? ` ${JSON.stringify(this.context)}`
      : '';
    const errorStack = error ? `\n${error.stack}` : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${context}${errorStack}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      const logger = context ? this.withContext(context) : this;
      console.debug(logger.formatMessage('debug', message));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      const logger = context ? this.withContext(context) : this;
      console.info(logger.formatMessage('info', message));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      const logger = context ? this.withContext(context) : this;
      console.warn(logger.formatMessage('warn', message));
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const logger = context ? this.withContext(context) : this;
      console.error(logger.formatMessage('error', message, error));
    }
  }
} 