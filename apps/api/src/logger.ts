/**
 * Module-level logger used by helpers that run outside of a Fastify request
 * context (autonomy loop, background sync, side-effect writes).
 *
 * Fastify handlers should prefer `request.log` / `app.log` so log lines are
 * tied to the request. Use this one when that's not available and you'd
 * otherwise silently swallow an error.
 */

type LogLevel = "warn" | "error";

function emit(level: LogLevel, message: string, context: Record<string, unknown>): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    service: "api",
    message,
    ...context
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.warn(line);
  }
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
  }
  return { error: { value: String(error) } };
}

export const logger = {
  warn(message: string, context: Record<string, unknown> = {}): void {
    emit("warn", message, context);
  },
  error(message: string, context: Record<string, unknown> = {}): void {
    emit("error", message, context);
  },
  /** Convenience wrapper used by "best-effort" catch sites that want to record
   * the error without crashing the parent flow. */
  bestEffortFailure(operation: string, error: unknown, context: Record<string, unknown> = {}): void {
    emit("warn", `best-effort operation failed: ${operation}`, {
      ...context,
      ...normalizeError(error)
    });
  }
};
