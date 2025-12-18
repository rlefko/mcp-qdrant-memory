/**
 * Structured Logger for MCP-Qdrant-Memory
 *
 * Features:
 * - 4 log levels: debug, info, warn, error
 * - JSON structured output when LOG_FORMAT=json
 * - Human-readable output otherwise
 * - Log level filtering via LOG_LEVEL env var
 * - Context enrichment with timestamp, module, operation
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  module?: string;
  operation?: string;
  collection?: string;
  duration_ms?: number;
  count?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  module?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | null, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && level in LOG_LEVEL_PRIORITY) {
    return level as LogLevel;
  }
  // Default to 'info' in production, 'debug' in development
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function isJsonFormat(): boolean {
  return process.env.LOG_FORMAT?.toLowerCase() === "json";
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function serializeError(error: Error): LogEntry["error"] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function formatJsonLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function formatHumanLog(entry: LogEntry): string {
  const { timestamp, level, message, module, context, error } = entry;
  const levelUpper = level.toUpperCase().padEnd(5);
  const modulePrefix = module ? `[${module}] ` : "";
  const contextStr =
    context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
  const errorStr = error ? `\n  Error: ${error.message}` : "";
  const stackStr = error?.stack ? `\n  Stack: ${error.stack}` : "";

  return `${timestamp} ${levelUpper} ${modulePrefix}${message}${contextStr}${errorStr}${stackStr}`;
}

function writeLog(entry: LogEntry): void {
  const output = isJsonFormat() ? formatJsonLog(entry) : formatHumanLog(entry);

  // Use stderr for all logs (standard practice for CLI tools)
  // This keeps stdout clean for actual MCP protocol messages
  console.error(output);
}

export function createLogger(defaultModule?: string): Logger {
  const createLogFn =
    (level: LogLevel) =>
    (
      message: string,
      errorOrContext?: Error | LogContext | null,
      maybeContext?: LogContext
    ): void => {
      if (!shouldLog(level)) return;

      // Handle overloaded signatures
      let error: Error | undefined;
      let context: LogContext | undefined;

      if (errorOrContext instanceof Error) {
        error = errorOrContext;
        context = maybeContext;
      } else if (errorOrContext !== null && errorOrContext !== undefined) {
        context = errorOrContext;
      }

      const { module: contextModule, ...restContext } = context || {};

      const entry: LogEntry = {
        timestamp: formatTimestamp(),
        level,
        message,
        module: contextModule || defaultModule,
      };

      if (Object.keys(restContext).length > 0) {
        entry.context = restContext;
      }

      if (error) {
        entry.error = serializeError(error);
      }

      writeLog(entry);
    };

  const logger: Logger = {
    debug: (message: string, context?: LogContext) => createLogFn("debug")(message, context),
    info: (message: string, context?: LogContext) => createLogFn("info")(message, context),
    warn: (message: string, context?: LogContext) => createLogFn("warn")(message, context),
    error: (message: string, error?: Error | null, context?: LogContext) =>
      createLogFn("error")(message, error, context),
    child: (childContext: LogContext): Logger => {
      const childModule = childContext.module || defaultModule;
      const childLogger = createLogger(childModule);
      // Merge parent context with child context for all future calls
      const originalDebug = childLogger.debug.bind(childLogger);
      const originalInfo = childLogger.info.bind(childLogger);
      const originalWarn = childLogger.warn.bind(childLogger);
      const originalError = childLogger.error.bind(childLogger);

      childLogger.debug = (message: string, context?: LogContext) =>
        originalDebug(message, { ...childContext, ...context });
      childLogger.info = (message: string, context?: LogContext) =>
        originalInfo(message, { ...childContext, ...context });
      childLogger.warn = (message: string, context?: LogContext) =>
        originalWarn(message, { ...childContext, ...context });
      childLogger.error = (message: string, error?: Error | null, context?: LogContext) =>
        originalError(message, error, { ...childContext, ...context });

      return childLogger;
    },
  };

  return logger;
}

// Default logger instance for the MCP server
export const logger = createLogger("mcp-qdrant-memory");

// Module-specific loggers (pre-configured for common modules)
export const qdrantLogger = createLogger("qdrant");
export const bm25Logger = createLogger("bm25");
export const validationLogger = createLogger("validation");
export const planModeLogger = createLogger("plan-mode");
export const shutdownLogger = createLogger("shutdown");
export const configLogger = createLogger("config");
export const ignoreFilterLogger = createLogger("ignore-filter");
