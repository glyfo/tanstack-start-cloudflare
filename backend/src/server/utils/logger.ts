/**
 * Structured logger for Cloudflare Workers
 *
 * Provides consistent log formatting with context.
 * In production, these go to Cloudflare's logging infrastructure.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug(message: string, context?: LogContext | unknown): void;
  info(message: string, context?: LogContext | unknown): void;
  warn(message: string, context?: LogContext | unknown): void;
  error(message: string, context?: LogContext | unknown): void;
}

/**
 * Serialize error objects properly
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack?.split("\n").slice(0, 3).join("\n"), // First 3 lines only
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return { error: String(error) };
}

function formatLog(
  level: LogLevel,
  component: string,
  message: string,
  context?: LogContext | unknown
): string {
  const timestamp = new Date().toISOString();
  const baseLog = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;

  if (context && typeof context === 'object' && context !== null && Object.keys(context).length > 0) {
    try {
      // Serialize errors properly
      const ctx = context as Record<string, unknown>;
      const serialized = { ...ctx };
      if (serialized.error) {
        serialized.error = serializeError(serialized.error);
      }
      return `${baseLog} ${JSON.stringify(serialized)}`;
    } catch (e) {
      // Fallback for circular references
      return `${baseLog} [Context serialization failed]`;
    }
  }

  return baseLog;
}

/**
 * Create a logger for a specific component
 */
export function createLogger(component: string): Logger {
  return {
    debug(message: string, context?: LogContext | unknown) {
      console.debug(formatLog("debug", component, message, context));
    },
    info(message: string, context?: LogContext | unknown) {
      console.log(formatLog("info", component, message, context));
    },
    warn(message: string, context?: LogContext | unknown) {
      console.warn(formatLog("warn", component, message, context));
    },
    error(message: string, context?: LogContext | unknown) {
      console.error(formatLog("error", component, message, context));
    },
  };
}

// Pre-configured loggers for common components
export const logger = {
  agent: createLogger("ChatAgent"),
  tool: createLogger("ToolExecutor"),
  router: createLogger("IntelligenceRouter"),
  context: createLogger("SmartContext"),
  workflow: createLogger("Workflow"),
  validator: createLogger("ContactValidator"),
};
